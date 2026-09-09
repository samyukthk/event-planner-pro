import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, Quotation } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { openOrShare } from '@/lib/files';
import { Button, Card, EmptyState, Screen } from '@/components/ui';
import { PullRefresh } from '@/components/gestures';
import { colors, font, radius, spacing } from '@/lib/theme';
import { formatDate, money } from '@/lib/format';

export default function QuotationsScreen() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.quotations();
      setQuotations(res.quotations);
    } catch {
      /* ignore */
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

  if (user?.role !== 'admin') {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Admins only" subtitle="Quotations are created by admins" />
      </Screen>
    );
  }

  const sendWhatsApp = async (q: Quotation) => {
    try {
      const res = await api.quotationWhatsApp(q.id);
      await Linking.openURL(res.url);
    } catch (e: any) {
      Alert.alert('Cannot open WhatsApp', e?.message || 'Make sure the quotation has a client phone number');
    }
  };

  return (
    <PullRefresh onRefresh={() => { setRefreshing(true); load(); }} refreshing={refreshing}>
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Button title="New Quotation" icon="add-circle" onPress={() => router.push('/quotation/new')} style={{ marginBottom: spacing.md }} />

      {loading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : quotations.length === 0 ? (
        <EmptyState icon="document-text-outline" title="No quotations yet" subtitle="Create your first quotation for a client" />
      ) : (
        quotations.map((q) => (
          <Card key={q.id}>
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.number}>{q.quotation_number}</Text>
                <Text style={styles.client}>{q.client_name}</Text>
                <Text style={styles.meta}>
                  {q.event_name || 'Event'} • {formatDate(q.event_date)}
                </Text>
              </View>
              <Text style={styles.total}>{money(q.total)}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable style={styles.actionBtn} onPress={() => openOrShare(api.quotationPdfUrl(q.id), `${q.quotation_number}.pdf`)}>
                <Ionicons name="download-outline" size={17} color={colors.primary} />
                <Text style={styles.actionText}>PDF</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: '#e9f9f0' }]} onPress={() => sendWhatsApp(q)}>
                <Ionicons name="logo-whatsapp" size={17} color="#128c4b" />
                <Text style={[styles.actionText, { color: '#128c4b' }]}>WhatsApp</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </Screen>
    </PullRefresh>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted, fontSize: font.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  number: { fontSize: font.md, fontWeight: '900', color: colors.primary },
  client: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginTop: 2 },
  meta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  total: { fontSize: font.lg, fontWeight: '900', color: colors.text },
  actions: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },
  actionText: { marginLeft: 6, fontSize: font.sm, fontWeight: '700', color: colors.primary },
});