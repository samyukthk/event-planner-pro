import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Work } from '@/lib/api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { syncReminders } from '@/lib/notifications';
import { Avatar, Badge, Button, Card, EmptyState, SectionTitle } from '@/components/ui';
import { WorkCard } from '@/components/work-card';
import { AssignWorkSheet } from '@/components/assign-work-sheet';
import { PullRefresh } from '@/components/gestures';
import { colors, font, spacing } from '@/lib/theme';
import { formatDate, todayISO } from '@/lib/format';

export default function DashboardScreen() {
  const { user } = useAuth();
  const [works, setWorks] = useState<Work[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.works();
      setWorks(res.works);
      syncReminders(res.works).catch(() => {});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const today = todayISO();
  const upcoming = works
    .filter((w) => w.status === 'assigned' && w.work_date >= today)
    .sort((a, b) => (a.work_date < b.work_date ? -1 : 1));
  const completed = works
    .filter((w) => w.status === 'completed')
    .sort((a, b) => ((a.completed_at || '') < (b.completed_at || '') ? 1 : -1))
    .slice(0, 3);

  const next = upcoming[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const isAdmin = user?.role === 'admin';

  return (
    <>
    <PullRefresh onRefresh={() => { setRefreshing(true); load(); }} refreshing={refreshing}>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>
            {greeting}, {user?.name?.split(' ')[0]} 👋
          </Text>
          <Text style={styles.sub}>Here's your work overview</Text>
        </View>
        <Avatar name={user?.name} size={44} />
      </View>

      {next ? (
        <Card style={styles.nextCard}>
          <View style={styles.nextHeader}>
            <Badge text="Next up" tone="warning" />
            <Text style={styles.nextDate}>{formatDate(next.work_date)}</Text>
          </View>
          <Text style={styles.nextTitle}>{next.title}</Text>
          {next.venue ? (
            <View style={styles.nextRow}>
              <Ionicons name="location-outline" size={14} color="#fff" />
              <Text style={styles.nextText}>{next.venue}</Text>
            </View>
          ) : null}
          <View style={styles.nextRow}>
            <Ionicons name="time-outline" size={14} color="#fff" />
            <Text style={styles.nextText}>{next.start_time || 'Time TBD'}</Text>
          </View>
          <Button
            title="View Details"
            variant="ghost"
            style={{ marginTop: spacing.md, borderColor: 'rgba(255,255,255,0.5)' }}
            onPress={() => router.push(`/work/${next.id}`)}
          />
        </Card>
      ) : (
        <Card>
          <Text style={styles.noNext}>No upcoming work. Enjoy the break! 🎉</Text>
        </Card>
      )}

      {isAdmin ? (
        <Button title="Assign New Work" icon="add-circle" onPress={() => setShowAssign(true)} style={{ marginBottom: spacing.xs }} />
      ) : null}

      <SectionTitle>Upcoming ({upcoming.length})</SectionTitle>
      {loading ? <Text style={styles.muted}>Loading…</Text> : upcoming.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Nothing scheduled" subtitle="New works assigned to you will appear here" />
      ) : (
        upcoming.slice(0, 5).map((w) => <WorkCard key={w.id} work={w} onPress={() => router.push(`/work/${w.id}`)} />)
      )}

      {completed.length > 0 ? (
        <>
          <SectionTitle>Recently Completed</SectionTitle>
          {completed.map((w) => (
            <WorkCard key={w.id} work={w} onPress={() => router.push(`/work/${w.id}`)} />
          ))}
        </>
      ) : null}
    </ScrollView>
    </PullRefresh>
      <AssignWorkSheet visible={showAssign} onClose={() => setShowAssign(false)} onCreated={load} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { fontSize: font.xl, fontWeight: '900', color: colors.text },
  sub: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  nextCard: { backgroundColor: colors.primary, borderColor: colors.primary },
  nextHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  nextDate: { color: '#c7d2fe', fontSize: font.sm, fontWeight: '700' },
  nextTitle: { color: '#fff', fontSize: font.xl, fontWeight: '900', marginBottom: spacing.sm },
  nextRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  nextText: { color: '#e0e7ff', fontSize: font.sm, marginLeft: 6 },
  noNext: { fontSize: font.md, color: colors.muted, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: font.sm },
});