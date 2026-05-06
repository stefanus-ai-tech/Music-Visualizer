// ============================================================
// ABSTRACT FLUID PAINT — AUDIOVISUAL ORGANISM
// Kandinsky × fluid acrylic × audio-reactive
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

// ============================================================
// PALETTES — fluid paint worlds
// ============================================================
const PALETTES = {
    blood: {
        bg: '#0a0005',
        colors: ['#ff0055','#cc0033','#ff3388','#880022','#ff66aa','#dd1144'],
        accent: ['#ffcc00','#ff6600','#ffffff'],
    },
    asylum: {
        bg: '#05050f',
        colors: ['#6644ff','#aa44ff','#4488ff','#ff44bb','#44ffdd','#ffffff'],
        accent: ['#ffeecc','#ff8844','#aaffee'],
    },
    rust: {
        bg: '#080400',
        colors: ['#ff6600','#dd4400','#ffaa00','#cc2200','#ff9933','#ffdd66'],
        accent: ['#ffffff','#ffeecc','#dd8800'],
    },
    ghost: {
        bg: '#000510',
        colors: ['#00ddff','#0055ff','#aa00ff','#00ffcc','#ffffff','#8800ff'],
        accent: ['#ffffff','#aaffee','#ffddff'],
    }
};

let currentPaletteKey = 'blood';
let pal = PALETTES[currentPaletteKey];

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentPaletteKey = e.target.dataset.preset;
        pal = PALETTES[currentPaletteKey];
        initBlobs();
    });
});

// ============================================================
// AUDIO SETUP
// ============================================================
let audioCtx, analyser, source;
let useRealAudio = false;
const BIN_COUNT = 1024;
const BINS = 64;
const MIN_DB = -90, MAX_DB = -10;
let logIndices = [];
let dataArray;
let time = 0;
let smoothedBins = new Float32Array(BINS).fill(0);

let bassEnergy = 0;
let midEnergy  = 0;
let highEnergy = 0;
let beatTimer  = 0;
let lastBass   = 0;

// ============================================================
// FLUID BLOB SYSTEM
// ============================================================
const BLOB_COUNT = 22;
let blobs = [];

function randomColor() {
    const pool = [...pal.colors, ...pal.accent];
    return pool[Math.floor(Math.random() * pool.length)];
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return {r,g,b};
}

function initBlobs() {
    blobs = [];
    const W = canvas.width, H = canvas.height;
    for (let i = 0; i < BLOB_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        blobs.push({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            radius: 60 + Math.random() * 180,
            color: randomColor(),
            color2: randomColor(),
            phase: Math.random() * Math.PI * 2,
            phaseSpeed: (Math.random() - 0.5) * 0.04,
            noiseOffX: Math.random() * 1000,
            noiseOffY: Math.random() * 1000,
            morphPhase: Math.random() * Math.PI * 2,
            morphSpeed: 0.003 + Math.random() * 0.008,
            petals: 3 + Math.floor(Math.random() * 7),
            audioBin: Math.floor(Math.random() * (BINS - 10)),
            life: 1.0,
            alpha: 0.18 + Math.random() * 0.35,
            spin: (Math.random() - 0.5) * 0.02,
            angle,
        });
    }
}

// ============================================================
// METABALL / FLOW FIELD LAYER
// ============================================================
const FLOW_PARTICLES = 280;
let flowParticles = [];

function initFlow() {
    flowParticles = [];
    const W = canvas.width, H = canvas.height;
    for (let i = 0; i < FLOW_PARTICLES; i++) {
        flowParticles.push({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: 0, vy: 0,
            size: 1.5 + Math.random() * 5,
            color: randomColor(),
            alpha: 0.08 + Math.random() * 0.25,
            life: Math.random(),
            decay: 0.002 + Math.random() * 0.003,
            audioBin: Math.floor(Math.random() * BINS),
            phase: Math.random() * Math.PI * 2,
        });
    }
}

// ============================================================
// PAINT STROKES — reactive slashes of color
// ============================================================
let paintStrokes = [];

function addPaintStroke(W, H, energy, pal) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const angle = Math.random() * Math.PI * 2;
    const len = 80 + energy * 600;
    const color = randomColor();
    paintStrokes.push({
        x, y, angle, len,
        width: 4 + energy * 60,
        color,
        alpha: 0.15 + energy * 0.5,
        life: 1.0,
        decay: 0.008 + Math.random() * 0.015,
        splatter: energy > 0.4,
        splatCount: Math.floor(energy * 20),
        bloblets: Array.from({length: Math.floor(3 + energy * 12)}, () => ({
            dx: (Math.random()-0.5) * len * 1.2,
            dy: (Math.random()-0.5) * len * 0.6,
            r: 3 + Math.random() * 20 * energy,
            alpha: 0.1 + Math.random() * 0.3,
            rot: Math.random() * Math.PI,
        }))
    });
    if (paintStrokes.length > 60) paintStrokes.shift();
}

