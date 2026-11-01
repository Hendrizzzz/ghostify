/* The film's sound, synthesized live with Web Audio: no audio files.

   A bed runs under the whole film: a low drone whose filter opens as the
   camera moves in, and a faint room tone. Everything else belongs to a shot.
   As each shot starts, the director hands its cues to `scene()`, and they
   are scheduled on the audio clock for the exact moments the shot's timeline
   reaches them. A hit lands on its frame, not on whichever animation frame
   happens to run next. A shot cut short takes its sounds with it; a shot
   that has played out lets its tail ring under the next cut.

   Browsers only allow audio after a click, tap, or key press, so sound
   starts inside the press that begins the film, unless the visitor has
   switched it off. Effects are heard at once; only the bed fades in. It
   ducks while the tab is hidden. */

const KEY = 'ghostify-sound';
const LEVEL = 0.55;
/* The bed's fade-in when sound starts (s). Effects are never faded in. */
const BED_FADE = 2.4;

/* One sound in a shot: when (s into the shot) and how to play it at an
   audio-clock time. */
export type Cue = readonly [at: number, play: (t: number) => void];

type Ctx = AudioContext & { outputLatency?: number };

export function soundPreferred(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

function remember(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* Private mode: the toggle still works for this visit. */
  }
}

/* A fixed spread of 0..1 values, so every viewing sounds the same. */
const spread = (i: number) => (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1;

/* The header meter's four bands, in analyser bins (about 190 Hz each). */
const BANDS = [
  [1, 3],
  [3, 7],
  [7, 18],
  [18, 44],
] as const;

export class FilmSound {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  /* The bed fades in once when sound starts, and dips under a hit. */
  private bedFade: GainNode | null = null;
  private bedDuck: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private meter: AnalyserNode | null = null;
  private bins: Uint8Array<ArrayBuffer> | null = null;
  /* Where the current shot's sounds play. */
  private bus: GainNode | null = null;
  private cues: readonly Cue[] = [];
  /* When the current shot started (performance.now). */
  private origin = 0;
  on = false;
  /* Called whenever the browser actually starts or stops the audio. */
  onChange?: (running: boolean) => void;

  get running() {
    return this.ctx?.state === 'running';
  }

  private build() {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx: Ctx = new Ctx({ latencyHint: 'interactive' });
    ctx.onstatechange = () => {
      const running = ctx.state === 'running';
      this.onChange?.(running);
      if (running) this.flush();
    };
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const meter = ctx.createAnalyser();
    meter.fftSize = 256;
    meter.smoothingTimeConstant = 0.55;
    meter.minDecibels = -78;
    meter.maxDecibels = -22;
    master.connect(meter);
    const bedFade = ctx.createGain();
    bedFade.gain.value = 0;
    bedFade.connect(master);
    const bedDuck = ctx.createGain();
    bedDuck.connect(bedFade);

    // Drone: four detuned voices through a slowly breathing low-pass.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 0.7;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    filter.connect(droneGain).connect(bedDuck);
    [
      [55, 'triangle', 0],
      [82.41, 'sine', 4],
      [110, 'triangle', -6],
      [164.81, 'sine', 3],
    ].forEach(([freq, type, detune]) => {
      const o = ctx.createOscillator();
      o.type = type as OscillatorType;
      o.frequency.value = freq as number;
      o.detune.value = detune as number;
      const g = ctx.createGain();
      g.gain.value = (freq as number) > 100 ? 0.35 : 0.6;
      o.connect(g).connect(filter);
      o.start();
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    // Room tone: very quiet filtered noise.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const room = ctx.createBufferSource();
    room.buffer = noise;
    room.loop = true;
    const roomFilter = ctx.createBiquadFilter();
    roomFilter.type = 'bandpass';
    roomFilter.frequency.value = 600;
    roomFilter.Q.value = 0.4;
    const roomGain = ctx.createGain();
    roomGain.gain.value = 0.012;
    room.connect(roomFilter).connect(roomGain).connect(bedDuck);
    room.start();

    this.ctx = ctx;
    this.master = master;
    this.meter = meter;
    this.bedFade = bedFade;
    this.bedDuck = bedDuck;
    this.filter = filter;
    this.noise = noise;

    // Duck while the tab is hidden; come back when it returns, if still on.
    // The film's clock stops with the tab, and so does the audio clock, so
    // the two pick up together.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (ctx.state !== 'running') return;
        this.ramp(0, 0.15);
        window.setTimeout(() => {
          if (document.hidden) ctx.suspend().catch(() => {});
        }, 200);
      } else if (this.on) {
        ctx
          .resume()
          .then(() => this.ramp(LEVEL, 0.6))
          .catch(() => {});
      }
    });
  }

  /* A straight fade of a gain from wherever it is now. */
  private fade(param: AudioParam | undefined, to: number, seconds: number) {
    const ctx = this.ctx;
    if (!ctx || !param) return;
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(to, t + seconds);
  }

  private ramp(to: number, seconds: number) {
    this.fade(this.master?.gain, to, seconds);
  }

  /* Turn sound on and ask the browser to start it. Safe to call before the
     visitor has interacted: where autoplay is allowed it plays at once,
     elsewhere it waits, and the next call from a click, tap, or key starts it.
     Never awaited, because a blocked resume() can stay pending. */
  arm() {
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    if (this.on && ctx.state === 'running') return;
    this.on = true;
    if (ctx.state === 'running') this.open();
    else {
      this.master!.gain.cancelScheduledValues(ctx.currentTime);
      this.master!.gain.setValueAtTime(0, ctx.currentTime);
      ctx
        .resume()
        .then(() => this.open())
        .catch(() => {});
    }
  }

  /* Running and wanted: effects at full level now, the bed fades in, and
     whatever is left of the current shot's cues is scheduled. */
  private open() {
    const ctx = this.ctx;
    if (!ctx || !this.on || ctx.state !== 'running') return;
    this.ramp(LEVEL, 0.04);
    const bed = this.bedFade!.gain;
    this.fade(bed, 1, Math.max(0.05, BED_FADE * (1 - bed.value)));
    this.flush();
  }

  enable() {
    this.arm();
    remember(true);
  }

  disable() {
    this.stop();
    remember(false);
  }

  /* Silence without changing the visitor's preference (page teardown). */
  stop() {
    this.drop(0.2);
    if (this.ctx && this.master) {
      this.ramp(0, 0.3);
      this.fade(this.bedFade?.gain, 0, 0.3);
      const ctx = this.ctx;
      window.setTimeout(() => {
        if (!this.on) ctx.suspend().catch(() => {});
      }, 400);
    }
    this.on = false;
  }

  /* A shot begins: these are its cues. The last shot's sounds fade out
     fast if it was cut short, slowly if it had played out. */
  scene(cues: readonly Cue[]) {
    const elapsed = (performance.now() - this.origin) / 1000;
    const done = this.cues.every(([at]) => at < elapsed);
    this.drop(done ? 0.9 : 0.12);
    this.cues = cues;
    this.origin = performance.now();
    this.flush();
  }

  /* Schedule the current shot's cues that are still ahead, once, as soon as
     sound is on and running. Sound reaches the ear after the output's
     latency, a frame reaches the eye about one frame after it is drawn, so
     cues go out early by the difference. */
  private flush() {
    const ctx = this.ctx;
    if (this.bus || !this.on || !ctx || ctx.state !== 'running' || !this.master) return;
    if (!this.cues.length) return;
    const bus = ctx.createGain();
    bus.connect(this.master);
    this.bus = bus;
    const elapsed = (performance.now() - this.origin) / 1000;
    const lag = Math.max(0, (ctx.outputLatency ?? 0) + (ctx.baseLatency ?? 0) - 0.017);
    const now = ctx.currentTime;
    for (const [at, play] of this.cues) {
      if (at < elapsed - 0.04) continue;
      try {
        play(Math.max(now, now + at - elapsed - lag));
      } catch {
        /* One sound failing never stops the film. */
      }
    }
  }

  /* Fade out and release the current shot's sounds. */
  private drop(seconds: number) {
    const bus = this.bus;
    const ctx = this.ctx;
    this.bus = null;
    if (!bus || !ctx) return;
    this.fade(bus.gain, 0, seconds);
    window.setTimeout(() => bus.disconnect(), (seconds + 0.1) * 1000);
    // A hit that will now never land must not leave the bed dipped.
    if (seconds < 0.5 && this.bedDuck) {
      const d = this.bedDuck.gain;
      d.cancelScheduledValues(ctx.currentTime);
      d.setTargetAtTime(1, ctx.currentTime, 0.08);
    }
  }

  /* 0 = far away, 1 = right up against the screen. */
  setIntensity(x: number) {
    if (!this.on || !this.ctx || !this.filter) return;
    this.filter.frequency.setTargetAtTime(280 + x * 1500, this.ctx.currentTime, 0.4);
  }

  /* The level in four bands, low to high, 0 to 1, for the header meter. */
  levels(out: number[]) {
    const m = this.meter;
    if (!m || !this.running) {
      out.fill(0);
      return out;
    }
    this.bins ??= new Uint8Array(m.frequencyBinCount);
    m.getByteFrequencyData(this.bins);
    BANDS.forEach(([a, b], i) => {
      let sum = 0;
      for (let k = a; k < b; k += 1) sum += this.bins![k];
      out[i] = sum / ((b - a) * 255);
    });
    return out;
  }

  /* ---------- Voices. Each plays at audio-clock time `t`. ---------- */

  private get out(): AudioNode {
    return this.bus ?? this.master!;
  }

  /* A gain that is silent at `t`, at `peak` after `attack`, and gone
     `release` later. */
  private env(t: number, peak: number, attack: number, release: number) {
    const g = this.ctx!.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    return g;
  }

  /* A stretch of the noise buffer, from a varied offset. It loops, so a
     long stretch never runs off the end of the buffer and stops short. */
  private hiss(t: number, seconds: number, offset = 0) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(t, offset % 1.4, seconds);
    return src;
  }

  private tone(type: OscillatorType, freq: number, t: number, seconds: number) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(t + seconds);
    return o;
  }

  private pass(type: BiquadFilterType, freq: number, q = 0.7) {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  /* The match cut. Air is drawn in while the ghost-shaped window holds, then
     rushes out as it opens past the frame at `t + open`, over a low swell. */
  whoosh(t: number, open: number) {
    const burst = t + open;
    const bp = this.pass('bandpass', 320, 1.1);
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.exponentialRampToValueAtTime(900, t + open * 0.65);
    bp.frequency.exponentialRampToValueAtTime(2600, burst);
    bp.frequency.exponentialRampToValueAtTime(480, burst + 0.6);
    const g = this.ctx!.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + open * 0.5);
    g.gain.exponentialRampToValueAtTime(0.2, burst);
    g.gain.exponentialRampToValueAtTime(0.0001, burst + 0.65);
    this.hiss(t, open + 0.7, t * 3.1)
      .connect(bp)
      .connect(g)
      .connect(this.out);

    const swell = this.tone('sine', 90, burst - 0.25, 0.9);
    swell.frequency.exponentialRampToValueAtTime(42, burst + 0.5);
    swell.connect(this.env(burst - 0.25, 0.1, 0.27, 0.55)).connect(this.out);
  }

  /* A screen sparking on. An electrical hum follows the screen's flicker
     frame for frame (`levels`, spread evenly over `seconds`), with a tick
     of current on each jump up, then settles low and fades. */
  flicker(t: number, seconds: number, levels: readonly number[]) {
    const ctx = this.ctx!;
    const seg = seconds / (levels.length - 1);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0, t);
    levels.forEach((v, i) => {
      if (i) g.gain.linearRampToValueAtTime(0.05 * v, t + i * seg);
    });
    g.gain.setTargetAtTime(0.014, t + seconds, 0.35);
    g.gain.setTargetAtTime(0, t + seconds + 1, 0.45);
    g.connect(this.pass('lowpass', 900)).connect(this.out);
    [100, 200, 300].forEach((f, i) => {
      this.tone(i ? 'sine' : 'sawtooth', f, t, seconds + 3.4).connect(g);
    });
    levels.forEach((v, i) => {
      if (!i || v - levels[i - 1] < 0.3) return;
      const at = t + (i - 0.5) * seg;
      this.hiss(at, 0.02, i * 0.37)
        .connect(this.pass('highpass', 2200))
        .connect(this.env(at, 0.045 * v, 0.001, 0.012))
        .connect(this.out);
    });
  }

  /* The Seen lifting out of the chat: a tone that climbs from `t0` and is
     cut off clean at `t1`, the moment it is stopped. */
  rise(t0: number, t1: number) {
    (
      [
        ['triangle', 196, 587, 0.06],
        ['sine', 98, 294, 0.045],
      ] as const
    ).forEach(([type, from, to, peak]) => {
      const o = this.tone(type, from, t0, t1 - t0 + 0.06);
      o.frequency.exponentialRampToValueAtTime(to, t1);
      const g = this.ctx!.createGain();
      g.gain.value = 0;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t1 - 0.01);
      g.gain.linearRampToValueAtTime(0.0001, t1 + 0.04);
      o.connect(g).connect(this.out);
    });
  }

  /* The way back from the receipt: the rising tone run backwards, falling
     from where it was cut to where it began as Seen sinks into the chat. */
  fall(t0: number, t1: number) {
    (
      [
        ['triangle', 587, 196, 0.05],
        ['sine', 294, 98, 0.04],
      ] as const
    ).forEach(([type, from, to, peak]) => {
      const o = this.tone(type, from, t0, t1 - t0 + 0.1);
      o.frequency.exponentialRampToValueAtTime(to, t1);
      o.connect(this.env(t0, peak, 0.02, t1 - t0)).connect(this.out);
    });
  }

  /* A whoosh played backwards, for a camera pushing back in: air that
     gathers toward the moment it lands (`t + seconds`) and stops there. */
  swell(t: number, seconds: number) {
    const end = t + seconds;
    const bp = this.pass('bandpass', 480, 1.1);
    bp.frequency.setValueAtTime(480, t);
    bp.frequency.exponentialRampToValueAtTime(2200, end);
    const g = this.ctx!.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, end);
    g.gain.linearRampToValueAtTime(0.0001, end + 0.06);
    this.hiss(t, seconds + 0.1, t * 2.3)
      .connect(bp)
      .connect(g)
      .connect(this.out);
  }

  /* The Seen is stopped: a soft, low thud with a short echo, and a bright
     stroke that travels left to right with the line drawn through the word
     (an expo.out draw is an exponential approach with a 60 ms time
     constant). The bed dips under it for a beat, never to silence. */
  impact(t: number) {
    const ctx = this.ctx!;
    if (this.bedDuck) {
      const bed = this.bedDuck.gain;
      bed.cancelScheduledValues(t);
      bed.setValueAtTime(1, t);
      bed.linearRampToValueAtTime(0.35, t + 0.04);
      bed.setTargetAtTime(1, t + 0.35, 0.25);
    }

    // Everything below feeds a dry path and a short, darkening echo.
    const dry = ctx.createGain();
    dry.connect(this.out);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.21;
    const tone = this.pass('lowpass', 700);
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    dry.connect(delay).connect(tone).connect(feedback).connect(delay);
    tone.connect(wet).connect(this.out);

    // The thud: a falling sine, with an octave above so small speakers carry it.
    (
      [
        [140, 55, 0.5, 'sine'],
        [280, 110, 0.12, 'triangle'],
      ] as const
    ).forEach(([from, to, level, type]) => {
      const o = this.tone(type, from, t, 1);
      o.frequency.exponentialRampToValueAtTime(to, t + 0.4);
      o.connect(this.env(t, level, 0.008, 0.9)).connect(dry);
    });

    // A little low noise for the body of the hit.
    this.hiss(t, 0.3, 0.2)
      .connect(this.pass('lowpass', 380))
      .connect(this.env(t, 0.14, 0.005, 0.25))
      .connect(dry);

    // The stroke: bright air swept across the stereo field.
    const hp = this.pass('highpass', 1500);
    hp.frequency.setValueAtTime(1500, t);
    hp.frequency.exponentialRampToValueAtTime(5200, t + 0.2);
    let stroke: AudioNode = this.hiss(t, 0.3, 0.9)
      .connect(hp)
      .connect(this.env(t, 0.07, 0.006, 0.22));
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(-0.55, t);
      pan.pan.setTargetAtTime(0.55, t, 0.06);
      stroke = stroke.connect(pan);
    }
    stroke.connect(this.out);

    // The echo has died away by then; release its loop.
    window.setTimeout(
      () => {
        dry.disconnect();
        delay.disconnect();
        feedback.disconnect();
        wet.disconnect();
      },
      (t - ctx.currentTime + 3) * 1000,
    );
  }

  /* One key of a draft being typed (`erase`: taken back), each a touch
     different so a line never sounds like a loop. */
  key(t: number, i: number, erase = false) {
    const r = spread(i + (erase ? 50 : 0));
    const f = (erase ? 1700 : 2900) * (0.9 + r * 0.2);
    const level = (erase ? 0.05 : 0.085) * (0.8 + spread(i + 7) * 0.4);
    this.hiss(t, 0.05, r * 1.3)
      .connect(this.pass('bandpass', f, 1.3))
      .connect(this.env(t, level, 0.002, 0.035))
      .connect(this.out);
    this.tone('sine', (erase ? 250 : 330) * (0.95 + r * 0.1), t, 0.07)
      .connect(this.env(t, 0.028, 0.003, 0.05))
      .connect(this.out);
  }

  /* A soft, round note. */
  note(t: number, freq: number, level: number, attack = 0.04, release = 1.6) {
    this.tone('sine', freq, t, attack + release + 0.05)
      .connect(this.env(t, level, attack, release))
      .connect(this.out);
  }

  /* A soft tick when a switch turns on. */
  tick(t: number) {
    const o = this.tone('sine', 1320, t, 0.15);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.06);
    o.connect(this.env(t, 0.09, 0.005, 0.11)).connect(this.out);
  }

  /* The end card: a warm, open chord that swells as the ghost arrives and
     settles under the line. */
  chord(t: number) {
    [220, 277.18, 329.63, 440].forEach((f, i) => {
      this.note(t + i * 0.03, f, 0.05 - i * 0.008, 0.65, 4.2);
    });
  }
}
