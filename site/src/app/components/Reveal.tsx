import {
  createElement,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';

type RevealTag = 'div' | 'header' | 'article' | 'aside' | 'footer' | 'section';

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  tag?: RevealTag;
  ariaHidden?: boolean;
};

export function Reveal({ children, className, delay = 0, tag = 'div', ariaHidden }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof IntersectionObserver === 'undefined'
    ) {
      node.classList.add('is-revealed');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style = delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined;

  return createElement(
    tag,
    {
      ref: ref as Ref<never>,
      className: className ? `reveal ${className}` : 'reveal',
      style,
      ...(ariaHidden === undefined ? {} : { 'aria-hidden': ariaHidden }),
    },
    children,
  );
}
