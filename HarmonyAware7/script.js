// ============================================================
// DAISY // RAGE PROTOCOL — OPTIMIZED BUILD
// ============================================================

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const controlsPanel = document.getElementById('controlsPanel');

const ctrlRings     = document.getElementById('ctrlRings');
const ctrlReact     = document.getElementById('ctrlReact');
const ctrlNoise     = document.getElementById('ctrlNoise');
const ctrlSpin      = document.getElementById('ctrlSpin');
const ctrlHole      = document.getElementById('ctrlHole');
const ctrlThickness = document.getElementById('ctrlThickness');
const ctrlIntensity = document.getElementById('ctrlIntensity');

const PALETTES = {
    rage:      { bg: '#000000', primary: '#ff0090', fg: '#ff1a1a', alt: '#d4ff00', glow: 'rgba(255,0,144,0.5)' },
    nightcore: { bg: '#04000f', primary: '#00fff2', fg: '#b400ff', alt: '#ff0090', glow: 'rgba(0,255,242,0.4)' },
    acid:      { bg: '#000800', primary: '#d4ff00', fg: '#00ff66', alt: '#ff6600', glow: 'rgba(212,255,0,0.4)' },
    void:      { bg: '#000010', primary: '#4444ff', fg: '#00fff2', alt: '#ff00ff', glow: 'rgba(68,68,255,0.5)' }
};

let currentPaletteKey = 'rage';
let pal = PALETTES[currentPaletteKey];
let lastSwapTime = 0;
const SWAP_COOLDOWN = 800;

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentPaletteKey = e.target.dataset.preset;
        pal = PALETTES[currentPaletteKey];
    });
});

let audioCtx, analyser, source;
let useRealAudio = false;
const BIN_COUNT = 1024;
const BINS = 64;
const MIN_DB = -90, MAX_DB = -10;
let logIndices = [];
let dataArray;
let time = 0;
let smoothedBins = new Float32Array(BINS).fill(0);

let beatTimer    = 0;
let lastBass     = 0;
let bassEnergy   = 0;
let midEnergy    = 0;
let globalSpin   = 0;
let erraticPhase = 0;
let erraticPetal = 0;
let erraticSpike = 0;
let currentScale = 1.0;
let glitchTimer  = 0;
let chromaOffset = 0;

// Offscreen canvas for glow pass
const glowCanvas = document.createElement('canvas');
const glowCtx    = glowCanvas.getContext('2d');

// Pre-allocated path store
let flowerPaths = [];

// Particles — 60 instead of 160
const PARTICLE_COUNT = 60;
let bgParticles = [];
for (let i = 0; i < PARTICLE_COUNT; i++) {
    bgParticles.push({
        x: (Math.random() - 0.5) * 1200,
        y: (Math.random() - 0.5) * 1200,
        size: 1.5 + Math.random() * 4,
        angle: Math.random() * Math.PI * 2,
        speed: (Math.random() - 0.5) * 0.02,
        parallax: 0.15 + Math.random() * 0.75,
        type: i % 3
    });
}

function resizeCanvas() {
    const phoneMaxWidth = 400;
    let w = Math.min(window.innerWidth, phoneMaxWidth);
    let h = w * (16 / 9);
    if (h > window.innerHeight) { h = window.innerHeight; w = h * (9 / 16); }
    canvas.width  = w; canvas.height = h;
    glowCanvas.width = w; glowCanvas.height = h;
}
window.addEventListener('resize', resizeCanvas);

startBtn.addEventListener('click', async () => {
    overlay.style.display = 'none';
    controlsPanel.classList.remove('hidden');
    resizeCanvas();
    dataArray = new Float32Array(BIN_COUNT);
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = BIN_COUNT * 2;
        analyser.smoothingTimeConstant = 0.5;
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
        const idx = freqs.findIndex(f => f >= targetFreq);
        logIndices.push(idx === -1 ? freqs.length - 1 : idx);
    }
}

