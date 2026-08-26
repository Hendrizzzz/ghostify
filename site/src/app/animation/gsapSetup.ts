import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { CustomWiggle } from 'gsap/CustomWiggle';
import { CustomEase } from 'gsap/CustomEase';

let registered = false;

export function ensureGsap() {
  if (!registered && typeof window !== 'undefined') {
    gsap.registerPlugin(
      ScrollTrigger,
      MotionPathPlugin,
      SplitText,
      DrawSVGPlugin,
      ScrambleTextPlugin,
      CustomEase,
      CustomWiggle,
    );
    registered = true;
  }
  return { gsap, ScrollTrigger, MotionPathPlugin, SplitText };
}

export { gsap, ScrollTrigger, MotionPathPlugin, SplitText, CustomWiggle };

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
