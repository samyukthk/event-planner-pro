import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, shadow, spacing } from '@/lib/theme';

/* ---------- Screen ---------- */
export function Screen({
  children,
  scroll,
  style,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  /** Enables native pull-to-refresh (works on iOS/Android; no-op on web — see PullRefresh). */
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const content = <View style={[styles.screen, style]}>{children}</View>;
  if (scroll) {
    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        style={styles.scrollBg}
        refreshControl={
          refreshing !== undefined && onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
        }
      >
        {content}
      </ScrollView>
    );
  }
  return content;
}

/* ---------- Card ---------- */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* ---------- Button ---------- */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'whatsapp' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}) {
  const bg = {
    primary: colors.primary,
    secondary: colors.primaryLight,
    danger: colors.danger,
    success: colors.success,
    whatsapp: colors.whatsapp,
    ghost: 'transparent',
  }[variant];
  const fg = variant === 'secondary' ? colors.primary : variant === 'ghost' ? colors.primary : '#ffffff';

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: colors.border },
        variant === 'secondary' && styles.buttonSecondary,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={17} color={fg} style={{ marginRight: spacing.sm }} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/* ---------- Input ---------- */
export function Input({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#94a3b8"
        style={[styles.input, error ? { borderColor: colors.danger } : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/* ---------- Chip (filter / selector) ---------- */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
    >
      <Text style={[styles.chipText, active ? { color: '#fff' } : null]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Badge ---------- */
export function Badge({ text, tone = 'info' }: { text: string; tone?: 'success' | 'warning' | 'info' | 'muted' }) {
  const bg = {
    success: colors.successLight,
    warning: colors.warningLight,
    info: colors.infoLight,
    muted: '#f1f5f9',
  }[tone];
  const fg = {
    success: colors.success,
    warning: colors.warning,
    info: colors.info,
    muted: colors.muted,
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name, size = 36 }: { name?: string | null; size?: number }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={42} color="#cbd5e1" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/* ---------- Section title ---------- */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/* ---------- Row of info ---------- */
export function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.muted} style={{ marginRight: spacing.sm, marginTop: 1 }} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollBg: { backgroundColor: colors.bg, flexGrow: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minHeight: 46,
  },
  buttonSecondary: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonText: { fontWeight: '700', fontSize: font.md },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16, // ≥16px stops iOS auto-zoom when the field is focused
    color: colors.text,
    backgroundColor: '#fff',
  },
  error: { color: colors.danger, fontSize: font.xs, marginTop: 4 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.muted },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, alignSelf: 'flex-start' },
  badgeText: { fontSize: font.xs, fontWeight: '700' },
  avatar: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: font.md, fontWeight: '700', color: colors.muted, marginTop: spacing.md },
  emptySubtitle: { fontSize: font.sm, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  infoLabel: { fontSize: font.sm, color: colors.muted, width: 92 },
  infoValue: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.text },
});