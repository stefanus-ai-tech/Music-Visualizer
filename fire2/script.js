/* ============================================================
   Burning Drum II — script.js
   Horizontal Plasma-Fire Music Visualizer
   ─────────────────────────────────────────
   Every visual / physics parameter is driven by a live
   configuration object (CFG) that the slider panel updates.
   ============================================================ */

// ───────────────────────────────────────────────────
// 1. DOM REFERENCES
// ───────────────────────────────────────────────────
const canvas = document.getElementById('visualizer-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const startLabel = document.getElementById('start-btn-label');
const eqBars = document.getElementById('eq-bars');
const paletteSel = document.getElementById('palette-select');
const idlePrompt = document.getElementById('idle-prompt');
const ambientGlow = document.getElementById('ambient-glow');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.getElementById('settings-close');
const settingsBackdrop = document.getElementById('settings-backdrop');

// ───────────────────────────────────────────────────
// 2. LIVE CONFIGURATION (driven by sliders)
//    Every tunable parameter lives here.
// ───────────────────────────────────────────────────
const DEFAULTS = {
  // Particles
  burstCount: 55,
  maxParticles: 6000,
  ambientRate: 2.5,

  // Spawn weights (will be normalised at runtime)
  weightCore: 25,
  weightEmber: 30,
  weightSmoke: 23,
  weightSpark: 22,

  // Particle sizes
  sizeCore: 7,
  sizeEmber: 4.5,
  sizeSmoke: 5,
  sizeSpark: 1.5,

  // Physics
  hSpeed: 4,
  vSpread: 2,
  turbulence: 0.35,
  convection: 0.06,
  damping: 0.99,
  pulse: 0.08,
  spawnSpreadX: 30,
  spawnSpreadY: 12,
  gravity: 0,

  // Lifecycle (decay rates — higher = shorter life)
  decayCore: 0.024,
  decayEmber: 0.011,
  decaySmoke: 0.005,
  decaySpark: 0.042,

  // Beat detection
  beatThreshold: 0.45,
  beatCooldown: 80,
  peakSens: 1.35,
  peakTrack: 0.97,

  // Rendering
  trail: 0.15,
  outerGlow: 0.06,
  coreOpacity: 0.45,
  centerBright: 0.9,
  smokeOpacity: 0.08,
  sparkGlow: 0.3,
  glowRadius: 3,

  // Emitter visuals
  ringSize: 35,
  ringOpacity: 0.35,
  ringDecay: 0.9,
  centerCol: 1,
  ambientGlowStr: 0.5,
  bandLabels: 1,

  // Colour tweaks
  hueShift: 0,
  satBoost: 0,
  lightBoost: 0,

  // Audio
  fftSmooth: 0.55,
  freqMin: 20,
  freqMax: 16000,
  bandCount: 8,
};

// Shallow-copy defaults into live config
const CFG = { ...DEFAULTS };

// ───────────────────────────────────────────────────
// 3. SLIDER ↔ CONFIG WIRING
//    Each slider ID maps to a CFG key. On every input
//    event the config is updated and the displayed value
//    is refreshed.
// ───────────────────────────────────────────────────
const SLIDER_MAP = {
  'sl-burst-count': 'burstCount',
  'sl-max-particles': 'maxParticles',
  'sl-ambient-rate': 'ambientRate',
  'sl-weight-core': 'weightCore',
  'sl-weight-ember': 'weightEmber',
  'sl-weight-smoke': 'weightSmoke',
  'sl-weight-spark': 'weightSpark',
  'sl-size-core': 'sizeCore',
  'sl-size-ember': 'sizeEmber',
  'sl-size-smoke': 'sizeSmoke',
  'sl-size-spark': 'sizeSpark',
  'sl-h-speed': 'hSpeed',
  'sl-v-spread': 'vSpread',
  'sl-turbulence': 'turbulence',
  'sl-convection': 'convection',
  'sl-damping': 'damping',
  'sl-pulse': 'pulse',
  'sl-spawn-spread-x': 'spawnSpreadX',
  'sl-spawn-spread-y': 'spawnSpreadY',
  'sl-gravity': 'gravity',
  'sl-decay-core': 'decayCore',
  'sl-decay-ember': 'decayEmber',
  'sl-decay-smoke': 'decaySmoke',
  'sl-decay-spark': 'decaySpark',
  'sl-beat-threshold': 'beatThreshold',
  'sl-beat-cooldown': 'beatCooldown',
  'sl-peak-sens': 'peakSens',
  'sl-peak-track': 'peakTrack',
  'sl-trail': 'trail',
  'sl-outer-glow': 'outerGlow',
  'sl-core-opacity': 'coreOpacity',
  'sl-center-bright': 'centerBright',
  'sl-smoke-opacity': 'smokeOpacity',
  'sl-spark-glow': 'sparkGlow',
  'sl-glow-radius': 'glowRadius',
  'sl-ring-size': 'ringSize',
  'sl-ring-opacity': 'ringOpacity',
  'sl-ring-decay': 'ringDecay',
  'sl-center-col': 'centerCol',
  'sl-ambient-glow': 'ambientGlowStr',
  'sl-band-labels': 'bandLabels',
  'sl-hue-shift': 'hueShift',
  'sl-sat-boost': 'satBoost',
  'sl-light-boost': 'lightBoost',
  'sl-fft-smooth': 'fftSmooth',
  'sl-freq-min': 'freqMin',
  'sl-freq-max': 'freqMax',
  'sl-band-count': 'bandCount',
};

/** Read a slider's value and update CFG + display span. */
function syncSlider(sliderId) {
  const el = document.getElementById(sliderId);
  if (!el) return;
  const key = SLIDER_MAP[sliderId];
  const val = parseFloat(el.value);
  CFG[key] = val;

  // Update display span
  const span = document.querySelector(`.slider-val[data-for="${sliderId}"]`);
  if (span) {
    // Show integer for integer-like values, else 2-3 decimals
    span.textContent = Number.isInteger(val) ? val : (val < 1 ? val.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : val.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));
  }

  // Special: update analyser smoothing live
  if (key === 'fftSmooth' && analyser) {
    analyser.smoothingTimeConstant = val;
  }

  // Special: rebuild log bins when freq range or band count changes
  if (key === 'freqMin' || key === 'freqMax' || key === 'bandCount') {
    setupLogBins();
  }
}

