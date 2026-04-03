/**
 * THE CORRUPTED CORE — script.js
 * Beat-reactive parameter matrix: every slider has a user-set base value
 * and a live beat-modulated value. Sliders animate in real time.
 */

'use strict';

// ── CANVAS ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
const wrap   = document.getElementById('phone-wrap');

let W, H, CX, CY;
let time = 0;

// ── AUDIO STATE ─────────────────────────────────────────────────────────────
let audioCtx, analyser, dataArray;
let isAudioInitialized = false;
let lastBass  = 0;
let beatTimes = [];

// ── FREQUENCY BUCKETS (live, lerped) ────────────────────────────────────────
const FREQ = { bass: 0, mid: 0, treble: 0, presence: 0, beatPulse: 0 };

// ── SCREEN SHAKE STATE (Mashle-style) ────────────────────────────────────────
// beatTimer: 0→1 spike on beat, exponentially decays — drives shake magnitude
// shakeX/Y:  translational jitter, re-randomised every frame while beatTimer>0
// currentScale: scale punch on beat hit, lerps back to 1.0
// beatRot/targetBeatRot: rotation snap on each hit, lerps back to 0
let beatTimer     = 0;
let shakeX        = 0;
let shakeY        = 0;
let currentScale  = 1.0;
let beatRot       = 0;
let targetBeatRot = 0;

// ── PARAMETER SYSTEM ─────────────────────────────────────────────────────────
// Each param has:
//   base   — what the user set with the slider
//   live   — base + beat modulation (what the engine actually reads)
//   mod    — which FREQ bucket drives it
//   scale  — how much the beat moves it  (can be negative)
//   min/max— clamp range for live value
//   lerpK  — how fast the live value chases the target (0-1)
const PARAMS = {
  bassSens:      { base:0.8,  live:0.8,  mod:'bass',     scale: 0.9,   min:0,    max:2,   lerpK:0.20 },
  trebleSens:    { base:0.8,  live:0.8,  mod:'treble',   scale: 0.8,   min:0,    max:2,   lerpK:0.25 },
  coreSize:      { base:0.6,  live:0.6,  mod:'bass',     scale: 0.35,  min:0.1,  max:1.1,  lerpK:0.35 },
  morphSpeed:    { base:1.0,  live:1.0,  mod:'mid',      scale: 2.5,   min:0.1,  max:4,   lerpK:0.12 },
  gridWarp:      { base:0.5,  live:0.5,  mod:'bass',     scale: 1.2,   min:0,    max:2,   lerpK:0.15 },
  shardChaos:    { base:0.5,  live:0.5,  mod:'beatPulse',scale: 1.3,   min:0,    max:2,   lerpK:0.30 },
  motionBlur:    { base:0.3,  live:0.3,  mod:'bass',     scale:-0.22,  min:0.05, max:0.9, lerpK:0.20 },
  glowIntensity: { base:0.5,  live:0.5,  mod:'presence', scale: 0.45,  min:0,    max:1,   lerpK:0.15 },
};

// Convenience proxy — engine reads P.xxx, always gets the live value
const P = new Proxy(PARAMS, {
  get(target, key) { return key in target ? target[key].live : undefined; }
});

// ── SLIDER MAP (connects DOM ids to PARAMS keys) ─────────────────────────────
const SLIDER_MAP = [
  ['s-bass',       'v-bass',       'bassSens'],
  ['s-treble',     'v-treble',     'trebleSens'],
  ['s-coresize',   'v-coresize',   'coreSize'],
  ['s-morphspeed', 'v-morphspeed', 'morphSpeed'],
  ['s-gridwarp',   'v-gridwarp',   'gridWarp'],
  ['s-shardchaos', 'v-shardchaos', 'shardChaos'],
  ['s-blur',       'v-blur',       'motionBlur'],
  ['s-glow',       'v-glow',       'glowIntensity'],
];

// Cache DOM refs once
const sliderEls = {};
const valEls    = {};
SLIDER_MAP.forEach(([sid, vid, param]) => {
  sliderEls[param] = document.getElementById(sid);
  valEls[param]    = document.getElementById(vid);
});

