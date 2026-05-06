// ============================================================
// ABSTRACT3 - Lattice Boltzmann inspired audiovisual flow
// D2Q9-looking field, audio/video forcing, dye advection
// ============================================================

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d', { alpha: false });
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const controlsPanel = document.getElementById('controlsPanel');

const ctrlRings = document.getElementById('ctrlRings');
const ctrlReact = document.getElementById('ctrlReact');
const ctrlNoise = document.getElementById('ctrlNoise');
const ctrlSpin = document.getElementById('ctrlSpin');
const ctrlHole = document.getElementById('ctrlHole');
const ctrlThickness = document.getElementById('ctrlThickness');
const ctrlIntensity = document.getElementById('ctrlIntensity');

const PALETTES = {
    cyberpunk: { label: 'CYBER', bg: '#020616', paper: '#dffbff', colors: ['#dffbff', '#00f6ff', '#14b8ff', '#8b5cff', '#ff3df2', '#061a3d', '#04101e'], accents: ['#ffffff', '#f7ff4a', '#ff2bd6'] },
    nightcity: { label: 'NIGHTCITY', bg: '#05030f', paper: '#f4fbff', colors: ['#f4fbff', '#00e5ff', '#00ffb3', '#a100ff', '#ff007a', '#12143f', '#07172b'], accents: ['#ffffff', '#fcee09', '#ff3ef8'] },
    blackice: { label: 'BLACKICE', bg: '#01040a', paper: '#e8fbff', colors: ['#e8fbff', '#63f6ff', '#0078ff', '#171d5c', '#2b0a54', '#ff40e6', '#05080f'], accents: ['#ffffff', '#9dfffb', '#d500ff'] },
    blood: { label: 'CRIMSON', bg: '#070408', paper: '#f2e8d5', colors: ['#f2e8d5', '#d10f2f', '#821020', '#251b20', '#bcc8d6', '#f0b982'], accents: ['#ffffff', '#ff2845', '#0b0809'] },
    asylum: { label: 'PORCELAIN', bg: '#03123a', paper: '#f7fbff', colors: ['#f7fbff', '#d7e9ff', '#82a8e8', '#214a9f', '#051d61', '#b8b2e6'], accents: ['#ffffff', '#74b7ff', '#041333'] },
    rust: { label: 'EMBER', bg: '#090503', paper: '#ffeac4', colors: ['#ffeac4', '#f56b21', '#bd2a15', '#39140d', '#f2bd68', '#c0ad8b'], accents: ['#ffffff', '#ffb13d', '#140806'] },
    ghost: { label: 'ABYSS', bg: '#020611', paper: '#eef9ff', colors: ['#eef9ff', '#86e8ff', '#2192da', '#0752a5', '#071a48', '#9e82e8'], accents: ['#ffffff', '#64fff1', '#040713'] },
    lilac: { label: 'LILAC', bg: '#100818', paper: '#fbf4ff', colors: ['#fbf4ff', '#e6d1ff', '#c49be8', '#8e5cc4', '#503069', '#f0bce4'], accents: ['#ffffff', '#c99aff', '#2f1746'] },
    indigo: { label: 'INDIGO', bg: '#050619', paper: '#f3f0ff', colors: ['#f3f0ff', '#c4ccff', '#7c8df6', '#3745bb', '#111863', '#82d8ff'], accents: ['#ffffff', '#5669ff', '#070b24'] },
    ultraviolet: { label: 'UV', bg: '#070014', paper: '#fff7ff', colors: ['#fff7ff', '#ef69ff', '#b600ff', '#5900ba', '#1a003d', '#00e5ff'], accents: ['#ffffff', '#fff06a', '#0c0024'] },
    opal: { label: 'OPAL', bg: '#061014', paper: '#fbfff8', colors: ['#fbfff8', '#d8fff5', '#b7dcff', '#ffd4ef', '#d6c7ff', '#93e4d5'], accents: ['#ffffff', '#fff0ad', '#78d9ff'] },
    jade: { label: 'JADE', bg: '#03120c', paper: '#f0fff6', colors: ['#f0fff6', '#b8f5d4', '#56c488', '#118755', '#063f29', '#d7e8a9'], accents: ['#ffffff', '#82ffbd', '#002517'] },
    candy: { label: 'CANDY', bg: '#130611', paper: '#fff7fb', colors: ['#fff7fb', '#ff7bc8', '#ff3f8e', '#8d5cff', '#42d8ff', '#ffe66d'], accents: ['#ffffff', '#7dffea', '#ffec99'] },
    aurora: { label: 'AURORA', bg: '#020711', paper: '#f4fff8', colors: ['#f4fff8', '#74ffd1', '#3ec8ff', '#5768ff', '#a54dff', '#061d3a'], accents: ['#ffffff', '#b7ff6a', '#081024'] },
    graphite: { label: 'GRAPHITE', bg: '#080909', paper: '#eeeeea', colors: ['#eeeeea', '#c9cac5', '#8d9291', '#50585d', '#1b2024', '#0a0b0c'], accents: ['#ffffff', '#93a4b4', '#020303'] },
    neonsea: { label: 'NEONSEA', bg: '#001015', paper: '#efffff', colors: ['#efffff', '#00fff0', '#00a3ff', '#0057ff', '#06245f', '#ff2ba6'], accents: ['#ffffff', '#a8ff00', '#00121c'] }
};

