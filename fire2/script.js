/* ============================================================
   Burning Drum II — script.js
   Horizontal Plasma-Fire Music Visualizer
   ─────────────────────────────────────────
   • System audio capture via getDisplayMedia (fallback: simulated)
   • 8 frequency bands → 8 vertically-stacked horizontal fire emitters
   • 4 particle types: Core Plasma, Ember, Smoke, Spark
   • HSL heat-decay colour transitions
   • Additive blending for glowing plasma
   • 4 switchable colour palettes
   ============================================================ */

// ───────────────────────────────────────────────────
// 1. DOM REFERENCES
// ───────────────────────────────────────────────────
const canvas      = document.getElementById('visualizer-canvas');
const ctx         = canvas.getContext('2d');
const startBtn    = document.getElementById('start-btn');
const startLabel  = document.getElementById('start-btn-label');
const eqBars      = document.getElementById('eq-bars');
const paletteSel  = document.getElementById('palette-select');
const idlePrompt  = document.getElementById('idle-prompt');
const ambientGlow = document.getElementById('ambient-glow');

// ───────────────────────────────────────────────────
// 2. CANVAS SIZING
// ───────────────────────────────────────────────────
let W, H, centerX, centerY;

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  centerX = W / 2;
  centerY = H / 2;
}

window.addEventListener('resize', resize);
resize();

// ───────────────────────────────────────────────────
// 3. COLOUR PALETTES
//    Each palette has 5 HSL stops used for heat-decay
//    interpolation: index 0 = hottest, 4 = coolest.
// ───────────────────────────────────────────────────
const PALETTES = {
  classic: [
    { h: 50,  s: 100, l: 92 },  // white-hot core
    { h: 42,  s: 100, l: 65 },  // bright yellow
    { h: 28,  s: 100, l: 55 },  // orange
    { h: 12,  s: 100, l: 46 },  // red-orange
    { h: 4,   s: 80,  l: 25 },  // dark ember
  ],
  ghost: [
    { h: 190, s: 60,  l: 95 },  // white-blue core
    { h: 190, s: 95,  l: 70 },  // bright cyan
    { h: 205, s: 90,  l: 58 },  // sky blue
    { h: 220, s: 85,  l: 48 },  // deeper blue
    { h: 230, s: 60,  l: 22 },  // dark navy
  ],
  cursed: [
    { h: 300, s: 50,  l: 92 },  // white-violet core
    { h: 285, s: 90,  l: 65 },  // bright purple
    { h: 130, s: 85,  l: 50 },  // toxic green
    { h: 295, s: 80,  l: 40 },  // deep violet
    { h: 135, s: 70,  l: 18 },  // dark green
  ],
  mono: [
    { h: 0,   s: 0,   l: 100 }, // stark white
    { h: 0,   s: 0,   l: 80 },  // light grey
    { h: 0,   s: 0,   l: 55 },  // mid grey
    { h: 0,   s: 0,   l: 35 },  // dark grey
    { h: 0,   s: 0,   l: 12 },  // near-black
  ],
};

const GLOW_COLORS = {
  classic: 'rgba(255, 100, 20, 0.08)',
  ghost:   'rgba(40, 170, 255, 0.07)',
  cursed:  'rgba(170, 40, 255, 0.07)',
  mono:    'rgba(180, 180, 180, 0.05)',
};

let currentPalette = 'classic';

paletteSel.addEventListener('change', () => {
  currentPalette = paletteSel.value;
  ambientGlow.style.background =
    `radial-gradient(ellipse 70% 50% at 50% 50%, ${GLOW_COLORS[currentPalette]} 0%, transparent 70%)`;
});

// ───────────────────────────────────────────────────
// 4. WEB AUDIO — getDisplayMedia capture
//    Matches the project's canonical pattern (Pattern B)
// ───────────────────────────────────────────────────
let audioCtx, analyser, source;
let useRealAudio = false;

const BIN_COUNT   = 2048;
const FFT_SIZE    = BIN_COUNT * 2;  // 4096
let   dataArray   = new Float32Array(BIN_COUNT);

