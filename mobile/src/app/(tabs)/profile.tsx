import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { remindersSupported } from '@/lib/notifications';
import { Avatar, Badge, Button, Card, InfoRow, Screen } from '@/components/ui';
import { colors, font, spacing } from '@/lib/theme';
import { formatDate } from '@/lib/format';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar name={user.name} size={72} />
        <Text style={styles.name}>{user.name}</Text>
        <Badge text={user.role === 'admin' ? 'Administrator' : 'Employee'} tone={user.role === 'admin' ? 'info' : 'muted'} />
      </View>

      <Card>
        <InfoRow icon="mail-outline" label="Email" value={user.email} />
        <InfoRow icon="call-outline" label="Phone" value={user.phone || '—'} />
        <InfoRow icon="calendar-outline" label="Joined" value={formatDate(user.created_at)} />
      </Card>

      <Card>
        <View style={styles.notifRow}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.notifTitle}>Work reminders</Text>
            <Text style={styles.notifText}>
              {remindersSupported()
                ? 'Alarms are scheduled on this device for works assigned to you — one day before and on the work day.'
                : 'Local alarms are only available in the mobile app. On the web, reminders appear in the work details.'}
            </Text>
          </View>
        </View>
      </Card>

      <Button title="Sign Out" variant="danger" icon="log-out-outline" onPress={() => logout()} />
      <Text style={styles.version}>Event Planner Pro v1.0.0</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginVertical: spacing.xl },
  name: { fontSize: font.xxl, fontWeight: '900', color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start' },
  notifTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  notifText: { fontSize: font.sm, color: colors.muted, marginTop: 4, lineHeight: 19 },
  version: { textAlign: 'center', color: '#94a3b8', fontSize: font.xs, marginTop: spacing.xl },
});