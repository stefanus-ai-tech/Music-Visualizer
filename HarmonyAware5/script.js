// ============================================================
// N3 — LIVING AUDIOVISUAL ORGANISM v10 (MOUNTAIN + FULL CONTROLS)
// ============================================================

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const stateName = document.getElementById('stateName');
const controlsPanel = document.getElementById('controlsPanel');

// Controls
const ctrlRotation   = document.getElementById('ctrlRotation');
const ctrlComplexity = document.getElementById('ctrlComplexity');
const ctrlSmoothness = document.getElementById('ctrlSmoothness');
const ctrlShake      = document.getElementById('ctrlShake');
const ctrlFogDensity = document.getElementById('ctrlFogDensity');
const ctrlFogHeight  = document.getElementById('ctrlFogHeight');
const ctrlFogWarmth  = document.getElementById('ctrlFogWarmth');
const ctrlSkyBright  = document.getElementById('ctrlSkyBright');
const ctrlDepthFade  = document.getElementById('ctrlDepthFade');
const ctrlHueDrift   = document.getElementById('ctrlHueDrift');
const ctrlFlashWarmth= document.getElementById('ctrlFlashWarmth');
const ctrlSaturation = document.getElementById('ctrlSaturation');
const ctrlFeedback   = document.getElementById('ctrlFeedback'); // compat

// ── PALETTE PRESETS ──────────────────────────────────────────
// Each preset: { layers: [{h,s,l}×7], sky: [{h,s,l}×3], fogWarmth, skyBright }
const PRESETS = {
    dusk: {
        name: 'Mountain Dusk',
        layers: [
            { h: 10,  s: 40, l: 62 },
            { h: 355, s: 30, l: 52 },
            { h: 340, s: 25, l: 44 },
            { h: 300, s: 20, l: 36 },
            { h: 260, s: 28, l: 32 },
            { h: 240, s: 38, l: 24 },
            { h: 235, s: 45, l: 18 },
        ],
        sky: [ { h: 12, s: 60, l: 78 }, { h: 8, s: 55, l: 70 }, { h: 5, s: 45, l: 62 } ],
        fogRgb: [230, 185, 165],
    },
    arctic: {
        name: 'Arctic',
        layers: [
            { h: 195, s: 30, l: 88 },
            { h: 200, s: 25, l: 78 },
            { h: 205, s: 30, l: 68 },
            { h: 210, s: 28, l: 55 },
            { h: 215, s: 32, l: 42 },
            { h: 220, s: 38, l: 30 },
            { h: 225, s: 45, l: 20 },
        ],
        sky: [ { h: 195, s: 40, l: 88 }, { h: 200, s: 30, l: 80 }, { h: 205, s: 25, l: 72 } ],
        fogRgb: [210, 235, 245],
    },
    volcanic: {
        name: 'Volcanic',
        layers: [
            { h: 25,  s: 70, l: 55 },
            { h: 15,  s: 65, l: 42 },
            { h: 5,   s: 70, l: 32 },
            { h: 0,   s: 60, l: 22 },
            { h: 355, s: 50, l: 16 },
            { h: 10,  s: 40, l: 10 },
            { h: 0,   s: 20, l: 6  },
        ],
        sky: [ { h: 20, s: 80, l: 50 }, { h: 10, s: 70, l: 35 }, { h: 0, s: 60, l: 22 } ],
        fogRgb: [180, 80, 40],
    },
    forest: {
        name: 'Midnight Forest',
        layers: [
            { h: 150, s: 20, l: 45 },
            { h: 145, s: 25, l: 36 },
            { h: 140, s: 28, l: 28 },
            { h: 135, s: 30, l: 22 },
            { h: 130, s: 35, l: 16 },
            { h: 125, s: 38, l: 11 },
            { h: 120, s: 30, l: 7  },
        ],
        sky: [ { h: 145, s: 15, l: 22 }, { h: 140, s: 12, l: 15 }, { h: 135, s: 10, l: 10 } ],
        fogRgb: [80, 140, 100],
    },
    golden: {
        name: 'Golden Hour',
        layers: [
            { h: 38,  s: 90, l: 72 },
            { h: 30,  s: 80, l: 58 },
            { h: 22,  s: 75, l: 46 },
            { h: 15,  s: 65, l: 36 },
            { h: 8,   s: 55, l: 27 },
            { h: 0,   s: 45, l: 19 },
            { h: 355, s: 35, l: 12 },
        ],
        sky: [ { h: 42, s: 90, l: 78 }, { h: 35, s: 85, l: 68 }, { h: 25, s: 75, l: 58 } ],
        fogRgb: [255, 210, 130],
    },
    void: {
        name: 'Void',
        layers: [
            { h: 260, s: 15, l: 28 },
            { h: 255, s: 12, l: 22 },
            { h: 250, s: 10, l: 17 },
            { h: 245, s: 8,  l: 13 },
            { h: 240, s: 6,  l: 9  },
            { h: 235, s: 5,  l: 6  },
            { h: 230, s: 4,  l: 3  },
        ],
        sky: [ { h: 255, s: 10, l: 14 }, { h: 250, s: 8, l: 10 }, { h: 245, s: 6, l: 7 } ],
        fogRgb: [60, 50, 90],
    },
};

