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

/* SplitText mask wrappers clip at the line box (that is what makes the
   masked word rise work), which beheads descenders — g, p, y, j — on
   headings with tight line-height. Padding the mask open and pulling the
   layout back with a negative margin keeps the animation AND the glyphs. */
export function keepSplitDescenders<T extends { masks: ArrayLike<Element> }>(split: T): T {
  Array.from(split.masks).forEach((maskEl) => {
    if (maskEl instanceof HTMLElement) {
      maskEl.style.paddingBottom = '0.14em';
      maskEl.style.marginBottom = '-0.14em';
    }
  });
  return split;
}