// Frequency band configuration (8 bands, log-spaced)
const NUM_BANDS  = 8;
const FREQ_MIN   = 20;
const FREQ_MAX   = 16000;
let   logBins    = [];   // { startBin, endBin } per band
let   bandValues = new Float64Array(NUM_BANDS); // normalised 0-1

/**
 * Build log-spaced frequency band boundaries.
 * Maps each of the 8 bands to a start/end index in the FFT data array.
 */
function setupLogBins() {
  logBins = [];
  const sampleRate = audioCtx ? audioCtx.sampleRate : 44100;
  const nyquist    = sampleRate / 2;
  const binWidth   = nyquist / BIN_COUNT;

  const logMin = Math.log10(FREQ_MIN);
  const logMax = Math.log10(FREQ_MAX);

  for (let i = 0; i < NUM_BANDS; i++) {
    const freqLow  = Math.pow(10, logMin + (logMax - logMin) * (i / NUM_BANDS));
    const freqHigh = Math.pow(10, logMin + (logMax - logMin) * ((i + 1) / NUM_BANDS));
    const startBin = Math.max(1, Math.floor(freqLow / binWidth));
    const endBin   = Math.min(BIN_COUNT - 1, Math.floor(freqHigh / binWidth));
    logBins.push({ startBin, endBin });
  }
}

/**
 * Start capturing system audio via getDisplayMedia.
 * Falls back to simulated data if the user cancels or
 * the browser doesn't support it.
 */
async function startAudio() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: { noiseSuppression: false, echoCancellation: false },
      video: true,
    });

    // Stop the video track immediately — we only need audio
    stream.getVideoTracks().forEach(t => t.stop());

    audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.55;

    source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    dataArray = new Float32Array(analyser.frequencyBinCount);

    useRealAudio = true;
    setupLogBins();
  } catch (err) {
    console.warn('getDisplayMedia failed — using simulated audio:', err);
    useRealAudio = false;
    setupLogBins();
  }

  // Update UI
  startBtn.classList.add('listening');
  startLabel.textContent = 'Listening';
  eqBars.classList.remove('hidden');
  idlePrompt.classList.add('hidden');
}

startBtn.addEventListener('click', () => {
  if (!startBtn.classList.contains('listening')) {
    startAudio();
  }
});

// ───────────────────────────────────────────────────
// 5. SIMULATED AUDIO (fallback when capture fails)
//    Generates plausible frequency data so the
//    visualizer still looks good during development.
// ───────────────────────────────────────────────────
let simTime = 0;

function updateSimulatedBands(dt) {
  simTime += dt * 0.001;
  for (let i = 0; i < NUM_BANDS; i++) {
    // Layered sine waves at different rates per band
    const base  = 0.3 + 0.25 * Math.sin(simTime * (1.8 + i * 0.6));
    const pulse = 0.35 * Math.pow(Math.max(0, Math.sin(simTime * (3.5 + i * 0.4))), 4);
    const noise = 0.08 * Math.sin(simTime * 13.7 + i * 2.3);
    bandValues[i] = Math.max(0, Math.min(1, base + pulse + noise));
  }
}

// ───────────────────────────────────────────────────
// 6. FREQUENCY ANALYSIS
//    Reads the FFT data and fills bandValues[0..7].
// ───────────────────────────────────────────────────

/** Convert Float32 dB value (-∞…0) to linear 0-1 */
function dbToLinear(db) {
  // getFloatFrequencyData returns dB; -100 dB ≈ silence, 0 dB ≈ max
  const clamped = Math.max(-100, Math.min(0, db));
  return (clamped + 100) / 100;
}

function analyseFrequencies() {
  if (!useRealAudio || !analyser) return;

  analyser.getFloatFrequencyData(dataArray);

  for (let b = 0; b < NUM_BANDS; b++) {
    const { startBin, endBin } = logBins[b];
    let sum = 0;
    let count = 0;
    for (let i = startBin; i <= endBin; i++) {
      sum += dbToLinear(dataArray[i]);
      count++;
    }
    bandValues[b] = count > 0 ? sum / count : 0;
  }
}

// ───────────────────────────────────────────────────
// 7. TURBULENCE — lightweight pseudo-noise
//    Gives particles organic swirling motion without
//    a full Perlin implementation.
// ───────────────────────────────────────────────────

