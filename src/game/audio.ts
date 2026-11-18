export class HorrorAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambientGain: GainNode | null = null;
  private humOsc: OscillatorNode | null = null;
  private humSubOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private sanityDroneOsc: OscillatorNode | null = null;
  private sanityDroneSubOsc: OscillatorNode | null = null;
  private sanityDroneGain: GainNode | null = null;
  private sanityWindSource: AudioBufferSourceNode | null = null;
  private sanityWindFilter: BiquadFilterNode | null = null;
  private sanityWindGain: GainNode | null = null;
  private sanityTensionOsc: OscillatorNode | null = null;
  private sanityTensionGain: GainNode | null = null;
  private tvStaticSource: AudioBufferSourceNode | null = null;
  private tvStaticGain: GainNode | null = null;
  private cctvMicSource: AudioBufferSourceNode | null = null;
  private cctvMicGain: GainNode | null = null;
  private taserChargeNodes: {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    noise: AudioBufferSourceNode;
    gain: GainNode;
  } | null = null;

  private heartbeatAccum = 0;
  private nextHeartbeatInterval = 0.85;
  private clockAccum = 0;
  private ambientEventAccum = 4;
  private lowSanityCueAccum = 6;
  private lowSanityWhisperAccum = 4.2;
  private lowSanityEnvAccum = 5.4;
  private sanityLayerIntensity = 0;
  private cctvCueAccum = 0.6;
  private escapeBreathAccum = 0.35;
  private escapeChaseBeatAccum = 0.4;
  private escapeScreamAccum = 4.2;
  private escapeFireAccum = 0.2;
  private escapePursuerStepAccum = 0.24;
  private escapePursuerStepIdx = 0;
  private escapeWhisperAccum = 1.3;
  private muted = false;
  private pendingWhisperSignal = false;
  private pendingParanormalSignal = false;

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.82;
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.55;
      this.ambientGain.connect(this.masterGain);

      this.noiseBuffer = this.createNoiseBuffer(2.5);
      this.startFluorescentHum();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.82, this.ctx.currentTime, 0.05);
    }
    if (muted) {
      this.stopNewsBroadcast();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private createNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private startFluorescentHum(): void {
    if (!this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;

    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0.0;
    this.humGain.connect(this.ambientGain);

    this.humOsc = this.ctx.createOscillator();
    this.humOsc.type = 'sawtooth';
    this.humOsc.frequency.setValueAtTime(120, now);

    this.humSubOsc = this.ctx.createOscillator();
    this.humSubOsc.type = 'sine';
    this.humSubOsc.frequency.setValueAtTime(60, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;

    this.humOsc.connect(filter);
    this.humSubOsc.connect(filter);
    filter.connect(this.humGain);

    this.humOsc.start(now);
    this.humSubOsc.start(now);

    // Subtle low-sanity paranoia drone (silent until sanity < 55%)
    this.sanityDroneGain = this.ctx.createGain();
    this.sanityDroneGain.gain.value = 0.0;
    this.sanityDroneGain.connect(this.ambientGain);

    this.sanityDroneOsc = this.ctx.createOscillator();
    this.sanityDroneOsc.type = 'sine';
    this.sanityDroneOsc.frequency.setValueAtTime(53, now);

    this.sanityDroneSubOsc = this.ctx.createOscillator();
    this.sanityDroneSubOsc.type = 'triangle';
    this.sanityDroneSubOsc.frequency.setValueAtTime(109, now);

    const droneLp = this.ctx.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.value = 240;

    this.sanityDroneOsc.connect(droneLp);
    this.sanityDroneSubOsc.connect(droneLp);
    droneLp.connect(this.sanityDroneGain);

    this.sanityDroneOsc.start(now);
    this.sanityDroneSubOsc.start(now);

    // Sub-40% sanity Layer 1B: breathing hollow corridor wind / void room tone
    if (this.noiseBuffer) {
      this.sanityWindGain = this.ctx.createGain();
      this.sanityWindGain.gain.value = 0.0;
      this.sanityWindGain.connect(this.ambientGain);

      this.sanityWindFilter = this.ctx.createBiquadFilter();
      this.sanityWindFilter.type = 'bandpass';
      this.sanityWindFilter.frequency.setValueAtTime(240, now);
      this.sanityWindFilter.Q.value = 1.4;

      this.sanityWindSource = this.ctx.createBufferSource();
      this.sanityWindSource.buffer = this.noiseBuffer;
      this.sanityWindSource.loop = true;

      this.sanityWindSource.connect(this.sanityWindFilter);
      this.sanityWindFilter.connect(this.sanityWindGain);
      this.sanityWindSource.start(now);
    }

    // Sub-25% sanity Layer 1C: subtle high dissonant tinnitus / psychological pressure tone
    this.sanityTensionGain = this.ctx.createGain();
    this.sanityTensionGain.gain.value = 0.0;
    this.sanityTensionGain.connect(this.ambientGain);

    this.sanityTensionOsc = this.ctx.createOscillator();
    this.sanityTensionOsc.type = 'triangle';
    this.sanityTensionOsc.frequency.setValueAtTime(2580, now);

    const tensionBp = this.ctx.createBiquadFilter();
    tensionBp.type = 'bandpass';
    tensionBp.frequency.value = 2580;
    tensionBp.Q.value = 5.5;

    this.sanityTensionOsc.connect(tensionBp);
    tensionBp.connect(this.sanityTensionGain);
    this.sanityTensionOsc.start(now);
  }

  public fadeDownSanityLayers(): void {
    this.sanityLayerIntensity = 0;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.sanityDroneGain) {
      this.sanityDroneGain.gain.setTargetAtTime(0, now, 0.14);
    }
    if (this.sanityWindGain) {
      this.sanityWindGain.gain.setTargetAtTime(0, now, 0.14);
    }
    if (this.sanityTensionGain) {
      this.sanityTensionGain.gain.setTargetAtTime(0, now, 0.12);
    }
  }

  public getSanityLayerMetrics(sanity: number): {
    active: boolean;
    intensity: number;
    whisperIntervalSec: number;
    envIntervalSec: number;
    voiceCount: number;
  } {
    if (sanity >= 40) {
      return {
        active: false,
        intensity: 0,
        whisperIntervalSec: 0,
        envIntervalSec: 0,
        voiceCount: 0,
      };
    }
    const linear = Math.max(0, Math.min(1, (40 - sanity) / 40));
    const intensity = Math.pow(linear, 1.15);
    return {
      active: true,
      intensity: Number(intensity.toFixed(3)),
      whisperIntervalSec: Number((1.15 + (1 - intensity) * 4.45).toFixed(2)),
      envIntervalSec: Number((1.85 + (1 - intensity) * 4.95).toFixed(2)),
      voiceCount: 2 + Math.floor(intensity * 2.4),
    };
  }

  public setAmbientHumLevel(level: number): void {
    if (!this.ctx || !this.humGain) return;
    this.humGain.gain.setTargetAtTime(Math.max(0, Math.min(0.08, level)), this.ctx.currentTime, 0.12);
    if (level <= 0) {
      this.fadeDownSanityLayers();
    }
  }

  public startTvStatic(level = 0.14): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    this.stopTvStatic();

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1800;
    bandpass.Q.value = 0.7;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.35);

    src.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);

    this.tvStaticSource = src;
    this.tvStaticGain = gain;
  }

  public pulseTvGlitch(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.4);

    // Low analog CRT thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.35);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.38, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playBroadcastChime(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freqs = [880, 660, 880];
    freqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.14);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.08, now + idx * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.12);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.13);
    });
  }

  public setTvStaticLevel(level: number): void {
    if (this.tvStaticGain && this.ctx) {
      this.tvStaticGain.gain.setTargetAtTime(Math.max(0.0001, level), this.ctx.currentTime, 0.14);
    }
  }

  public primeNewsVoice(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.getVoices();
      const primer = new SpeechSynthesisUtterance(' ');
      primer.volume = 0;
      window.speechSynthesis.speak(primer);
    } catch {
      // ignore
    }
  }

  private playNewsVoiceFallback(durationSeconds = 9.5): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const syllableStep = 0.22;
    const count = Math.floor(durationSeconds / syllableStep);
    for (let i = 0; i < count; i++) {
      // Natural phrase pause every ~9 syllables
      if (i % 9 === 8) continue;
      const t = now + i * syllableStep;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const pitch = 112 + Math.sin(i * 0.7) * 14 - (i % 5) * 2.5;
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.linearRampToValueAtTime(pitch - 7, t + 0.16);

      const formant = this.ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = 680 + (i % 3) * 190;
      formant.Q.value = 3.6;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.032, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.17);

      osc.connect(formant);
      formant.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.18);
    }
  }

  public speakNewsBroadcast(lines: string[]): void {
    if (this.muted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.playNewsVoiceFallback(9.5);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            /David|Mark|Daniel|Guy|Arthur|Google US English|Male/i.test(v.name),
        ) ??
        voices.find((v) => v.lang.startsWith('en')) ??
        null;

      let fallbackPlayed = false;
      lines.forEach((text, idx) => {
        const utt = new SpeechSynthesisUtterance(text);
        if (preferredVoice) utt.voice = preferredVoice;
        utt.lang = preferredVoice?.lang ?? 'en-US';
        utt.rate = 0.96;
        utt.pitch = 0.86;
        utt.volume = this.muted ? 0 : 0.92;
        if (idx === 0) {
          utt.onerror = () => {
            if (!fallbackPlayed) {
              fallbackPlayed = true;
              this.playNewsVoiceFallback(9.0);
            }
          };
        }
        window.speechSynthesis.speak(utt);
      });
    } catch {
      this.playNewsVoiceFallback(9.5);
    }
  }

  public speakNewsLine(line: string): void {
    this.unlock();
    this.speakNewsBroadcast([line]);
  }

  public stopNewsBroadcast(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  public stopTvStatic(): void {
    if (this.tvStaticSource && this.ctx) {
      try {
        if (this.tvStaticGain) {
          this.tvStaticGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.04);
        }
        this.tvStaticSource.stop(this.ctx.currentTime + 0.12);
      } catch {
        // ignore if already stopped
      }
      this.tvStaticSource = null;
      this.tvStaticGain = null;
    }
  }

  public playFootstep(sprint = false, crouch = false): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Heel tap + echoing hall tail (crouching uses a single soft muffled step without echo)
    const taps = crouch ? [0] : [0, 0.13, 0.27];
    taps.forEach((delay, idx) => {
      const src = this.ctx!.createBufferSource();
      src.buffer = this.noiseBuffer!;

      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = crouch
        ? 310 + Math.random() * 65
        : idx === 0
          ? 520 + Math.random() * 140
          : 380;
      filter.Q.value = crouch ? 1.2 : 1.6;

      const gain = this.ctx!.createGain();
      const baseVol =
        (crouch ? 0.028 : sprint ? 0.19 : 0.11) * (idx === 0 ? 1 : idx === 1 ? 0.3 : 0.11);
      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(baseVol, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + (crouch ? 0.08 : 0.11));

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      src.start(now + delay);
      src.stop(now + delay + (crouch ? 0.1 : 0.14));
    });
  }

  public playHeartbeat(intensity = 1, irregular = false): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const secondOffset = irregular ? 0.11 + Math.random() * 0.14 : 0.16;
    const beats: { offset: number; pitch: number; vol: number }[] = [
      { offset: 0, pitch: irregular ? 52 : 58, vol: 0.24 * intensity },
      { offset: secondOffset, pitch: irregular ? 42 : 46, vol: 0.17 * intensity },
    ];
    // Occasional faint phantom third flutter when sanity is critically low
    if (irregular && Math.random() < 0.34) {
      beats.push({
        offset: secondOffset + 0.14 + Math.random() * 0.08,
        pitch: 39,
        vol: 0.11 * intensity,
      });
    }
    beats.forEach((b) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(b.pitch, now + b.offset);
      osc.frequency.exponentialRampToValueAtTime(24, now + b.offset + 0.14);

      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now + b.offset);
      g.gain.linearRampToValueAtTime(Math.min(0.65, b.vol), now + b.offset + 0.018);
      g.gain.exponentialRampToValueAtTime(0.001, now + b.offset + 0.18);

      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + b.offset);
      osc.stop(now + b.offset + 0.2);
    });
  }

  public playClockTick(backwards = false): void {
    if (!this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(backwards ? 1480 : 1120, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.025);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.055, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(g);
    g.connect(this.ambientGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playDistantSchoolBell(): void {
    if (!this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    const partials = [440, 882, 1318, 1765];
    partials.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const lfo = this.ctx!.createOscillator();
      lfo.frequency.value = 14;
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.value = 0.012 / (idx + 1);

      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.045 / (idx + 1), now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 2.6);

      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(this.ambientGain!);

      osc.start(now);
      lfo.start(now);
      osc.stop(now + 2.7);
      lfo.stop(now + 2.7);
    });
  }

  public playDistortedSchoolBell(volumeScale = 1): void {
    if (!this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    const scale = Math.max(0.4, Math.min(2.4, volumeScale));
    // Detuned, pitch-warping distant school bell for low-sanity audio hallucinations
    const partials = [418, 846, 1255, 1692];
    partials.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.87, now + 2.8);

      const wobble = this.ctx!.createOscillator();
      wobble.frequency.value = 5.5 + idx * 1.3;
      const wobbleGain = this.ctx!.createGain();
      wobbleGain.gain.value = 8 + idx * 5;
      wobble.connect(wobbleGain);
      wobbleGain.connect(osc.frequency);

      const bp = this.ctx!.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1050;
      bp.Q.value = 1.6;

      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime((0.038 * scale) / (idx + 1), now + 0.09);
      g.gain.exponentialRampToValueAtTime(0.0004, now + 2.9);

      osc.connect(bp);
      bp.connect(g);
      g.connect(this.ambientGain!);

      osc.start(now);
      wobble.start(now);
      osc.stop(now + 3.0);
      wobble.stop(now + 3.0);
    });
  }

  public playDistantWhisperCue(volumeScale = 1): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const scale = Math.max(0.4, Math.min(2.4, volumeScale));
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 5.5;
    filter.frequency.setValueAtTime(1150, now);
    filter.frequency.linearRampToValueAtTime(1680, now + 0.45);
    filter.frequency.linearRampToValueAtTime(720, now + 1.45);

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = (Math.random() > 0.5 ? 1 : -1) * (0.55 + Math.random() * 0.35);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.068 * scale, now + 0.32);
    g.gain.exponentialRampToValueAtTime(0.0006, now + 1.55);

    src.connect(filter);
    filter.connect(panner);
    panner.connect(g);
    g.connect(this.ambientGain);
    src.start(now);
    src.stop(now + 1.6);
  }

  /**
   * Layer 2 (Sanity < 40%): Multi-voice overlapping stereo whisper swarm with syllabic
   * formant modulation and close-ear sub-vocal breath at high intensity.
   */
  public playLayeredWhisperCluster(intensity: number): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
    const clamped = Math.max(0.05, Math.min(1, intensity));
    const now = this.ctx.currentTime;
    const voiceCount = 2 + Math.floor(clamped * 2.4);

    for (let i = 0; i < voiceCount; i++) {
      const delay = i * (0.14 + Math.random() * 0.22);
      const dur = 0.95 + Math.random() * 0.65 + clamped * 0.35;
      const start = now + delay;
      const end = start + dur;

      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      // Dual vocal formant bandpass filters (whispered vowel & sibilant bands)
      const f1 = this.ctx.createBiquadFilter();
      f1.type = 'bandpass';
      const baseF1 = 680 + Math.random() * 280;
      f1.frequency.setValueAtTime(baseF1, start);
      f1.frequency.linearRampToValueAtTime(baseF1 * (1.28 + Math.random() * 0.25), start + dur * 0.45);
      f1.frequency.linearRampToValueAtTime(baseF1 * 0.82, end);
      f1.Q.value = 4.2 + clamped * 2.0;

      const f2 = this.ctx.createBiquadFilter();
      f2.type = 'bandpass';
      const baseF2 = 1580 + Math.random() * 620;
      f2.frequency.setValueAtTime(baseF2, start);
      f2.frequency.linearRampToValueAtTime(baseF2 * 1.24, start + dur * 0.35);
      f2.frequency.linearRampToValueAtTime(baseF2 * 0.72, end);
      f2.Q.value = 5.0;

      // Syllabic flutter LFO so whispers sound like hushed unintelligible phrases
      const tremolo = this.ctx.createOscillator();
      tremolo.type = 'sine';
      tremolo.frequency.setValueAtTime(5.8 + Math.random() * 4.5, start);
      const tremoloGain = this.ctx.createGain();
      tremoloGain.gain.value = 0.016 + clamped * 0.024;

      const panner = this.ctx.createStereoPanner();
      const side = i % 2 === 0 ? -1 : 1;
      const startPan = side * (0.42 + Math.random() * 0.46);
      panner.pan.setValueAtTime(startPan, start);
      if (clamped > 0.48) {
        // Unsettling ear-to-ear drift at critically low sanity
        panner.pan.linearRampToValueAtTime(-startPan * 0.75, end);
      }

      const voiceGain = this.ctx.createGain();
      const peakGain = (0.045 + clamped * 0.088) * (i === 0 ? 1.0 : 0.78);
      voiceGain.gain.setValueAtTime(0.0008, start);
      voiceGain.gain.linearRampToValueAtTime(peakGain, start + dur * 0.28);
      voiceGain.gain.exponentialRampToValueAtTime(0.0006, end);

      src.connect(f1);
      src.connect(f2);
      f1.connect(voiceGain);
      f2.connect(voiceGain);
      tremolo.connect(tremoloGain);
      tremoloGain.connect(voiceGain.gain);
      voiceGain.connect(panner);
      panner.connect(this.ambientGain);

      src.start(start, Math.random() * 1.1);
      src.stop(end + 0.04);
      tremolo.start(start);
      tremolo.stop(end + 0.04);

      // Subtle sub-vocal close-ear breathy murmur when sanity drops deeper (<22%)
      if (clamped > 0.45 && i < 2) {
        const sub = this.ctx.createOscillator();
        sub.type = 'triangle';
        const pitch = 116 + Math.random() * 34;
        sub.frequency.setValueAtTime(pitch, start);
        sub.frequency.linearRampToValueAtTime(pitch * 0.78, end);

        const subBp = this.ctx.createBiquadFilter();
        subBp.type = 'bandpass';
        subBp.frequency.value = 540;
        subBp.Q.value = 3.2;

        const sg = this.ctx.createGain();
        sg.gain.setValueAtTime(0.0005, start);
        sg.gain.linearRampToValueAtTime(0.014 * clamped, start + dur * 0.3);
        sg.gain.exponentialRampToValueAtTime(0.0005, end);

        sub.connect(subBp);
        subBp.connect(sg);
        sg.connect(panner);
        sub.start(start);
        sub.stop(end + 0.04);
      }
    }
  }

  /**
   * Layer 3 (Sanity < 40%): Dynamic unsettling environmental horror audio cues
   * (approaching phantom footsteps, hollow metallic groans, warped bell, door rattle & cold breath).
   */
  public playLayeredEnvironmentalCue(intensity: number): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
    const clamped = Math.max(0.05, Math.min(1, intensity));
    const roll = Math.random();

    if (roll < 0.28) {
      this.playPhantomFootstepsBehind(clamped);
    } else if (roll < 0.54) {
      this.playDistantMetalGroan(clamped);
    } else if (roll < 0.78) {
      this.playDistortedSchoolBell(0.75 + clamped * 1.45);
    } else {
      this.playDoorRattleAndBreath(clamped);
    }

    // At critically low sanity (< 18%), occasionally layer a secondary distant thump/whisper tail
    if (clamped > 0.55 && Math.random() < 0.42) {
      this.playDistantWhisperCue(0.65 + clamped * 0.85);
    }
  }

  private playPhantomFootstepsBehind(intensity: number): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const steps = 2 + Math.floor(intensity * 2.2);
    const startSide = Math.random() < 0.5 ? -1 : 1;

    for (let i = 0; i < steps; i++) {
      const t = now + i * (0.34 - intensity * 0.08 + Math.random() * 0.06);
      const prog = steps <= 1 ? 1 : i / (steps - 1);
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = startSide * (0.72 - prog * 0.42);
      panner.connect(this.ambientGain);

      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 340 + i * 45 + Math.random() * 80;
      bp.Q.value = 1.6;

      const vol = (0.042 + intensity * 0.075) * (0.65 + prog * 0.55);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.001, t);
      ng.gain.linearRampToValueAtTime(vol, t + 0.012);
      ng.gain.exponentialRampToValueAtTime(0.0008, t + 0.14);

      src.connect(bp);
      bp.connect(ng);
      ng.connect(panner);
      src.start(t, Math.random() * 1.2, 0.16);

      const thud = this.ctx.createOscillator();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(84 + prog * 18, t);
      thud.frequency.exponentialRampToValueAtTime(32, t + 0.1);
      const tg = this.ctx.createGain();
      tg.gain.setValueAtTime(0.001, t);
      tg.gain.linearRampToValueAtTime(vol * 1.15, t + 0.01);
      tg.gain.exponentialRampToValueAtTime(0.0008, t + 0.12);
      thud.connect(tg);
      tg.connect(panner);
      thud.start(t);
      thud.stop(t + 0.14);
    }
  }

  private playDistantMetalGroan(intensity: number): void {
    if (!this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = (Math.random() > 0.5 ? 1 : -1) * (0.45 + Math.random() * 0.4);
    panner.connect(this.ambientGain);

    [138, 144.5].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.52, now + 1.85);

      const bp = this.ctx!.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(420, now);
      bp.frequency.linearRampToValueAtTime(240, now + 1.85);
      bp.Q.value = 5.2;

      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.0008, now);
      g.gain.linearRampToValueAtTime((0.036 + intensity * 0.052) / (idx + 1), now + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 1.9);

      osc.connect(bp);
      bp.connect(g);
      g.connect(panner);
      osc.start(now);
      osc.stop(now + 1.95);
    });
  }

  private playDoorRattleAndBreath(intensity: number): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = (Math.random() > 0.5 ? 1 : -1) * (0.58 + Math.random() * 0.3);
    panner.connect(this.ambientGain);

    // Rapid metallic handle jiggle
    [0, 0.11, 0.24].forEach((offset) => {
      const src = this.ctx!.createBufferSource();
      src.buffer = this.noiseBuffer!;
      const bp = this.ctx!.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1280 + Math.random() * 340;
      bp.Q.value = 3.8;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now + offset);
      g.gain.linearRampToValueAtTime(0.045 + intensity * 0.055, now + offset + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, now + offset + 0.09);
      src.connect(bp);
      bp.connect(g);
      g.connect(panner);
      src.start(now + offset, Math.random() * 1.1, 0.11);
    });

    // Cold exhalation tail
    const breath = this.ctx.createBufferSource();
    breath.buffer = this.noiseBuffer;
    const bFilter = this.ctx.createBiquadFilter();
    bFilter.type = 'bandpass';
    bFilter.frequency.setValueAtTime(760, now + 0.35);
    bFilter.frequency.linearRampToValueAtTime(420, now + 1.15);
    bFilter.Q.value = 3.0;
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.0008, now + 0.35);
    bg.gain.linearRampToValueAtTime(0.038 + intensity * 0.058, now + 0.52);
    bg.gain.exponentialRampToValueAtTime(0.0006, now + 1.2);
    breath.connect(bFilter);
    bFilter.connect(bg);
    bg.connect(panner);
    breath.start(now + 0.35, 0.2, 0.9);
  }

  public consumeWhisperSignal(): boolean {
    const had = this.pendingWhisperSignal;
    this.pendingWhisperSignal = false;
    return had;
  }

  public consumeParanormalSignal(): boolean {
    const had = this.pendingParanormalSignal;
    this.pendingParanormalSignal = false;
    return had;
  }

  public playLightFlickerBurst(): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const bursts = [0, 0.24, 0.62, 1.05];
    bursts.forEach((offset) => {
      const src = this.ctx!.createBufferSource();
      src.buffer = this.noiseBuffer!;
      const bp = this.ctx!.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 180 + Math.random() * 140;
      bp.Q.value = 3.2;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now + offset);
      g.gain.linearRampToValueAtTime(0.095, now + offset + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.ambientGain!);
      src.start(now + offset);
      src.stop(now + offset + 0.18);
    });
  }

  public playParanormalSound(triggerSanityDrain = true): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
    if (triggerSanityDrain && !this.muted) {
      this.pendingParanormalSignal = true;
    }
    const now = this.ctx.currentTime;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.random() > 0.5 ? -0.72 : 0.72;
    panner.connect(this.ambientGain);

    // Distant hollow metallic thud + eerie scraping resonance
    const thud = this.ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(112, now);
    thud.frequency.exponentialRampToValueAtTime(38, now + 0.42);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.001, now);
    tg.gain.linearRampToValueAtTime(0.14, now + 0.02);
    tg.gain.exponentialRampToValueAtTime(0.0008, now + 0.48);
    thud.connect(tg);
    tg.connect(panner);
    thud.start(now);
    thud.stop(now + 0.52);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1450, now + 0.18);
    bp.frequency.linearRampToValueAtTime(620, now + 1.05);
    bp.Q.value = 6.0;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now + 0.18);
    ng.gain.linearRampToValueAtTime(0.075, now + 0.34);
    ng.gain.exponentialRampToValueAtTime(0.0008, now + 1.15);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(panner);
    src.start(now + 0.18);
    src.stop(now + 1.2);
  }

  public playWhisper(triggerSanityDrain = true): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
    if (triggerSanityDrain && !this.muted) {
      this.pendingWhisperSignal = true;
    }
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4.5;
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.linearRampToValueAtTime(1950, now + 0.55);
    filter.frequency.linearRampToValueAtTime(750, now + 1.3);

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.random() > 0.5 ? -0.65 : 0.65;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.09, now + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 1.45);

    src.connect(filter);
    filter.connect(panner);
    panner.connect(g);
    g.connect(this.ambientGain);

    src.start(now);
    src.stop(now + 1.5);
  }

  public playDoorCreak(triggerSanityDrain = false): void {
    if (!this.ctx || !this.ambientGain) return;
    if (triggerSanityDrain && !this.muted) {
      this.pendingParanormalSignal = true;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.linearRampToValueAtTime(240, now + 0.45);
    osc.frequency.linearRampToValueAtTime(145, now + 1.1);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 580;
    filter.Q.value = 7;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 1.15);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.ambientGain);
    osc.start(now);
    osc.stop(now + 1.2);
  }

  public playHideToggle(entering: boolean): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(entering ? 650 : 900, now);
    lp.frequency.exponentialRampToValueAtTime(entering ? 240 : 480, now + 0.22);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.25);
  }

  public startTaserCharge(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    this.stopTaserCharge();

    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 2.0);
    gain.connect(this.masterGain);

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(175, now);
    osc1.frequency.exponentialRampToValueAtTime(1420, now + 2.0);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, now);
    lp.frequency.exponentialRampToValueAtTime(4200, now + 2.0);
    osc1.connect(lp);
    lp.connect(gain);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(350, now);
    osc2.frequency.exponentialRampToValueAtTime(2840, now + 2.0);
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.45;
    osc2.connect(g2);
    g2.connect(gain);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600, now);
    bp.frequency.exponentialRampToValueAtTime(4600, now + 2.0);
    bp.Q.value = 1.8;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.25;
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(gain);

    osc1.start(now);
    osc2.start(now);
    noise.start(now);

    this.taserChargeNodes = { osc1, osc2, noise, gain };
  }

  public stopTaserCharge(): void {
    if (!this.taserChargeNodes || !this.ctx) return;
    const nodes = this.taserChargeNodes;
    this.taserChargeNodes = null;
    const now = this.ctx.currentTime;
    try {
      nodes.gain.gain.cancelScheduledValues(now);
      nodes.gain.gain.setTargetAtTime(0.0001, now, 0.02);
      nodes.osc1.stop(now + 0.08);
      nodes.osc2.stop(now + 0.08);
      nodes.noise.stop(now + 0.08);
    } catch {
      // ignore if already stopped
    }
  }

  public playTaser(): void {
    this.stopTaserCharge();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Loud electrical arc crackle
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 1.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.68);

    // High-voltage buzz
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.setValueAtTime(340, now + 0.08);
    osc.frequency.setValueAtTime(180, now + 0.2);

    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.28, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.58);
  }

  public playCardInspect(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.09);
  }

  public playScanHum(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(520, now + 1.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.55);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.6);
  }

  public playScanDone(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [740, 980].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.09, now + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.14);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.16);
    });
  }

  public playGateBuzz(breach = false): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(breach ? 88 : 130, now);
    if (breach) osc.frequency.exponentialRampToValueAtTime(48, now + 0.7);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = breach ? 780 : 420;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(breach ? 0.28 : 0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (breach ? 0.75 : 0.32));
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (breach ? 0.8 : 0.35));
  }

  public playRoundResult(correct: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    if (correct) {
      const notes = [330, 440, 554];
      notes.forEach((f, i) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.09);
        const g = this.ctx!.createGain();
        g.gain.setValueAtTime(0.11, now + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.35);
        osc.connect(g);
        g.connect(this.masterGain!);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.38);
      });
    } else {
      // Harsh low reset buzzer
      [110, 116].forEach((f) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.linearRampToValueAtTime(75, now + 0.6);
        const lp = this.ctx!.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 480;
        const g = this.ctx!.createGain();
        g.gain.setValueAtTime(0.22, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.connect(lp);
        lp.connect(g);
        g.connect(this.masterGain!);
        osc.start(now);
        osc.stop(now + 0.68);
      });
    }
  }

  public playAnomalyCaughtScream(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Piercing dual-formant unnatural anomaly shriek when catching the player
    const voices = [
      { startFreq: 690, peakFreq: 1380, endFreq: 460, formantHz: 1450, gain: 0.34 },
      { startFreq: 860, peakFreq: 1740, endFreq: 520, formantHz: 2350, gain: 0.28 },
    ];

    voices.forEach((v, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(v.startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(v.peakFreq, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(v.endFreq, now + 1.08);

      // Guttural unnatural FM rasp
      const rasp = this.ctx!.createOscillator();
      rasp.type = 'triangle';
      rasp.frequency.value = 34 + idx * 17;
      const raspGain = this.ctx!.createGain();
      raspGain.gain.value = 95;
      rasp.connect(raspGain);
      raspGain.connect(osc.frequency);

      const throat = this.ctx!.createBiquadFilter();
      throat.type = 'bandpass';
      throat.frequency.setValueAtTime(v.formantHz, now);
      throat.frequency.linearRampToValueAtTime(v.formantHz * 0.72, now + 1.05);
      throat.Q.value = 2.6;

      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(v.gain, now + 0.035);
      g.gain.setValueAtTime(v.gain * 0.92, now + 0.55);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

      osc.connect(throat);
      throat.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      rasp.start(now);
      osc.stop(now + 1.18);
      rasp.stop(now + 1.18);
    });

    // Breathy vocal screech noise layer
    const breathSrc = this.ctx.createBufferSource();
    breathSrc.buffer = this.noiseBuffer;
    const breathBp = this.ctx.createBiquadFilter();
    breathBp.type = 'bandpass';
    breathBp.frequency.setValueAtTime(2100, now);
    breathBp.frequency.exponentialRampToValueAtTime(980, now + 1.1);
    breathBp.Q.value = 1.9;
    const breathG = this.ctx.createGain();
    breathG.gain.setValueAtTime(0.001, now);
    breathG.gain.linearRampToValueAtTime(0.42, now + 0.04);
    breathG.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
    breathSrc.connect(breathBp);
    breathBp.connect(breathG);
    breathG.connect(this.masterGain);
    breathSrc.start(now);
    breathSrc.stop(now + 1.18);
  }

  public playJumpscare(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // 1. Sub-bass impact slam
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.85);
    const subG = this.ctx.createGain();
    subG.gain.setValueAtTime(0.75, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    sub.connect(subG);
    subG.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 1.0);

    // 2. Piercing dissonant screech cluster
    [523, 554, 784, 1108].forEach((f) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.86, now + 0.9);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.05);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 1.1);
    });

    // 3. Harsh roaring white noise blast
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.6;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.45, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 1.05);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.masterGain);
    src.start(now);
    src.stop(now + 1.1);

    // 4. Anomaly vocal scream on catch
    this.playAnomalyCaughtScream();
  }

  public update(
    dt: number,
    options: {
      playing: boolean;
      round: number;
      entityNearby: boolean;
      entityAlerted: boolean;
      isHiding?: boolean;
      sanity?: number;
      backwardsClock: boolean;
      clockFrozen: boolean;
    },
  ): void {
    if (!this.ctx) return;
    if (!options.playing) {
      this.fadeDownSanityLayers();
      return;
    }

    const now = this.ctx.currentTime;
    const sanity = options.sanity ?? 100;
    const lowSanityFactor = sanity < 55 ? Math.min(1, (55 - sanity) / 45) : 0;
    const linearCritical = sanity < 40 ? Math.min(1, (40 - sanity) / 40) : 0;
    const criticalSanityFactor = linearCritical > 0 ? Math.pow(linearCritical, 1.15) : 0;
    this.sanityLayerIntensity = criticalSanityFactor;

    // Layer 1A: Reactive low-sanity paranoia drone (escalates & detunes below 40% sanity)
    if (this.sanityDroneGain) {
      this.sanityDroneGain.gain.setTargetAtTime(
        lowSanityFactor * 0.062 + criticalSanityFactor * 0.052,
        now,
        0.22,
      );
    }
    if (this.sanityDroneSubOsc) {
      const detune =
        criticalSanityFactor > 0
          ? Math.sin(now * 0.7) * 7.5 * criticalSanityFactor
          : 0;
      this.sanityDroneSubOsc.frequency.setTargetAtTime(109 + detune, now, 0.2);
    }

    // Layer 1B: Breathing hollow corridor wind / void room tone (< 40% sanity)
    if (this.sanityWindGain && this.sanityWindFilter) {
      const windLevel = criticalSanityFactor > 0 ? 0.014 + criticalSanityFactor * 0.068 : 0;
      this.sanityWindGain.gain.setTargetAtTime(windLevel, now, 0.28);
      if (criticalSanityFactor > 0) {
        const sweepHz = 210 + criticalSanityFactor * 165 + Math.sin(now * 0.62) * 85;
        this.sanityWindFilter.frequency.setTargetAtTime(sweepHz, now, 0.22);
      }
    }

    // Layer 1C: Subtle dissonant high psychological pressure whine (< 25% sanity -> 0%)
    if (this.sanityTensionGain && this.sanityTensionOsc) {
      const tinnitusFactor = sanity < 25 ? Math.max(0, Math.min(1, (25 - sanity) / 25)) : 0;
      this.sanityTensionGain.gain.setTargetAtTime(tinnitusFactor * 0.016, now, 0.3);
      if (tinnitusFactor > 0) {
        this.sanityTensionOsc.frequency.setTargetAtTime(
          2580 + Math.sin(now * 1.9) * 28 * tinnitusFactor,
          now,
          0.18,
        );
      }
    }

    // Heartbeat BPM, volume, and irregular rhythms as sanity drops below 40%
    const baseBpm = 54 + (options.round - 1) * 10 + Math.round(lowSanityFactor * 24);
    const bpm =
      options.isHiding && options.entityNearby
        ? Math.min(172, baseBpm + 62)
        : options.entityAlerted
          ? Math.min(165, baseBpm + 48)
          : options.entityNearby
            ? Math.min(148, baseBpm + 26)
            : baseBpm;
    const regularInterval = 60 / bpm;

    this.heartbeatAccum += dt;
    if (this.heartbeatAccum >= this.nextHeartbeatInterval) {
      this.heartbeatAccum = 0;
      const isIrregular = criticalSanityFactor > 0;
      const jitter = isIrregular
        ? 1 + (Math.random() * 0.85 - 0.4) * criticalSanityFactor
        : 1;
      this.nextHeartbeatInterval = Math.max(0.32, regularInterval * jitter);

      const baseIntensity =
        options.isHiding && options.entityNearby
          ? 2.25
          : options.entityAlerted
            ? 1.55
            : options.entityNearby
              ? 1.25
              : isIrregular
                ? 0.36 + criticalSanityFactor * 0.46
                : 0.45 + (options.round / 8) * 0.55;
      this.playHeartbeat(baseIntensity + lowSanityFactor * 0.32, isIrregular);
    }

    // Layer 2 & Layer 3: Below 40% sanity, dynamically trigger layered multi-voice whispers,
    // unsettling environmental sounds, and irregular heartbeat stutters, escalating toward 0%.
    if (criticalSanityFactor > 0) {
      // Layer 2: Multi-voice stereo whisper swarm
      this.lowSanityWhisperAccum -= dt;
      if (this.lowSanityWhisperAccum <= 0) {
        const minWhisperInterval = 1.15 + (1 - criticalSanityFactor) * 4.45;
        this.lowSanityWhisperAccum =
          minWhisperInterval + Math.random() * (0.9 + (1 - criticalSanityFactor) * 1.9);
        this.playLayeredWhisperCluster(criticalSanityFactor);
      }

      // Layer 3: Dynamic environmental horror cues (footsteps behind, metal groans, warped bell, door rattle)
      this.lowSanityEnvAccum -= dt;
      if (this.lowSanityEnvAccum <= 0) {
        const minEnvInterval = 1.85 + (1 - criticalSanityFactor) * 4.95;
        this.lowSanityEnvAccum =
          minEnvInterval + Math.random() * (1.15 + (1 - criticalSanityFactor) * 2.1);
        this.playLayeredEnvironmentalCue(criticalSanityFactor);
      }

      // Irregular off-beat heartbeat stutter bursts
      this.lowSanityCueAccum -= dt;
      if (this.lowSanityCueAccum <= 0) {
        const minStutterInterval = 2.6 + (1 - criticalSanityFactor) * 5.8;
        this.lowSanityCueAccum =
          minStutterInterval + Math.random() * (1.2 + (1 - criticalSanityFactor) * 2.0);
        this.playHeartbeat(0.38 + criticalSanityFactor * 0.62, true);
      }
    } else {
      this.lowSanityWhisperAccum = Math.min(this.lowSanityWhisperAccum, 2.2);
      this.lowSanityEnvAccum = Math.min(this.lowSanityEnvAccum, 3.0);
      this.lowSanityCueAccum = Math.min(this.lowSanityCueAccum, 3.5);
    }

    // Clock tick
    if (!options.clockFrozen) {
      const tickInterval = options.backwardsClock ? 0.34 : 1.0;
      this.clockAccum += dt;
      if (this.clockAccum >= tickInterval) {
        this.clockAccum -= tickInterval;
        this.playClockTick(options.backwardsClock);
      }
    }

    // Random eerie ambient sounds (whispers & unexplained paranormal sounds)
    this.ambientEventAccum -= dt;
    if (this.ambientEventAccum <= 0) {
      this.ambientEventAccum = 11 + Math.random() * 10;
      const roll = Math.random();
      if (roll < 0.38) {
        this.playWhisper(true);
      } else if (roll < 0.7) {
        this.playParanormalSound(true);
      } else {
        this.playDoorCreak(true);
      }
    }
  }

  public playCctvSwitch(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Relay click
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.11, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(cg);
    cg.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.045);

    // Quick static squelch
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 1.1;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.12, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.15);
  }

  public playUiClick(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.045);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playAnomalyTransform(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + 1.35);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(620, now);
    lp.frequency.exponentialRampToValueAtTime(160, now + 1.35);

    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.linearRampToValueAtTime(0.28, now + 0.14);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

    sub.connect(lp);
    lp.connect(sg);
    sg.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 1.5);

    this.playDistortedSchoolBell(0.85);
  }

  public playAnomalySurge(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    this.playDistantScream(0);

    const pulse = this.ctx.createOscillator();
    pulse.type = 'triangle';
    pulse.frequency.setValueAtTime(140, now);
    pulse.frequency.exponentialRampToValueAtTime(48, now + 0.65);
    const pg = this.ctx.createGain();
    pg.gain.setValueAtTime(0.24, now);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    pulse.connect(pg);
    pg.connect(this.masterGain);
    pulse.start(now);
    pulse.stop(now + 0.72);
  }

  public playAnomalyHuntCatch(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Non-graphic ominous shadow whoosh + deep resonance
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(620, now);
    bp.frequency.exponentialRampToValueAtTime(190, now + 0.42);
    bp.Q.value = 1.8;

    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.22, now + 0.04);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.masterGain);
    src.start(now, 0, 0.5);

    const thud = this.ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(128, now);
    thud.frequency.exponentialRampToValueAtTime(38, now + 0.36);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.26, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    thud.connect(tg);
    tg.connect(this.masterGain);
    thud.start(now);
    thud.stop(now + 0.42);
  }

  private ensureCctvMicLoop(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.cctvMicSource) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1350;
    bp.Q.value = 0.85;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0;

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);

    this.cctvMicSource = src;
    this.cctvMicGain = gain;
  }

  private playPencilWrite(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const strokes = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < strokes; i++) {
      const t = now + i * 0.19;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3100 + Math.random() * 600;
      bp.Q.value = 2.4;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      src.start(t);
      src.stop(t + 0.13);
    }
  }

  private playChalkAndMurmur(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    // Soft distant teacher voice formant pulse + chalk tap
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145 + Math.random() * 30, now);
    osc.frequency.linearRampToValueAtTime(128, now + 0.45);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 620;
    bp.Q.value = 2.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.042, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  private playStudentYawnWhisper(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(920, now);
    bp.frequency.linearRampToValueAtTime(640, now + 0.55);
    bp.Q.value = 3.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.026, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.65);
  }

  private playAnomalyMicCue(hunting: boolean): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    if (hunting) {
      this.playFootstep(true);
    } else {
      if (!this.muted) this.pendingWhisperSignal = true;
      // Subtle monotone repeating whisper cadence over CCTV mic
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(96, now);
      osc.frequency.linearRampToValueAtTime(92, now + 0.55);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 820;
      bp.Q.value = 4.0;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.045, now + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      osc.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  }

  public updateCctvFeed(
    dt: number,
    active: boolean,
    mode: 'quiet' | 'class_normal' | 'anomaly_reveal' | 'anomaly_hunt',
  ): void {
    if (!this.ctx) return;
    this.ensureCctvMicLoop();
    if (this.cctvMicGain) {
      const targetGain = !active ? 0 : mode === 'anomaly_hunt' ? 0.052 : mode === 'anomaly_reveal' ? 0.036 : 0.024;
      this.cctvMicGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
    }
    if (!active) return;

    this.cctvCueAccum -= dt;
    if (this.cctvCueAccum <= 0) {
      if (mode === 'class_normal') {
        this.cctvCueAccum = 1.1 + Math.random() * 0.9;
        const r = Math.random();
        if (r < 0.5) this.playPencilWrite();
        else if (r < 0.82) this.playChalkAndMurmur();
        else this.playStudentYawnWhisper();
      } else if (mode === 'anomaly_reveal') {
        this.cctvCueAccum = 1.45 + Math.random() * 0.55;
        this.playAnomalyMicCue(false);
      } else if (mode === 'anomaly_hunt') {
        this.cctvCueAccum = 0.65 + Math.random() * 0.45;
        this.playAnomalyMicCue(true);
      } else {
        this.cctvCueAccum = 3.5;
      }
    }
  }

  // =========================================================================
  // SHIFT 5 FINAL ESCAPE AUDIO
  // =========================================================================
  public playMetalCrash(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const slam = this.ctx.createOscillator();
    slam.type = 'triangle';
    slam.frequency.setValueAtTime(165, now);
    slam.frequency.exponentialRampToValueAtTime(38, now + 0.42);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.45, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    slam.connect(sg);
    sg.connect(this.masterGain);
    slam.start(now);
    slam.stop(now + 0.5);

    [420, 695, 1120].forEach((freq, idx) => {
      const clang = this.ctx!.createOscillator();
      clang.type = 'sawtooth';
      clang.frequency.setValueAtTime(freq, now + idx * 0.03);
      clang.frequency.exponentialRampToValueAtTime(freq * 0.74, now + 0.45);
      const bp = this.ctx!.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq * 1.1;
      bp.Q.value = 3.2;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.14 / (idx + 1), now + idx * 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      clang.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain!);
      clang.start(now + idx * 0.03);
      clang.stop(now + 0.52);
    });

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.28, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    src.connect(hp);
    hp.connect(ng);
    ng.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.48);
  }

  public playElectricalSpark(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3400;
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.35);

    const buzz = this.ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(240, now);
    buzz.frequency.setValueAtTime(520, now + 0.05);
    buzz.frequency.setValueAtTime(140, now + 0.14);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.18, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    buzz.connect(bg);
    bg.connect(this.masterGain);
    buzz.start(now);
    buzz.stop(now + 0.3);
  }

  public playDistantScream(pan?: number): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(540 + Math.random() * 140, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(410, now + 1.05);

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1180;
    bp.Q.value = 2.8;

    const panner = this.ctx.createStereoPanner();
    panner.pan.value =
      typeof pan === 'number'
        ? Math.max(-0.82, Math.min(0.82, pan))
        : (Math.random() - 0.5) * 1.1;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 1.1);

    osc.connect(bp);
    bp.connect(panner);
    panner.connect(g);
    g.connect(this.ambientGain);
    osc.start(now);
    osc.stop(now + 1.15);
  }

  public playSpatialPursuerFootstep(pan: number, proximity: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const clampedPan = Math.max(-0.82, Math.min(0.82, pan));
    const prox = Math.max(0.12, Math.min(1, proximity));

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = clampedPan;
    panner.connect(this.masterGain);

    // Subtle rushing grit/scrape of approaching footstep
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 390 + Math.random() * 160;
    bp.Q.value = 1.35;

    const ng = this.ctx.createGain();
    const gritVol = 0.03 + prox * 0.068;
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(gritVol, now + 0.012);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    src.connect(bp);
    bp.connect(ng);
    ng.connect(panner);
    src.start(now, Math.random() * 1.4, 0.14);

    // Soft low heel impact
    const thud = this.ctx.createOscillator();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(92 + Math.random() * 18, now);
    thud.frequency.exponentialRampToValueAtTime(34, now + 0.085);

    const tg = this.ctx.createGain();
    const thudVol = 0.032 + prox * 0.078;
    tg.gain.setValueAtTime(0.001, now);
    tg.gain.linearRampToValueAtTime(thudVol, now + 0.008);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    thud.connect(tg);
    tg.connect(panner);
    thud.start(now);
    thud.stop(now + 0.11);
  }

  public playSpatialWhisperCue(pan: number, proximity: number): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const clampedPan = Math.max(-0.82, Math.min(0.82, pan));
    const prox = Math.max(0.12, Math.min(1, proximity));

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = clampedPan;
    panner.connect(this.ambientGain);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(860 + Math.random() * 180, now);
    bp.frequency.linearRampToValueAtTime(1640, now + 0.24);
    bp.frequency.linearRampToValueAtTime(660, now + 0.78);
    bp.Q.value = 4.6;

    const g = this.ctx.createGain();
    const peak = 0.026 + prox * 0.054;
    g.gain.setValueAtTime(0.0008, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.16);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.82);

    src.connect(bp);
    bp.connect(g);
    g.connect(panner);
    src.start(now, Math.random() * 1.1, 0.85);
  }

  public playHeavyBreath(intensity = 1): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(760, now);
    bp.frequency.linearRampToValueAtTime(520, now + 0.26);
    bp.Q.value = 2.2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.075 * Math.min(1.6, intensity), now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.3);
  }

  public playFireCrackle(): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400 + Math.random() * 1600;
    bp.Q.value = 2.5;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.095, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.ambientGain);
    src.start(now);
    src.stop(now + 0.16);
  }

  public playBusHornAndDoor(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Hydraulic door hiss
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const dg = this.ctx.createGain();
    dg.gain.setValueAtTime(0.001, now);
    dg.gain.linearRampToValueAtTime(0.14, now + 0.08);
    dg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    src.connect(hp);
    hp.connect(dg);
    dg.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.58);

    // Low diesel engine thrum
    const eng = this.ctx.createOscillator();
    eng.type = 'sawtooth';
    eng.frequency.setValueAtTime(58, now);
    eng.frequency.linearRampToValueAtTime(84, now + 1.8);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 190;
    const eg = this.ctx.createGain();
    eg.gain.setValueAtTime(0.001, now);
    eg.gain.linearRampToValueAtTime(0.16, now + 0.3);
    eg.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
    eng.connect(lp);
    lp.connect(eg);
    eg.connect(this.masterGain);
    eng.start(now);
    eng.stop(now + 2.5);
  }

  public updateEscapeChase(
    dt: number,
    options: {
      active: boolean;
      sprinting: boolean;
      fireNear: boolean;
      pursuerDist: number;
      progress: number;
      pursuerCues?: { pan: number; proximity: number }[];
    },
  ): void {
    if (!this.ctx || !options.active) return;

    // 1. Escalating chase heartbeat & bass pulse
    const threat = Math.max(0, Math.min(1, 1 - options.pursuerDist / 16));
    const intensityBoost = 0.85 + options.progress * 0.9 + threat * 0.75;
    const beatInterval = Math.max(0.32, 0.72 - options.progress * 0.25 - threat * 0.14);
    this.escapeChaseBeatAccum -= dt;
    if (this.escapeChaseBeatAccum <= 0) {
      this.escapeChaseBeatAccum = beatInterval;
      this.playHeartbeat(intensityBoost, options.progress > 0.6 || threat > 0.6);
    }

    // 2. Heavy panting breath while sprinting or near end
    this.escapeBreathAccum -= dt;
    if (this.escapeBreathAccum <= 0) {
      this.escapeBreathAccum = options.sprinting ? 0.44 : 0.78;
      this.playHeavyBreath(options.sprinting ? 1.25 : 0.75);
    }

    // 3. Fire crackle when near fire obstacles
    if (options.fireNear) {
      this.escapeFireAccum -= dt;
      if (this.escapeFireAccum <= 0) {
        this.escapeFireAccum = 0.08 + Math.random() * 0.12;
        this.playFireCrackle();
      }
    }

    const cues = options.pursuerCues;
    if (cues && cues.length > 0) {
      // 4a. Subtle stereo-panned pursuer footsteps alternating across lanes behind player
      this.escapePursuerStepAccum -= dt;
      if (this.escapePursuerStepAccum <= 0) {
        this.escapePursuerStepAccum = Math.max(0.19, 0.34 - threat * 0.13) + Math.random() * 0.04;
        const cue = cues[this.escapePursuerStepIdx % cues.length];
        this.escapePursuerStepIdx = (this.escapePursuerStepIdx + 1) % cues.length;
        this.playSpatialPursuerFootstep(cue.pan, cue.proximity);
      }

      // 4b. Subtle directional whispers from the nearest threatening anomalies behind player
      this.escapeWhisperAccum -= dt;
      if (this.escapeWhisperAccum <= 0) {
        this.escapeWhisperAccum = Math.max(1.35, 2.75 - threat * 1.25) + Math.random() * 0.85;
        const sorted = [...cues].sort((a, b) => b.proximity - a.proximity);
        const pick = sorted[Math.random() < 0.65 || sorted.length < 2 ? 0 : 1];
        this.playSpatialWhisperCue(pick.pan, pick.proximity);
      }
    }

    // 5. Distant anomaly screams echoing behind (panned toward a random pursuer lane when available)
    this.escapeScreamAccum -= dt;
    if (this.escapeScreamAccum <= 0) {
      this.escapeScreamAccum = Math.max(2.6, 5.8 - options.progress * 2.2) + Math.random() * 2.2;
      const screamPan = cues && cues.length > 0 ? cues[Math.floor(Math.random() * cues.length)].pan : undefined;
      this.playDistantScream(screamPan);
    }
  }

  public playBrakeScreech(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Tire screech & air-brake hiss as bus halts at roadblock
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(1150, now + 0.95);
    bp.Q.value = 5.0;

    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.18, now + 0.08);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.masterGain);
    src.start(now);
    src.stop(now + 1.1);

    // Low bass thud on full stop
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(74, now + 0.55);
    sub.frequency.exponentialRampToValueAtTime(32, now + 1.25);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.001, now + 0.55);
    sg.gain.linearRampToValueAtTime(0.28, now + 0.6);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
    sub.connect(sg);
    sg.connect(this.masterGain);
    sub.start(now + 0.55);
    sub.stop(now + 1.35);
  }

  public playKidnapperRevealChord(intense = false): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freqs = intense ? [65.4, 98.0, 103.8, 207.6] : [73.4, 110.0, 116.5];
    freqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.96, now + 2.4);

      const lp = this.ctx!.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = intense ? 520 : 340;

      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(intense ? 0.12 : 0.08, now + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 2.5);

      osc.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 2.6);
    });
  }

  public playVanDoorSlam(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Metallic sliding track rattle -> heavy slam
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(950, now);
    bp.frequency.exponentialRampToValueAtTime(220, now + 0.45);
    bp.Q.value = 1.6;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.09, now);
    ng.gain.setValueAtTime(0.42, now + 0.26);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.75);

    const thud = this.ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(118, now + 0.25);
    thud.frequency.exponentialRampToValueAtTime(28, now + 0.78);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.001, now + 0.25);
    tg.gain.linearRampToValueAtTime(0.58, now + 0.27);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    thud.connect(tg);
    tg.connect(this.masterGain);
    thud.start(now + 0.25);
    thud.stop(now + 0.88);
  }

  public playMindControl(possess: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const base = possess ? 210 : 420;
    const target = possess ? 540 : 165;
    [1, 1.498].forEach((mult, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(base * mult, now);
      osc.frequency.exponentialRampToValueAtTime(target * mult, now + 0.42);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.16 : 0.08, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  public playImmortalShield(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [330, 495, 660].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.02);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + 0.28);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.09, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + i * 0.02);
      osc.stop(now + 0.36);
    });
  }

  public playRevivePulse(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [220, 330, 440, 660].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now + idx * 0.05);
      g.gain.linearRampToValueAtTime(0.11, now + idx * 0.05 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.42);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.45);
    });
  }

  public playBodyguardSummon(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playCreditsThemeChord(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [73.4, 110.0, 130.8, 164.8].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.09 : 0.05, now + 0.8);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 5.2);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 5.3);
    });
  }

  public dispose(): void {
    this.stopNewsBroadcast();
    this.stopTvStatic();
    this.stopTaserCharge();
    try {
      this.cctvMicSource?.stop();
      this.humOsc?.stop();
      this.humSubOsc?.stop();
      this.sanityDroneOsc?.stop();
      this.sanityDroneSubOsc?.stop();
      this.sanityWindSource?.stop();
      this.sanityTensionOsc?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
  }
}