const FLUX_HUES = [265, 238, 295, 190, 164, 128, 48, 18, 345, 328, 210, 276, 155, 32, 4, 72, 224, 252];
for (let i = 0; i < FLUX_HUES.length; i++) {
    const h = FLUX_HUES[i];
    const m = (h + 36 + (i % 5) * 17) % 360;
    PALETTES[`flux${i + 1}`] = {
        label: `FLUX ${String(i + 1).padStart(2, '0')}`,
        bg: `hsl(${h}, ${36 + (i % 4) * 8}%, ${5 + (i % 3) * 2}%)`,
        paper: `hsl(${m}, 86%, 94%)`,
        colors: [`hsl(${m}, 86%, 94%)`, `hsl(${h}, 82%, 76%)`, `hsl(${m}, 78%, 62%)`, `hsl(${(h + 80) % 360}, 70%, 48%)`, `hsl(${h}, 62%, 18%)`, `hsl(${(m + 170) % 360}, 74%, 80%)`],
        accents: ['#ffffff', `hsl(${(h + 42) % 360}, 100%, 72%)`, `hsl(${h}, 56%, 10%)`]
    };
}

let currentPaletteKey = 'cyberpunk';
let pal = PALETTES[currentPaletteKey];

const BIN_COUNT = 1024;
const BINS = 96;
const MIN_DB = -88;
const MAX_DB = -12;
let audioCtx;
let analyser;
let source;
let dataArray = new Float32Array(BIN_COUNT);
let smoothedBins = new Float32Array(BINS);
let logIndices = [];
let useRealAudio = false;

let videoEl;
let videoReady = false;
let videoCanvas;
let videoCtx;
let videoSamples = [];
let lastVideoSamples = [];
let videoMotion = 0;
let videoLuma = 0;

let W = 1;
let H = 1;
let dpr = 1;
let cols = 96;
let rows = 54;
let cell = 12;
let fieldSize = 0;
let ux;
let uy;
let density;
let dye;
let nextDye;
let pressure;
let curl;
let particles = [];
let glowCanvas;
let glowCtx;
let time = 0;
let frame = 0;
let bassEnergy = 0;
let midEnergy = 0;
let highEnergy = 0;
let lastBass = 0;
let beatPulse = 0;

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function hexToRgb(color) {
    if (color.startsWith('hsl')) {
        const nums = color.match(/[\d.]+/g).map(Number);
        const h = ((nums[0] % 360) + 360) % 360;
        const s = clamp(nums[1] / 100, 0, 1);
        const l = clamp(nums[2] / 100, 0, 1);
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r = 0;
        let g = 0;
        let b = 0;
        if (h < 60) [r, g, b] = [c, x, 0];
        else if (h < 120) [r, g, b] = [x, c, 0];
        else if (h < 180) [r, g, b] = [0, c, x];
        else if (h < 240) [r, g, b] = [0, x, c];
        else if (h < 300) [r, g, b] = [x, 0, c];
        else [r, g, b] = [c, 0, x];
        return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
    }
    const h = color.replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function rgba(color, a) {
    const c = hexToRgb(color);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function index(x, y) {
    return y * cols + x;
}

function wrapX(x) {
    return (x + cols) % cols;
}

function wrapY(y) {
    return (y + rows) % rows;
}

function noise(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
}

function smoothNoise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(noise(xi, yi), noise(xi + 1, yi), u), lerp(noise(xi, yi + 1), noise(xi + 1, yi + 1), u), v);
}

