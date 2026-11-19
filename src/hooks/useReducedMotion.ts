import { useMediaQuery } from './useMediaQuery';

/** True when the user has requested reduced motion (spec §7.4). */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
