import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api, User } from '@/lib/api';
import { Avatar, Button, Card, Chip, Input, SectionTitle } from '@/components/ui';
import { BottomSheet } from '@/components/bottom-sheet';
import { colors, font, spacing } from '@/lib/theme';
import { todayISO } from '@/lib/format';

const DEFAULTS = {
  title: '',
  description: '',
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  venue: '',
  startTime: '09:00',
  reminderTime: '08:00',
};

/**
 * “Assign New Work” form presented as an iOS-style bottom sheet (opened from
 * the admin dashboard). Calls `onCreated` once the work is saved so the caller
 * can refresh its lists.
 */
export function AssignWorkSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(DEFAULTS.title);
  const [description, setDescription] = useState(DEFAULTS.description);
  const [clientName, setClientName] = useState(DEFAULTS.clientName);
  const [clientPhone, setClientPhone] = useState(DEFAULTS.clientPhone);
  const [clientEmail, setClientEmail] = useState(DEFAULTS.clientEmail);
  const [venue, setVenue] = useState(DEFAULTS.venue);
  const [workDate, setWorkDate] = useState(todayISO());
  const [startTime, setStartTime] = useState(DEFAULTS.startTime);
  const [reminderTime, setReminderTime] = useState(DEFAULTS.reminderTime);

  // Fresh state + employee list every time the sheet is opened.
  useEffect(() => {
    if (!visible) return;
    setTitle(DEFAULTS.title);
    setDescription(DEFAULTS.description);
    setClientName(DEFAULTS.clientName);
    setClientPhone(DEFAULTS.clientPhone);
    setClientEmail(DEFAULTS.clientEmail);
    setVenue(DEFAULTS.venue);
    setWorkDate(todayISO());
    setStartTime(DEFAULTS.startTime);
    setReminderTime(DEFAULTS.reminderTime);
    setSelected([]);
    api
      .users()
      .then((res) => setUsers(res.users.filter((u) => u.role === 'employee')))
      .catch(() => setUsers([]));
  }, [visible]);

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const validate = (): string | null => {
    if (!title.trim()) return 'Work title is required';
    if (!clientName.trim()) return 'Client name is required';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return 'Work date must be YYYY-MM-DD';
    if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) return 'Start time must be HH:MM (24h)';
    if (reminderTime && !/^\d{2}:\d{2}$/.test(reminderTime)) return 'Reminder time must be HH:MM (24h)';
    if (selected.length === 0) return 'Assign at least one employee';
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      Alert.alert('Check the form', problem);
      return;
    }
    setSaving(true);
    try {
      await api.createWork({
        title,
        description: description || undefined,
        client_name: clientName,
        client_phone: clientPhone || undefined,
        client_email: clientEmail || undefined,
        venue: venue || undefined,
        work_date: workDate,
        start_time: startTime || undefined,
        reminder_time: reminderTime || undefined,
        assignee_ids: selected,
      });
      setSaving(false);
      onClose();
      onCreated?.();
      Alert.alert('Work assigned', 'The work was created and reminders are set.');
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Failed', e?.message || 'Could not create the work');
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Assign New Work"
      footer={
        <Button title="Create & Assign Work" icon="checkmark-circle" onPress={save} loading={saving} />
      }
    >
      <SectionTitle>Work details</SectionTitle>
      <Card>
        <Input label="Work title *" value={title} onChangeText={setTitle} placeholder="e.g. Wedding stage decoration" />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What needs to be done"
          multiline
          numberOfLines={3}
        />
        <Input label="Venue" value={venue} onChangeText={setVenue} placeholder="e.g. Grand Palace, Mumbai" />
      </Card>

      <SectionTitle>Client</SectionTitle>
      <Card>
        <Input label="Client name *" value={clientName} onChangeText={setClientName} placeholder="e.g. Mr. Mehta" />
        <Input label="Client phone" value={clientPhone} onChangeText={setClientPhone} placeholder="+91 …" keyboardType="phone-pad" />
        <Input
          label="Client email"
          value={clientEmail}
          onChangeText={setClientEmail}
          placeholder="client@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Card>

      <SectionTitle>Schedule & reminders</SectionTitle>
      <Card>
        <Input label="Work date (YYYY-MM-DD) *" value={workDate} onChangeText={setWorkDate} placeholder="2026-09-10" />
        <Input label="Start time (HH:MM)" value={startTime} onChangeText={setStartTime} placeholder="09:00" />
        <Input label="Reminder time on work day (HH:MM)" value={reminderTime} onChangeText={setReminderTime} placeholder="08:00" />
        <Text style={styles.hint}>Employees get an alarm one day before and on the work day at the reminder time.</Text>
      </Card>

      <SectionTitle>Assign employees ({selected.length})</SectionTitle>
      <Card>
        {users.length === 0 ? (
          <Text style={styles.hint}>No employees found. Add team members first (Team tab).</Text>
        ) : (
          <View style={styles.chips}>
            {users.map((u) => (
              <Chip key={u.id} label={u.name} active={selected.includes(u.id)} onPress={() => toggle(u.id)} />
            ))}
          </View>
        )}
        {selected.length > 0 ? (
          <View style={{ marginTop: spacing.sm }}>
            {selected.map((id) => {
              const u = users.find((x) => x.id === id);
              return u ? (
                <View key={id} style={styles.selectedRow}>
                  <Avatar name={u.name} size={22} />
                  <Text style={styles.selectedName}>{u.name}</Text>
                </View>
              ) : null;
            })}
          </View>
        ) : null}
      </Card>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: font.xs, color: colors.muted, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  selectedRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  selectedName: { marginLeft: spacing.sm, fontSize: font.sm, fontWeight: '600', color: colors.text },
});
