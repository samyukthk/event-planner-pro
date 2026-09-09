import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { colors, font, radius, spacing } from '@/lib/theme';

export default function LoginScreen() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href="/(tabs)" />;

  const submit = async (mail: string, pass: string) => {
    setError('');
    setBusy(true);
    try {
      await login(mail, pass);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Ionicons name="calendar" size={30} color="#fff" />
          </View>
          <Text style={styles.brandName}>Event Planner Pro</Text>
          <Text style={styles.tagline}>Manage your team, events & quotations</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Sign In" onPress={() => submit(email, password)} loading={busy} disabled={!email || !password} />

        <Text style={styles.demoLabel}>Quick logins</Text>
        <View style={styles.demoRow}>
          <Pressable style={[styles.demoChip, styles.subinChip]} onPress={() => submit('subin@desireevents', 'subin123')}>
            <Text style={[styles.demoChipText, styles.subinChipText]}>Subin (Admin)</Text>
          </Pressable>
          <Pressable style={styles.demoChip} onPress={() => submit('admin@eventplanner.com', 'admin123')}>
            <Text style={styles.demoChipText}>Admin</Text>
          </Pressable>
          <Pressable style={styles.demoChip} onPress={() => submit('ravi@eventplanner.com', 'ravi123')}>
            <Text style={styles.demoChipText}>Employee (Ravi)</Text>
          </Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  brandName: { fontSize: font.xxl, fontWeight: '900', color: colors.text },
  tagline: { fontSize: font.sm, color: colors.muted, marginTop: 4 },
  form: { width: '100%' },
  error: { color: colors.danger, fontSize: font.sm, marginBottom: spacing.md, fontWeight: '600' },
  demoLabel: { textAlign: 'center', fontSize: font.xs, color: colors.muted, marginTop: spacing.xl, marginBottom: spacing.sm },
  demoRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  demoChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    marginBottom: spacing.xs,
  },
  demoChipText: { fontSize: font.sm, fontWeight: '700', color: colors.primary },
  subinChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  subinChipText: { color: '#fff' },
});