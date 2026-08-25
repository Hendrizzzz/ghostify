import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { SplitText } from 'gsap/SplitText';

let registered = false;

export function ensureGsap() {
  if (!registered && typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, SplitText);
    registered = true;
  }
  return { gsap, ScrollTrigger, MotionPathPlugin, SplitText };
}

export { gsap, ScrollTrigger, MotionPathPlugin, SplitText };

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