function setupLogBins(isSimulated = false) {
    logIndices = [];
    const nyquist = (isSimulated ? 44100 : audioCtx.sampleRate) / 2;
    const minLog = Math.log10(24);
    const maxLog = Math.log10(16500);
    for (let i = 0; i < BINS; i++) {
        const f = Math.pow(10, minLog + (i / (BINS - 1)) * (maxLog - minLog));
        logIndices.push(clamp(Math.floor((f / nyquist) * BIN_COUNT), 0, BIN_COUNT - 1));
    }
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += clamp((data[i] - MIN_DB) / (MAX_DB - MIN_DB), 0, 1);
    return sum / Math.max(1, to - from);
}

function updateSimulatedFrequencies() {
    for (let i = 0; i < BIN_COUNT; i++) dataArray[i] = MIN_DB + Math.random() * 4;
    const kick = Math.max(0, Math.sin(time * 3.15)) ** 16;
    const pad = 0.5 + 0.5 * Math.sin(time * 0.72);
    const hats = 0.5 + 0.5 * Math.sin(time * 8.4);
    for (let i = 1; i < BIN_COUNT * 0.06; i++) dataArray[i] = lerp(dataArray[i], MAX_DB, kick * 0.85);
    for (let i = BIN_COUNT * 0.06; i < BIN_COUNT * 0.34; i++) dataArray[i] = lerp(dataArray[i], MAX_DB, pad * 0.42);
    for (let i = BIN_COUNT * 0.34; i < BIN_COUNT * 0.82; i++) dataArray[i] = lerp(dataArray[i], MAX_DB, hats * 0.18);
}

function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.55);
    W = Math.floor(window.innerWidth * dpr);
    H = Math.floor(window.innerHeight * dpr);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    glowCanvas = document.createElement('canvas');
    glowCanvas.width = W;
    glowCanvas.height = H;
    glowCtx = glowCanvas.getContext('2d', { alpha: true });

    const targetCells = Number(ctrlRings.value);
    cols = clamp(Math.floor(targetCells * (W / Math.max(W, H)) * 1.25), 34, 104);
    rows = clamp(Math.floor(targetCells * (H / Math.max(W, H)) * 1.25), 24, 72);
    cell = Math.max(W / cols, H / rows);
    fieldSize = cols * rows;
    ux = new Float32Array(fieldSize);
    uy = new Float32Array(fieldSize);
    density = new Float32Array(fieldSize);
    dye = new Float32Array(fieldSize);
    nextDye = new Float32Array(fieldSize);
    pressure = new Float32Array(fieldSize);
    curl = new Float32Array(fieldSize);

    videoCanvas = document.createElement('canvas');
    videoCanvas.width = cols;
    videoCanvas.height = rows;
    videoCtx = videoCanvas.getContext('2d', { willReadFrequently: true });

    seedField();
}

function seedField() {
    particles = [];
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const i = index(x, y);
            const n = smoothNoise(x * 0.08, y * 0.08);
            density[i] = 0.82 + n * 0.35;
            dye[i] = Math.max(0, n - 0.42) * 0.9;
            ux[i] = (smoothNoise(x * 0.05 + 4, y * 0.05) - 0.5) * 0.2;
            uy[i] = (smoothNoise(x * 0.05, y * 0.05 + 8) - 0.5) * 0.2;
        }
    }

    const count = Math.floor(clamp(W * H / (2600 * dpr), 320, 920));
    for (let i = 0; i < count; i++) {
        particles.push({
            x: rand(0, W),
            y: rand(0, H),
            px: 0,
            py: 0,
            life: rand(0.35, 1),
            color: pick(pal.colors),
            bin: Math.floor(rand(0, BINS))
        });
    }
}

function sampleVideoCell(x, y) {
    if (!videoSamples.length) return 0;
    return videoSamples[index(wrapX(x), wrapY(y))] || 0;
}