/** Push CFG values back into slider elements (for preset/reset). */
function pushCfgToSliders() {
  for (const [sliderId, key] of Object.entries(SLIDER_MAP)) {
    const el = document.getElementById(sliderId);
    if (el) {
      el.value = CFG[key];
      syncSlider(sliderId);
    }
  }
}



// ───────────────────────────────────────────────────
// 4. SETTINGS PANEL TOGGLE & COLLAPSIBLE GROUPS
// ───────────────────────────────────────────────────
function openSettings() {
  settingsPanel.classList.remove('closed');
  settingsToggle.classList.add('active');
  if (settingsBackdrop) settingsBackdrop.classList.remove('hidden');
}

function closeSettings() {
  settingsPanel.classList.add('closed');
  settingsToggle.classList.remove('active');
  if (settingsBackdrop) settingsBackdrop.classList.add('hidden');
}

settingsToggle.addEventListener('click', () => {
  if (settingsPanel.classList.contains('closed')) {
    openSettings();
  } else {
    closeSettings();
  }
});

settingsClose.addEventListener('click', () => closeSettings());

if (settingsBackdrop) {
  settingsBackdrop.addEventListener('click', () => closeSettings());
}

// Collapsible group toggles
document.querySelectorAll('.group-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const groupId = 'group-' + btn.dataset.group;
    const body = document.getElementById(groupId);
    if (body) {
      body.classList.toggle('collapsed');
      // Rotate chevron
      const chevron = btn.querySelector('.chevron');
      if (chevron) {
        chevron.style.transform = body.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0)';
      }
    }
  });
});