let currentPreset = PRESETS.dusk;
// Smoothly interpolated live palette (lerps toward currentPreset)
let liveLayers = PRESETS.dusk.layers.map(p => ({ ...p }));
let liveSky    = PRESETS.dusk.sky.map(p => ({ ...p }));
let liveFogRgb = [...PRESETS.dusk.fogRgb];

// Preset button wiring
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPreset = PRESETS[btn.dataset.preset];
    });
});

// ── AUDIO ─────────────────────────────────────────────────────
let audioCtx, analyser, source;
let useRealAudio = false;

const BIN_COUNT = 2048;
const CHROMA_BINS = 12;
const BINS = 64;
const MIN_DB = -80, MAX_DB = -5;
let logIndices = [];
let smoothedY = new Array(BINS).fill(MIN_DB);
let smoothedMountains = [];

let dataArray;
let time = 0;
let energy = 0, bassEnergy = 0, midEnergy = 0, highEnergy = 0, peakEnergy = 0.01;
let chromaSmoothed = new Float32Array(CHROMA_BINS).fill(0);
let beatTimer = 0, lastBass = 0;

const MOUNTAIN_LAYERS = [
    { baseY: 0.38, heightScale: 0.12, freqBand: [0.6, 1.0], noiseSpeed: 0.15 },
    { baseY: 0.44, heightScale: 0.14, freqBand: [0.5, 0.85], noiseSpeed: 0.18 },
    { baseY: 0.50, heightScale: 0.16, freqBand: [0.4, 0.75], noiseSpeed: 0.22 },
    { baseY: 0.56, heightScale: 0.18, freqBand: [0.3, 0.65], noiseSpeed: 0.26 },
    { baseY: 0.62, heightScale: 0.20, freqBand: [0.2, 0.55], noiseSpeed: 0.30 },
    { baseY: 0.70, heightScale: 0.24, freqBand: [0.0, 0.40], noiseSpeed: 0.35 },
    { baseY: 0.82, heightScale: 0.20, freqBand: [0.0, 0.25], noiseSpeed: 0.40 },
];

function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    smoothedMountains = MOUNTAIN_LAYERS.map(() => new Float32Array(200).fill(0));
}
window.addEventListener('resize', resizeCanvas);

startBtn.addEventListener('click', async () => {
    overlay.style.display = 'none';
    controlsPanel.classList.remove('hidden');
    resizeCanvas();
    dataArray = new Float32Array(BIN_COUNT);
    smoothedMountains = MOUNTAIN_LAYERS.map(() => new Float32Array(200).fill(0));

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ audio: { noiseSuppression: false, echoCancellation: false }, video: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = BIN_COUNT * 2;
        analyser.smoothingTimeConstant = 0.8;
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        useRealAudio = true;
        setupLogBins();
    } catch (err) {
        useRealAudio = false;
        setupLogBins(true);
    }
    requestAnimationFrame(renderLoop);
});

function setupLogBins(isSimulated = false) {
    logIndices = [];
    const nyquist = (isSimulated ? 44100 : audioCtx.sampleRate) / 2;
    const freqs = Array.from({ length: BIN_COUNT }, (_, i) => i * nyquist / BIN_COUNT);
    const minLog = Math.log10(20), maxLog = Math.log10(16000);
    for (let i = 0; i < BINS; i++) {
        const targetFreq = Math.pow(10, minLog + (i / BINS) * (maxLog - minLog));
        const index = freqs.findIndex(f => f >= targetFreq);
        logIndices.push(index === -1 ? freqs.length - 1 : index);
    }
}