function updateVideoField() {
    if (!videoReady || !videoEl || frame % 3 !== 0) return;
    try {
        videoCtx.drawImage(videoEl, 0, 0, cols, rows);
        const pixels = videoCtx.getImageData(0, 0, cols, rows).data;
        const next = new Array(fieldSize);
        let luma = 0;
        let motion = 0;
        for (let i = 0; i < fieldSize; i++) {
            const p = i * 4;
            const v = (pixels[p] * 0.2126 + pixels[p + 1] * 0.7152 + pixels[p + 2] * 0.0722) / 255;
            const previous = lastVideoSamples[i] ?? v;
            next[i] = v;
            luma += v;
            motion += Math.abs(v - previous);
        }
        videoSamples = next;
        lastVideoSamples = next;
        videoLuma = videoLuma * 0.84 + (luma / fieldSize) * 0.16;
        videoMotion = videoMotion * 0.76 + (motion / fieldSize) * 0.24;
    } catch (err) {
        videoReady = false;
    }
}

function injectForce(cx, cy, radius, fx, fy, amount) {
    const minX = Math.floor(cx - radius);
    const maxX = Math.ceil(cx + radius);
    const minY = Math.floor(cy - radius);
    const maxY = Math.ceil(cy + radius);
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const d = Math.sqrt(dx * dx + dy * dy) / Math.max(0.001, radius);
            if (d > 1) continue;
            const i = index(wrapX(x), wrapY(y));
            const k = (1 - d) * amount;
            ux[i] += fx * k;
            uy[i] += fy * k;
            dye[i] = clamp(dye[i] + k * 0.75, 0, 4);
            density[i] += k * 0.18;
        }
    }
}

function stepLattice() {
    const react = Number(ctrlReact.value);
    const vort = Number(ctrlNoise.value) / 50;
    const bias = Number(ctrlSpin.value);
    const tau = 0.72 + (1 - clamp(midEnergy, 0, 1)) * 0.42;
    const omega = 1 / tau;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const i = index(x, y);
            const l = index(wrapX(x - 1), y);
            const r = index(wrapX(x + 1), y);
            const u = index(x, wrapY(y - 1));
            const d = index(x, wrapY(y + 1));
            const du = ux[r] - ux[l];
            const dv = uy[d] - uy[u];
            pressure[i] = density[i] + (Math.abs(ux[i]) + Math.abs(uy[i])) * 0.42;
            curl[i] = (uy[r] - uy[l]) - (ux[d] - ux[u]);

            const video = sampleVideoCell(x, y);
            const audio = smoothedBins[Math.floor((x / Math.max(1, cols - 1)) * (BINS - 1))] || 0;
            const n = smoothNoise(x * 0.055 + time * 0.45, y * 0.055 - time * 0.25);
            const angle = n * Math.PI * 2 + curl[i] * 4.2 + bias * 0.65;
            ux[i] += Math.cos(angle) * (0.002 + audio * react * 0.024 + videoMotion * video * 0.06);
            uy[i] += Math.sin(angle) * (0.002 + audio * react * 0.024 + videoMotion * video * 0.06);
            ux[i] += -dv * vort * 0.035;
            uy[i] += du * vort * 0.035;
        }
    }

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const i = index(x, y);
            const l = index(wrapX(x - 1), y);
            const r = index(wrapX(x + 1), y);
            const u = index(x, wrapY(y - 1));
            const d = index(x, wrapY(y + 1));
            const avgU = (ux[l] + ux[r] + ux[u] + ux[d]) * 0.25;
            const avgV = (uy[l] + uy[r] + uy[u] + uy[d]) * 0.25;
            const avgD = (density[l] + density[r] + density[u] + density[d]) * 0.25;
            const gradX = pressure[r] - pressure[l];
            const gradY = pressure[d] - pressure[u];
            ux[i] = lerp(ux[i], avgU - gradX * 0.018, omega * 0.08);
            uy[i] = lerp(uy[i], avgV - gradY * 0.018, omega * 0.08);
            density[i] = lerp(density[i], avgD, 0.016);
            const speedLimit = 1.9 + bassEnergy * 3.5;
            ux[i] = clamp(ux[i] * 0.992, -speedLimit, speedLimit);
            uy[i] = clamp(uy[i] * 0.992, -speedLimit, speedLimit);
        }
    }

    nextDye.fill(0);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const i = index(x, y);
            const sx = wrapX(Math.round(x - ux[i] * 1.4));
            const sy = wrapY(Math.round(y - uy[i] * 1.4));
            const src = index(sx, sy);
            const v = dye[src] * (0.972 - highEnergy * 0.018);
            nextDye[i] = Math.max(nextDye[i], v);
        }
    }
    [dye, nextDye] = [nextDye, dye];
}