// ───────────────────────────────────────────────────
// 5. PRESETS
// ───────────────────────────────────────────────────
const PRESETS = {
  inferno: {
    burstCount: 120, maxParticles: 8000, ambientRate: 5,
    weightCore: 35, weightEmber: 30, weightSmoke: 15, weightSpark: 20,
    sizeCore: 10, sizeEmber: 6, sizeSmoke: 7, sizeSpark: 2.2,
    hSpeed: 8, vSpread: 3.5, turbulence: 0.6, convection: 0.1,
    damping: 0.985, pulse: 0.12, spawnSpreadX: 40, spawnSpreadY: 18, gravity: 0,
    decayCore: 0.018, decayEmber: 0.008, decaySmoke: 0.003, decaySpark: 0.035,
    beatThreshold: 0.3, beatCooldown: 50, peakSens: 1.2, peakTrack: 0.96,
    trail: 0.1, outerGlow: 0.1, coreOpacity: 0.6, centerBright: 1,
    smokeOpacity: 0.1, sparkGlow: 0.5, glowRadius: 4,
    ringSize: 50, ringOpacity: 0.5, ringDecay: 0.88, centerCol: 1,
    ambientGlowStr: 0.7, bandLabels: 1,
    hueShift: 0, satBoost: 10, lightBoost: 5,
    fftSmooth: 0.5, freqMin: 20, freqMax: 16000, bandCount: 8,
  },
  ethereal: {
    burstCount: 35, maxParticles: 5000, ambientRate: 4,
    weightCore: 15, weightEmber: 20, weightSmoke: 45, weightSpark: 20,
    sizeCore: 5, sizeEmber: 3.5, sizeSmoke: 8, sizeSpark: 1,
    hSpeed: 2, vSpread: 1.5, turbulence: 1.2, convection: 0.15,
    damping: 0.995, pulse: 0.15, spawnSpreadX: 50, spawnSpreadY: 25, gravity: -0.02,
    decayCore: 0.015, decayEmber: 0.006, decaySmoke: 0.002, decaySpark: 0.03,
    beatThreshold: 0.5, beatCooldown: 120, peakSens: 1.5, peakTrack: 0.98,
    trail: 0.06, outerGlow: 0.12, coreOpacity: 0.35, centerBright: 0.7,
    smokeOpacity: 0.12, sparkGlow: 0.2, glowRadius: 5,
    ringSize: 60, ringOpacity: 0.2, ringDecay: 0.95, centerCol: 0.5,
    ambientGlowStr: 0.6, bandLabels: 0.5,
    hueShift: 0, satBoost: -10, lightBoost: 10,
    fftSmooth: 0.7, freqMin: 30, freqMax: 14000, bandCount: 10,
  },
  chaos: {
    burstCount: 180, maxParticles: 10000, ambientRate: 7,
    weightCore: 30, weightEmber: 25, weightSmoke: 10, weightSpark: 35,
    sizeCore: 12, sizeEmber: 7, sizeSmoke: 4, sizeSpark: 3,
    hSpeed: 12, vSpread: 6, turbulence: 2, convection: 0.02,
    damping: 0.97, pulse: 0.2, spawnSpreadX: 20, spawnSpreadY: 8, gravity: 0,
    decayCore: 0.025, decayEmber: 0.015, decaySmoke: 0.008, decaySpark: 0.05,
    beatThreshold: 0.2, beatCooldown: 30, peakSens: 1.1, peakTrack: 0.94,
    trail: 0.08, outerGlow: 0.15, coreOpacity: 0.7, centerBright: 1,
    smokeOpacity: 0.06, sparkGlow: 0.6, glowRadius: 3.5,
    ringSize: 70, ringOpacity: 0.6, ringDecay: 0.85, centerCol: 0.8,
    ambientGlowStr: 0.9, bandLabels: 0.3,
    hueShift: 0, satBoost: 15, lightBoost: 0,
    fftSmooth: 0.4, freqMin: 15, freqMax: 18000, bandCount: 12,
  },
  minimal: {
    burstCount: 20, maxParticles: 2000, ambientRate: 0.8,
    weightCore: 10, weightEmber: 40, weightSmoke: 40, weightSpark: 10,
    sizeCore: 4, sizeEmber: 2.5, sizeSmoke: 3, sizeSpark: 0.8,
    hSpeed: 2.5, vSpread: 1, turbulence: 0.15, convection: 0.04,
    damping: 0.993, pulse: 0.03, spawnSpreadX: 15, spawnSpreadY: 6, gravity: 0,
    decayCore: 0.02, decayEmber: 0.008, decaySmoke: 0.003, decaySpark: 0.04,
    beatThreshold: 0.6, beatCooldown: 150, peakSens: 1.6, peakTrack: 0.98,
    trail: 0.25, outerGlow: 0.03, coreOpacity: 0.3, centerBright: 0.6,
    smokeOpacity: 0.05, sparkGlow: 0.15, glowRadius: 2,
    ringSize: 20, ringOpacity: 0.15, ringDecay: 0.93, centerCol: 0.3,
    ambientGlowStr: 0.2, bandLabels: 0.7,
    hueShift: 0, satBoost: -20, lightBoost: -5,
    fftSmooth: 0.7, freqMin: 30, freqMax: 12000, bandCount: 6,
  },
};

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  Object.assign(CFG, p);
  pushCfgToSliders();
}

document.getElementById('btn-preset-inferno').addEventListener('click', () => applyPreset('inferno'));
document.getElementById('btn-preset-ethereal').addEventListener('click', () => applyPreset('ethereal'));
document.getElementById('btn-preset-chaos').addEventListener('click', () => applyPreset('chaos'));
document.getElementById('btn-preset-minimal').addEventListener('click', () => applyPreset('minimal'));
document.getElementById('btn-reset').addEventListener('click', () => {
  Object.assign(CFG, DEFAULTS);
  pushCfgToSliders();
});

// ───────────────────────────────────────────────────
// 6. CANVAS SIZING
// ───────────────────────────────────────────────────
let W, H, centerX, centerY;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  centerX = W / 2;
  centerY = H / 2;
}

window.addEventListener('resize', resize);
resize();

