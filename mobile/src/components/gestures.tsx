import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/lib/theme';

/* ------------------------------------------------------------------ */
/* PullRefresh — pull down from the top of a page to refresh.          */
/*                                                                    */
/* Native: pass-through (screens supply their own RefreshControl,     */
/* which by design only fires when the scroll is at the very top).    */
/* Web: react-native-web's RefreshControl renders nothing, so we       */
/* implement the gesture here with touch/mouse handlers + a translate */
/* animation. It only engages when every scrollable ancestor of the   */
/* touch point is at scrollTop 0 (i.e. the page is at the top), so    */
/* pulling from mid-page does nothing. While any popup (Modal) is     */
/* open, touches land on the modal overlay and never reach the page,  */
/* so the refresh gesture is naturally disabled.                      */
/* ------------------------------------------------------------------ */
export function PullRefresh({
  onRefresh,
  refreshing,
  children,
  style,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return <WebPullRefresh onRefresh={onRefresh} refreshing={refreshing} children={children} style={style} />;
}

const THRESHOLD = 70;
const MAX_PULL = 96;
const REST_Y = 44;

function WebPullRefresh({
  onRefresh,
  refreshing,
  children,
  style,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const wrapRef = useRef<View>(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const g = useRef<null | { startY: number; fired: boolean }>(null);
  const stateRef = useRef({ onRefresh, refreshing });
  stateRef.current = { onRefresh, refreshing };

  // While refreshing, hold the content down with the spinner visible;
  // release back to the top when the refresh finishes.
  useEffect(() => {
    if (refreshing) {
      Animated.spring(translateY, { toValue: REST_Y, useNativeDriver: false, friction: 9, tension: 90 }).start();
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: false }).start();
    } else {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: false, friction: 9, tension: 90 }).start();
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    }
  }, [refreshing, translateY, opacity]);

  /* True only when every scrollable ancestor (up to this wrapper) is at the top. */
  const atTopOfPage = (target: any): boolean => {
    const root = wrapRef.current as unknown as HTMLElement | null;
    if (!root) return true;
    let el = (target as HTMLElement | null) ?? null;
    while (el && el !== root && el.parentElement) {
      if (el.scrollHeight > el.clientHeight && el.scrollTop > 0) return false;
      el = el.parentElement;
    }
    return true;
  };

  const point = (e: any) => e?.nativeEvent?.touches?.[0] ?? e?.nativeEvent ?? e;

  const start = (e: any) => {
    const t = point(e);
    if (!atTopOfPage(e?.target ?? e?.nativeEvent?.target)) {
      g.current = null;
      return;
    }
    g.current = { startY: t.pageY ?? t.clientY ?? 0, fired: false };
  };

  const move = (e: any) => {
    const cur = g.current;
    if (!cur) return;
    const t = point(e);
    const dy = (t.pageY ?? t.clientY ?? 0) - cur.startY;
    if (dy <= 0) {
      translateY.setValue(0);
      opacity.setValue(0);
      return;
    }
    const pull = Math.min(MAX_PULL, dy * 0.5);
    translateY.setValue(pull);
    opacity.setValue(Math.min(1, pull / THRESHOLD));
    if (pull >= THRESHOLD && !cur.fired && !stateRef.current.refreshing) {
      cur.fired = true;
    }
  };

  const end = () => {
    const cur = g.current;
    g.current = null;
    if (!cur) return;
    if (cur.fired) {
      if (!stateRef.current.refreshing) stateRef.current.onRefresh();
      Animated.spring(translateY, { toValue: REST_Y, useNativeDriver: false, friction: 9, tension: 90 }).start();
    } else {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: false, friction: 9, tension: 90 }).start();
      opacity.setValue(0);
    }
  };

  // Touch/mouse handlers are web-only DOM props — RN's ViewProps doesn't type them.
  const gestureHandlers = {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onTouchCancel: end,
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: end,
    onMouseLeave: end,
  } as any;

  return (
    <View ref={wrapRef} style={[{ flex: 1, overflow: 'hidden', backgroundColor: colors.bg }, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[styles.indicator, { opacity }]}>
          <ActivityIndicator color={colors.primary} size="small" />
        </Animated.View>
      </View>
      <Animated.View style={{ flex: 1, transform: [{ translateY }] }} {...gestureHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* SwipeBackView — iOS-style swipe from the left edge to go back.      */
/* Web-only: native builds get the gesture from the native stack       */
/* (gestureEnabled in _layout.tsx).                                    */
/* ------------------------------------------------------------------ */
export function SwipeBackView({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return <WebSwipeBack children={children} style={style} />;
}

const EDGE = 48;
const BACK_DISTANCE = 90;

function WebSwipeBack({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const g = useRef<null | { startX: number; startY: number; startT: number; lastX: number; active: boolean }>(null);

  const point = (e: any) => e?.nativeEvent?.touches?.[0] ?? e?.nativeEvent ?? e;

  const start = (e: any) => {
    const t = point(e);
    const x = t.pageX ?? t.clientX ?? 0;
    const y = t.pageY ?? t.clientY ?? 0;
    if (x <= EDGE) {
      g.current = { startX: x, startY: y, startT: Date.now(), lastX: x, active: false };
    } else {
      g.current = null;
    }
  };

  const move = (e: any) => {
    const cur = g.current;
    if (!cur) return;
    const t = point(e);
    const x = t.pageX ?? t.clientX ?? 0;
    const y = t.pageY ?? t.clientY ?? 0;
    const dx = x - cur.startX;
    const dy = y - cur.startY;
    if (!cur.active) {
      if (dx > 24 && dx > Math.abs(dy) * 1.2) {
        cur.active = true;
      } else if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        // Looks like a vertical scroll — give up on swipe-back.
        g.current = null;
        return;
      }
    }
    if (cur.active) {
      translateX.setValue(Math.max(0, dx) * 0.6);
      cur.lastX = x;
    }
  };

  const end = () => {
    const cur = g.current;
    g.current = null;
    if (!cur || !cur.active) {
      translateX.setValue(0);
      return;
    }
    const dx = cur.lastX - cur.startX;
    const elapsed = Math.max(1, Date.now() - cur.startT);
    const vx = dx / elapsed;
    if (dx > BACK_DISTANCE || vx > 0.6) {
      Animated.timing(translateX, { toValue: 500, duration: 170, useNativeDriver: false }).start(() => {
        router.back();
      });
    } else {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: false, friction: 9, tension: 80 }).start();
    }
  };

  const gestureHandlers = {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onTouchCancel: end,
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: end,
    onMouseLeave: end,
  } as any;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, style]} {...gestureHandlers}>
      <Animated.View style={{ flex: 1, transform: [{ translateX }] }}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    alignSelf: 'center',
    marginTop: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
});