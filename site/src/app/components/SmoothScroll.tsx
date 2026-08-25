import { useEffect, type ReactNode } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap, ScrollTrigger, ensureGsap } from '../animation/gsapSetup';

interface SmoothScrollProps {
  children: ReactNode;
  enabled?: boolean;
}

const SCROLL_EASING = (progress: number) => Math.min(1, 1.001 - Math.pow(2, -10 * progress));

export function SmoothScroll({ children, enabled = true }: SmoothScrollProps) {
  useEffect(() => {
    if (!enabled) return;

    ensureGsap();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarsePointer = window.matchMedia('(pointer: coarse)');
    let lenis: Lenis | null = null;

    const syncPreference = () => {
      const shouldSmooth = !reducedMotion.matches && !coarsePointer.matches;

      if (shouldSmooth && !lenis) {
        lenis = new Lenis({
          anchors: true,
          autoRaf: false,
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

        lenis.on('scroll', ScrollTrigger.update);
        const raf = (time: number) => lenis?.raf(time * 1000);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);
        ScrollTrigger.refresh();

        const teardown = () => {
          gsap.ticker.remove(raf);
          lenis?.destroy();
          lenis = null;
        };
        (syncPreference as unknown as { teardown?: () => void }).teardown = teardown;
        return;
      }

      if (!shouldSmooth && lenis) {
        (syncPreference as unknown as { teardown?: () => void }).teardown?.();
        (syncPreference as unknown as { teardown?: () => void }).teardown = undefined;
        ScrollTrigger.refresh();
      }
    };

    syncPreference();
    reducedMotion.addEventListener('change', syncPreference);
    coarsePointer.addEventListener('change', syncPreference);

    return () => {
      reducedMotion.removeEventListener('change', syncPreference);
      coarsePointer.removeEventListener('change', syncPreference);
      (syncPreference as unknown as { teardown?: () => void }).teardown?.();
      (syncPreference as unknown as { teardown?: () => void }).teardown = undefined;
    };
  }, [enabled]);

  return children;
}