// ───────────────────────────────────────────────────
// 7. COLOUR PALETTES
// ───────────────────────────────────────────────────
const PALETTES = {
  classic: [
    { h: 50, s: 100, l: 92 },
    { h: 42, s: 100, l: 65 },
    { h: 28, s: 100, l: 55 },
    { h: 12, s: 100, l: 46 },
    { h: 4, s: 80, l: 25 },
  ],
  ghost: [
    { h: 190, s: 60, l: 95 },
    { h: 190, s: 95, l: 70 },
    { h: 205, s: 90, l: 58 },
    { h: 220, s: 85, l: 48 },
    { h: 230, s: 60, l: 22 },
  ],
  cursed: [
    { h: 300, s: 50, l: 92 },
    { h: 285, s: 90, l: 65 },
    { h: 130, s: 85, l: 50 },
    { h: 295, s: 80, l: 40 },
    { h: 135, s: 70, l: 18 },
  ],
  mono: [
    { h: 0, s: 0, l: 100 },
    { h: 0, s: 0, l: 80 },
    { h: 0, s: 0, l: 55 },
    { h: 0, s: 0, l: 35 },
    { h: 0, s: 0, l: 12 },
  ],
};

const GLOW_COLORS = {
  classic: 'rgba(255, 100, 20, 0.08)',
  ghost: 'rgba(40, 170, 255, 0.07)',
  cursed: 'rgba(170, 40, 255, 0.07)',
  mono: 'rgba(180, 180, 180, 0.05)',
};

let currentPalette = 'classic';

paletteSel.addEventListener('change', () => {
  currentPalette = paletteSel.value;
  ambientGlow.style.background =
    `radial-gradient(ellipse 70% 50% at 50% 50%, ${GLOW_COLORS[currentPalette]} 0%, transparent 70%)`;
});

/**
 * Get a palette colour with CFG hue/sat/light offsets applied.
 */
function tintColor(c) {
  return {
    h: (c.h + CFG.hueShift + 360) % 360,
    s: Math.max(0, Math.min(100, c.s + CFG.satBoost)),
    l: Math.max(0, Math.min(100, c.l + CFG.lightBoost)),
  };
}

// ───────────────────────────────────────────────────
// 8. WEB AUDIO — getDisplayMedia capture
// ───────────────────────────────────────────────────
let audioCtx, analyser, source;
let useRealAudio = false;

const BIN_COUNT = 2048;
const FFT_SIZE = BIN_COUNT * 2;
let dataArray = new Float32Array(BIN_COUNT);

// Frequency bands (rebuilt dynamically)
let logBins = [];
let bandValues, bandPeaks, bandCooldown, ringPulse;

function allocBandArrays() {
  const n = Math.round(CFG.bandCount);
  bandValues = new Float64Array(n);
  bandPeaks = new Float64Array(n);
  bandCooldown = new Float64Array(n);
  ringPulse = new Float64Array(n);
}

allocBandArrays();

function setupLogBins() {
  const n = Math.round(CFG.bandCount);
  if (bandValues.length !== n) allocBandArrays();

  logBins = [];
  const sampleRate = audioCtx ? audioCtx.sampleRate : 44100;
  const nyquist = sampleRate / 2;
  const binWidth = nyquist / BIN_COUNT;
  const logMin = Math.log10(Math.max(10, CFG.freqMin));
  const logMax = Math.log10(Math.min(22000, CFG.freqMax));

  for (let i = 0; i < n; i++) {
    const freqLow = Math.pow(10, logMin + (logMax - logMin) * (i / n));
    const freqHigh = Math.pow(10, logMin + (logMax - logMin) * ((i + 1) / n));
    const startBin = Math.max(1, Math.floor(freqLow / binWidth));
    const endBin = Math.min(BIN_COUNT - 1, Math.floor(freqHigh / binWidth));
    logBins.push({ startBin, endBin });
  }
}

setupLogBins();

/**
 * Attach an audio stream to the Web Audio analyser.
 */
function connectStream(stream) {
  // Stop any video tracks (from getDisplayMedia)
  stream.getVideoTracks().forEach(t => t.stop());

  if (stream.getAudioTracks().length === 0) {
    // No audio tracks in the stream
    return false;
  }

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = CFG.fftSmooth;

  source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
  dataArray = new Float32Array(analyser.frequencyBinCount);
  useRealAudio = true;
  setupLogBins();
  return true;
}

/**
 * Try to capture system audio via getDisplayMedia.
 * Returns true on success, false on failure/cancel.
 */
async function tryDisplayMedia() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    console.warn('getDisplayMedia not available.');
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: { noiseSuppression: false, echoCancellation: false },
      video: true,
    });

    if (connectStream(stream)) {
      return true;
    } else {
      stream.getTracks().forEach(t => t.stop());
      console.warn('getDisplayMedia: no audio tracks shared.');
      return false;
    }
  } catch (err) {
    console.warn('getDisplayMedia failed:', err.name, err.message);
    return false;
  }
}

