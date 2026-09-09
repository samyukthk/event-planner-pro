import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, User, UserWorksList, UserPaymentsList, UserPayment, Work } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Avatar, Badge, Button, Card, Chip, EmptyState, Input, Screen, SectionTitle } from '@/components/ui';
import { BottomSheet } from '@/components/bottom-sheet';
import { PullRefresh } from '@/components/gestures';
import { colors, font, spacing } from '@/lib/theme';
import { formatDate, money, parseDate, toISODate, toISOTime } from '@/lib/format';

export default function TeamScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add user sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [saving, setSaving] = useState(false);

  // User works + payments popups state
  const [userSheetUser, setUserSheetUser] = useState<User | null>(null);
  const [userWorks, setUserWorks] = useState<Work[]>([]);
  const [userSheetOpen, setUserSheetOpen] = useState(false);
  const [userSheetLoading, setUserSheetLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [paySheetUser, setPaySheetUser] = useState<User | null>(null);
  const [payments, setPayments] = useState<UserPayment[]>([]);
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [paySheetLoading, setPaySheetLoading] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(toISODate(new Date()));
  const [payTime, setPayTime] = useState('');
  const [paySource, setPaySource] = useState('work settlement');
  const [payNotes, setPayNotes] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');
  const [payErrorVisible, setPayErrorVisible] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.users();
      setUsers(res.users);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.users();
      setUsers(res.users);
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (user?.role !== 'admin') {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Admins only" subtitle="Only admins can add users" />
      </Screen>
    );
  }

  const openAddSheet = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setRole('employee');
    setSheetOpen(true);
  };

  const addUser = async () => {
    if (!name.trim() || !email.trim() || !password) {
      return Alert.alert('Check the form', 'Name, email and password are required');
    }
    setSaving(true);
    try {
      await api.createUser({ name, email, phone: phone || undefined, password, role });
      setSaving(false);
      setSheetOpen(false);
      load();
      Alert.alert('User added', 'The new user can now log in.');
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Failed', e?.message || 'Could not add the user');
    }
  };

  const removeUser = (u: User) => {
    Alert.alert(`Remove ${u.name}?`, 'They will lose access immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteUser(u.id);
            load();
          } catch (e: any) {
            Alert.alert('Failed', e?.message || 'Could not remove the user');
          }
        },
      },
    ]);
  };

  const openUserSheet = async (u: User) => {
    setListError('');
    setUserSheetUser(u);
    setUserWorks([]);
    setUserSheetLoading(true);
    try {
      const res = await api.userWorks(u.id);
      setUserWorks(res.works);
    } catch (e: any) {
      setListError(e?.message || 'Failed to load works');
      setUserWorks([]);
    } finally {
      setUserSheetLoading(false);
      setUserSheetOpen(true);
    }
  };

  const openPaySheet = async (u: User) => {
    setPayError('');
    setPayErrorVisible('');
    setPaySheetUser(u);
    setPayAmount('');
    setPayDate(toISODate(new Date()));
    setPayTime('');
    setPaySource('work settlement');
    setPayNotes('');
    setPaySaving(false);
    setPayments([]);
    setPaySheetLoading(true);
    try {
      const res = await api.userPayments(u.id);
      setPayments(res.payments);
    } catch (e: any) {
      setPayError(e?.message || 'Failed to load payments');
    } finally {
      setPaySheetLoading(false);
      setPaySheetOpen(true);
    }
  };

  const closePaySheet = () => {
    setPaySheetOpen(false);
    setPayError('');
    setPayErrorVisible('');
  };

  const settlePayment = async () => {
    const u = paySheetUser;
    if (!u) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayError('Enter a valid payment amount');
      setPayErrorVisible('amount');
      return;
    }
    if (!payDate) {
      setPayError('Enter the date the payment was given');
      setPayErrorVisible('date');
      return;
    }
    setPaySaving(true);
    setPayError('');
    setPayErrorVisible('');
    try {
      const res = await api.settlePayment(u.id, {
        amount,
        given_on: payDate,
        given_at: payTime || undefined,
        source: paySource || undefined,
        notes: payNotes || undefined,
      });
      setPayments((ps) => [res.payment, ...ps]);
      setPayAmount('');
      setPayTime('');
      setPayNotes('');
      setPayError('');
      setPayErrorVisible('');
      Alert.alert('Payment recorded', `₹${Math.round(amount).toLocaleString()} given to ${u.name} on ${formatDate(payDate)}`);
    } catch (e: any) {
      setPayError(e?.message || 'Could not record the payment');
      setPayErrorVisible('submit');
    } finally {
      setPaySaving(false);
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <Pressable onPress={() => openUserSheet(item)} style={styles.userCardPress}>
      <Card style={styles.userCard}>
        <Avatar name={item.name} size={40} />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {item.email}
          </Text>
        </View>
        <Badge text={item.role === 'admin' ? 'Admin' : 'Employee'} tone={item.role === 'admin' ? 'info' : 'muted'} />
        {item.id !== user.id ? (
          <Pressable onPress={() => removeUser(item)} hitSlop={8} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        ) : null}
      </Card>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <PullRefresh onRefresh={refresh} refreshing={refreshing}>
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.title}>Team ({users.length})</Text>
              <Text style={styles.subtitle}>Everyone with access to the app</Text>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <Text style={styles.muted}>Loading…</Text>
            ) : (
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon="people-outline"
                  title="No team members yet"
                  subtitle="Tap “Add User” to invite your first member."
                />
              </View>
            )
          }
        />
      </PullRefresh>

      {/* Fixed add-user action, always visible above the tab bar */}
      <View style={styles.footer}>
        <Button title="Add User" icon="person-add" onPress={openAddSheet} style={styles.addBtn} />
      </View>

      {/* User works popup */}
      <BottomSheet
        visible={userSheetOpen}
        onClose={() => setUserSheetOpen(false)}
        title={userSheetUser ? `${userSheetUser.name} — works` : 'Works'}
        footer={
          <Button
            title="Settle Payment"
            icon="cash-outline"
            variant="success"
            onPress={() => {
              setUserSheetOpen(false);
              openPaySheet(userSheetUser!);
            }}
          />
        }
      >
        {userSheetLoading ? (
          <Text style={styles.muted}>Loading works…</Text>
        ) : listError ? (
          <Text style={styles.error}>{listError}</Text>
        ) : userWorks.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No works assigned yet" subtitle={`${userSheetUser?.name} doesn't have any works yet.`} />
        ) : (
          <>
            <Text style={styles.hint}>Tap “Settle Payment” to record a payment made to {userSheetUser?.name}.</Text>
            {userWorks.map((w) => (
              <Card key={w.id} style={styles.workCard}>
                <View style={styles.workTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workTitle}>{w.title}</Text>
                    <Text style={styles.workClient}>Client: {w.client_name}</Text>
                  </View>
                  <Badge text={w.status === 'completed' ? 'Completed' : 'Upcoming'} tone={w.status === 'completed' ? 'success' : 'warning'} />
                </View>
                <View style={styles.workMeta}>
                  <Ionicons name="calendar-outline" size={14} color={colors.muted} />
                  <Text style={styles.workMetaText}>{formatDate(w.work_date)}</Text>
                  {w.start_time ? (
                    <>
                      <Ionicons name="time-outline" size={14} color={colors.muted} style={{ marginLeft: spacing.sm }} />
                      <Text style={styles.workMetaText}>{w.start_time}</Text>
                    </>
                  ) : null}
                </View>
                {w.venue ? (
                  <View style={styles.workMeta}>
                    <Ionicons name="location-outline" size={14} color={colors.muted} />
                    <Text style={styles.workMetaText}>{w.venue}</Text>
                  </View>
                ) : null}
                {w.payment_amount != null ? (
                  <View style={styles.workPayment}>
                    <Text style={styles.workPaymentLabel}>Client paid</Text>
                    <Text style={styles.workPaymentValue}>{money(w.payment_amount)}</Text>
                  </View>
                ) : null}
              </Card>
            ))}
          </>
        )}
      </BottomSheet>

      {/* Settle payment popup (also shows payment history) */}
      <BottomSheet
        visible={paySheetOpen}
        onClose={closePaySheet}
        title={paySheetUser ? `Settle payment — ${paySheetUser.name}` : 'Settle payment'}
        footer={
          <Button
            title="Record payment"
            icon="checkmark-circle"
            variant="success"
            onPress={settlePayment}
            loading={paySaving}
            disabled={paySaving}
          />
        }
      >
        <Text style={styles.payHint}>Add a payment given to {paySheetUser?.name}. Payments are recorded separately from work completion — you can add them any time, for any amount, with the date you handed the money over.</Text>

        <Input
          label="Amount given (Rs.)"
          value={payAmount}
          onChangeText={(v) => { setPayAmount(v); setPayErrorVisible(''); setPayError(''); }}
          keyboardType="numeric"
          placeholder="e.g. 4500"
          error={payErrorVisible === 'amount' ? payError : undefined}
        />
        <Input
          label="Date payment given (YYYY-MM-DD) *"
          value={payDate}
          onChangeText={(v) => { setPayDate(v); setPayErrorVisible(''); setPayError(''); }}
          placeholder="2026-09-07"
          error={payErrorVisible === 'date' ? payError : undefined}
        />
        <Input
          label="Time (HH:MM, optional)"
          value={payTime}
          onChangeText={(v) => { setPayTime(v); setPayErrorVisible(''); setPayError(''); }}
          placeholder="09:30"
          keyboardType="numeric"
        />
        <Text style={styles.roleLabel}>Source</Text>
        <View style={styles.chips}>
          {['work settlement', 'advance', 'bonus', 'other'].map((s) => (
            <Chip key={s} label={s} active={paySource === s} onPress={() => setPaySource(s)} />
          ))}
        </View>
        <Input
          label="Notes (optional)"
          value={payNotes}
          onChangeText={setPayNotes}
          placeholder="e.g. for the stadium event"
        />

        {payError && payErrorVisible ? (
          <Text style={styles.error}>{payError}</Text>
        ) : null}

        <SectionTitle>Payment history</SectionTitle>
        {paySheetLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : payments.length === 0 ? (
          <Text style={styles.muted}>No payments recorded yet.</Text>
        ) : (
          <View style={styles.paymentList}>
            {payments.map((p) => (
              <Card key={p.id} style={styles.paymentCard}>
                <View style={styles.paymentTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentAmount}>{money(p.amount)}</Text>
                    <Text style={styles.paymentMeta}>
                      {formatDate(p.given_on)}{p.given_at ? ` at ${p.given_at}` : ''}
                    </Text>
                  </View>
                  <Chip label={p.source || 'other'} active={false} onPress={() => {}} />
                </View>
                {p.notes ? <Text style={styles.paymentNotes}>{p.notes}</Text> : null}
                <Text style={styles.paymentBy}>Given by {p.given_by_name || 'you'}</Text>
              </Card>
            ))}
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing.lg, paddingBottom: spacing.lg, flexGrow: 1 },
  listHeader: { marginBottom: spacing.md },
  title: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  muted: { color: colors.muted, fontSize: font.sm },
  emptyWrap: { marginTop: spacing.xxl },
  userCardPress: { marginBottom: spacing.md },
  userCard: { flexDirection: 'row', alignItems: 'center' },
  userInfo: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  userName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  userEmail: { fontSize: font.xs, color: colors.muted },
  deleteBtn: { marginLeft: spacing.md, padding: spacing.xs },
  roleLabel: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  addBtn: { borderRadius: 999, minHeight: 50 },
  hint: { fontSize: font.sm, color: colors.muted, marginBottom: spacing.md, lineHeight: 20 },
  error: { color: colors.danger, fontSize: font.sm, marginTop: spacing.sm },
  workCard: { marginBottom: spacing.md },
  workTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  workTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  workClient: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  workMeta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  workMetaText: { fontSize: font.xs, color: colors.muted, marginLeft: spacing.xs, flex: 1 },
  workPayment: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  workPaymentLabel: { fontSize: font.xs, color: colors.muted },
  workPaymentValue: { fontSize: font.md, fontWeight: '700', color: colors.success },
  payHint: { fontSize: font.sm, color: colors.muted, marginBottom: spacing.md, lineHeight: 20 },
  paymentList: { marginTop: spacing.sm },
  paymentCard: { marginBottom: spacing.md },
  paymentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  paymentAmount: { fontSize: font.lg, fontWeight: '900', color: colors.text },
  paymentMeta: { fontSize: font.xs, color: colors.muted, marginTop: 2 },
  paymentNotes: { fontSize: font.xs, color: colors.muted, marginTop: spacing.sm, lineHeight: 16 },
  paymentBy: { fontSize: font.xs, color: colors.muted, marginTop: spacing.sm },
});