// ============================================================
// SIMPLEX-ISH NOISE (simple 2D value noise)
// ============================================================
function smoothNoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + t * (b - a);
    const hash = (a, b) => Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    const frac = v => v - Math.floor(v);
    const u = fade(xf), v = fade(yf);
    const aa = frac(hash(xi, yi));
    const ba = frac(hash(xi+1, yi));
    const ab = frac(hash(xi, yi+1));
    const bb = frac(hash(xi+1, yi+1));
    return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
}

// ============================================================
// CANVAS & AUDIO INIT
// ============================================================
function resizeCanvas() {
    const phoneMaxWidth = 400;
    let w = Math.min(window.innerWidth, phoneMaxWidth);
    let h = w * (16 / 9);
    if (h > window.innerHeight) { h = window.innerHeight; w = h * (9 / 16); }
    canvas.width = w; canvas.height = h;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    initBlobs();
    initFlow();
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
        analyser.smoothingTimeConstant = 0.55;
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
    const t = time;
    const addPeak = (s, e, a) => { for (let i = s; i < e; i++) if (-100 + a > dataArray[i]) dataArray[i] = -100 + a; };
    if (Math.sin(t * 5) > 0.7) addPeak(0, 5, 80 + Math.sin(t) * 20);
    addPeak(8, 18, 50 + Math.sin(t * 1.7) * 30);
    addPeak(20, 40, 30 + Math.sin(t * 3.1) * 20);
    addPeak(40, 60, 20 + Math.sin(t * 7.3) * 15);
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += Math.max(0, (data[i] - MIN_DB) / (MAX_DB - MIN_DB));
    return sum / Math.max(1, to - from);
}

// ============================================================
// TOGGLE UI
// ============================================================
const toggleUIBtn = document.createElement('button');
toggleUIBtn.id = 'toggleUIBtn';
toggleUIBtn.innerText = '[ HIDE UI ]';
toggleUIBtn.style.cssText = "position:fixed;top:10px;right:10px;z-index:9999;padding:6px 12px;font-family:'Courier Prime',monospace;font-size:10px;background:rgba(0,0,0,0.7);color:#cc4488;border:1px solid #cc4488;cursor:pointer;";
document.body.appendChild(toggleUIBtn);
toggleUIBtn.addEventListener('click', () => {
    controlsPanel.classList.toggle('hidden');
    toggleUIBtn.innerText = controlsPanel.classList.contains('hidden') ? '[ SHOW UI ]' : '[ HIDE UI ]';
});