/**
 * Fallback: capture microphone audio via getUserMedia.
 * Returns true on success, false on failure.
 */
async function tryMicrophoneMedia() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('getUserMedia not available.');
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { noiseSuppression: false, echoCancellation: false, autoGainControl: false },
    });

    if (connectStream(stream)) {
      return true;
    } else {
      stream.getTracks().forEach(t => t.stop());
      return false;
    }
  } catch (err) {
    console.warn('getUserMedia failed:', err.name, err.message);
    return false;
  }
}

async function startAudio() {
  startLabel.textContent = 'Connecting…';
  startBtn.style.pointerEvents = 'none'; // prevent double-clicks

  // 1. Try system audio capture (getDisplayMedia)
  let ok = await tryDisplayMedia();

  // 2. If that failed, try microphone fallback
  if (!ok) {
    startLabel.textContent = 'Trying mic…';
    ok = await tryMicrophoneMedia();
  }

  // 3. If everything failed, use simulated audio
  if (!ok) {
    console.warn('All audio sources failed — using simulated audio.');
    useRealAudio = false;
    setupLogBins();
  }

  startBtn.style.pointerEvents = '';
  setListeningUI(ok ? (useRealAudio ? 'live' : 'sim') : 'sim');
}

function setListeningUI(mode) {
  startBtn.classList.add('listening');
  if (mode === 'live') {
    startLabel.textContent = '● Listening';
  } else {
    startLabel.textContent = '● Simulated';
  }
  eqBars.classList.remove('hidden');
  idlePrompt.classList.add('hidden');
}

startBtn.addEventListener('click', () => {
  if (!startBtn.classList.contains('listening')) {
    startAudio();
  }
});

// ───────────────────────────────────────────────────
// 9. SIMULATED AUDIO (fallback)
// ───────────────────────────────────────────────────
let simTime = 0;

function updateSimulatedBands(dt) {
  simTime += dt * 0.001;
  const n = Math.round(CFG.bandCount);
  for (let i = 0; i < n; i++) {
    const base = 0.3 + 0.25 * Math.sin(simTime * (1.8 + i * 0.6));
    const pulse = 0.35 * Math.pow(Math.max(0, Math.sin(simTime * (3.5 + i * 0.4))), 4);
    const noise = 0.08 * Math.sin(simTime * 13.7 + i * 2.3);
    bandValues[i] = Math.max(0, Math.min(1, base + pulse + noise));
  }
}

// ───────────────────────────────────────────────────
// 10. FREQUENCY ANALYSIS
// ───────────────────────────────────────────────────
function dbToLinear(db) {
  return (Math.max(-100, Math.min(0, db)) + 100) / 100;
}

function analyseFrequencies() {
  if (!useRealAudio || !analyser) return;
  analyser.getFloatFrequencyData(dataArray);

  const n = Math.round(CFG.bandCount);
  for (let b = 0; b < n; b++) {
    if (!logBins[b]) continue;
    const { startBin, endBin } = logBins[b];
    let sum = 0, count = 0;
    for (let i = startBin; i <= endBin; i++) {
      sum += dbToLinear(dataArray[i]);
      count++;
    }
    bandValues[b] = count > 0 ? sum / count : 0;
  }
}

