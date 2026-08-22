import { useEffect, type ReactNode } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

interface SmoothScrollProps {
  children: ReactNode;
  enabled?: boolean;
}

const SCROLL_EASING = (progress: number) => Math.min(1, 1.001 - Math.pow(2, -10 * progress));

export function SmoothScroll({ children, enabled = true }: SmoothScrollProps) {
  useEffect(() => {
    if (!enabled) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarsePointer = window.matchMedia('(pointer: coarse)');
    let lenis: Lenis | null = null;

    const syncPreference = () => {
      const shouldSmooth = !reducedMotion.matches && !coarsePointer.matches;

      if (shouldSmooth && !lenis) {
        lenis = new Lenis({
          anchors: true,
          autoRaf: true,
          duration: 1.2,
          easing: SCROLL_EASING,
          overscroll: true,
          smoothWheel: true,
          stopInertiaOnNavigate: true,
          syncTouch: false,
          virtualScroll: (input) => {
            const target = input.event.target;
            if (!(target instanceof Element)) return true;

            const section = target.closest('.feature-scroll');
            if (!section) return true;

            const bounds = section.getBoundingClientRect();
            if (bounds.top <= 0 && bounds.bottom >= window.innerHeight) {
              input.deltaY *= 0.75;
            }
            return true;
          },
        });
        return;
      }

      if (!shouldSmooth && lenis) {
        lenis.destroy();
        lenis = null;
      }
    };

    syncPreference();
    reducedMotion.addEventListener('change', syncPreference);
    coarsePointer.addEventListener('change', syncPreference);

    return () => {
      reducedMotion.removeEventListener('change', syncPreference);
      coarsePointer.removeEventListener('change', syncPreference);
      lenis?.destroy();
    };
  }, [enabled]);

  return children;
}
