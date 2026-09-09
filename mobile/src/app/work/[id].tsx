import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { api, Work } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { openOrShare } from '@/lib/files';
import { Avatar, Badge, Button, Card, EmptyState, InfoRow, Input, SectionTitle } from '@/components/ui';
import { BottomSheet } from '@/components/bottom-sheet';
import { PullRefresh, SwipeBackView } from '@/components/gestures';
import { colors, font, radius, spacing } from '@/lib/theme';
import { formatDate, formatDateTime, money, weekday } from '@/lib/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WorkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [work, setWork] = useState<Work | null>(null);
  const [error, setError] = useState('');

  const [payment, setPayment] = useState('');
  const [expense, setExpense] = useState('');
  const [notes, setNotes] = useState('');
  const [closing, setClosing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      const res = await api.work(Number(id));
      setWork(res.work);
    } catch (e: any) {
      setError(e?.message || 'Failed to load work');
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Retry" onPress={load} style={{ marginTop: spacing.md }} />
      </View>
    );
  }
  if (!work) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const isAdmin = user?.role === 'admin';
  const done = work.status === 'completed';

  const closeWork = async () => {
    const paymentAmount = Number(payment);
    const expenseAmount = Number(expense);
    if (Number.isNaN(paymentAmount) || paymentAmount < 0 || Number.isNaN(expenseAmount) || expenseAmount < 0) {
      Alert.alert('Invalid amounts', 'Enter valid payment and expense amounts');
      return;
    }
    setClosing(true);
    try {
      const res = await api.completeWork(work.id, {
        payment_amount: paymentAmount,
        expense_amount: expenseAmount,
        payment_notes: notes,
      });
      setWork(res.work);
      setSheetOpen(false);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not close the work');
    } finally {
      setClosing(false);
    }
  };

  const pickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      const files = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name || `document-${Date.now()}`,
        type: a.mimeType || 'application/octet-stream',
      }));
      setUploading(true);
      const res = await api.uploadDocuments(work.id, files);
      setWork(res.work);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Could not upload documents');
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = (docId: number) => {
    Alert.alert('Delete document?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.deleteDocument(work.id, docId);
          load();
        },
      },
    ]);
  };

  return (
    <SwipeBackView>
    <PullRefresh onRefresh={refresh} refreshing={refreshing}>
    <View style={styles.screen}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Card>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{work.title}</Text>
            <Text style={styles.client}>Client: {work.client_name}</Text>
          </View>
          <Badge text={done ? 'Completed' : 'Upcoming'} tone={done ? 'success' : 'warning'} />
        </View>
        {work.description ? <Text style={styles.description}>{work.description}</Text> : null}
        <InfoRow icon="calendar-outline" label="Date" value={`${weekday(work.work_date)}, ${formatDate(work.work_date)}`} />
        <InfoRow icon="time-outline" label="Start time" value={work.start_time || '—'} />
        <InfoRow icon="location-outline" label="Venue" value={work.venue || '—'} />
        <InfoRow icon="call-outline" label="Client phone" value={work.client_phone || '—'} />
        <InfoRow icon="mail-outline" label="Client email" value={work.client_email || '—'} />
      </Card>

      <SectionTitle>Reminders</SectionTitle>
      <Card>
        <InfoRow icon="alarm-outline" label="One day before" value={formatDateTime(work.reminder_day_before_at)} />
        <InfoRow icon="alarm-outline" label="On the day" value={formatDateTime(work.reminder_at)} />
        <Text style={styles.hint}>Alarms fire on your phone automatically for works assigned to you.</Text>
      </Card>

      <SectionTitle>Coworkers ({work.assignees?.length || 0})</SectionTitle>
      {work.assignees?.length ? (
        <Card>
          {work.assignees.map((a) => (
            <View key={a.id} style={styles.member}>
              <Avatar name={a.name} size={36} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.memberName}>{a.name}</Text>
                <Text style={styles.memberRole}>{a.role === 'admin' ? 'Admin' : 'Employee'}</Text>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <Text style={styles.hint}>No coworkers assigned yet.</Text>
        </Card>
      )}

      <SectionTitle>Documents ({work.documents?.length || 0})</SectionTitle>
      <Card>
        {work.documents?.length ? (
          work.documents.map((d) => (
            <View key={d.id} style={styles.docRow}>
              <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
              <Text style={styles.docName} numberOfLines={1}>
                {d.original_name || d.filename}
              </Text>
              <Pressable onPress={() => openOrShare(api.documentUrl(d.filename), d.original_name || d.filename)} style={styles.docAction}>
                <Ionicons name="download-outline" size={20} color={colors.primary} />
              </Pressable>
              {isAdmin ? (
                <Pressable onPress={() => deleteDoc(d.id)} style={styles.docAction}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.hint}>No documents attached.</Text>
        )}
        {isAdmin ? (
          <Button title="Upload Documents" icon="cloud-upload-outline" variant="secondary" onPress={pickAndUpload} loading={uploading} style={{ marginTop: spacing.md }} />
        ) : null}
      </Card>

      {done ? (
        <>
          <SectionTitle>Payment Summary</SectionTitle>
          <Card>
            <InfoRow icon="cash-outline" label="Received" value={money(work.payment_amount)} />
            <InfoRow icon="wallet-outline" label="Expenses" value={money(work.expense_amount)} />
            <InfoRow
              icon="trending-up-outline"
              label="Profit"
              value={money((work.payment_amount || 0) - (work.expense_amount || 0))}
            />
            {work.payment_notes ? <Text style={styles.hint}>{work.payment_notes}</Text> : null}
            <Text style={styles.hint}>Completed on {formatDateTime(work.completed_at)}</Text>
          </Card>
        </>
      ) : null}
    </ScrollView>

    {isAdmin && !done ? (
      <View style={[styles.footerBar, { paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
        <Button title="Complete Work" icon="checkmark-circle" variant="success" onPress={() => setSheetOpen(true)} />
      </View>
    ) : null}

    <BottomSheet
      visible={sheetOpen}
      onClose={() => setSheetOpen(false)}
      title="Close Work & Payments"
      footer={<Button title="Complete Work" icon="checkmark-circle" variant="success" onPress={closeWork} loading={closing} />}
    >
      <Text style={styles.sheetHint}>Enter how much was received from the client and what it cost to deliver this work.</Text>
      <Input label="Total received from client (Rs.)" value={payment} onChangeText={setPayment} keyboardType="numeric" placeholder="0" />
      <Input label="Total expenses (Rs.)" value={expense} onChangeText={setExpense} keyboardType="numeric" placeholder="0" />
      <Input label="Payment notes" value={notes} onChangeText={setNotes} placeholder="e.g. advance + balance, cash/UPI" />
    </BottomSheet>
    </View>
    </PullRefresh>
    </SwipeBackView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  errorText: { color: colors.danger, fontWeight: '600' },
  loadingText: { color: colors.muted },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  title: { fontSize: font.xl, fontWeight: '900', color: colors.text, marginBottom: 2 },
  client: { fontSize: font.sm, color: colors.muted },
  description: { fontSize: font.sm, color: colors.text, marginBottom: spacing.md, lineHeight: 20 },
  hint: { fontSize: font.xs, color: colors.muted, marginTop: spacing.sm, lineHeight: 16 },
  member: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  memberName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  memberRole: { fontSize: font.xs, color: colors.muted, textTransform: 'capitalize' },
  docRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  docName: { flex: 1, marginLeft: spacing.sm, fontSize: font.sm, color: colors.text },
  docAction: { padding: spacing.sm, marginLeft: spacing.xs },
  footerBar: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sheetHint: { fontSize: font.sm, color: colors.muted, marginBottom: spacing.md, lineHeight: 20 },
});