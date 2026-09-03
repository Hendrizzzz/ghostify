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
   masked word rise work), which can trim italic caps and descenders on
   headings with tight line-height. Padding the mask open on both edges and
   pulling the layout back with matching negative margins keeps the animation
   and the whole glyph intact. */
export function keepSplitDescenders<T extends { masks: ArrayLike<Element> }>(split: T): T {
  Array.from(split.masks).forEach((maskEl) => {
    if (maskEl instanceof HTMLElement) {
      maskEl.style.paddingTop = '0.14em';
      maskEl.style.marginTop = '-0.14em';
      maskEl.style.paddingBottom = '0.14em';
      maskEl.style.marginBottom = '-0.14em';
    }
  });
  return split;
}
