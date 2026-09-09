import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, spacing } from '@/lib/theme';

const NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * iOS-style bottom sheet. Slides up from the bottom with a fade on the
 * backdrop, a grabber handle, and swipe-down-to-close. Content scrolls when
 * it does not fit (so forms stay usable on small phones).
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  footer,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Optional sticky action bar pinned below the scrolling content (e.g. the primary submit button). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Kept mounted while animating out so the exit animation is visible.
  const [render, setRender] = useState(visible);
  const translateY = useRef(new Animated.Value(height)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isWide = width >= 600;

  /* Open / close transitions, driven by the `visible` prop. */
  useEffect(() => {
    if (visible) {
      translateY.setValue(height);
      backdrop.setValue(0);
      setRender(true);
    } else if (render) {
      animRef.current?.stop();
      const anim = Animated.parallel([
        Animated.timing(translateY, {
          toValue: height,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(backdrop, { toValue: 0, duration: 220, useNativeDriver: NATIVE_DRIVER }),
      ]);
      animRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) setRender(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, height]);

  /* Slide the panel in once it is mounted and visible. */
  useEffect(() => {
    if (visible && render) {
      animRef.current?.stop();
      const anim = Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(backdrop, { toValue: 1, duration: 280, useNativeDriver: NATIVE_DRIVER }),
      ]);
      animRef.current = anim;
      anim.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, render]);

  /* Swipe down on the header/grabber to dismiss, like iOS sheets. */
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onPanResponderMove: (_evt, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_evt, g) => {
        if (g.dy > 110 || g.vy > 0.9) {
          onCloseRef.current();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: NATIVE_DRIVER,
            friction: 8,
            tension: 70,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: NATIVE_DRIVER,
          friction: 8,
          tension: 70,
        }).start();
      },
    })
  ).current;

  if (!render) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={() => onCloseRef.current()}>
      <View style={styles.root}>
        {/* Dimmed backdrop – tap to dismiss */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}>
          <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={() => onCloseRef.current()} />
        </Animated.View>

        {/* Panel sliding up from the bottom */}
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }, isWide && styles.sheetWide]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View {...pan.panHandlers} style={styles.headerArea}>
              <View style={styles.grabber} />
              <View style={styles.headerRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <Pressable onPress={() => onCloseRef.current()} hitSlop={10} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={colors.muted} />
                </Pressable>
              </View>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: Math.round(height * 0.72) }}
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingBottom: footer ? spacing.md : Math.max(spacing.lg, insets.bottom) + spacing.sm,
              }}
            >
              {children}
            </ScrollView>
            {footer ? <View style={[styles.sheetFooter, { paddingBottom: Math.max(spacing.lg, insets.bottom) + spacing.sm }]}>{footer}</View> : null}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: {
    backgroundColor: colors.card,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 24,
  },
  sheetWide: { borderRadius: 26, marginBottom: 20 },
  headerArea: { paddingTop: 6 },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { flex: 1, fontSize: font.lg, fontWeight: '800', color: colors.text },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
