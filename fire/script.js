/* ============================================================
   Burning Drum — script.js
   2D Fire-Particle Music Visualizer
   Uses Web Audio API for beat detection and Canvas 2D for rendering.
   ============================================================ */

// ───────────────────────────────────────────────────
// 1. DOM REFERENCES
// ───────────────────────────────────────────────────
const canvas      = document.getElementById('visualizer-canvas');
const ctx         = canvas.getContext('2d');
const fileInput   = document.getElementById('audio-upload');
const paletteSel  = document.getElementById('palette-select');
const nowPlaying  = document.getElementById('now-playing');
const trackName   = document.getElementById('track-name');
const idlePrompt  = document.getElementById('idle-prompt');
const ambientGlow = document.getElementById('ambient-glow');

// ───────────────────────────────────────────────────
// 2. COLOR PALETTES
//    Each palette is an array of HSL-based color stops
//    used to tint particles at different life stages.
// ───────────────────────────────────────────────────
const PALETTES = {
  classic: [
    { h: 15,  s: 100, l: 55 },   // deep orange
    { h: 30,  s: 100, l: 55 },   // orange
    { h: 45,  s: 100, l: 58 },   // amber
    { h: 55,  s: 100, l: 60 },   // yellow
    { h: 8,   s: 100, l: 45 },   // red-orange
  ],
  ghost: [
    { h: 200, s: 90,  l: 55 },   // mid blue
    { h: 185, s: 95,  l: 55 },   // cyan
    { h: 210, s: 85,  l: 50 },   // deeper blue
    { h: 175, s: 80,  l: 60 },   // light cyan
    { h: 220, s: 70,  l: 45 },   // dark blue
  ],
  cursed: [
    { h: 275, s: 85,  l: 55 },   // purple
    { h: 290, s: 90,  l: 50 },   // magenta-purple
    { h: 120, s: 80,  l: 45 },   // toxic green
    { h: 310, s: 80,  l: 48 },   // violet
    { h: 130, s: 90,  l: 40 },   // dark green
  ],
  mono: [
    { h: 0,   s: 0,   l: 90 },   // near-white
    { h: 0,   s: 0,   l: 72 },   // light gray
    { h: 0,   s: 0,   l: 55 },   // mid gray
    { h: 0,   s: 0,   l: 40 },   // dark gray
    { h: 0,   s: 0,   l: 98 },   // stark white
  ],
};

// Ambient glow colors matched to each palette
const GLOW_COLORS = {
  classic: 'rgba(255, 120, 20, 0.14)',
  ghost:   'rgba(40, 160, 255, 0.12)',
  cursed:  'rgba(180, 40, 255, 0.12)',
  mono:    'rgba(200, 200, 200, 0.08)',
};

let currentPalette = 'classic';

paletteSel.addEventListener('change', () => {
  currentPalette = paletteSel.value;
  // Update ambient glow gradient
  ambientGlow.style.background =
    `radial-gradient(circle at 50% 55%, ${GLOW_COLORS[currentPalette]} 0%, transparent 65%)`;
});

// ───────────────────────────────────────────────────
// 3. CANVAS SIZING
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
// 4. WEB AUDIO SETUP
// ───────────────────────────────────────────────────
let audioCtx, analyser, dataArray, sourceNode, audio;
const FFT_SIZE   = 2048;
// Number of bins dedicated to bass (≈ 20–120 Hz range).
// Bin width = sampleRate / fftSize ≈ 44100/2048 ≈ 21.5 Hz
// So bins 1–6 roughly cover 21–129 Hz.
const BASS_START = 1;
const BASS_END   = 6;

/**
 * Initialise (or re-initialise) the audio pipeline.
 * Called once per file load.
 */