/**
 * Fast value-noise approximation using sin-hash.
 * Returns roughly [-1, 1].
 */
function noise2D(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

/**
 * Smooth noise with bilinear interpolation.
 */
function smoothNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const a = noise2D(ix,     iy);
  const b = noise2D(ix + 1, iy);
  const c = noise2D(ix,     iy + 1);
  const d = noise2D(ix + 1, iy + 1);

  const top    = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

// ───────────────────────────────────────────────────
// 8. PARTICLE SYSTEM
// ───────────────────────────────────────────────────

/*  Particle types:
 *   0 = CORE PLASMA  — large, bright, short-lived
 *   1 = EMBER        — medium, moderate glow, longer life
 *   2 = SMOKE        — small, dark, very long life
 *   3 = SPARK        — tiny, white-hot, fast, quick fade
 */
const PTYPE_CORE  = 0;
const PTYPE_EMBER = 1;
const PTYPE_SMOKE = 2;
const PTYPE_SPARK = 3;

class Particle {
  constructor() {
    this.alive = false;
  }

  /**
   * Initialise / reset this particle.
   * @param {number} x
   * @param {number} y
   * @param {number} vx       — horizontal velocity (primary)
   * @param {number} vy       — vertical velocity (secondary)
   * @param {number} size     — initial radius
   * @param {number} type     — PTYPE constant
   * @param {number} bandIdx  — which frequency band spawned this
   */
  init(x, y, vx, vy, size, type, bandIdx) {
    this.alive = true;
    this.x  = x;
    this.y  = y;
    this.vx = vx;
    this.vy = vy;
    this.size     = size;
    this.initSize = size;
    this.type     = type;
    this.bandIdx  = bandIdx;

    // Life & decay rates vary by type
    this.life = 1.0;
    switch (type) {
      case PTYPE_CORE:
        this.decay = 0.018 + Math.random() * 0.012;
        break;
      case PTYPE_EMBER:
        this.decay = 0.007 + Math.random() * 0.008;
        break;
      case PTYPE_SMOKE:
        this.decay = 0.003 + Math.random() * 0.004;
        break;
      case PTYPE_SPARK:
        this.decay = 0.03 + Math.random() * 0.025;
        break;
    }

    // Turbulence seed
    this.noiseSeed = Math.random() * 100;
  }

  update(time) {
    if (!this.alive) return;

    // Turbulence wobble (organic swirl)
    const noiseScale = 0.012;
    const turbX = smoothNoise(this.x * noiseScale + time * 0.4, this.y * noiseScale) * 0.35;
    const turbY = smoothNoise(this.x * noiseScale, this.y * noiseScale + time * 0.4 + this.noiseSeed) * 0.35;

    // Slight upward convection bias (heat rises)
    const convection = this.type === PTYPE_SMOKE ? -0.12 : -0.06;

    this.vx += turbX;
    this.vy += turbY + convection;

    // Velocity damping
    const damp = this.type === PTYPE_SPARK ? 0.975 : 0.99;
    this.vx *= damp;
    this.vy *= damp;

    this.x += this.vx;
    this.y += this.vy;

    // Life decay
    this.life -= this.decay;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }

    // Size: shrink with slight pulsation
    const pulse = 1 + 0.08 * Math.sin(time * 12 + this.noiseSeed * 6);
    this.size = this.initSize * this.life * pulse;
  }

  /**
   * Get the HSL colour at the particle's current heat level.
   * life=1 → hottest (palette[0]), life=0 → coolest (palette[4]).
   */
  getColor(palette) {
    // Map life to palette index (0-4)
    const t = 1 - this.life;                    // 0 = hot, 1 = cold
    const idx = Math.min(t * (palette.length - 1), palette.length - 1.001);
    const i   = Math.floor(idx);
    const f   = idx - i;

    const a = palette[i];
    const b = palette[Math.min(i + 1, palette.length - 1)];

    return {
      h: a.h + (b.h - a.h) * f,
      s: a.s + (b.s - a.s) * f,
      l: a.l + (b.l - a.l) * f,
    };
  }

  draw(ctx, palette) {
    if (!this.alive || this.size <= 0.2) return;

    const col   = this.getColor(palette);
    const alpha = Math.pow(this.life, 1.3);

    if (this.type === PTYPE_SMOKE) {
      // Smoke: single soft circle, low alpha, no additive blend
      ctx.globalCompositeOperation = 'screen';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${col.h}, ${col.s * 0.4}%, ${col.l * 0.5}%, ${alpha * 0.08})`;
      ctx.fill();
      return;
    }

    // Use additive blending for plasma glow
    ctx.globalCompositeOperation = 'lighter';

    if (this.type === PTYPE_SPARK) {
      // Spark: tiny bright dot with sharp glow
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${col.h}, ${col.s * 0.5}%, ${Math.min(col.l + 20, 100)}%, ${alpha * 0.3})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${col.h}, ${col.s * 0.3}%, ${Math.min(col.l + 30, 100)}%, ${alpha})`;
      ctx.fill();
      return;
    }

    // CORE PLASMA & EMBER — three-layer rendering

    // Layer 1: Outer glow (wide, faint)
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${col.h}, ${col.s}%, ${col.l}%, ${alpha * 0.06})`;
    ctx.fill();

    // Layer 2: Core body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${col.h}, ${col.s}%, ${col.l}%, ${alpha * 0.45})`;
    ctx.fill();

    // Layer 3: Hot centre highlight
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${col.h}, ${Math.max(col.s - 30, 0)}%, ${Math.min(col.l + 25, 100)}%, ${alpha * 0.9})`;
    ctx.fill();
  }
}

// ───────────────────────────────────────────────────
// 9. PARTICLE POOL
//    Pre-allocate a fixed pool to avoid GC pressure.
// ───────────────────────────────────────────────────
const MAX_PARTICLES = 6000;
const pool = [];
for (let i = 0; i < MAX_PARTICLES; i++) {
  pool.push(new Particle());
}
let activeCount = 0;

/**
 * Get the next available dead particle from the pool.
 * Returns null if pool is exhausted.
 */
function allocParticle() {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (!pool[i].alive) return pool[i];
  }
  return null;
}

// ───────────────────────────────────────────────────
// 10. EMITTER — one per frequency band
//     Each emitter sits at a vertical position and
//     fires particles HORIZONTALLY (left & right).
// ───────────────────────────────────────────────────

// Beat detection state per band
const bandPeaks    = new Float64Array(NUM_BANDS);
const bandCooldown = new Float64Array(NUM_BANDS);

// Ring-pulse per band (visual accent)
const ringPulse = new Float64Array(NUM_BANDS);

/**
 * Get the Y position of band emitter `i`.
 * Band 0 (bass) is at the bottom, band 7 (treble) at the top.
 * Leave margins for the UI and bottom edge.
 */
function bandY(i) {
  const marginTop    = 80;
  const marginBottom = 40;
  const usable = H - marginTop - marginBottom;
  // Invert: band 0 → bottom, band 7 → top
  return marginTop + usable * (1 - (i + 0.5) / NUM_BANDS);
}

/**
 * Spawn a horizontal fire burst for a given band.
 * @param {number} bandIdx — frequency band index 0-7
 * @param {number} energy  — 0-1 energy level
 */
function spawnBurst(bandIdx, energy) {
  const palette = PALETTES[currentPalette];
  const ey      = bandY(bandIdx);
  const count   = Math.floor(20 + energy * 55);

  for (let i = 0; i < count; i++) {
    const p = allocParticle();
    if (!p) break;

    // Decide particle type probabilities
    const r = Math.random();
    let type;
    if (r < 0.25) type = PTYPE_CORE;
    else if (r < 0.55) type = PTYPE_EMBER;
    else if (r < 0.78) type = PTYPE_SMOKE;
    else type = PTYPE_SPARK;

    // Horizontal direction: left or right
    const dir = Math.random() < 0.5 ? -1 : 1;

    // Speed depends on type
    let speed;
    switch (type) {
      case PTYPE_CORE:  speed = 2 + Math.random() * 4 * energy; break;
      case PTYPE_EMBER: speed = 1.5 + Math.random() * 3 * energy; break;
      case PTYPE_SMOKE: speed = 0.5 + Math.random() * 1.5; break;
      case PTYPE_SPARK: speed = 4 + Math.random() * 6 * energy; break;
    }

    const vx = dir * speed;
    // Slight vertical spread
    const vy = (Math.random() - 0.5) * 2.0 * energy;

    // Size depends on type
    let size;
    switch (type) {
      case PTYPE_CORE:  size = 4 + Math.random() * 5; break;
      case PTYPE_EMBER: size = 2.5 + Math.random() * 3.5; break;
      case PTYPE_SMOKE: size = 3 + Math.random() * 4; break;
      case PTYPE_SPARK: size = 0.8 + Math.random() * 1.5; break;
    }

    // Spawn position: near center horizontally, at band's Y
    const ox = centerX + (Math.random() - 0.5) * 30;
    const oy = ey + (Math.random() - 0.5) * 12;

    p.init(ox, oy, vx, vy, size, type, bandIdx);
  }
}

/**
 * Spawn a small trickle of ambient embers per band
 * to keep the fire alive even between beats.
 */
function spawnAmbient(bandIdx, energy) {
  if (energy < 0.05) return; // too quiet

  const count = Math.floor(energy * 2.5);
  const ey    = bandY(bandIdx);

  for (let i = 0; i < count; i++) {
    const p = allocParticle();
    if (!p) break;

    const dir  = Math.random() < 0.5 ? -1 : 1;
    const vx   = dir * (0.3 + Math.random() * 1.2 * energy);
    const vy   = (Math.random() - 0.5) * 0.6;
    const size = 1 + Math.random() * 2;
    const type = Math.random() < 0.6 ? PTYPE_EMBER : PTYPE_SMOKE;

    const ox = centerX + (Math.random() - 0.5) * 20;
    const oy = ey + (Math.random() - 0.5) * 8;

    p.init(ox, oy, vx, vy, size, type, bandIdx);
  }
}

// ───────────────────────────────────────────────────
// 11. BEAT DETECTION (per-band)
//     A beat is detected when a band's energy exceeds
//     a running threshold with a cooldown timer.
// ───────────────────────────────────────────────────
const BEAT_THRESHOLD_BASE = 0.45;
const BEAT_COOLDOWN_MS    = 80; // minimum ms between beats per band

function detectBeats(now) {
  for (let b = 0; b < NUM_BANDS; b++) {
    const energy = bandValues[b];

    // Dynamic threshold: slightly above recent average
    bandPeaks[b] = bandPeaks[b] * 0.97 + energy * 0.03;
    const threshold = Math.max(BEAT_THRESHOLD_BASE, bandPeaks[b] * 1.35);

    if (energy > threshold && now - bandCooldown[b] > BEAT_COOLDOWN_MS) {
      bandCooldown[b] = now;
      spawnBurst(b, energy);
      ringPulse[b] = 1.0;
    }
  }
}

// ───────────────────────────────────────────────────
// 12. DRAW: EMITTER RINGS (heat-distortion accents)
//     Each band gets a subtle pulsing ring at its Y.
// ───────────────────────────────────────────────────
function drawEmitterRings() {
  const palette = PALETTES[currentPalette];
  const baseCol = palette[1]; // use the "bright" stop

  ctx.globalCompositeOperation = 'lighter';

  for (let b = 0; b < NUM_BANDS; b++) {
    if (ringPulse[b] < 0.01) continue;

    const ey     = bandY(b);
    const radius = 18 + ringPulse[b] * 35;
    const alpha  = ringPulse[b] * 0.35;

    // Glow
    const grad = ctx.createRadialGradient(centerX, ey, 0, centerX, ey, radius * 1.8);
    grad.addColorStop(0, `hsla(${baseCol.h}, ${baseCol.s}%, ${baseCol.l}%, ${alpha * 0.3})`);
    grad.addColorStop(1, `hsla(${baseCol.h}, ${baseCol.s}%, ${baseCol.l}%, 0)`);
    ctx.beginPath();
    ctx.arc(centerX, ey, radius * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Ring stroke
    ctx.beginPath();
    ctx.arc(centerX, ey, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${baseCol.h}, ${baseCol.s}%, ${baseCol.l + 10}%, ${alpha})`;
    ctx.lineWidth   = 1.5 + ringPulse[b] * 1.5;
    ctx.stroke();

    // Decay
    ringPulse[b] *= 0.9;
  }
}

