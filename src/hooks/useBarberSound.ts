/**
 * useBarberSound — Distinct sounds for booking confirmation and cancellation.
 *
 * booking: Bright ascending 3-note chime (ding-ding-ding ↑) — like a classic shop entry bell
 * cancel:  Descending minor-chord "dun-dun" — clearly signals something negative/alert
 *
 * No external audio files. Pure Web Audio API synthesis.
 */
export function useBarberSound() {
  const play = (type: "booking" | "cancel" = "booking") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === "booking") {
        playNewBookingChime(ctx);
      } else {
        playCancelAlert(ctx);
      }
    } catch {
      // Silently ignore — user may not have interacted yet
    }
  };

  return { play };
}

// ── New Booking: Bright ascending 3-note chime (D5 → F#5 → A5) ───────────────
// Sounds like a classic barbershop/shop door bell ringing upward
function playNewBookingChime(ctx: AudioContext) {
  // Note 1 — D5 (587 Hz)
  scheduleBell(ctx, 0.00, 587.33, 0.55, 0.08, 1.4);
  scheduleBell(ctx, 0.00, 880.0,  0.15, 0.05, 0.9); // shimmer overtone

  // Note 2 — F#5 (740 Hz) — slightly higher
  scheduleBell(ctx, 0.20, 739.99, 0.50, 0.08, 1.4);
  scheduleBell(ctx, 0.20, 1108.73, 0.12, 0.05, 0.8);

  // Note 3 — A5 (880 Hz) — highest, brightest finish
  scheduleBell(ctx, 0.42, 880.0,  0.55, 0.10, 1.8);
  scheduleBell(ctx, 0.42, 1318.5, 0.18, 0.07, 1.2); // E6 shimmer

  // Soft body resonance underneath
  scheduleBell(ctx, 0.01, 293.66, 0.08, 1.0, 2.2); // D4 body
}

// ── Cancellation: Descending minor "dun-dun" (A4 → E4) ────────────────────────
// Two lower falling notes — instantly recognizable as different from booking
function playCancelAlert(ctx: AudioContext) {
  // First note — A4 (440 Hz) low, rounded
  scheduleBell(ctx, 0.00, 440.0, 0.45, 0.10, 1.6);
  scheduleBell(ctx, 0.00, 329.63, 0.15, 0.08, 1.2); // E4 minor undertone

  // Second note — Eb4 (311 Hz) — falls lower, minor feel
  scheduleBell(ctx, 0.30, 311.13, 0.40, 0.12, 1.8);
  scheduleBell(ctx, 0.30, 233.08, 0.12, 0.10, 1.4); // Bb3 undertone
}

// ── Core bell oscillator ──────────────────────────────────────────────────────
function scheduleBell(
  ctx: AudioContext,
  startOffset: number,  // seconds from now
  frequency: number,    // Hz
  gain: number,         // 0..1 peak volume
  attackDecay: number,  // seconds for initial attack+hold
  releaseTime: number   // seconds for exponential decay tail
) {
  const now = ctx.currentTime + startOffset;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.99, now + 0.08);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(gain, now + 0.01);
  gainNode.gain.setValueAtTime(gain, now + attackDecay * 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

  // Gentle delay reverb
  const delay = ctx.createDelay(0.3);
  delay.delayTime.value = 0.030;
  const fbGain = ctx.createGain();
  fbGain.gain.value = 0.14;
  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.84;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.16;

  // High-pass to keep it crisp
  const hpf = ctx.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 180;

  // Routing: osc → hpf → gainNode → dryGain → destination
  //                                → delay  → fbGain → delay (loop)
  //                                         → wetGain → destination
  osc.connect(hpf);
  hpf.connect(gainNode);
  gainNode.connect(dryGain);
  dryGain.connect(ctx.destination);
  gainNode.connect(delay);
  delay.connect(fbGain);
  fbGain.connect(delay);
  delay.connect(wetGain);
  wetGain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + releaseTime + 0.1);
}