function initAudio(file) {
  // If a previous audio element exists, stop it
  if (audio) {
    audio.pause();
    audio.src = '';
  }

  // Create AudioContext on first interaction (auto-play policy)
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Create analyser once
  if (!analyser) {
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.75;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.connect(audioCtx.destination);
  }

  // Disconnect any previous source
  if (sourceNode) {
    sourceNode.disconnect();
  }

  // Create <audio> element and connect it
  audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.src = URL.createObjectURL(file);
  sourceNode = audioCtx.createMediaElementSource(audio);
  sourceNode.connect(analyser);

  audio.play();
  audioCtx.resume(); // ensure context is running

  // Show track name
  nowPlaying.classList.remove('hidden');
  trackName.textContent = file.name.replace(/\.[^.]+$/, '');
  idlePrompt.classList.add('hidden');
}

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    initAudio(e.target.files[0]);
  }
});

// ───────────────────────────────────────────────────
// 5. BEAT DETECTION
// ───────────────────────────────────────────────────
const BEAT_THRESHOLD   = 0.62;   // normalised 0-1; tweak for sensitivity
const BEAT_COOLDOWN_MS = 100;    // minimum ms between beats
let lastBeatTime       = 0;
let currentBassEnergy  = 0;      // smooth value for ambient effects

/**
 * Sample bass bins and return normalised energy [0, 1].
 */
function getBassEnergy() {
  if (!analyser) return 0;
  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = BASS_START; i <= BASS_END; i++) {
    sum += dataArray[i];
  }
  // Normalise: each bin maxes at 255
  return sum / ((BASS_END - BASS_START + 1) * 255);
}

/**
 * Returns true when a beat is detected.
 */
function detectBeat(now) {
  currentBassEnergy = getBassEnergy();

  if (currentBassEnergy > BEAT_THRESHOLD && now - lastBeatTime > BEAT_COOLDOWN_MS) {
    lastBeatTime = now;
    return true;
  }
  return false;
}

// ───────────────────────────────────────────────────
// 6. PARTICLE SYSTEM
// ───────────────────────────────────────────────────

/**
 * Particle class — each instance is a single fire mote.
 *
 * Physics:
 *  • Initial velocity is radial (from center outward).
 *  • Gravity pulls particles upward (negative y).
 *  • A slight random "wind" drifts them horizontally.
 *  • Size and opacity decay over lifetime.
 */
class Particle {
  /**
   * @param {number} x      — spawn x
   * @param {number} y      — spawn y
   * @param {number} angle  — radial direction (radians)
   * @param {number} speed  — initial speed
   * @param {object} color  — {h, s, l} from palette
   * @param {number} size   — initial radius
   */
  constructor(x, y, angle, speed, color, size) {
    this.x  = x;
    this.y  = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.color = color;
    this.size  = size;
    this.initialSize = size;

    this.life    = 1.0;           // 1 → 0
    this.decay   = 0.008 + Math.random() * 0.014; // how fast it fades

    // Slight horizontal wind / drift
    this.windX   = (Math.random() - 0.5) * 0.3;
    // Upward buoyancy (fire rises)
    this.gravity  = -(0.04 + Math.random() * 0.06);
  }

  update() {
    this.vx += this.windX * 0.05;
    this.vy += this.gravity;

    // Damping
    this.vx *= 0.985;
    this.vy *= 0.985;

    this.x += this.vx;
    this.y += this.vy;

    this.life -= this.decay;
    this.size  = this.initialSize * Math.max(this.life, 0);
  }

  draw(ctx) {
    if (this.life <= 0) return;

    const alpha = Math.pow(this.life, 1.5); // ease-out fade
    const { h, s, l } = this.color;

    // Glow layer (larger, more transparent)
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${alpha * 0.15})`;
    ctx.fill();

    // Core layer
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${h}, ${s}%, ${l + 10}%, ${alpha * 0.85})`;
    ctx.fill();

