import { useEffect, useRef, useState } from 'react';
import { Film } from './Film';
import { Footer, Header, orderedStores } from './Shell';
import { FilmSound, soundPreferred } from './sound';

const FAQ = [
  {
    q: 'Why does my browser say Ghostify can read and change data on these sites?',
    a: 'It needs access to Instagram, Messenger, and Facebook tabs to hold the signals you switch off. That access is limited to those Meta web apps.',
  },
  {
    q: 'Does Ghostify read my messages?',
    a: 'It checks requests inside your browser to find the signals. Your conversations are never sent to Ghostify or saved, and it never asks for your passwords.',
  },
  {
    q: 'Does it work in the phone apps?',
    a: 'Not in the apps. It works on the web versions in desktop browsers, and in Firefox for Android.',
  },
  {
    q: 'What if Meta changes something?',
    a: 'It can break a switch. Every switch is checked by hand and the results are published on the status page.',
  },
];

const GLYPH = {
  wave: (
    <>
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  muted: (
    <>
      <path d="m16 9 5 6" />
      <path d="m21 9-5 6" />
    </>
  ),
};

/* How much each meter band is lifted: the drone fills the lowest band on its
   own, the higher ones only move on a hit. */
const METER_GAIN = [1.1, 2.5, 2.6, 3.5];

/* Always in the header. A live meter of the actual sound while it plays, a
   speaker while it waits for the press that begins the film, a crossed
   speaker when the visitor has muted it (remembered for next time). */
function SoundToggle({ sound }: { sound: FilmSound }) {
  // Still frames never start sound on their own: off until asked for.
  const [wanted, setWanted] = useState(
    () => soundPreferred() && !matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [running, setRunning] = useState(false);
  const meter = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    sound.onChange = setRunning;
    return () => {
      sound.onChange = undefined;
    };
  }, [sound]);

  const live = wanted && running;

  // The bars follow what is playing, frame by frame; still under reduced motion.
  useEffect(() => {
    const el = meter.current;
    if (!live || !el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bars = Array.from(el.children) as HTMLElement[];
    const level = [0, 0, 0, 0];
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      sound.levels(level);
      bars.forEach((b, i) => {
        const v = Math.min(1, level[i] * METER_GAIN[i]);
        b.style.transform = `scaleY(${(0.2 + 0.8 * v).toFixed(3)})`;
      });
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      bars.forEach((b) => (b.style.transform = ''));
    };
  }, [live, sound]);

  const toggle = () => {
    if (wanted) {
      sound.disable();
      setWanted(false);
    } else {
      // This press is itself the gesture that unlocks audio.
      sound.enable();
      setWanted(true);
    }
  };

  return (
    <button
      type="button"
      className={`sound${live ? ' is-on' : ''}`}
      aria-pressed={wanted}
      aria-label={
        !wanted
          ? 'Sound is off. Press to turn it on'
          : live
            ? 'Sound is on. Press to mute'
            : 'The film plays with sound. Press to mute'
      }
      onClick={toggle}
    >
      {live ? (
        <span className="sound-bars" ref={meter} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : (
        <svg
          className="sound-glyph"
          aria-hidden="true"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          {wanted ? GLYPH.wave : GLYPH.muted}
        </svg>
      )}
      <span className="sound-word">Sound</span>
    </button>
  );
}

export default function Landing({ base }: { base: string }) {
  const [stores] = useState(orderedStores);
  const [sound] = useState(() => new FilmSound());

  useEffect(() => () => sound.stop(), [sound]);

  // The film moves one shot per gesture, so a scrollbar only jumps around.
  useEffect(() => {
    document.documentElement.classList.add('is-film-page');
    return () => document.documentElement.classList.remove('is-film-page');
  }, []);

  return (
    <>
      <Header store={stores[0]} base={base} extra={<SoundToggle sound={sound} />} />
      <main id="main-content">
        <Film stores={stores} sound={sound} base={base} />

        <section className="credits" aria-labelledby="credits-title">
          <h2 id="credits-title">Questions</h2>
          <dl>
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <Footer base={base} credits />
    </>
  );
}
