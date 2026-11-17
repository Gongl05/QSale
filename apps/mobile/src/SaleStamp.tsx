import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { PlanStatus } from '@qsale/contracts';
import { Text, colors } from './ui';

/** Green "¡Sale!" stamp for a confirmed plan. It pops in once, unless the phone asks for less motion. */
export function SaleStamp() {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) progress.setValue(1);
        else
          Animated.spring(progress, {
            toValue: 1,
            friction: 5,
            tension: 120,
            useNativeDriver: true,
          }).start();
      });
    return () => {
      cancelled = true;
    };
  }, [progress]);
  return (
    <Animated.View
      accessible
      accessibilityLabel="El plan sale"
      style={{
        backgroundColor: colors.green,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 5,
        opacity: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
        transform: [
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['-14deg', '-4deg'],
              easing: Easing.out(Easing.quad),
            }),
          },
        ],
      }}
    >
      <Text style={{ color: '#fff', fontFamily: 'Manrope_800ExtraBold', fontSize: 15, lineHeight: 22 }}>
        ¡Sale!
      </Text>
    </Animated.View>
  );
}

/** A success vibration when a plan turns confirmed while the person is looking at it. */
export function useConfirmedHaptic(status: PlanStatus | undefined) {
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current === 'OPEN' && status === 'CLOSED')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    previous.current = status;
  }, [status]);
}