    // Bright centre highlight
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${h}, ${Math.max(s - 20, 0)}%, ${Math.min(l + 30, 100)}%, ${alpha})`;
    ctx.fill();
  }

  get dead() {
    return this.life <= 0;
  }
}

// Active particles pool
let particles = [];
const MAX_PARTICLES = 4000;

/**
 * Spawn a radial burst of fire particles from the drum center.
 *
 * @param {number} intensity — 0-1, derived from bass energy
 */
function spawnBurst(intensity) {
  const palette = PALETTES[currentPalette];
  const count   = Math.floor(40 + intensity * 80); // 40-120 particles per beat

  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) break;

    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4 * intensity;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const size  = 2.5 + Math.random() * 4;

    // Slight random offset from exact center for a more organic feel
    const offsetR = Math.random() * 18;
    const ox = centerX + Math.cos(angle) * offsetR;
    const oy = centerY + Math.sin(angle) * offsetR;

    particles.push(new Particle(ox, oy, angle, speed, color, size));
  }
}

/**
 * Continuously emit a small number of ambient embers
 * so the drum always has a gentle smolder.
 */
function spawnAmbient() {
  if (!analyser) return;
  const palette = PALETTES[currentPalette];
  // Emit 1-3 particles per frame when music is playing
  const count = Math.floor(1 + currentBassEnergy * 3);

  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) break;

    const angle = Math.random() * Math.PI * 2;
    const speed = 0.3 + Math.random() * 0.8;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const size  = 1 + Math.random() * 2;

    const offsetR = Math.random() * 10;
    const ox = centerX + Math.cos(angle) * offsetR;
    const oy = centerY + Math.sin(angle) * offsetR;

    particles.push(new Particle(ox, oy, angle, speed, color, size));
  }
}

// ───────────────────────────────────────────────────
// 7. DRUM-HEAD RING (visual anchor)
// ───────────────────────────────────────────────────
let ringPulse = 0; // 0-1, set on beat

function drawDrumRing() {
  const palette = PALETTES[currentPalette];
  const base    = palette[0];

  // Outer glow
  const glowRadius = 60 + ringPulse * 30;
  const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
  grad.addColorStop(0, `hsla(${base.h}, ${base.s}%, ${base.l}%, ${0.08 + ringPulse * 0.15})`);
  grad.addColorStop(1, `hsla(${base.h}, ${base.s}%, ${base.l}%, 0)`);
  ctx.beginPath();
  ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Ring stroke
  const ringRadius = 28 + ringPulse * 12;
  ctx.beginPath();
  ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `hsla(${base.h}, ${base.s}%, ${base.l + 15}%, ${0.25 + ringPulse * 0.55})`;
  ctx.lineWidth   = 2 + ringPulse * 2;
  ctx.stroke();

  // Inner dot
  ctx.beginPath();
  ctx.arc(centerX, centerY, 3 + ringPulse * 4, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${base.h}, ${Math.max(base.s - 20, 0)}%, ${Math.min(base.l + 30, 100)}%, ${0.5 + ringPulse * 0.5})`;
  ctx.fill();

  // Decay the pulse
  ringPulse *= 0.92;
}

// ───────────────────────────────────────────────────
// 8. MAIN RENDER LOOP
// ───────────────────────────────────────────────────
function loop(timestamp) {
  requestAnimationFrame(loop);

  // Semi-transparent clear → motion-trail effect
  ctx.fillStyle = 'rgba(5, 5, 5, 0.18)';
  ctx.fillRect(0, 0, W, H);

  // Beat detection
  const beat = detectBeat(timestamp);
  if (beat) {
    spawnBurst(currentBassEnergy);
    ringPulse = 1;
    // Pulse the ambient glow
    ambientGlow.style.opacity = '1';
  } else {
    // Fade ambient glow
    ambientGlow.style.opacity = String(currentBassEnergy * 0.5);
  }

  // Ambient embers
  spawnAmbient();

  // Update & draw particles (iterate backward for safe splice)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    if (p.dead) {
      particles.splice(i, 1);
    } else {
      p.draw(ctx);
    }
  }

  // Draw drum ring on top
  drawDrumRing();
}

// Kick off
requestAnimationFrame(loop);