function updateSimulatedFrequencies() {
    for (let i = 0; i < BIN_COUNT; i++) dataArray[i] = -100 + Math.random() * 5;
    const t = time * 0.5;
    const addPeak = (s, e, a) => { for (let i = s; i < e; i++) if (-100 + a > dataArray[i]) dataArray[i] = -100 + a; };
    if (Math.sin(t * 8) > 0.8) addPeak(1, 5, 80);
    addPeak(10, 15, 60 + Math.sin(t * 2) * 20);
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += Math.max(0, (data[i] - MIN_DB) / (MAX_DB - MIN_DB));
    return sum / Math.max(1, to - from);
}

const toggleUIBtn = document.createElement('button');
toggleUIBtn.id = 'toggleUIBtn';
toggleUIBtn.innerText = '[ HIDE UI ]';
document.body.appendChild(toggleUIBtn);
toggleUIBtn.addEventListener('click', () => {
    controlsPanel.classList.toggle('hidden');
    toggleUIBtn.innerText = controlsPanel.classList.contains('hidden') ? '[ SHOW UI ]' : '[ HIDE UI ]';
});

// ============================================================
// RENDER LOOP
// ============================================================
function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.005;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for (let i = 0; i < dataArray.length; i++) if (!isFinite(dataArray[i])) dataArray[i] = MIN_DB;
    } else {
        updateSimulatedFrequencies();
    }

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT * 0.05));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.05), Math.floor(BIN_COUNT * 0.3));
    const intensity = parseFloat(ctrlIntensity.value);

    if (eB - lastBass > 0.02 && eB > 0.05) {
        beatTimer    = 1.0;
        currentScale = 1.1 + eB * 0.3 * intensity;
        glitchTimer  = 1.0;
        chromaOffset = (Math.random() - 0.5) * 6 * intensity;

        if (intensity > 0.1) {
            const now = Date.now();
            if (now - lastSwapTime > SWAP_COOLDOWN) {
                lastSwapTime = now;
                const keys = Object.keys(PALETTES).filter(k => k !== currentPaletteKey);
                currentPaletteKey = keys[Math.floor(Math.random() * keys.length)];
                pal = PALETTES[currentPaletteKey];
                document.querySelectorAll('.preset-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.preset === currentPaletteKey);
                });
            }
            erraticPhase = (Math.random() * Math.PI * 4) * intensity;
            erraticPetal = Math.floor((Math.random() - 0.5) * 16 * intensity);
            erraticSpike = (Math.random() - 0.5) * 0.9 * intensity;
        }
    }
    lastBass = eB;

    beatTimer    *= 0.72;
    glitchTimer  *= 0.75;
    chromaOffset *= 0.8;
    currentScale += (1.0 - currentScale) * 0.25;
    bassEnergy   += (eB - bassEnergy) * 0.4;
    midEnergy    += (eM - midEnergy) * 0.3;
    erraticPhase *= 0.84;
    erraticPetal *= 0.84;
    erraticSpike *= 0.78;

    globalSpin += parseFloat(ctrlSpin.value) * 0.03 + erraticSpike;

    for (let i = 0; i < BINS; i++) {
        const norm = Math.max(0, ((dataArray[logIndices[i]] || MIN_DB) - MIN_DB) / (MAX_DB - MIN_DB));
        smoothedBins[i] += (norm - smoothedBins[i]) * (beatTimer > 0.5 ? 0.6 : 0.2);
    }

    const W = canvas.width, H = canvas.height;

    // CSS hue glitch — zero pixel cost
    if (Math.abs(chromaOffset) > 0.3) {
        canvas.style.filter = `hue-rotate(${chromaOffset * 8}deg)`;
        setTimeout(() => { canvas.style.filter = 'none'; }, 55);
    }

    // Camera shake — translation only, no pixel reads
    const shakeMag = beatTimer > 0.3 ? beatTimer * 18 * intensity : 0;
    const shakeX = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag : 0;
    const shakeY = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag : 0;

    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);

    drawGrid(W, H);

    ctx.save();
    ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
    ctx.scale(currentScale, currentScale);

    renderBackground(intensity);
    buildFlowerPaths(intensity);
    drawGlowLayer(W, H);
    drawSharpLayer(intensity);

    ctx.restore();
}