// ───────────────────────────────────────────────────
// 11. TURBULENCE NOISE
// ───────────────────────────────────────────────────
function noise2D(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = noise2D(ix, iy), b = noise2D(ix + 1, iy);
  const c = noise2D(ix, iy + 1), d = noise2D(ix + 1, iy + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

// ───────────────────────────────────────────────────
// 12. PARTICLE SYSTEM
// ───────────────────────────────────────────────────
const PTYPE_CORE = 0, PTYPE_EMBER = 1, PTYPE_SMOKE = 2, PTYPE_SPARK = 3;

class Particle {
  constructor() { this.alive = false; }

  init(x, y, vx, vy, size, type, bandIdx) {
    this.alive = true;
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.size = size;
    this.initSize = size;
    this.type = type;
    this.bandIdx = bandIdx;
    this.life = 1.0;

    // Decay comes from CFG + randomness
    const rnd = 0.7 + Math.random() * 0.6; // 0.7–1.3 multiplier
    switch (type) {
      case PTYPE_CORE: this.decay = CFG.decayCore * rnd; break;
      case PTYPE_EMBER: this.decay = CFG.decayEmber * rnd; break;
      case PTYPE_SMOKE: this.decay = CFG.decaySmoke * rnd; break;
      case PTYPE_SPARK: this.decay = CFG.decaySpark * rnd; break;
    }

    this.noiseSeed = Math.random() * 100;
  }

  update(time) {
    if (!this.alive) return;

    // Turbulence
    const ns = 0.012;
    const turb = CFG.turbulence;
    const tX = smoothNoise(this.x * ns + time * 0.4, this.y * ns) * turb;
    const tY = smoothNoise(this.x * ns, this.y * ns + time * 0.4 + this.noiseSeed) * turb;

    // Convection (upward) + gravity
    const conv = this.type === PTYPE_SMOKE ? CFG.convection * 2 : CFG.convection;

    this.vx += tX;
    this.vy += tY - conv + CFG.gravity;

    // Damping
    const damp = this.type === PTYPE_SPARK ? CFG.damping * 0.985 : CFG.damping;
    this.vx *= damp;
    this.vy *= damp;

    this.x += this.vx;
    this.y += this.vy;

    this.life -= this.decay;
    if (this.life <= 0) { this.alive = false; return; }

    // Size with pulsation
    const p = 1 + CFG.pulse * Math.sin(time * 12 + this.noiseSeed * 6);
    this.size = this.initSize * this.life * p;
  }

  getColor(palette) {
    const n = Math.round(CFG.bandCount) || 1;
    // t_band: 0 = band teratas (AIR), 1 = band terbawah (SUB)
    const t_band = 1 - (this.bandIdx + 0.5) / n;
    // t_life: pengaruh penuaan tetap ada tapi dikurangin bobotnya
    const t_life = 1 - this.life;
    // Gabungin: 70% dari posisi band, 30% dari life
    const t = t_band * 0.7 + t_life * 0.3;

    const idx = Math.min(t * (palette.length - 1), palette.length - 1.001);
    const i = Math.floor(idx);
    const f = idx - i;
    const a = palette[i];
    const b = palette[Math.min(i + 1, palette.length - 1)];
    return tintColor({
      h: a.h + (b.h - a.h) * f,
      s: a.s + (b.s - a.s) * f,
      l: a.l + (b.l - a.l) * f,
    });
  }

  draw(ctx, palette) {
    if (!this.alive || this.size <= 0.15) return;
    const col = this.getColor(palette);
    const alpha = Math.pow(this.life, 1.3);

    if (this.type === PTYPE_SMOKE) {
      ctx.globalCompositeOperation = 'screen';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${col.h},${col.s * 0.4}%,${col.l * 0.5}%,${alpha * CFG.smokeOpacity})`;
      ctx.fill();
      return;
    }

    ctx.globalCompositeOperation = 'lighter';

    if (this.type === PTYPE_SPARK) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${col.h},${col.s * 0.5}%,${Math.min(col.l + 20, 100)}%,${alpha * CFG.sparkGlow})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${col.h},${col.s * 0.3}%,${Math.min(col.l + 30, 100)}%,${alpha})`;
      ctx.fill();
      return;
    }

    // CORE & EMBER — three layers
    // L1: Outer glow
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * CFG.glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${col.h},${col.s}%,${col.l}%,${alpha * CFG.outerGlow})`;
    ctx.fill();
    // L2: Core body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${col.h},${col.s}%,${col.l}%,${alpha * CFG.coreOpacity})`;
    ctx.fill();
    // L3: Hot centre
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${col.h},${Math.max(col.s - 30, 0)}%,${Math.min(col.l + 25, 100)}%,${alpha * CFG.centerBright})`;
    ctx.fill();
  }
}

// ───────────────────────────────────────────────────
// 13. PARTICLE POOL (pre-allocated, max from CFG)
// ───────────────────────────────────────────────────
const POOL_SIZE = 10000; // allocate largest possible
const pool = [];
for (let i = 0; i < POOL_SIZE; i++) pool.push(new Particle());

function allocParticle() {
  const limit = Math.round(CFG.maxParticles);
  // Count alive
  let alive = 0;
  for (let i = 0; i < POOL_SIZE; i++) {
    if (pool[i].alive) alive++;
    else if (alive < limit) return pool[i]; // return first dead within limit
  }
  // If we're over limit, find any dead slot
  for (let i = 0; i < POOL_SIZE; i++) {
    if (!pool[i].alive) return pool[i];
  }
  return null;
}

// ───────────────────────────────────────────────────
// 14. EMITTER LOGIC
// ───────────────────────────────────────────────────

function bandY(i) {
  const n = Math.round(CFG.bandCount);
  const mT = 80, mB = 40;
  const usable = H - mT - mB;
  return mT + usable * (1 - (i + 0.5) / n);
}

/**
 * Pick a particle type based on normalised spawn weights.
 */
function pickType() {
  const total = CFG.weightCore + CFG.weightEmber + CFG.weightSmoke + CFG.weightSpark;
  if (total <= 0) return PTYPE_EMBER;
  const r = Math.random() * total;
  if (r < CFG.weightCore) return PTYPE_CORE;
  if (r < CFG.weightCore + CFG.weightEmber) return PTYPE_EMBER;
  if (r < CFG.weightCore + CFG.weightEmber + CFG.weightSmoke) return PTYPE_SMOKE;
  return PTYPE_SPARK;
}

function typeSize(type) {
  const rnd = Math.random();
  switch (type) {
    case PTYPE_CORE: return CFG.sizeCore * (0.5 + rnd * 0.7);
    case PTYPE_EMBER: return CFG.sizeEmber * (0.5 + rnd * 0.7);
    case PTYPE_SMOKE: return CFG.sizeSmoke * (0.5 + rnd * 0.7);
    case PTYPE_SPARK: return CFG.sizeSpark * (0.5 + rnd * 0.7);
  }
}

function typeSpeed(type, energy) {
  switch (type) {
    case PTYPE_CORE: return 0.5 * CFG.hSpeed * (0.4 + Math.random() * 0.6 * energy);
    case PTYPE_EMBER: return 0.4 * CFG.hSpeed * (0.3 + Math.random() * 0.7 * energy);
    case PTYPE_SMOKE: return 0.15 * CFG.hSpeed * (0.3 + Math.random() * 0.5);
    case PTYPE_SPARK: return 0.8 * CFG.hSpeed * (0.5 + Math.random() * 0.8 * energy);
  }
}

function spawnBurst(bandIdx, energy) {
  const ey = bandY(bandIdx);
  const count = Math.floor(CFG.burstCount * (0.4 + 0.6 * energy));

  for (let i = 0; i < count; i++) {
    const p = allocParticle();
    if (!p) break;

    const type = pickType();
    const dir = Math.random() < 0.5 ? -1 : 1;
    const speed = typeSpeed(type, energy);
    const vx = dir * speed;
    const vy = (Math.random() - 0.5) * CFG.vSpread * energy;
    const size = typeSize(type);

    const ox = centerX + (Math.random() - 0.5) * CFG.spawnSpreadX;
    const oy = ey + (Math.random() - 0.5) * CFG.spawnSpreadY;

    p.init(ox, oy, vx, vy, size, type, bandIdx);
  }
}

function spawnAmbient(bandIdx, energy) {
  if (energy < 0.05) return;
  const count = Math.floor(energy * CFG.ambientRate);
  const ey = bandY(bandIdx);

  for (let i = 0; i < count; i++) {
    const p = allocParticle();
    if (!p) break;

    const type = Math.random() < 0.6 ? PTYPE_EMBER : PTYPE_SMOKE;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const vx = dir * (0.2 + Math.random() * 0.8 * CFG.hSpeed * 0.15 * energy);
    const vy = (Math.random() - 0.5) * 0.5;
    const size = typeSize(type) * 0.7;

    const ox = centerX + (Math.random() - 0.5) * CFG.spawnSpreadX * 0.6;
    const oy = ey + (Math.random() - 0.5) * CFG.spawnSpreadY * 0.5;

    p.init(ox, oy, vx, vy, size, type, bandIdx);
  }
}

// ───────────────────────────────────────────────────
// 15. BEAT DETECTION (per-band)
// ───────────────────────────────────────────────────
function detectBeats(now) {
  const n = Math.round(CFG.bandCount);
  for (let b = 0; b < n; b++) {
    const energy = bandValues[b] || 0;
    bandPeaks[b] = bandPeaks[b] * CFG.peakTrack + energy * (1 - CFG.peakTrack);
    const threshold = Math.max(CFG.beatThreshold, bandPeaks[b] * CFG.peakSens);

    if (energy > threshold && now - bandCooldown[b] > CFG.beatCooldown) {
      bandCooldown[b] = now;
      spawnBurst(b, energy);
      ringPulse[b] = 1.0;
    }
  }
}

// ───────────────────────────────────────────────────
// 16. DRAW: EMITTER RINGS
// ───────────────────────────────────────────────────
function drawEmitterRings() {
  const palette = PALETTES[currentPalette];
  const n = Math.round(CFG.bandCount);

  ctx.globalCompositeOperation = 'lighter';

  for (let b = 0; b < n; b++) {
    if (ringPulse[b] < 0.01) continue;
    
    const t = 1 - (b + 0.5) / n;
    const bandColIdx = Math.min(Math.floor(t * (palette.length - 1)), palette.length - 2);
    const baseCol = tintColor(palette[bandColIdx]);
    const ey = bandY(b);
    const radius = 18 + ringPulse[b] * CFG.ringSize;
    const alpha = ringPulse[b] * CFG.ringOpacity;

    const grad = ctx.createRadialGradient(centerX, ey, 0, centerX, ey, radius * 1.8);
    grad.addColorStop(0, `hsla(${baseCol.h},${baseCol.s}%,${baseCol.l}%,${alpha * 0.3})`);
    grad.addColorStop(1, `hsla(${baseCol.h},${baseCol.s}%,${baseCol.l}%,0)`);
    ctx.beginPath();
    ctx.arc(centerX, ey, radius * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, ey, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${baseCol.h},${baseCol.s}%,${baseCol.l + 10}%,${alpha})`;
    ctx.lineWidth = 1.5 + ringPulse[b] * 1.5;
    ctx.stroke();

    ringPulse[b] *= CFG.ringDecay;
  }
}