function updateSimulatedFrequencies() {
    for (let i = 0; i < BIN_COUNT; i++) dataArray[i] = -100 + Math.random() * 5;
    const addPeak = (freq, w, amp) => {
        const c = (freq / (44100 / 2)) * BIN_COUNT;
        for (let i = Math.max(0, Math.floor(c - w * 3)); i < Math.min(BIN_COUNT, Math.ceil(c + w * 3)); i++) {
            const bump = amp * Math.exp(-(Math.abs(i - c) ** 2) / (w * w));
            if (-100 + bump > dataArray[i]) dataArray[i] = -100 + bump;
        }
    };
    const t = time * 0.4;
    const beatSim = Math.sin(t * 8) > 0.8 ? 25 : 0;
    addPeak(60, 2, 60 + beatSim);
    addPeak(220 + Math.sin(t * 0.1) * 20, 4, 75 + Math.sin(t * 2) * 10);
    addPeak(800 + Math.cos(t * 0.15) * 50, 6, 70);
    addPeak(3500 + Math.sin(t * 2) * 500, 10, 65);
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += Math.max(0, (data[i] + 100) / 100);
    return sum / (to - from);
}

function extractChroma(data) {
    const chroma = new Float32Array(12).fill(0), count = new Float32Array(12).fill(0);
    for (let i = 1; i < BIN_COUNT; i++) {
        const freq = (i / BIN_COUNT) * (44100 / 2);
        if (freq < 80 || freq > 4000) continue;
        const db = data[i]; if (db < -70) continue;
        const pc = ((Math.round(12 * Math.log2(freq / 440) + 69) % 12) + 12) % 12;
        chroma[pc] += Math.max(0, (db + 70) / 70); count[pc]++;
    }
    let mx = 0;
    for (let i = 0; i < 12; i++) { if (count[i] > 0) chroma[i] /= count[i]; if (chroma[i] > mx) mx = chroma[i]; }
    if (mx > 0) for (let i = 0; i < 12; i++) chroma[i] /= mx;
    return chroma;
}

function mountainNoise(x, seed, octaves = 4) {
    let val = 0, amp = 1, freq = 1, total = 0;
    for (let o = 0; o < octaves; o++) {
        val += Math.sin(x * freq * 0.8 + seed + o * 1.7) * amp;
        val += Math.cos(x * freq * 0.5 - seed * 0.7 + o * 2.3) * amp * 0.6;
        total += amp;
        amp *= 0.55; freq *= 2.1;
    }
    return val / total;
}

// ── RENDER LOOP ───────────────────────────────────────────────
function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.008;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for (let i = 0; i < dataArray.length; i++) if (!isFinite(dataArray[i])) dataArray[i] = -100;
    } else updateSimulatedFrequencies();

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT * 0.05));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.05), Math.floor(BIN_COUNT * 0.3));
    const eH = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.3), Math.floor(BIN_COUNT * 0.7));

    if (eB - lastBass > 0.08 && eB > 0.3) beatTimer = 1.0;
    lastBass = eB;
    beatTimer *= 0.82;

    bassEnergy = lerp(bassEnergy, eB, 0.2);
    midEnergy  = lerp(midEnergy, eM, 0.2);
    highEnergy = lerp(highEnergy, eH, 0.15);

    const raw = eB * 0.5 + eM * 0.35 + eH * 0.15;
    peakEnergy = raw > peakEnergy ? raw : lerp(peakEnergy, raw, 0.001);
    energy = Math.min(1, raw / peakEnergy);

    const chroma = extractChroma(dataArray);
    for (let i = 0; i < 12; i++) chromaSmoothed[i] = lerp(chromaSmoothed[i], chroma[i], 0.05);

    // Smoothly lerp live palette toward current preset
    const palLerp = 0.015;
    for (let i = 0; i < MOUNTAIN_LAYERS.length; i++) {
        liveLayers[i].h = lerp(liveLayers[i].h, currentPreset.layers[i].h, palLerp);
        liveLayers[i].s = lerp(liveLayers[i].s, currentPreset.layers[i].s, palLerp);
        liveLayers[i].l = lerp(liveLayers[i].l, currentPreset.layers[i].l, palLerp);
    }
    for (let i = 0; i < 3; i++) {
        liveSky[i].h = lerp(liveSky[i].h, currentPreset.sky[i].h, palLerp);
        liveSky[i].s = lerp(liveSky[i].s, currentPreset.sky[i].s, palLerp);
        liveSky[i].l = lerp(liveSky[i].l, currentPreset.sky[i].l, palLerp);
    }
    for (let i = 0; i < 3; i++) liveFogRgb[i] = lerp(liveFogRgb[i], currentPreset.fogRgb[i], palLerp);

    renderMountainScene();
}

