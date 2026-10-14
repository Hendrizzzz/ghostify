/* The film's sound, synthesized live with Web Audio: no audio files.
   A low drone whose filter opens as the camera moves in, a faint room tone,
   a hum as the first screen wakes, a rising tone cut to silence when the Seen
   breaks, three soft taps for the dots, a breath of air on cuts, a tick for
   each switch, one phrase on the wide and a chord on the end card. Sound is
   on by default, but browsers only allow audio after a click, tap, or key
   press, so it starts inside the press that begins the film, unless the
   visitor has switched it off. It ducks while the tab is hidden. */

const KEY = 'ghostify-sound';
const LEVEL = 0.55;
/* Fade-in when sound starts or comes back (s). */
const FADE = 1.5;

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

export class FilmSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private riser: { o: OscillatorNode; g: GainNode } | null = null;
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
    const ctx = new Ctx();
    ctx.onstatechange = () => this.onChange?.(ctx.state === 'running');
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Drone: three detuned voices through a slowly breathing low-pass.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 0.7;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    filter.connect(droneGain).connect(master);
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
    room.connect(roomFilter).connect(roomGain).connect(master);
    room.start();

    this.ctx = ctx;
    this.master = master;
    this.filter = filter;
    this.noise = noise;

    // Duck while the tab is hidden; come back when it returns, if still on.
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
          .then(() => this.ramp(LEVEL, FADE))
          .catch(() => {});
      }
    });
  }

  /* A straight fade of the master level from wherever it is now. */
  private ramp(to: number, seconds: number) {
    const ctx = this.ctx;
    const g = this.master?.gain;
    if (!ctx || !g) return;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + seconds);
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
    if (ctx.state === 'running') this.ramp(LEVEL, FADE);
    else {
      this.master!.gain.cancelScheduledValues(ctx.currentTime);
      this.master!.gain.setValueAtTime(0, ctx.currentTime);
      ctx
        .resume()
        .then(() => this.ramp(LEVEL, FADE))
        .catch(() => {});
    }
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
    if (this.ctx && this.master) {
      this.ramp(0, 0.3);
      const ctx = this.ctx;
      window.setTimeout(() => {
        if (!this.on) ctx.suspend().catch(() => {});
      }, 400);
    }
    this.on = false;
  }

  /* 0 = far away, 1 = right up against the screen. */
  setIntensity(x: number) {
    if (!this.on || !this.ctx || !this.filter) return;
    this.filter.frequency.setTargetAtTime(280 + x * 1500, this.ctx.currentTime, 0.4);
  }

  /* A breath of air for a cut. */
  whoosh() {
    if (!this.on || !this.ctx || !this.noise) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.55);
    bp.frequency.exponentialRampToValueAtTime(500, t + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 1.2);
  }

  /* The far screen waking: a low electrical hum that swells and settles. */
  hum() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    g.connect(lp).connect(this.master!);
    [100, 200, 300].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      o.connect(g);
      o.start(t);
      o.stop(t + 2.7);
    });
  }

  /* The Seen rising toward the camera: a tone that climbs until cut(). */
  rise() {
    if (!this.on || !this.ctx || this.riser) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 2.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 2);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 4);
    this.riser = { o, g };
    o.onended = () => {
      if (this.riser?.o === o) this.riser = null;
    };
  }

  /* Hard cut to silence: the riser stops and the room drops out for a beat. */
  cut() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (this.riser) {
      this.riser.g.gain.cancelScheduledValues(t);
      this.riser.g.gain.setTargetAtTime(0, t, 0.008);
      this.riser = null;
    }
    if (!this.on) return;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.01);
    this.master.gain.setTargetAtTime(LEVEL, t + 0.7, 0.5);
  }

  /* One soft tap for a typing dot; the last one is swallowed. */
  tap(swallowed = false) {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(swallowed ? 420 : 620, t);
    o.frequency.exponentialRampToValueAtTime(swallowed ? 180 : 360, t + 0.09);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = swallowed ? 380 : 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(swallowed ? 0.035 : 0.11, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (swallowed ? 0.08 : 0.18));
    o.connect(lp).connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.2);
  }

  /* The wide: the score rises into one short phrase. */
  phrase() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [329.63, 392, 493.88, 587.33].forEach((f, i) => {
      const at = t + i * 0.32;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.045, at + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.8);
      o.connect(g).connect(this.master!);
      o.start(at);
      o.stop(at + 1.9);
    });
  }

  /* A soft tick when a switch turns on. */
  tick() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1320, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.15);
  }

  /* The end card: a warm, open chord that swells and settles. */
  chord() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [220, 277.18, 329.63, 440].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05 - i * 0.008, t + 1.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
      o.connect(g).connect(this.master!);
      o.start(t);
      o.stop(t + 5.2);
    });
  }
}