// ───────────────────────────────────────────────────
// 17. DRAW: CENTER COLUMN
// ───────────────────────────────────────────────────
function drawCenterColumn() {
  if (CFG.centerCol <= 0.01) return;

  const palette = PALETTES[currentPalette];
  const col = tintColor(palette[0]);
  const n = Math.round(CFG.bandCount);

  let avgEnergy = 0;
  for (let b = 0; b < n; b++) avgEnergy += (bandValues[b] || 0);
  avgEnergy /= n;

  const alpha = (0.03 + avgEnergy * 0.08) * CFG.centerCol;

  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createLinearGradient(centerX - 60, 0, centerX + 60, 0);
  grad.addColorStop(0, `hsla(${col.h},${col.s}%,${col.l}%,0)`);
  grad.addColorStop(0.5, `hsla(${col.h},${col.s}%,${col.l}%,${alpha})`);
  grad.addColorStop(1, `hsla(${col.h},${col.s}%,${col.l}%,0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(centerX - 60, 0, 120, H);

  const lineA = (0.05 + avgEnergy * 0.12) * CFG.centerCol;
  ctx.strokeStyle = `hsla(${col.h},${col.s}%,${Math.min(col.l + 10, 100)}%,${lineA})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, H);
  ctx.stroke();
}

// ───────────────────────────────────────────────────
// 18. BAND LABELS
// ───────────────────────────────────────────────────
const LABEL_NAMES = ['SUB', 'BASS', 'LO-MID', 'MID', 'HI-MID', 'PRES', 'BRILL', 'AIR',
  'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16'];

