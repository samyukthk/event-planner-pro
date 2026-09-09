import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Work } from './api';
import { getItem, setItem } from './storage';

const SCHEDULED_KEY = 'ep_scheduled_reminders'; // { [key: `${workId}:${kind}`]: string notificationId }
const CHANNEL_ID = 'work-reminders';

export type ReminderKind = 'day_before' | 'on_day';

export function remindersSupported(): boolean {
  return Platform.OS !== 'web';
}

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Work reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported()) return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Local datetime strings like "2026-09-08T09:00:00" are parsed in local time. */
function toDate(localDt: string | null | undefined): Date | null {
  if (!localDt) return null;
  const d = new Date(localDt);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Schedule (or refresh) local reminder alarms for a list of works.
 * Runs on the user's own device, so every assigned employee gets their alarms.
 * Completed/past works get their alarms cancelled.
 */
export async function syncReminders(works: Work[]): Promise<void> {
  if (!remindersSupported()) return;
  const granted = await ensurePermission();
  if (!granted) return;

  const scheduled = (await getItem<Record<string, string>>(SCHEDULED_KEY)) || {};
  const next: Record<string, string> = { ...scheduled };
  const now = Date.now();

  const schedule = async (key: string, at: Date, title: string, body: string) => {
    if (at.getTime() <= now) return;
    if (next[key]) return; // already scheduled
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { reminder: key } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
    next[key] = id;
  };

  for (const work of works) {
    const label = `${work.title} — ${work.venue || work.client_name}`;
    if (work.status === 'completed') {
      await cancelIfScheduled(next, `${work.id}:day_before`);
      await cancelIfScheduled(next, `${work.id}:on_day`);
      continue;
    }
    const dayBefore = toDate(work.reminder_day_before_at);
    const onDay = toDate(work.reminder_at);
    if (dayBefore) await schedule(`${work.id}:day_before`, dayBefore, 'Work reminder: tomorrow', `"${label}" is tomorrow. Be prepared!`);
    if (onDay) await schedule(`${work.id}:on_day`, onDay, 'Work reminder: today', `"${label}" is today. Time to go!`);
  }

  await setItem(SCHEDULED_KEY, next);
}

async function cancelIfScheduled(store: Record<string, string>, key: string) {
  const id = store[key];
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* ignore */
  }
  delete store[key];
}