function addAudioImpulses(isBeat) {
    const react = Number(ctrlReact.value);
    const amount = 0.5 + bassEnergy * 3.5 + videoMotion * 4;
    injectForce(cols * 0.5, rows * 0.52, 6 + bassEnergy * 18, 0.25 + Number(ctrlSpin.value) * 0.18, -0.08, amount * react);

    if (isBeat) {
        beatPulse = 1;
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2 + time;
            const cx = cols * (0.5 + Math.cos(a) * rand(0.05, 0.34));
            const cy = rows * (0.5 + Math.sin(a) * rand(0.05, 0.34));
            injectForce(cx, cy, rand(4, 12), Math.cos(a + Math.PI * 0.5) * rand(0.9, 2.4), Math.sin(a + Math.PI * 0.5) * rand(0.9, 2.4), rand(0.8, 1.8) * react);
        }
    }
}

function drawField() {
    const intensity = Number(ctrlIntensity.value);
    const thickness = Number(ctrlThickness.value);
    const voidThreshold = Number(ctrlHole.value);
    const glow = Number(ctrlNoise.value) / 50;
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    bg.addColorStop(0, rgba(pal.colors[5] || pal.bg, 0.88));
    bg.addColorStop(0.5, rgba(pal.bg, 0.9));
    bg.addColorStop(1, rgba(pal.bg, 1));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    glowCtx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let y = 0; y < H; y += Math.max(3, dpr * 3)) {
        ctx.fillStyle = `rgba(0,246,255,${0.012 + highEnergy * 0.015})`;
        ctx.fillRect(0, y, W, Math.max(1, dpr));
    }
    ctx.restore();

    const step = Math.max(2, Math.floor(cols / 58));
    const hexR = Math.max(5 * dpr, cell * 0.58 * step);
    const hexH = Math.sin(Math.PI / 3) * hexR;
    for (let y = 0; y < rows; y += step) {
        for (let x = 0; x < cols; x += step) {
            const i = index(x, y);
            const px = (x + 0.5) * (W / cols);
            const py = (y + 0.5) * (H / rows);
            const speed = Math.hypot(ux[i], uy[i]);
            const d = clamp(dye[i], 0, 1.8);
            const c = pal.colors[Math.floor(Math.abs(curl[i] * 3 + pressure[i] * 2.1)) % pal.colors.length];
            const alpha = clamp(0.035 + d * 0.22 + speed * 0.22 + beatPulse * 0.08, 0.02, 0.7) * intensity;

            if (d < voidThreshold && speed < 0.04) continue;
            ctx.strokeStyle = rgba(c, alpha);
            ctx.lineWidth = Math.max(0.45, dpr * thickness * (0.45 + d * 0.7));
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
                const a = Math.PI / 6 + k * Math.PI / 3;
                const hx = px + Math.cos(a) * hexR;
                const hy = py + Math.sin(a) * hexH;
                k === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();

            if ((x + y) % (step * 3) === 0) {
                glowCtx.strokeStyle = rgba(c, alpha * 0.72);
                glowCtx.lineWidth = ctx.lineWidth * 1.8;
                glowCtx.beginPath();
                for (let k = 0; k < 6; k++) {
                    const a = Math.PI / 6 + k * Math.PI / 3;
                    const hx = px + Math.cos(a) * hexR;
                    const hy = py + Math.sin(a) * hexH;
                    k === 0 ? glowCtx.moveTo(hx, hy) : glowCtx.lineTo(hx, hy);
                }
                glowCtx.closePath();
                glowCtx.stroke();
            }

            if ((x + y) % (step * 4) === 0) {
                const len = cell * (3.2 + speed * 7) * thickness;
                ctx.strokeStyle = rgba(c, alpha * 1.25);
                ctx.lineWidth = Math.max(0.7, dpr * thickness);
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + ux[i] * len, py + uy[i] * len);
                ctx.stroke();
                ctx.fillStyle = rgba(pal.accents[(x + y) % pal.accents.length], alpha * 0.7);
                ctx.beginPath();
                ctx.arc(px, py, Math.max(1.2 * dpr, cell * 0.06 + d * cell * 0.12), 0, Math.PI * 2);
                ctx.fill();

                glowCtx.strokeStyle = rgba(c, alpha * 0.9);
                glowCtx.lineWidth = ctx.lineWidth * 2.4;
                glowCtx.beginPath();
                glowCtx.moveTo(px, py);
                glowCtx.lineTo(px + ux[i] * len, py + uy[i] * len);
                glowCtx.stroke();
            }
        }
    }

    if (glow > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.56 + beatPulse * 0.18;
        ctx.filter = `blur(${Math.round((5 + glow * 9) * dpr)}px)`;
        ctx.drawImage(glowCanvas, 0, 0);
        ctx.filter = 'none';
        ctx.globalAlpha = 0.82;
        ctx.drawImage(glowCanvas, 0, 0);
        ctx.restore();
    }
}