// ============================================================
// GRID — single batched path
// ============================================================
function drawGrid(W, H) {
    ctx.globalAlpha = 0.03 + bassEnergy * 0.04;
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    const sp = 44;
    for (let x = 0; x < W; x += sp) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y < H; y += sp) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.globalAlpha = 1;
}

// ============================================================
// BG PARTICLES — batched by color group, no per-particle shadow
// ============================================================
function renderBackground(intensity) {
    ctx.save();
    ctx.rotate(-globalSpin * 0.7);
    const drift = 500 + midEnergy * (220 + intensity * 160);
    const groups = [[], [], []];

    for (let i = 0; i < bgParticles.length; i++) {
        const p = bgParticles[i];
        p.angle += p.speed + p.speed * beatTimer * 6 * intensity;
        groups[p.type].push(p);
    }

    const colors = [pal.primary, pal.fg, pal.alt];
    for (let g = 0; g < 3; g++) {
        ctx.strokeStyle = colors[g];
        ctx.globalAlpha = 0.3 + beatTimer * 0.18;
        ctx.beginPath();

        for (const p of groups[g]) {
            const dx = Math.cos(p.angle) * p.parallax * drift;
            const dy = Math.sin(p.angle) * p.parallax * drift;
            const px = p.x + dx;
            const py = p.y + dy;
            const s  = p.size * (1 + beatTimer * 0.35 * p.parallax * intensity);
            ctx.lineWidth = p.size * 0.25;

            if (g === 0) {
                ctx.moveTo(px - s, py); ctx.lineTo(px + s, py);
                ctx.moveTo(px, py - s); ctx.lineTo(px, py + s);
            } else if (g === 1) {
                ctx.moveTo(px, py - s);
                ctx.lineTo(px + s, py); ctx.lineTo(px, py + s);
                ctx.lineTo(px - s, py); ctx.closePath();
            } else {
                ctx.moveTo(px - s, py - s * 0.3);
                ctx.lineTo(px + s, py + s * 0.3);
            }
        }
        ctx.stroke();
    }
    ctx.restore();
}