// ── UPDATE LIVE PARAMS (called every frame) ──────────────────────────────────
function updateLiveParams() {
  for (const [key, p] of Object.entries(PARAMS)) {
    const freqVal = FREQ[p.mod] ?? 0;
    const target  = Math.min(p.max, Math.max(p.min, p.base + freqVal * p.scale));
    p.live += (target - p.live) * p.lerpK;

    // Animate the slider thumb to the live value
    const el = sliderEls[key];
    if (el) el.value = p.live;

    // Update the numeric readout
    const ve = valEls[key];
    if (ve) ve.textContent = p.live.toFixed(2);
  }
}

// ── SHARDS ───────────────────────────────────────────────────────────────────
let shards = [];

function initShards() {
  shards = [];
  const chars = ['X','0','F','!','NULL','ERR','//','>>','<<','??'];
  for (let i = 0; i < 100; i++) {
    shards.push({
      x:    CX,
      y:    CY,
      vx:   (Math.random() - 0.5) * 8,
      vy:   (Math.random() - 0.5) * 8,
      size: Math.random() * 3 + 2,
      char: chars[Math.floor(Math.random() * chars.length)],
      hue:  Math.random() > 0.5 ? 'cyan' : 'yellow',
    });
  }
}

// ── RESIZE ───────────────────────────────────────────────────────────────────
function resize() {
  W  = canvas.width  = wrap.offsetWidth;
  H  = canvas.height = wrap.offsetHeight;
  CX = W / 2;
  CY = H / 2;
  initShards();
}
window.addEventListener('resize', resize);
resize();

// ── TYPOGRAPHY ───────────────────────────────────────────────────────────────
let glitchText = 'SYSTEM.VOID';

function scrambleText() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*><!/';
  glitchText = Array.from({ length: 11 }, () =>
    c[Math.floor(Math.random() * c.length)]
  ).join('');
}

// ── BEAT DETECTION ───────────────────────────────────────────────────────────
function detectBeat(rawBass) {
  if (rawBass - lastBass > 0.07 && rawBass > 0.5) {
    const now = performance.now();
    beatTimes.push(now);
    if (beatTimes.length > 8) beatTimes.shift();

    if (beatTimes.length >= 2) {
      let sum = 0;
      for (let i = 1; i < beatTimes.length; i++)
        sum += beatTimes[i] - beatTimes[i - 1];
      const bpm = Math.round(60000 / (sum / (beatTimes.length - 1)));
      const el  = document.getElementById('hud-bpm');
      if (el) el.textContent = bpm + ' BPM';
    }
    return true;
  }
  return false;
}

// ── EXPLOSION ────────────────────────────────────────────────────────────────
function triggerExplosion(rawBass) {
  const force = rawBass * 60 * P.shardChaos;
  const chars = ['X','0','F','!','NULL','ERR','//','>>','<<','??'];
  for (const s of shards) {
    s.vx  += (Math.random() - 0.5) * force;
    s.vy  += (Math.random() - 0.5) * force;
    s.char = chars[Math.floor(Math.random() * chars.length)];
  }
  const bf = document.getElementById('beatflash');
  if (bf) {
    bf.style.opacity = '1';
    setTimeout(() => { bf.style.opacity = '0'; }, 80);
  }
}

// ── FREQUENCY ENERGY ─────────────────────────────────────────────────────────
function getEnergy(arr, start, end) {
  let sum = 0;
  for (let i = start; i <= end; i++) sum += arr[i];
  return sum / ((end - start + 1) * 255);
}

