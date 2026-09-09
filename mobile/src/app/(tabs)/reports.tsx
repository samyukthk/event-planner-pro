import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, Report } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, Chip, EmptyState, Input, Screen, SectionTitle } from '@/components/ui';
import { PullRefresh } from '@/components/gestures';
import { openOrShare } from '@/lib/files';
import { colors, font, radius, spacing } from '@/lib/theme';
import { addDaysISO, money, todayISO } from '@/lib/format';

type RangeKey = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export default function ReportsScreen() {
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>('monthly');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const query = useMemo(() => {
    const today = new Date();
    switch (range) {
      case 'daily':
        return { range: 'daily' };
      case 'weekly': {
        const day = today.getDay() || 7;
        return { range: 'custom', from: addDaysISO(new Date(today.getTime() - (day - 1) * 86400000), 0), to: addDaysISO(today, 6 - day) };
      }
      case 'yearly':
        return { range: 'yearly' };
      case 'custom': {
        const q: Record<string, string> = { range: 'custom' };
        if (/^\d{4}-\d{2}-\d{2}$/.test(customFrom)) q.from = customFrom;
        if (/^\d{4}-\d{2}-\d{2}$/.test(customTo)) q.to = customTo;
        return q;
      }
      default:
        return { range: 'monthly' };
    }
  }, [range, customFrom, customTo]);

  const load = useCallback(async () => {
    try {
      const res = await api.reports(query);
      setReport(res);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  const downloadPdf = useCallback(() => {
    const f = customFrom || new Date().toISOString().slice(0, 10);
    const t = customTo || new Date().toISOString().slice(0, 10);
    openOrShare(api.reportsPdfUrl(query), `report-${f}-to-${t}.pdf`);
  }, [query, customFrom, customTo]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (user?.role !== 'admin') {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Admins only" subtitle="Reports are available to admins" />
      </Screen>
    );
  }

  const s = report?.summary;

  return (
    <PullRefresh onRefresh={() => { setRefreshing(true); load(); }} refreshing={refreshing}>
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={styles.chips}>
        {([
          ['daily', 'Today'],
          ['weekly', 'This Week'],
          ['monthly', 'This Month'],
          ['yearly', 'This Year'],
          ['custom', 'Custom'],
        ] as [RangeKey, string][]).map(([key, label]) => (
          <Chip key={key} label={label} active={range === key} onPress={() => setRange(key)} />
        ))}
      </View>

      {range === 'custom' ? (
        <View style={styles.customRow}>
          <Input label="From" value={customFrom} onChangeText={setCustomFrom} placeholder="2026-01-01" style={{ flex: 1, marginRight: spacing.sm }} />
          <Input label="To" value={customTo} onChangeText={setCustomTo} placeholder="2026-12-31" style={{ flex: 1 }} />
        </View>
      ) : null}

      {loading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : report ? (
        <>
          <View style={styles.downloadRow}>
            <Pressable onPress={downloadPdf} style={({ pressed }) => [styles.downloadBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="download-outline" size={16} color="#fff" />
              <Text style={styles.downloadBtnText}>Download PDF</Text>
            </Pressable>
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.successLight }]}>
              <Text style={[styles.summaryValue, { color: colors.success }]}>{money(s?.income)}</Text>
              <Text style={styles.summaryLabel}>Income</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.dangerLight }]}>
              <Text style={[styles.summaryValue, { color: colors.danger }]}>{money(s?.expense)}</Text>
              <Text style={styles.summaryLabel}>Expense</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{money(s?.profit)}</Text>
              <Text style={styles.summaryLabel}>Profit</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.warningLight }]}>
              <Text style={[styles.summaryValue, { color: colors.warning }]}>{money(s?.payments)}</Text>
              <Text style={styles.summaryLabel}>Paid to staff</Text>
            </View>
          </View>
          <Text style={styles.period}>
            {report.from} → {report.to} • {s?.works} completed work(s)
            {s?.payment_count ? ` • ${s.payment_count} staff payment(s)` : ''}
          </Text>

          <SectionTitle>Breakdown</SectionTitle>
          {report.rows.length === 0 ? (
            <EmptyState icon="stats-chart-outline" title="No activity in this period" subtitle="Closed works and staff payments will appear here" />
          ) : (
            report.rows.map((r) => (
              <Card key={r.key} style={{ paddingVertical: spacing.md }}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowKey}>{r.key}</Text>
                  <Text style={styles.rowWorks}>
                    {r.works} work{r.works > 1 ? 's' : ''}
                    {r.payment_count ? ` • ${r.payment_count} payment${r.payment_count > 1 ? 's' : ''}` : ''}
                  </Text>
                </View>
                <View style={styles.rowStats}>
                  <Text style={[styles.rowStat, { color: colors.success }]}>+{money(r.income)}</Text>
                  <Text style={[styles.rowStat, { color: colors.danger }]}>-{money(r.expense)}</Text>
                  <Text style={[styles.rowStat, { color: colors.primary, fontWeight: '800' }]}>{money(r.profit)}</Text>
                </View>
                {r.payment_count > 0 ? (
                  <View style={styles.rowPayments}>
                    <Ionicons name="cash-outline" size={13} color={colors.warning} />
                    <Text style={styles.rowPaymentsText}>
                      Paid to staff {money(r.payments)} ({r.payment_count} payment{r.payment_count > 1 ? 's' : ''})
                    </Text>
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </>
      ) : null}
    </Screen>
    </PullRefresh>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  customRow: { flexDirection: 'row', marginTop: spacing.sm },
  downloadRow: { marginTop: spacing.md, alignItems: 'flex-start' },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  downloadBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  summaryCard: { flex: 1, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  summaryValue: { fontSize: font.md, fontWeight: '900' },
  summaryLabel: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  period: { fontSize: font.xs, color: colors.muted, marginTop: spacing.sm, textAlign: 'center' },
  muted: { color: colors.muted, fontSize: font.sm },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowKey: { fontSize: font.md, fontWeight: '800', color: colors.text },
  rowWorks: { fontSize: font.xs, color: colors.muted },
  rowStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  rowStat: { fontSize: font.sm, fontWeight: '600' },
  rowPayments: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  rowPaymentsText: { fontSize: font.xs, color: colors.warning, fontWeight: '700' },
});