// ============================================================
// FLOWER PATH BUILDER — points computed once, reused by both passes
// ============================================================
function buildFlowerPaths(intensity) {
    const baseRingCount = parseInt(ctrlRings.value);
    const reactAmp  = parseFloat(ctrlReact.value);
    const noiseAmp  = parseFloat(ctrlNoise.value) / 25;
    const holeSize  = parseFloat(ctrlHole.value);
    const lineThick = parseFloat(ctrlThickness.value);
    const maxRadius = Math.min(canvas.width, canvas.height) * 0.15;
    // One glitch offset per frame, not per vertex
    const frameGlitch = intensity > 0.8 ? (Math.random() - 0.5) * beatTimer * intensity * 30 : 0;

    flowerPaths = [];
    const resolution = 120; // down from 200

    function buildLayer(ringCount, layerRadius, layerAmp, basePetals, phaseMult, isSharp, alpha, audioStart, audioEnd, color, glowColor) {
        const petals = Math.max(1, basePetals + Math.round(erraticPetal));
        for (let i = 0; i < ringCount; i++) {
            const rn    = ringCount > 1 ? i / (ringCount - 1) : 0;
            const rBase = holeSize * maxRadius + layerRadius * (0.1 + 0.9 * rn);
            const phase = rn * phaseMult + erraticPhase;
            const pts   = new Float32Array((resolution + 1) * 2);

            for (let j = 0; j <= resolution; j++) {
                const t      = (j / resolution) * Math.PI * 2;
                const angle  = t + globalSpin;
                const binIdx = Math.floor(audioStart + (audioEnd - audioStart) * Math.sin((j / resolution) * Math.PI));
                const audio  = smoothedBins[binIdx] || 0;
                const wave   = isSharp
                    ? Math.abs(Math.sin((petals * t + phase) / 2)) * 2 - 1
                    : Math.cos(petals * t + phase);
                const amp = layerAmp * noiseAmp + audio * maxRadius * 0.4 * reactAmp * (1 + intensity);
                const r   = rBase + amp * wave + frameGlitch;
                pts[j * 2]     = r * Math.cos(angle);
                pts[j * 2 + 1] = r * Math.sin(angle);
            }
            flowerPaths.push({ pts, color, glowColor, alpha, lineWidth: lineThick + beatTimer * intensity * 2.2 });
        }
    }

    buildLayer(Math.floor(baseRingCount * 0.5),  maxRadius * 0.8,  maxRadius * 0.3, 8,  Math.PI,     false, 0.9,  0,  10, pal.primary, pal.glow);
    buildLayer(Math.floor(baseRingCount * 0.35), maxRadius * 0.45, maxRadius * 0.2, 16, Math.PI * 2, true,  0.85, 10, 30, pal.fg,      pal.primary);
    buildLayer(Math.floor(baseRingCount * 0.15), maxRadius * 0.2,  maxRadius * 0.1, 24, Math.PI * 4, true,  0.95, 30, 60, pal.alt,     pal.fg);
}

// GLOW PASS — rendered once to offscreen canvas, composited via 'screen'
function drawGlowLayer(W, H) {
    glowCtx.clearRect(0, 0, W, H);
    glowCtx.save();
    glowCtx.translate(W / 2, H / 2);
    glowCtx.scale(currentScale, currentScale);
    glowCtx.lineJoin  = 'round';
    glowCtx.shadowBlur = 14 + beatTimer * 20; // set ONCE

    for (const p of flowerPaths) {
        glowCtx.globalAlpha = p.alpha * 0.18;
        glowCtx.strokeStyle = p.glowColor;
        glowCtx.shadowColor = p.glowColor;
        glowCtx.lineWidth   = p.lineWidth * 3.5;
        glowCtx.beginPath();
        const pts = p.pts;
        glowCtx.moveTo(pts[0], pts[1]);
        for (let j = 2; j < pts.length; j += 2) glowCtx.lineTo(pts[j], pts[j + 1]);
        glowCtx.closePath();
        glowCtx.stroke();
    }

    // Center dot glow
    const cp = 3 + bassEnergy * 10;
    glowCtx.shadowColor = pal.primary;
    glowCtx.fillStyle   = pal.primary;
    glowCtx.globalAlpha = 0.5;
    glowCtx.beginPath();
    glowCtx.arc(0, 0, cp * 2.5, 0, Math.PI * 2);
    glowCtx.fill();

    glowCtx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(glowCanvas, 0, 0);
    ctx.restore();
}

// SHARP PASS — crisp lines, no shadow
function drawSharpLayer(intensity) {
    ctx.lineJoin   = beatTimer > 0.3 && intensity > 0.5 ? 'miter' : 'round';
    ctx.miterLimit = 6;
    ctx.shadowBlur = 0;

    for (const p of flowerPaths) {
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth   = p.lineWidth;
        ctx.beginPath();
        const pts = p.pts;
        ctx.moveTo(pts[0], pts[1]);
        for (let j = 2; j < pts.length; j += 2) ctx.lineTo(pts[j], pts[j + 1]);
        ctx.closePath();
        ctx.stroke();
    }

    const cp = 3 + bassEnergy * 10;
    ctx.fillStyle   = pal.primary;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(0, 0, cp, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}