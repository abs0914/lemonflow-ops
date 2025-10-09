/**
 * Accessibility utilities for mobile-optimized UI
 */

/**
 * Minimum touch target size (44x44px per WCAG)
 */
export const MIN_TOUCH_TARGET_SIZE = 44;

/**
 * Check if an element meets minimum touch target size
 */
export function meetsTouchTargetSize(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width >= MIN_TOUCH_TARGET_SIZE && rect.height >= MIN_TOUCH_TARGET_SIZE;
}

/**
 * CSS class for minimum touch targets
 */
export const touchTargetClass = "min-h-[44px] min-w-[44px]";

/**
 * Haptic feedback utility (if supported)
 */
export function triggerHapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
  if ('vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 30,
    };
    navigator.vibrate(patterns[type]);
  }
}

/**
 * CSS classes for smooth transitions
 */
export const transitionClasses = {
  fast: 'transition-all duration-150',
  normal: 'transition-all duration-300',
  slow: 'transition-all duration-500',
};

/**
 * CSS classes for loading states
 */
export const loadingClasses = {
  skeleton: 'animate-pulse bg-muted',
  spinner: 'animate-spin',
  shimmer: 'animate-[shimmer_2s_ease-in-out_infinite]',
};