// ── RENDER LOOP ───────────────────────────────────────────────────────────────
function renderLoop() {
  requestAnimationFrame(renderLoop);
  time += 0.008 * PARAMS.morphSpeed.live;   // use live directly to avoid feedback loop

  // ── Read audio ──────────────────────────────────────────────────────────
  let rawBass = 0, rawMid = 0, rawTreble = 0, rawPresence = 0;

  if (isAudioInitialized) {
    analyser.getByteFrequencyData(dataArray);
    rawBass     = getEnergy(dataArray,  1,   5);
    rawMid      = getEnergy(dataArray,  6,  20);
    rawTreble   = getEnergy(dataArray, 21,  60);
    rawPresence = getEnergy(dataArray, 61, 100);
  } else {
    // Idle breathing
    rawBass     = (Math.sin(time * 2.0) + 1) * 0.18;
    rawMid      = (Math.sin(time * 3.3) + 1) * 0.12;
    rawTreble   = (Math.cos(time * 5.0) + 1) * 0.08;
    rawPresence = (Math.cos(time * 7.0) + 1) * 0.06;
  }

  // Lerp frequency buckets
  const lk = 0.25;
  FREQ.bass     += (rawBass     - FREQ.bass)     * lk;
  FREQ.mid      += (rawMid      - FREQ.mid)      * lk;
  FREQ.treble   += (rawTreble   - FREQ.treble)   * lk;
  FREQ.presence += (rawPresence - FREQ.presence) * lk;
  FREQ.beatPulse += (0 - FREQ.beatPulse) * 0.18;  // always decays

  // Beat hit
  const isBeat = detectBeat(rawBass);
  if (isBeat) {
    FREQ.beatPulse = 1;
    triggerExplosion(rawBass);
    scrambleText();

    // ── Mashle-style beat impact ─────────────────────────────────────────
    beatTimer    = 1.0;                                          // full spike
    currentScale = 1.08 + rawBass * 0.15;                       // scale punch
    // Random rotational snap: ±15° or ±30° weighted by bass
    const snapAngles = [Math.PI/12, Math.PI/8, Math.PI/6];
    const snap = snapAngles[Math.floor(rawBass * snapAngles.length)] ?? Math.PI/12;
    targetBeatRot += (Math.random() > 0.5 ? 1 : -1) * snap;
    // Clamp so it never drifts more than ±45°
    targetBeatRot = Math.max(-Math.PI/4, Math.min(Math.PI/4, targetBeatRot));
  }
  lastBass = rawBass;

  // ── Decay shake state every frame ─────────────────────────────────────
  beatTimer     *= 0.78;                          // exponential decay
  currentScale  += (1.0 - currentScale)  * 0.45; // lerp scale back to 1
  beatRot       += (targetBeatRot - beatRot) * 0.18; // lerp rot to target
  targetBeatRot += (0 - targetBeatRot) * 0.06;   // drift target back to 0

  // Re-randomise translational shake each frame proportional to beatTimer
  if (beatTimer > 0.02) {
    const mag = beatTimer * 18 * P.shardChaos;   // shardChaos scales shake
    shakeX = (Math.random() - 0.5) * mag;
    shakeY = (Math.random() - 0.5) * mag;
  } else {
    shakeX = 0;
    shakeY = 0;
  }

  // Update all live param values + animate sliders
  updateLiveParams();

  // Pulse the controls panel track color on beats
  if (isBeat) ctrlPanel.classList.add('beat-active');
  else        ctrlPanel.classList.remove('beat-active');

  // Motion-blur background (drawn OUTSIDE shake so it doesn't smear the border)
  const blurAlpha = Math.max(0.05, PARAMS.motionBlur.live - FREQ.bass * 0.12);
  ctx.fillStyle = `rgba(5,5,10,${blurAlpha})`;
  ctx.fillRect(0, 0, W, H);

  // ── Apply shake transform around canvas centre ──────────────────────────
  ctx.save();
  ctx.translate(CX + shakeX, CY + shakeY);   // translational jitter
  ctx.rotate(beatRot);                         // rotational snap
  ctx.scale(currentScale, currentScale);       // scale punch
  ctx.translate(-CX, -CY);                    // re-centre

  // Visual layers
  drawTunnel();
  drawDistortedGrid();
  drawSpectrum();
  updateAndDrawPhysics();
  drawBiologicalCore();
  drawTypographyRing();
  drawHexRing();
  drawWaveform();

  ctx.restore(); // ── end shake transform ────────────────────────────────
}

