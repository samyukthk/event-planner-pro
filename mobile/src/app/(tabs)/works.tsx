import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Work } from '@/lib/api';
import { api } from '@/lib/api';
import { Chip, EmptyState, Input, Screen, SectionTitle } from '@/components/ui';
import { WorkCard } from '@/components/work-card';
import { PullRefresh } from '@/components/gestures';
import { colors, font, spacing } from '@/lib/theme';
import { addDaysISO, todayISO } from '@/lib/format';

type QuickRange = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

function rangeFor(q: QuickRange): { from?: string; to?: string } {
  const today = new Date();
  const todayStr = todayISO();
  switch (q) {
    case 'today':
      return { from: todayStr, to: todayStr };
    case 'week': {
      const day = today.getDay() || 7; // Mon start
      const monday = addDaysISO(new Date(today.getTime() - (day - 1) * 86400000), 0);
      return { from: monday, to: addDaysISO(today, 6 - day) };
    }
    case 'month': {
      const first = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      return { from: first, to: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()}` };
    }
    case 'year':
      return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
    default:
      return {};
  }
}

export default function WorksScreen() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quick, setQuick] = useState<QuickRange>('all');
  const [status, setStatus] = useState<'all' | 'assigned' | 'completed'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const query = useMemo(() => {
    const q: Record<string, string> = {};
    if (status !== 'all') q.status = status;
    if (quick === 'custom') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(customFrom)) q.from = customFrom;
      if (/^\d{4}-\d{2}-\d{2}$/.test(customTo)) q.to = customTo;
    } else {
      const r = rangeFor(quick);
      if (r.from) q.from = r.from;
      if (r.to) q.to = r.to;
    }
    return q;
  }, [quick, status, customFrom, customTo]);

  const load = useCallback(async () => {
    try {
      const res = await api.works(query);
      setWorks(res.works);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  return (
    <PullRefresh onRefresh={() => { setRefreshing(true); load(); }} refreshing={refreshing}>
    <Screen scroll>
      <View style={styles.chips}>
        {(['all', 'today', 'week', 'month', 'year', 'custom'] as QuickRange[]).map((r) => (
          <Chip key={r} label={{ all: 'All', today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', custom: 'Custom' }[r]} active={quick === r} onPress={() => setQuick(r)} />
        ))}
      </View>
      <View style={styles.chips}>
        {(['all', 'assigned', 'completed'] as const).map((s) => (
          <Chip key={s} label={s === 'all' ? 'All status' : s === 'assigned' ? 'Upcoming' : 'Completed'} active={status === s} onPress={() => setStatus(s)} />
        ))}
      </View>

      {quick === 'custom' ? (
        <View style={styles.customRow}>
          <Input label="From (YYYY-MM-DD)" value={customFrom} onChangeText={setCustomFrom} placeholder="2026-01-01" style={{ flex: 1, marginRight: spacing.sm }} />
          <Input label="To (YYYY-MM-DD)" value={customTo} onChangeText={setCustomTo} placeholder="2026-12-31" style={{ flex: 1 }} />
        </View>
      ) : null}

      <SectionTitle>
        {works.length} work{works.length === 1 ? '' : 's'} found
      </SectionTitle>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : works.length === 0 ? (
          <EmptyState icon="file-tray-outline" title="No works found" subtitle="Try changing the filters" />
        ) : (
          works.map((w) => <WorkCard key={w.id} work={w} onPress={() => router.push(`/work/${w.id}`)} />)
        )}
      </ScrollView>
    </Screen>
    </PullRefresh>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  customRow: { flexDirection: 'row', marginTop: spacing.sm },
  muted: { color: colors.muted, fontSize: font.sm },
});