// ───────────────────────────────────────────────────
// 13. DRAW: CENTER COLUMN (visual anchor / drumhead)
//     A subtle vertical glowing line at screen center
//     so the user sees where the fire originates.
// ───────────────────────────────────────────────────
function drawCenterColumn() {
  const palette = PALETTES[currentPalette];
  const col = palette[0];

  // Average energy across all bands for brightness
  let avgEnergy = 0;
  for (let b = 0; b < NUM_BANDS; b++) avgEnergy += bandValues[b];
  avgEnergy /= NUM_BANDS;

  const alpha = 0.03 + avgEnergy * 0.08;

  ctx.globalCompositeOperation = 'lighter';

  // Wide soft glow
  const grad = ctx.createLinearGradient(centerX - 60, 0, centerX + 60, 0);
  grad.addColorStop(0,   `hsla(${col.h}, ${col.s}%, ${col.l}%, 0)`);
  grad.addColorStop(0.5, `hsla(${col.h}, ${col.s}%, ${col.l}%, ${alpha})`);
  grad.addColorStop(1,   `hsla(${col.h}, ${col.s}%, ${col.l}%, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(centerX - 60, 0, 120, H);

  // Thin bright core line
  const lineAlpha = 0.05 + avgEnergy * 0.12;
  ctx.strokeStyle = `hsla(${col.h}, ${col.s}%, ${Math.min(col.l + 10, 100)}%, ${lineAlpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, H);
  ctx.stroke();
}

// ───────────────────────────────────────────────────
// 14. BAND LABELS (subtle frequency indicators)
// ───────────────────────────────────────────────────
const BAND_LABELS = ['SUB', 'BASS', 'LO-MID', 'MID', 'HI-MID', 'PRES', 'BRILL', 'AIR'];

function drawBandLabels() {
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = '500 9px system-ui, sans-serif';
  ctx.textAlign = 'right';

  for (let b = 0; b < NUM_BANDS; b++) {
    const ey = bandY(b);
    const energy = bandValues[b];
    const alpha = 0.1 + energy * 0.25;
    const palette = PALETTES[currentPalette];
    const col = palette[2];

    ctx.fillStyle = `hsla(${col.h}, ${col.s * 0.6}%, ${col.l}%, ${alpha})`;
    ctx.fillText(BAND_LABELS[b], centerX - 45, ey + 3);
  }
}

// ───────────────────────────────────────────────────
// 15. MAIN RENDER LOOP
// ───────────────────────────────────────────────────
let lastTime = 0;

function loop(timestamp) {
  requestAnimationFrame(loop);

  const dt   = timestamp - lastTime;
  lastTime   = timestamp;
  const time = timestamp * 0.001; // seconds

  // ─── Get frequency data ───
  if (useRealAudio) {
    analyseFrequencies();
  } else {
    updateSimulatedBands(dt);
  }

  // ─── Semi-transparent clear → motion trail ───
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(3, 3, 4, 0.15)';
  ctx.fillRect(0, 0, W, H);

  // ─── Beat detection & burst spawning ───
  detectBeats(timestamp);

  // ─── Ambient embers per band ───
  for (let b = 0; b < NUM_BANDS; b++) {
    spawnAmbient(b, bandValues[b]);
  }

  // ─── Draw centre column ───
  drawCenterColumn();

  // ─── Draw emitter rings ───
  drawEmitterRings();

  // ─── Update & draw particles ───
  const palette = PALETTES[currentPalette];

  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = pool[i];
    if (!p.alive) continue;

    p.update(time);
    if (p.alive) {
      p.draw(ctx, palette);
    }
  }

  // Reset composite mode for non-additive draws
  ctx.globalCompositeOperation = 'source-over';

  // ─── Band labels ───
  drawBandLabels();

  // ─── Ambient glow pulse ───
  let maxEnergy = 0;
  for (let b = 0; b < NUM_BANDS; b++) {
    if (bandValues[b] > maxEnergy) maxEnergy = bandValues[b];
  }
  ambientGlow.style.opacity = String(maxEnergy * 0.5);
}

// ─── Initialise simulated bins (for non-audio mode) ───
setupLogBins();

// ─── Start render loop ───
requestAnimationFrame(loop);