function updateParticles() {
    const thickness = Number(ctrlThickness.value);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.shadowBlur = 0;
    for (const p of particles) {
        p.px = p.x;
        p.py = p.y;
        const gx = clamp(Math.floor((p.x / W) * cols), 0, cols - 1);
        const gy = clamp(Math.floor((p.y / H) * rows), 0, rows - 1);
        const i = index(gx, gy);
        const audio = smoothedBins[p.bin] || 0;
        const speed = 0.65 + audio * 6 + bassEnergy * 3;
        p.x += ux[i] * cell * speed;
        p.y += uy[i] * cell * speed;
        p.life -= 0.002 + highEnergy * 0.002;

        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.life <= 0) {
            p.x = rand(0, W);
            p.y = rand(0, H);
            p.px = p.x;
            p.py = p.y;
            p.life = rand(0.35, 1);
            p.color = Math.random() > 0.2 ? pick(pal.colors) : pick(pal.accents);
            p.bin = Math.floor(rand(0, BINS));
        }

        ctx.strokeStyle = rgba(p.color, clamp(0.1 + audio * 0.62, 0.08, 0.78) * p.life);
        ctx.lineWidth = Math.max(0.35, dpr * thickness * (0.5 + audio * 2.2));
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }
    ctx.restore();
}

function drawPressureContours() {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineWidth = Math.max(0.45, dpr * 0.7);
    const stride = Math.max(4, Math.floor(cols / 24));
    for (let y = stride; y < rows - stride; y += stride) {
        ctx.beginPath();
        for (let x = 0; x < cols; x++) {
            const i = index(x, y);
            const px = (x + 0.5) * (W / cols);
            const py = (y + 0.5) * (H / rows) + Math.sin(pressure[i] * 5 + time + x * 0.13) * cell * (0.25 + Math.abs(curl[i]) * 0.6);
            x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        const color = y % (stride * 2) === 0 ? pal.colors[1] : pal.colors[4];
        ctx.strokeStyle = rgba(color, 0.055 + midEnergy * 0.09);
        ctx.stroke();
    }
    ctx.restore();
}

function drawCircuitBranches() {
    const densityStep = Math.max(7, Math.floor(cols / 18));
    const glow = Number(ctrlNoise.value) / 50;
    const thickness = Number(ctrlThickness.value);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let y = densityStep; y < rows; y += densityStep) {
        for (let x = densityStep; x < cols; x += densityStep) {
            const i = index(x, y);
            const audio = smoothedBins[Math.floor((x / cols) * (BINS - 1))] || 0;
            const active = dye[i] + audio + Math.abs(curl[i]) * 0.5 + videoMotion * 2;
            if (active < 0.16 && (x + y + frame) % 3 !== 0) continue;

            const px = (x + 0.5) * (W / cols);
            const py = (y + 0.5) * (H / rows);
            const dir = Math.atan2(uy[i], ux[i]) + Math.round((time * 0.2 + x + y) % 6) * Math.PI / 3;
            const len = cell * densityStep * (0.44 + active * 0.42);
            const color = active > 0.55 ? pal.accents[1] : pal.colors[(x + y) % pal.colors.length];

            ctx.strokeStyle = rgba(color, clamp(0.08 + active * 0.35, 0.08, 0.62));
            ctx.lineWidth = Math.max(0.7, dpr * thickness * (0.75 + audio));
            ctx.beginPath();
            ctx.moveTo(px, py);
            const mx = px + Math.cos(dir) * len * 0.48;
            const my = py + Math.sin(dir) * len * 0.48;
            ctx.lineTo(mx, my);
            ctx.lineTo(mx + Math.cos(dir + Math.PI / 3) * len * 0.34, my + Math.sin(dir + Math.PI / 3) * len * 0.34);
            ctx.moveTo(mx, my);
            ctx.lineTo(mx + Math.cos(dir - Math.PI / 3) * len * 0.3, my + Math.sin(dir - Math.PI / 3) * len * 0.3);
            ctx.stroke();

            ctx.fillStyle = rgba(color, clamp(0.16 + active * 0.45, 0.16, 0.86));
            ctx.beginPath();
            ctx.arc(px, py, Math.max(1.4 * dpr, cell * 0.12 * (1 + active)), 0, Math.PI * 2);
            ctx.fill();

            if ((x + y) % (densityStep * 2) === 0) {
                glowCtx.strokeStyle = rgba(color, clamp(0.08 + active * 0.26, 0.08, 0.46));
                glowCtx.lineWidth = ctx.lineWidth * 2.8 * Math.max(0.35, glow);
                glowCtx.beginPath();
                glowCtx.moveTo(px, py);
                glowCtx.lineTo(mx, my);
                glowCtx.stroke();
            }
        }
    }

    ctx.restore();
}