function drawBandLabels() {
  if (CFG.bandLabels <= 0.01) return;

  ctx.globalCompositeOperation = 'source-over';
  ctx.font = '500 9px system-ui, sans-serif';
  ctx.textAlign = 'right';

  const palette = PALETTES[currentPalette];
  const n = Math.round(CFG.bandCount);

  for (let b = 0; b < n; b++) {
    const t = 1 - (b + 0.5) / n;
    const bandColIdx = Math.min(Math.floor(t * (palette.length - 1)), palette.length - 2);
    const col = tintColor(palette[bandColIdx]);
    
    const ey = bandY(b);
    const energy = bandValues[b] || 0;
    const alpha = (0.1 + energy * 0.25) * CFG.bandLabels;
    ctx.fillStyle = `hsla(${col.h},${col.s * 0.6}%,${col.l}%,${alpha})`;
    ctx.fillText(LABEL_NAMES[b] || `B${b + 1}`, centerX - 45, ey + 3);
  }
}

// ───────────────────────────────────────────────────
// 19. MAIN RENDER LOOP
// ───────────────────────────────────────────────────
let lastTime = 0;

function loop(timestamp) {
  requestAnimationFrame(loop);

  const dt = timestamp - lastTime;
  lastTime = timestamp;
  const time = timestamp * 0.001;

  // Get frequency data
  if (useRealAudio) {
    analyseFrequencies();
  } else {
    updateSimulatedBands(dt);
  }

  // Motion trail clear
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(3, 3, 4, ${CFG.trail})`;
  ctx.fillRect(0, 0, W, H);

  // Beat detection
  detectBeats(timestamp);

  // Ambient embers
  const n = Math.round(CFG.bandCount);
  for (let b = 0; b < n; b++) {
    spawnAmbient(b, bandValues[b] || 0);
  }

  // Centre column
  drawCenterColumn();

  // Emitter rings
  drawEmitterRings();

  // Particles
  const palette = PALETTES[currentPalette];
  for (let i = 0; i < POOL_SIZE; i++) {
    const p = pool[i];
    if (!p.alive) continue;
    p.update(time);
    if (p.alive) p.draw(ctx, palette);
  }

  ctx.globalCompositeOperation = 'source-over';

  // Band labels
  drawBandLabels();

  // Ambient glow
  let maxE = 0;
  for (let b = 0; b < n; b++) {
    if ((bandValues[b] || 0) > maxE) maxE = bandValues[b];
  }
  ambientGlow.style.opacity = String(maxE * CFG.ambientGlowStr);
}

// === PASTE THE INITIALIZATION LOOP HERE ===
// Bind all sliders after all variables are declared
for (const sliderId of Object.keys(SLIDER_MAP)) {
  const el = document.getElementById(sliderId);
  if (el) {
    el.addEventListener('input', () => syncSlider(sliderId));
    syncSlider(sliderId); // initial sync
  }
}

requestAnimationFrame(loop);