// ── LAYER 1: Depth tunnel rings ───────────────────────────────────────────────
function drawTunnel() {
  const bass   = FREQ.bass;
  const treble = FREQ.treble;
  for (let i = 0; i < 8; i++) {
    const t     = ((time * 0.4 + i / 8) % 1);
    const r     = t * Math.min(W, H) * 0.75;
    const alpha = (1 - t) * (0.04 + bass * 0.12);
    const warp  = Math.sin(time * 3 + i) * bass * 15;
    ctx.beginPath();
    ctx.arc(CX, CY, r + warp, 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 === 0
      ? `rgba(255,0,70,${alpha})`
      : `rgba(0,255,242,${alpha * 0.6})`;
    ctx.lineWidth = 1 + bass * 2;
    ctx.stroke();
  }
}

// ── LAYER 2: Perspective grid ─────────────────────────────────────────────────
function drawDistortedGrid() {
  const bass     = FREQ.bass;
  const warpAmt  = P.gridWarp;
  const horizonY = H * 0.38;

  ctx.lineWidth   = 0.5 + bass * 1.5;
  ctx.strokeStyle = `rgba(0,255,242,${0.06 + bass * 0.25})`;
  ctx.beginPath();
  for (let x = -W; x <= W * 2; x += 35) {
    const wx = Math.sin(time * 2.5 + x * 0.01) * (bass * 80 * warpAmt);
    ctx.moveTo(CX, horizonY);
    ctx.lineTo(x + wx, H);
  }
  for (let y = horizonY + 8; y <= H; y += (y - horizonY) * 0.18 + 1) {
    const wy = Math.cos(time * 4 + y * 0.04) * (bass * 20 * warpAmt);
    ctx.moveTo(0, y + wy);
    ctx.lineTo(W, y + wy);
  }
  ctx.stroke();
}

// ── LAYER 3: Radial spectrum bars ─────────────────────────────────────────────
function drawSpectrum() {
  if (!isAudioInitialized) return;
  const bass    = FREQ.bass;
  const bars    = 64;
  const radius  = 80 + bass * 50 * P.coreSize;
  const maxBarH = 60 + bass * 80;

  for (let i = 0; i < bars; i++) {
    const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
    const idx   = Math.floor((i / bars) * dataArray.length * 0.5);
    const val   = dataArray[idx] / 255;
    const barH  = val * maxBarH * P.bassSens;
    const hue   = i < bars / 2 ? '255,0,70' : '0,255,242';
    ctx.strokeStyle = `rgba(${hue},${0.4 + val * 0.6})`;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(angle) * radius,          CY + Math.sin(angle) * radius);
    ctx.lineTo(CX + Math.cos(angle) * (radius + barH), CY + Math.sin(angle) * (radius + barH));
    ctx.stroke();
  }
}

// ── LAYER 4: Glitch shard physics ─────────────────────────────────────────────
function updateAndDrawPhysics() {
  ctx.textAlign = 'center';
  for (const s of shards) {
    s.x += s.vx;
    s.y += s.vy;
    s.vx *= 0.87;
    s.vy *= 0.87;
    s.vx += (CX - s.x) * 0.004;
    s.vy += (CY - s.y) * 0.004;
    const speed = Math.hypot(s.vx, s.vy);
    ctx.globalAlpha = Math.min(1, speed * 0.08 + 0.15);
    ctx.font        = `${s.size * 3}px 'Share Tech Mono'`;
    ctx.fillStyle   = s.hue === 'cyan' ? '#00fff2' : '#d4ff00';
    ctx.fillText(s.char, s.x, s.y);
  }
  ctx.globalAlpha = 1;
}