function layerColor(i, energy, beatTimer) {
    const p = liveLayers[i];
    const hueDrift  = parseFloat(ctrlHueDrift.value);
    const satMult   = parseFloat(ctrlSaturation.value);
    const beatBright= beatTimer * 6 * (1 - i / MOUNTAIN_LAYERS.length);
    const energyHue = energy * hueDrift + beatTimer * (hueDrift * 0.5);

    const h = p.h + energyHue;
    const s = Math.min(100, p.s * satMult);
    const l = p.l + beatBright;
    return { h, s, l };
}

function renderMountainScene() {
    const W = canvas.width, H = canvas.height;

    // ── SKY ──────────────────────────────────────────────────
    const skyBright  = parseFloat(ctrlSkyBright.value);
    const hueDrift   = parseFloat(ctrlHueDrift.value);
    const energyHue  = energy * hueDrift + beatTimer * (hueDrift * 0.5);
    const satMult    = parseFloat(ctrlSaturation.value);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
    for (let i = 0; i < 3; i++) {
        const sk = liveSky[i];
        const l = Math.min(98, sk.l * skyBright);
        const s = Math.min(100, sk.s * satMult);
        skyGrad.addColorStop(i * 0.5, `hsl(${sk.h + energyHue}, ${s}%, ${l}%)`);
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Horizon radial glow — beats
    const glowAlpha = 0.20 + beatTimer * 0.18;
    const horizonGlow = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.6);
    const [fr, fg, fb] = liveFogRgb;
    horizonGlow.addColorStop(0, `rgba(${fr}, ${fg}, ${fb}, ${glowAlpha})`);
    horizonGlow.addColorStop(1, `rgba(${fr}, ${fg}, ${fb}, 0)`);
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, 0, W, H);

    // ── MOUNTAIN LAYERS ───────────────────────────────────────
    const pointCount  = 160;
    const complexity  = parseInt(ctrlComplexity.value);
    const octaves     = 2 + Math.floor(complexity * 0.75);
    const rotVal      = parseFloat(ctrlRotation.value) || 0.5;
    const smoothness  = parseFloat(ctrlSmoothness.value);
    const depthFade   = parseFloat(ctrlDepthFade.value);

    for (let li = 0; li < MOUNTAIN_LAYERS.length; li++) {
        const layer    = MOUNTAIN_LAYERS[li];
        const progress = li / (MOUNTAIN_LAYERS.length - 1);

        const bStart = Math.floor(layer.freqBand[0] * BINS);
        const bEnd   = Math.floor(layer.freqBand[1] * BINS);
        let bandEnergy = 0;
        for (let b = bStart; b < bEnd; b++) {
            const db = Math.max(MIN_DB, Math.min(MAX_DB, dataArray[logIndices[b]] || MIN_DB));
            bandEnergy += (db - MIN_DB) / (MAX_DB - MIN_DB);
        }
        bandEnergy /= Math.max(1, bEnd - bStart);

        if (!smoothedMountains[li]) smoothedMountains[li] = new Float32Array(pointCount + 2).fill(0);

        const baseY     = layer.baseY * H;
        const maxH      = layer.heightScale * H;
        const bassW     = lerp(0.2, 0.9, progress);
        const highW     = lerp(0.8, 0.1, progress);
        const react     = (bassEnergy * bassW + highEnergy * highW) * bandEnergy;
        const beatPunch = beatTimer * (0.3 + progress * 0.7) * parseFloat(ctrlShake.value);
        const seed      = li * 4.37 + time * layer.noiseSpeed * Math.abs(rotVal);

        ctx.beginPath();
        ctx.moveTo(0, H);

        for (let xi = 0; xi <= pointCount; xi++) {
            const xRatio  = xi / pointCount;
            const x       = xRatio * W;
            const noise   = mountainNoise(xRatio * 5, seed, octaves);
            const specBin = Math.min(Math.floor(xRatio * (bEnd - bStart)) + bStart, BINS - 1);
            const specDb  = Math.max(MIN_DB, Math.min(MAX_DB, dataArray[logIndices[specBin]] || MIN_DB));
            const specNorm= (specDb - MIN_DB) / (MAX_DB - MIN_DB);

            const hf = (noise * 0.5 + 0.5) * 0.6
                + specNorm * (0.3 + react * 0.4)
                + beatPunch * 0.2;
            const y = baseY - hf * maxH;

            smoothedMountains[li][xi] = lerp(smoothedMountains[li][xi], y, smoothness + react * 0.1);
            if (xi === 0) ctx.moveTo(x, smoothedMountains[li][xi]);
            else ctx.lineTo(x, smoothedMountains[li][xi]);
        }

        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();

        const col = layerColor(li, energy, beatTimer);
        // Atmospheric depth fade: back layers get more transparent (atmospheric perspective)
        const backness  = 1 - progress;
        const fadeAlpha = 1.0 - (depthFade * backness * 0.55);
        ctx.globalAlpha = Math.max(0.3, fadeAlpha);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `hsl(${col.h}, ${col.s}%, ${col.l}%)`;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Ridge rim light on beat
        if (beatTimer > 0.25 && li < MOUNTAIN_LAYERS.length - 1) {
            ctx.beginPath();
            for (let xi = 0; xi <= pointCount; xi++) {
                const x = (xi / pointCount) * W;
                if (xi === 0) ctx.moveTo(x, smoothedMountains[li][xi]);
                else ctx.lineTo(x, smoothedMountains[li][xi]);
            }
            ctx.strokeStyle = `rgba(${fr}, ${fg}, ${fb}, ${beatTimer * 0.18 * (1 - progress * 0.7)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    // ── FOG / MIST LAYERS ─────────────────────────────────────
    const fogDensity = parseFloat(ctrlFogDensity.value);
    const fogHeight  = parseFloat(ctrlFogHeight.value);
    const fogWarmth  = parseFloat(ctrlFogWarmth.value); // -1 cool, +1 warm

    // Warmth tints the fog rgb
    const warmR = Math.min(255, fr + fogWarmth * 40);
    const warmG = Math.min(255, fg + fogWarmth * 10);
    const warmB = Math.max(0,   fb - fogWarmth * 30);

    // Layer 1: horizon mist band
    if (fogDensity > 0.01) {
        const mistGrad = ctx.createLinearGradient(0, H * (fogHeight - 0.12), 0, H * (fogHeight + 0.12));
        mistGrad.addColorStop(0,   `rgba(${warmR}, ${warmG}, ${warmB}, 0)`);
        mistGrad.addColorStop(0.5, `rgba(${warmR}, ${warmG}, ${warmB}, ${fogDensity * (0.35 + energy * 0.08)})`);
        mistGrad.addColorStop(1,   `rgba(${warmR}, ${warmG}, ${warmB}, 0)`);
        ctx.fillStyle = mistGrad;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillRect(0, 0, W, H);

        // Layer 2: ground fog — denser near bottom, animated by bass
        const groundFogH = H * (0.75 + bassEnergy * 0.05);
        const groundGrad = ctx.createLinearGradient(0, groundFogH, 0, H);
        groundGrad.addColorStop(0, `rgba(${warmR}, ${warmG}, ${warmB}, ${fogDensity * 0.25})`);
        groundGrad.addColorStop(1, `rgba(${warmR}, ${warmG}, ${warmB}, 0)`);
        ctx.fillStyle = groundGrad;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillRect(0, 0, W, H);

        ctx.globalCompositeOperation = 'source-over';
    }

    // ── BEAT FLASH ────────────────────────────────────────────
    if (beatTimer > 0.65 && parseFloat(ctrlShake.value) > 0.2) {
        const flashWarmth = parseFloat(ctrlFlashWarmth.value);
        // Interpolate flash color: cool (blue-white) to warm (peach-white)
        const fR = Math.round(lerp(180, 255, flashWarmth));
        const fG = Math.round(lerp(200, 210, flashWarmth));
        const fB = Math.round(lerp(255, 160, flashWarmth));
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(${fR}, ${fG}, ${fB}, ${beatTimer * 0.07})`;
        ctx.fillRect(0, 0, W, H);
    }
}

function lerp(a, b, t) { return a + (b - a) * t; }