// ============================================================
// PERSISTENT CANVAS (paint accumulates, slowly fades)
// ============================================================
let persistCanvas, persistCtx;
function ensurePersist() {
    if (!persistCanvas || persistCanvas.width !== canvas.width) {
        persistCanvas = document.createElement('canvas');
        persistCanvas.width = canvas.width;
        persistCanvas.height = canvas.height;
        persistCtx = persistCanvas.getContext('2d');
        // Fill with bg color
        persistCtx.fillStyle = pal.bg;
        persistCtx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// ============================================================
// DRAW BLOB (fluid, warped organic shape)
// ============================================================
function drawBlob(blob, audio, intensity, react) {
    const W = canvas.width, H = canvas.height;
    const pts = 60;
    const baseR = blob.radius * (1 + audio * react * 1.5);
    const noiseAmp = parseFloat(ctrlNoise.value) * 0.6 * (1 + audio * 3);

    const c = persistCtx;
    c.save();
    c.translate(blob.x, blob.y);

    // Gradient fill — paint mixing simulation
    const gradient = c.createRadialGradient(0, 0, 0, 0, 0, baseR * 1.2);
    const rgb1 = hexToRgb(blob.color);
    const rgb2 = hexToRgb(blob.color2);
    gradient.addColorStop(0, `rgba(${rgb1.r},${rgb1.g},${rgb1.b},${blob.alpha})`);
    gradient.addColorStop(0.5, `rgba(${Math.floor((rgb1.r+rgb2.r)/2)},${Math.floor((rgb1.g+rgb2.g)/2)},${Math.floor((rgb1.b+rgb2.b)/2)},${blob.alpha * 0.7})`);
    gradient.addColorStop(1, `rgba(${rgb2.r},${rgb2.g},${rgb2.b},0)`);

    c.fillStyle = gradient;
    c.beginPath();

    for (let j = 0; j <= pts; j++) {
        const angle = blob.angle + (j / pts) * Math.PI * 2;
        // Multi-frequency warp — the key to organic paint look
        const n1 = smoothNoise(
            blob.noiseOffX + Math.cos(angle) * 2.5 + time * 0.3,
            blob.noiseOffY + Math.sin(angle) * 2.5 + time * 0.2
        );
        const n2 = smoothNoise(
            blob.noiseOffX * 2.1 + Math.cos(angle * 2.3) * 1.8 + time * 0.5,
            blob.noiseOffY * 2.1 + Math.sin(angle * 2.3) * 1.8
        );
        const petalWave = Math.sin(blob.petals * angle + blob.morphPhase) * 0.3;
        const warp = noiseAmp * (n1 * 0.7 + n2 * 0.3) + petalWave * baseR * 0.4;
        const r = baseR + warp;

        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        j === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.closePath();
    c.fill();

    // Specular highlight — paint shine
    if (audio > 0.2 || intensity > 1.3) {
        const shine = c.createRadialGradient(-baseR*0.3, -baseR*0.3, 0, 0, 0, baseR * 0.5);
        shine.addColorStop(0, `rgba(255,255,255,${0.07 + audio * 0.12})`);
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = shine;
        c.beginPath();
        c.arc(0, 0, baseR * 0.5, 0, Math.PI * 2);
        c.fill();
    }

    c.restore();
}

// ============================================================
// DRAW FLOW FIELD STREAKS
// ============================================================
function updateFlowParticles(W, H, intensity, bassE, midE) {
    const react = parseFloat(ctrlReact.value);
    const c = persistCtx;

    for (let p of flowParticles) {
        // Audio-driven flow field angle
        const nx = smoothNoise(p.x * 0.003 + time * 0.15, p.y * 0.003);
        const ny = smoothNoise(p.x * 0.003, p.y * 0.003 + time * 0.12);
        const flowAngle = nx * Math.PI * 4 + time * 0.5;
        const audioBoost = (smoothedBins[p.audioBin] || 0) * react * intensity;

        const speed = 1.5 + audioBoost * 8 + bassE * 5;
        p.vx = p.vx * 0.96 + Math.cos(flowAngle) * speed * 0.04;
        p.vy = p.vy * 0.96 + Math.sin(flowAngle) * speed * 0.04;

        const px = p.x, py = p.y;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        p.life -= p.decay;
        if (p.life <= 0) {
            // Rebirth
            p.x = Math.random() * W;
            p.y = Math.random() * H;
            p.vx = 0; p.vy = 0;
            p.life = 0.6 + Math.random() * 0.4;
            p.color = randomColor();
            p.alpha = 0.05 + Math.random() * 0.2;
        }

        const a = p.alpha * p.life * (1 + audioBoost * 0.5);
        const rgb = hexToRgb(p.color);
        c.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
        c.lineWidth = p.size * (1 + audioBoost * 2);
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(p.x, p.y);
        c.stroke();
    }
}

// ============================================================
// DRAW PAINT STROKES (beat-triggered)
// ============================================================
function renderPaintStrokes() {
    const c = persistCtx;
    for (let i = paintStrokes.length - 1; i >= 0; i--) {
        const s = paintStrokes[i];
        if (s.life <= 0) { paintStrokes.splice(i, 1); continue; }

        const rgb = hexToRgb(s.color);
        const a = s.alpha * s.life;

        // Main stroke
        c.save();
        c.translate(s.x, s.y);
        c.rotate(s.angle);
        const g = c.createLinearGradient(-s.len/2, 0, s.len/2, 0);
        g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
        g.addColorStop(0.2, `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`);
        g.addColorStop(0.8, `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`);
        g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(0, 0, s.len/2, s.width/2, 0, 0, Math.PI*2);
        c.fill();

        // Bloblets (paint droplets)
        for (const bl of s.bloblets) {
            c.globalAlpha = bl.alpha * s.life;
            c.fillStyle = s.color;
            c.beginPath();
            c.ellipse(bl.dx, bl.dy, bl.r, bl.r * 0.6, bl.rot, 0, Math.PI*2);
            c.fill();
        }
        c.globalAlpha = 1;
        c.restore();

        s.life -= s.decay;
    }
}

// ============================================================
// CHROMATIC ABERRATION EFFECT
// ============================================================
function drawChromaticLayer(W, H, shift, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(persistCanvas, shift, 0, W, H);
    ctx.restore();
}

// ============================================================
// RENDER LOOP
// ============================================================
function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.01;

    const W = canvas.width, H = canvas.height;
    ensurePersist();

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for (let i = 0; i < dataArray.length; i++) if (!isFinite(dataArray[i])) dataArray[i] = MIN_DB;
    } else {
        updateSimulatedFrequencies();
    }

    // Compute smoothed bins
    for (let i = 0; i < BINS; i++) {
        const raw = Math.max(0, (dataArray[logIndices[i] || 0] - MIN_DB) / (MAX_DB - MIN_DB));
        smoothedBins[i] = smoothedBins[i] * 0.75 + raw * 0.25;
    }

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT * 0.05));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.05), Math.floor(BIN_COUNT * 0.3));
    const eH = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.3), Math.floor(BIN_COUNT * 0.7));

    bassEnergy = bassEnergy * 0.85 + eB * 0.15;
    midEnergy  = midEnergy  * 0.85 + eM * 0.15;
    highEnergy = highEnergy * 0.85 + eH * 0.15;
    beatTimer  = Math.max(0, beatTimer - 0.03);

    const intensity = parseFloat(ctrlIntensity.value);
    const react     = parseFloat(ctrlReact.value);
    const spin      = parseFloat(ctrlSpin.value);

    // Beat detection
    const isBeat = eB - lastBass > 0.025 && eB > 0.07;
    if (isBeat) {
        beatTimer = 1.0;
        addPaintStroke(W, H, eB, pal);
        if (eB > 0.15) addPaintStroke(W, H, eM, pal);
        // On big beats — rebirth some blobs
        if (eB > 0.2) {
            const rebirth = blobs[Math.floor(Math.random() * blobs.length)];
            rebirth.color = randomColor();
            rebirth.color2 = randomColor();
            rebirth.x = Math.random() * W;
            rebirth.y = Math.random() * H;
            rebirth.petals = 3 + Math.floor(Math.random() * 8);
            rebirth.radius = 60 + Math.random() * 200;
        }
    }
    lastBass = eB;

    // ── PERSIST LAYER: slowly fade to bg ──
    persistCtx.globalAlpha = 0.005 + eB * 0.002;
    persistCtx.fillStyle = pal.bg;
    persistCtx.fillRect(0, 0, W, H);
    persistCtx.globalAlpha = 1;

    // ── UPDATE BLOBS ──
    for (let blob of blobs) {
        const audio = smoothedBins[blob.audioBin % BINS] || 0;
        blob.morphPhase += blob.morphSpeed * (1 + audio * 3 * intensity);
        blob.angle += blob.spin + spin * 0.01 + audio * 0.05 * intensity;
        blob.noiseOffX += 0.004 + eM * 0.01;
        blob.noiseOffY += 0.003 + eH * 0.008;

        // Movement — fluid drift
        blob.vx = blob.vx * 0.992 + (Math.random()-0.5) * 0.08 * (1 + midEnergy * 2);
        blob.vy = blob.vy * 0.992 + (Math.random()-0.5) * 0.08 * (1 + midEnergy * 2);
        // Audio kick
        if (isBeat && blob.audioBin < 15) {
            blob.vx += (Math.random()-0.5) * eB * 20 * intensity;
            blob.vy += (Math.random()-0.5) * eB * 20 * intensity;
        }
        blob.x += blob.vx;
        blob.y += blob.vy;

        // Wrap
        const margin = blob.radius;
        if (blob.x < -margin) blob.x = W + margin;
        if (blob.x > W + margin) blob.x = -margin;
        if (blob.y < -margin) blob.y = H + margin;
        if (blob.y > H + margin) blob.y = -margin;

        drawBlob(blob, audio, intensity, react);
    }

    // ── PAINT STROKES ──
    renderPaintStrokes();

    // ── FLOW FIELD ──
    updateFlowParticles(W, H, intensity, bassEnergy, midEnergy);


    // ── COMPOSITE TO MAIN CANVAS ──
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(persistCanvas, 0, 0);

    // Chromatic aberration on beats
    const caShift = beatTimer * 6 * intensity;
    if (caShift > 0.3) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.15 * beatTimer;
        ctx.drawImage(persistCanvas, caShift, 0, W, H);
        ctx.globalAlpha = 0.1 * beatTimer;
        ctx.drawImage(persistCanvas, -caShift, 0, W, H);
        ctx.restore();
    }

    // Vignette
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
}