// ── LAYER 5: Biological core blob ────────────────────────────────────────────
function drawBiologicalCore() {
  const bass   = FREQ.bass;
  const treble = FREQ.treble;
  const glow   = P.glowIntensity;
  const baseR  = (40 + bass * 55) * P.coreSize;
  const points = 120;

  function coreShape(extraR) {
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const a  = (i / points) * Math.PI * 2;
      const n1 = Math.sin(a *  5 + time *  7) * (bass   * 28);
      const n2 = Math.cos(a * 11 - time * 11) * (treble * 22);
      const n3 = Math.sin(a * 17 + time *  4) * (bass   *  8);
      const r  = baseR + n1 + n2 + n3 + extraR;
      i === 0
        ? ctx.moveTo(CX + Math.cos(a) * r, CY + Math.sin(a) * r)
        : ctx.lineTo(CX + Math.cos(a) * r, CY + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  for (let g = 3; g >= 0; g--) {
    coreShape(g * 12);
    ctx.fillStyle = `rgba(255,0,70,${(0.03 + bass * 0.05) * glow * (4 - g)})`;
    ctx.fill();
  }

  ctx.shadowBlur  = 20 + bass * 60 * glow;
  ctx.shadowColor = '#ff0046';
  coreShape(0);
  ctx.fillStyle = `rgba(255,0,70,${0.75 + treble * 0.25})`;
  ctx.fill();
  ctx.shadowBlur = 0;

  const grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, baseR * 0.6);
  grad.addColorStop(0, `rgba(255,180,180,${0.4 + bass * 0.3})`);
  grad.addColorStop(1, 'rgba(255,0,70,0)');
  ctx.beginPath();
  ctx.arc(CX, CY, baseR * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

// ── LAYER 6: Orbiting glitch text ring ───────────────────────────────────────
function drawTypographyRing() {
  const treble   = FREQ.treble;
  const rotSpeed = 0.3 + treble * 4 * P.morphSpeed;
  const radius   = 140 + treble * 30;

  ctx.save();
  ctx.translate(CX, CY);
  ctx.rotate(time * rotSpeed);
  ctx.font        = 'bold 13px Share Tech Mono';
  ctx.textAlign   = 'center';
  ctx.shadowBlur  = 8 + treble * 20;
  ctx.shadowColor = '#00fff2';

  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = `rgba(0,255,242,${0.6 + treble * 0.4})`;
    ctx.fillText(glitchText,  radius, 0);
    ctx.fillStyle = 'rgba(0,255,242,0.2)';
    ctx.fillText(glitchText, -radius, 0);
  }
  ctx.restore();
  ctx.shadowBlur = 0;
}

// ── LAYER 7: Hex shard orbit ─────────────────────────────────────────────────
function drawHexRing() {
  const bass      = FREQ.bass;
  const beatPulse = FREQ.beatPulse;
  const count     = 6;
  const radius    = 100 + bass * 30 + beatPulse * 40;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + time * 0.3;
    const x     = CX + Math.cos(angle) * radius;
    const y     = CY + Math.sin(angle) * radius;
    const size  = 10 + bass * 15 + beatPulse * 10;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + time);
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const ha = (j / 6) * Math.PI * 2;
      j === 0
        ? ctx.moveTo(Math.cos(ha) * size, Math.sin(ha) * size)
        : ctx.lineTo(Math.cos(ha) * size, Math.sin(ha) * size);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(212,255,0,${0.3 + bass * 0.5 + beatPulse * 0.4})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (beatPulse > 0.3) {
      ctx.fillStyle = `rgba(212,255,0,${beatPulse * 0.15})`;
      ctx.fill();
    }
    ctx.restore();
  }
}