function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.012;
    frame += 1;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
    } else {
        updateSimulatedFrequencies();
    }
    for (let i = 0; i < BINS; i++) {
        const raw = clamp((dataArray[logIndices[i] || 0] - MIN_DB) / (MAX_DB - MIN_DB), 0, 1);
        smoothedBins[i] = smoothedBins[i] * 0.78 + raw * 0.22;
    }

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT * 0.055));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.055), Math.floor(BIN_COUNT * 0.32));
    const eH = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.32), Math.floor(BIN_COUNT * 0.78));
    bassEnergy = bassEnergy * 0.86 + eB * 0.14;
    midEnergy = midEnergy * 0.86 + eM * 0.14;
    highEnergy = highEnergy * 0.86 + eH * 0.14;
    beatPulse = Math.max(0, beatPulse - 0.035);
    const isBeat = eB - lastBass > 0.028 && eB > 0.075;
    lastBass = eB;

    updateVideoField();
    addAudioImpulses(isBeat);
    stepLattice();
    drawField();
    drawPressureContours();
    drawCircuitBranches();
    updateParticles();

    const vignette = ctx.createRadialGradient(W * 0.5, H * 0.48, Math.min(W, H) * 0.18, W * 0.5, H * 0.5, Math.max(W, H) * 0.74);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
}

function renderPaletteButtons() {
    const grid = document.getElementById('presetGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.entries(PALETTES).forEach(([key, palette]) => {
        const btn = document.createElement('button');
        btn.className = `preset-btn${key === currentPaletteKey ? ' active' : ''}`;
        btn.dataset.preset = key;
        btn.textContent = palette.label || key.toUpperCase();
        btn.style.setProperty('--swatch-a', palette.colors[1] || palette.paper);
        btn.style.setProperty('--swatch-b', palette.colors[3] || palette.bg);
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPaletteKey = key;
            pal = PALETTES[currentPaletteKey];
            seedField();
        });
        grid.appendChild(btn);
    });
}

startBtn.addEventListener('click', async () => {
    overlay.style.display = 'none';
    controlsPanel.classList.remove('hidden');
    resizeCanvas();
    dataArray = new Float32Array(BIN_COUNT);

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: { frameRate: 30, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        videoEl = document.createElement('video');
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.srcObject = stream;
        await videoEl.play();
        videoReady = true;

        if (stream.getAudioTracks().length) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = BIN_COUNT * 2;
            analyser.minDecibels = MIN_DB;
            analyser.maxDecibels = MAX_DB;
            analyser.smoothingTimeConstant = 0.62;
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            useRealAudio = true;
            setupLogBins();
        } else {
            useRealAudio = false;
            setupLogBins(true);
        }
    } catch (err) {
        videoReady = false;
        useRealAudio = false;
        setupLogBins(true);
    }

    requestAnimationFrame(renderLoop);
});

const toggleUIBtn = document.createElement('button');
toggleUIBtn.id = 'toggleUIBtn';
toggleUIBtn.innerText = '[ HIDE UI ]';
document.body.appendChild(toggleUIBtn);
toggleUIBtn.addEventListener('click', () => {
    controlsPanel.classList.toggle('hidden');
    toggleUIBtn.innerText = controlsPanel.classList.contains('hidden') ? '[ SHOW UI ]' : '[ HIDE UI ]';
});

ctrlRings.addEventListener('change', resizeCanvas);
window.addEventListener('resize', resizeCanvas);
renderPaletteButtons();
resizeCanvas();
