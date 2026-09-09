import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Work } from '@/lib/api';
import { colors, font, radius, spacing } from '@/lib/theme';
import { formatDate, weekday } from '@/lib/format';
import { Avatar, Badge } from './ui';

export function WorkCard({ work, onPress }: { work: Work; onPress?: () => void }) {
  const done = work.status === 'completed';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={styles.topRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {work.title}
          </Text>
          <Text style={styles.client} numberOfLines={1}>
            {work.client_name}
          </Text>
        </View>
        <Badge text={done ? 'Completed' : 'Upcoming'} tone={done ? 'success' : 'warning'} />
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={14} color={colors.muted} />
        <Text style={styles.meta}>
          {weekday(work.work_date)}, {formatDate(work.work_date)}
          {work.start_time ? ` • ${work.start_time}` : ''}
        </Text>
      </View>
      {work.venue ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={colors.muted} />
          <Text style={styles.meta} numberOfLines={1}>
            {work.venue}
          </Text>
        </View>
      ) : null}
      {work.coworker_names ? (
        <View style={styles.coworkers}>
          <Ionicons name="people-outline" size={14} color={colors.muted} style={{ marginRight: 6 }} />
          {work.assignees?.length ? (
            <View style={{ flexDirection: 'row' }}>
              {work.assignees.slice(0, 4).map((a) => (
                <View key={a.id} style={{ marginRight: -8 }}>
                  <Avatar name={a.name} size={24} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.meta} numberOfLines={1}>
              {work.coworker_names}
            </Text>
          )}
          <Text style={[styles.meta, { marginLeft: 12 }]} numberOfLines={1}>
            {work.assignees?.length ? `${work.assignees.length} member${work.assignees.length > 1 ? 's' : ''}` : ''}
          </Text>
        </View>
      ) : null}
      {(work.documents?.length ?? 0) > 0 ? (
        <View style={styles.metaRow}>
          <Ionicons name="attach-outline" size={14} color={colors.muted} />
          <Text style={styles.meta}>{work.documents!.length} document(s)</Text>
        </View>
      ) : null}

      {done && work.payment_amount !== null ? (
        <View style={styles.paymentRow}>
          <Text style={styles.paid}>Paid: {work.payment_amount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  titleWrap: { flex: 1, marginRight: spacing.md },
  title: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  client: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  meta: { fontSize: font.sm, color: colors.muted, marginLeft: 6, flexShrink: 1 },
  coworkers: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  paymentRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  paid: { fontSize: font.sm, fontWeight: '700', color: colors.success },
});