// ── LAYER 8: Time-domain waveform arc ────────────────────────────────────────
function drawWaveform() {
  if (!isAudioInitialized) return;
  const bass  = FREQ.bass;
  const tdata = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(tdata);

  const arcR     = 175 + bass * 20;
  const arcSpan  = Math.PI * 1.2;
  const arcStart = Math.PI / 2 + (Math.PI - arcSpan) / 2;

  ctx.beginPath();
  for (let i = 0; i < tdata.length; i++) {
    const t     = i / tdata.length;
    const angle = arcStart + t * arcSpan;
    const amp   = (tdata[i] / 128 - 1) * 30 * P.bassSens;
    const r     = arcR + amp;
    i === 0
      ? ctx.moveTo(CX + Math.cos(angle) * r, CY + Math.sin(angle) * r)
      : ctx.lineTo(CX + Math.cos(angle) * r, CY + Math.sin(angle) * r);
  }
  ctx.strokeStyle = `rgba(212,255,0,${0.25 + bass * 0.4})`;
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

// ── AUDIO INITIALISATION ─────────────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', async () => {
  const btn = document.getElementById('startBtn');
  btn.textContent = '...CONNECTING';
  btn.disabled    = true;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize               = 512;
    analyser.smoothingTimeConstant = 0.8;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 44100 },
      });
      stream.getVideoTracks().forEach(t => t.stop());
    } catch (e) {
      console.warn('getDisplayMedia unavailable — falling back to mic:', e);
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }

    if (!stream.getAudioTracks().length)
      throw new Error('No audio track. Enable "Share audio" in the capture dialog.');

    audioCtx.createMediaStreamSource(stream).connect(analyser);
    isAudioInitialized = true;

    const ov = document.getElementById('overlay');
    ov.classList.add('hidden');
    setTimeout(() => { ov.style.display = 'none'; }, 500);

    document.getElementById('hud').classList.add('visible');
    document.getElementById('toggleCtrl').classList.add('visible');
    document.getElementById('hud-mode').textContent = 'AUDIO ● LIVE';

  } catch (err) {
    console.error('Audio init failed:', err);
    btn.textContent = '✖ RETRY';
    btn.disabled    = false;
  }
});

// ── SLIDER BINDINGS — sets BASE value only ────────────────────────────────────
SLIDER_MAP.forEach(([sliderId, , param]) => {
  const el = document.getElementById(sliderId);
  // Read the initial slider value into base
  PARAMS[param].base = parseFloat(el.value);

  el.addEventListener('input', () => {
    // User drags → update base; beat modulation still adds on top
    PARAMS[param].base = parseFloat(el.value);
  });
  // Prevent the slider from fighting the user while they drag
  el.addEventListener('pointerdown', () => { PARAMS[param].lerpKPaused = true;  });
  el.addEventListener('pointerup',   () => { PARAMS[param].lerpKPaused = false; });
});

// ── PRESETS ───────────────────────────────────────────────────────────────────
const PRESETS = {
  corrupted: { bassSens:0.8, trebleSens:0.8, coreSize:0.6, morphSpeed:1.0, gridWarp:0.5, shardChaos:0.5, motionBlur:0.3, glowIntensity:0.5 },
  void:      { bassSens:0.4, trebleSens:0.3, coreSize:0.3, morphSpeed:0.4, gridWarp:0.2, shardChaos:0.1, motionBlur:0.6, glowIntensity:0.2 },
  rage:      { bassSens:2.0, trebleSens:1.8, coreSize:1.4, morphSpeed:3.5, gridWarp:2.0, shardChaos:2.0, motionBlur:0.1, glowIntensity:1.0 },
  ghost:     { bassSens:0.6, trebleSens:1.5, coreSize:0.4, morphSpeed:0.7, gridWarp:0.3, shardChaos:0.2, motionBlur:0.7, glowIntensity:0.3 },
};

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = PRESETS[btn.dataset.preset];
    if (!preset) return;
    // Apply preset values as BASE — beat mod still lives on top
    for (const [param, val] of Object.entries(preset)) {
      if (PARAMS[param]) PARAMS[param].base = val;
    }
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── CONTROLS PANEL TOGGLE ─────────────────────────────────────────────────────
let ctrlOpen = false;
const ctrlPanel = document.getElementById('controls');

function toggleCtrl() {
  ctrlOpen = !ctrlOpen;
  ctrlPanel.classList.toggle('visible', ctrlOpen);
  document.getElementById('toggleCtrl').textContent = ctrlOpen ? '✕ CLOSE' : '⚙ PARAMS';
}
document.getElementById('toggleCtrl').addEventListener('click', toggleCtrl);
document.getElementById('ctrlHandle').addEventListener('click',  toggleCtrl);

// ── KICK OFF ──────────────────────────────────────────────────────────────────
renderLoop();