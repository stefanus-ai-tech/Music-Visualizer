// ============================================================
// ABSTRACT FLUID SPECTRUM - paint on water audiovisual system
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
    blood: {
        label: 'CRIMSON',
        bg: '#080609',
        paper: '#efe7d2',
        colors: ['#f3ead2', '#b90d20', '#6d0711', '#d6d9e3', '#a8b6c9', '#1e2427', '#f5cf9b'],
        accents: ['#fff8dc', '#e0212f', '#0e1014']
    },
    asylum: {
        label: 'PORCELAIN',
        bg: '#04143b',
        paper: '#f4fbff',
        colors: ['#f6fbff', '#d7e8ff', '#9ebbe4', '#28549f', '#061d5d', '#b7b3df', '#eef4ff'],
        accents: ['#ffffff', '#071f66', '#6f8bc7']
    },
    rust: {
        label: 'EMBER',
        bg: '#090805',
        paper: '#f0e2c2',
        colors: ['#fff4d7', '#d44c21', '#8d1e13', '#f29a45', '#2f2a24', '#c0b6a0', '#f9d47c'],
        accents: ['#fffaf0', '#ca151b', '#11100d']
    },
    ghost: {
        label: 'ABYSS',
        bg: '#020510',
        paper: '#eef7ff',
        colors: ['#f7fbff', '#c6e9ff', '#61b8de', '#0d66a8', '#061a43', '#9d7ed9', '#101018'],
        accents: ['#ffffff', '#75fff0', '#070b1c']
    },
    lilac: {
        label: 'LILAC',
        bg: '#100a18',
        paper: '#fbf5ff',
        colors: ['#fbf5ff', '#e8d5ff', '#cda7ef', '#a06ad1', '#6b3c98', '#f2c7e6', '#d9ecff'],
        accents: ['#ffffff', '#b98cff', '#4c2a6b']
    },
    indigo: {
        label: 'INDIGO',
        bg: '#050619',
        paper: '#f3f0ff',
        colors: ['#f3f0ff', '#c8ceff', '#7e8cf2', '#3942b0', '#171b66', '#0a0d31', '#86d8ff'],
        accents: ['#ffffff', '#5264ff', '#05081f']
    },
    ultraviolet: {
        label: 'UV',
        bg: '#080013',
        paper: '#fff7ff',
        colors: ['#fff7ff', '#f063ff', '#b700ff', '#5b00c8', '#1b003d', '#00e5ff', '#ff2f92'],
        accents: ['#ffffff', '#ffeb70', '#0d0024']
    },
    opal: {
        label: 'OPAL',
        bg: '#071012',
        paper: '#fbfff8',
        colors: ['#fbfff8', '#d9fff5', '#b9dcff', '#ffd6ef', '#d7c9ff', '#9be7d8', '#27333a'],
        accents: ['#ffffff', '#fff0ad', '#8ed9ff']
    },
    pearl: {
        label: 'PEARL',
        bg: '#111112',
        paper: '#fffdf3',
        colors: ['#fffdf3', '#e8e1d4', '#c8c4bc', '#f8d8ce', '#d7e4ec', '#908b88', '#2b2b2d'],
        accents: ['#ffffff', '#f3c8aa', '#5f6167']
    },
    cyanotype: {
        label: 'CYAN',
        bg: '#001a2e',
        paper: '#eefaff',
        colors: ['#eefaff', '#bfeaff', '#58c3f0', '#0878bc', '#004c82', '#002b55', '#d8f6ff'],
        accents: ['#ffffff', '#00e2ff', '#001b34']
    },
    jade: {
        label: 'JADE',
        bg: '#03120d',
        paper: '#f0fff6',
        colors: ['#f0fff6', '#b8f5d4', '#58c48a', '#138854', '#075232', '#c9e6a8', '#111b14'],
        accents: ['#ffffff', '#83ffbd', '#002517']
    },
    venom: {
        label: 'VENOM',
        bg: '#050b03',
        paper: '#f7ffe9',
        colors: ['#f7ffe9', '#d6ff54', '#8fff00', '#41a800', '#102800', '#1b1b16', '#e9ffb3'],
        accents: ['#ffffff', '#baff00', '#071000']
    },
    coral: {
        label: 'CORAL',
        bg: '#160806',
        paper: '#fff2e8',
        colors: ['#fff2e8', '#ffb199', '#ff6f61', '#d73745', '#8b1d2c', '#ffcdb2', '#4b1715'],
        accents: ['#ffffff', '#ffd56b', '#35100f']
    },
    sakura: {
        label: 'SAKURA',
        bg: '#160910',
        paper: '#fff6f9',
        colors: ['#fff6f9', '#ffd6e8', '#ff9ec8', '#e45b91', '#9a2f63', '#ede2ff', '#391627'],
        accents: ['#ffffff', '#ffc2d9', '#5d1f3f']
    },
    glacier: {
        label: 'GLACIER',
        bg: '#061016',
        paper: '#f6fcff',
        colors: ['#f6fcff', '#d8f4ff', '#a2ddf2', '#5ba8ca', '#1d5f83', '#0b2f45', '#d6fff5'],
        accents: ['#ffffff', '#9dffef', '#052337']
    },
    moss: {
        label: 'MOSS',
        bg: '#0b0e08',
        paper: '#f2f0d8',
        colors: ['#f2f0d8', '#c7c889', '#8f9d57', '#4d672e', '#263a1d', '#10170d', '#d8c7a0'],
        accents: ['#fffce4', '#b6d36a', '#061006']
    },
    mineral: {
        label: 'MINERAL',
        bg: '#0b0c10',
        paper: '#f0eee8',
        colors: ['#f0eee8', '#b7b4ad', '#6c7a86', '#2f5966', '#19404a', '#a45d53', '#d8b785'],
        accents: ['#ffffff', '#85e0db', '#181b20']
    },
    oil: {
        label: 'OIL',
        bg: '#040405',
        paper: '#f2f0e6',
        colors: ['#f2f0e6', '#22242a', '#5b4bd8', '#0bb3b8', '#e64d83', '#efb45b', '#071d24'],
        accents: ['#ffffff', '#65fff4', '#ffdb70']
    },
    sunset: {
        label: 'SUNSET',
        bg: '#12090d',
        paper: '#fff0d5',
        colors: ['#fff0d5', '#ffb35c', '#ff6a3d', '#db245c', '#7f1f75', '#262052', '#ffd0a6'],
        accents: ['#ffffff', '#ffd36e', '#2a163a']
    },
    noir: {
        label: 'NOIR',
        bg: '#020203',
        paper: '#f2f0e8',
        colors: ['#f2f0e8', '#c7c1b6', '#7c7c80', '#2f3136', '#090a0d', '#b0182e', '#31466f'],
        accents: ['#ffffff', '#d4162c', '#050506']
    },
    candy: {
        label: 'CANDY',
        bg: '#140612',
        paper: '#fff7fb',
        colors: ['#fff7fb', '#ff7bc8', '#ff3f8e', '#8d5cff', '#42d8ff', '#ffe66d', '#4a1645'],
        accents: ['#ffffff', '#7dffea', '#ffec99']
    },
    aurora: {
        label: 'AURORA',
        bg: '#020711',
        paper: '#f4fff8',
        colors: ['#f4fff8', '#74ffd1', '#3ec8ff', '#5768ff', '#a54dff', '#061d3a', '#d8fff0'],
        accents: ['#ffffff', '#b7ff6a', '#081024']
    },
    wine: {
        label: 'WINE',
        bg: '#0e0308',
        paper: '#fff3ec',
        colors: ['#fff3ec', '#d8b0a5', '#9d233a', '#5d0c25', '#240511', '#c86a7a', '#2d1820'],
        accents: ['#ffffff', '#f3bd91', '#170107']
    },
    graphite: {
        label: 'GRAPHITE',
        bg: '#080909',
        paper: '#eeeeea',
        colors: ['#eeeeea', '#c9cac5', '#8d9291', '#50585d', '#1b2024', '#0a0b0c', '#d4d6de'],
        accents: ['#ffffff', '#93a4b4', '#020303']
    },
    neonsea: {
        label: 'NEONSEA',
        bg: '#001015',
        paper: '#efffff',
        colors: ['#efffff', '#00fff0', '#00a3ff', '#0057ff', '#06245f', '#ff2ba6', '#07181f'],
        accents: ['#ffffff', '#a8ff00', '#00121c']
    }
};

const RANDOM_PALETTE_COUNT = 18;
const RANDOM_HUES = [
    265, 238, 295, 190, 164, 128, 48, 18, 345, 328, 210, 276,
    155, 32, 4, 72, 224, 252, 306, 176, 92, 12, 338, 200
];

for (let i = 0; i < RANDOM_PALETTE_COUNT; i++) {
    const h = RANDOM_HUES[i % RANDOM_HUES.length];
    const mate = (h + 24 + (i % 5) * 18) % 360;
    const dark = `hsl(${h}, ${34 + (i % 4) * 8}%, ${5 + (i % 3) * 2}%)`;
    const pale = `hsl(${mate}, 86%, 94%)`;
    PALETTES[`flux${i + 1}`] = {
        label: `FLUX ${String(i + 1).padStart(2, '0')}`,
        bg: dark,
        paper: pale,
        colors: [
            pale,
            `hsl(${h}, 82%, 76%)`,
            `hsl(${mate}, 78%, 64%)`,
            `hsl(${(h + 72) % 360}, 68%, 48%)`,
            `hsl(${(h + 144) % 360}, 56%, 34%)`,
            `hsl(${h}, 62%, 18%)`,
            `hsl(${(mate + 180) % 360}, 72%, 82%)`
        ],
        accents: [
            '#ffffff',
            `hsl(${(h + 42) % 360}, 100%, 72%)`,
            `hsl(${h}, 56%, 10%)`
        ]
    }
};

let currentPaletteKey = 'blood';
let pal = PALETTES[currentPaletteKey];

const BIN_COUNT = 1024;
const BINS = 96;
const MIN_DB = -88;
const MAX_DB = -12;

let audioCtx;
let analyser;
let source;
let dataArray = new Float32Array(BIN_COUNT);
let logIndices = [];
let smoothedBins = new Float32Array(BINS);
let useRealAudio = false;

let time = 0;
let frame = 0;
let bassEnergy = 0;
let midEnergy = 0;
let highEnergy = 0;
let lastBass = 0;
let beatPulse = 0;
let masterPulse = 0;

let paintCanvas;
let paintCtx;
let videoCanvas;
let videoCtx;
let videoEl;
let videoReady = false;
let videoInfluence = 0;
let videoMotion = 0;
let lastVideoSamples = [];
let videoSamples = [];

let ribbons = [];
let blooms = [];
let droplets = [];
let foam = [];

const DPR_MAX = 1.6;
const RIBBON_COUNT = 36;
const BLOOM_COUNT = 18;
const FOAM_COUNT = 260;

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

function hexToRgb(hex) {
    if (hex.startsWith('hsl')) {
        const nums = hex.match(/[\d.]+/g)?.map(Number) || [0, 0, 0];
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
        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    }

    const h = hex.replace('#', '');
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
    };
}

function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

function smoothNoise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const fade = t => t * t * (3 - 2 * t);
    const hash = (a, b) => {
        const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
        return s - Math.floor(s);
    };
    const aa = hash(xi, yi);
    const ba = hash(xi + 1, yi);
    const ab = hash(xi, yi + 1);
    const bb = hash(xi + 1, yi + 1);
    const u = fade(xf);
    const v = fade(yf);
    return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
}

function fbm(x, y) {
    let value = 0;
    let amp = 0.52;
    let freq = 1;
    for (let i = 0; i < 4; i++) {
        value += smoothNoise(x * freq, y * freq) * amp;
        freq *= 2.08;
        amp *= 0.5;
    }
    return value;
}

function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const w = Math.max(1, Math.floor(window.innerWidth * dpr));
    const h = Math.max(1, Math.floor(window.innerHeight * dpr));
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    paintCanvas = document.createElement('canvas');
    paintCanvas.width = w;
    paintCanvas.height = h;
    paintCtx = paintCanvas.getContext('2d', { alpha: false });

    videoCanvas = document.createElement('canvas');
    videoCanvas.width = 42;
    videoCanvas.height = 24;
    videoCtx = videoCanvas.getContext('2d', { willReadFrequently: true });

    resetSurface(true);
    initWorld();
}

function resetSurface(full = false) {
    if (!paintCtx) return;
    const W = paintCanvas.width;
    const H = paintCanvas.height;
    const grad = paintCtx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    grad.addColorStop(0, rgba(pal.paper, 0.98));
    grad.addColorStop(0.55, rgba(pal.bg, 0.9));
    grad.addColorStop(1, rgba(pal.bg, 1));
    paintCtx.globalCompositeOperation = 'source-over';
    paintCtx.globalAlpha = full ? 1 : 0.16;
    paintCtx.fillStyle = grad;
    paintCtx.fillRect(0, 0, W, H);
    paintCtx.globalAlpha = 1;
}

function initWorld() {
    const W = canvas.width;
    const H = canvas.height;
    const diagonal = Math.hypot(W, H);

    ribbons = Array.from({ length: RIBBON_COUNT }, (_, i) => ({
        offset: rand(-diagonal * 0.65, diagonal * 0.65),
        width: rand(8, 38) * (window.devicePixelRatio || 1),
        color: pick(pal.colors),
        secondary: pick(pal.colors),
        alpha: rand(0.08, 0.28),
        speed: rand(0.0015, 0.008),
        phase: rand(0, Math.PI * 2),
        audioBin: Math.floor((i / RIBBON_COUNT) * (BINS - 1)),
        bend: rand(0.7, 1.9),
        lane: i / Math.max(1, RIBBON_COUNT - 1)
    }));

    blooms = Array.from({ length: BLOOM_COUNT }, () => createBloom(W, H));
    foam = Array.from({ length: FOAM_COUNT }, () => createFoam(W, H));
    droplets = [];
}

function createBloom(W, H) {
    return {
        x: rand(-W * 0.08, W * 1.08),
        y: rand(-H * 0.08, H * 1.08),
        vx: rand(-0.16, 0.16),
        vy: rand(-0.12, 0.12),
        r: rand(Math.min(W, H) * 0.035, Math.min(W, H) * 0.16),
        color: pick(pal.colors),
        core: pick(pal.accents),
        phase: rand(0, Math.PI * 2),
        spin: rand(-0.008, 0.008),
        audioBin: Math.floor(rand(0, BINS)),
        petals: Math.floor(rand(5, 12)),
        alpha: rand(0.08, 0.24)
    };
}

function createFoam(W, H) {
    return {
        x: rand(0, W),
        y: rand(0, H),
        vx: rand(-0.25, 0.25),
        vy: rand(-0.25, 0.25),
        r: rand(0.8, 4.8) * (window.devicePixelRatio || 1),
        color: Math.random() > 0.82 ? pick(pal.accents) : pal.paper,
        audioBin: Math.floor(rand(0, BINS)),
        phase: rand(0, Math.PI * 2),
        alpha: rand(0.08, 0.34)
    };
}

function setupLogBins(isSimulated = false) {
    logIndices = [];
    const nyquist = (isSimulated ? 44100 : audioCtx.sampleRate) / 2;
    const minLog = Math.log10(24);
    const maxLog = Math.log10(16500);
    for (let i = 0; i < BINS; i++) {
        const t = i / Math.max(1, BINS - 1);
        const target = Math.pow(10, minLog + t * (maxLog - minLog));
        logIndices.push(clamp(Math.floor((target / nyquist) * BIN_COUNT), 0, BIN_COUNT - 1));
    }
}

function updateSimulatedFrequencies() {
    for (let i = 0; i < BIN_COUNT; i++) dataArray[i] = MIN_DB + Math.random() * 4;
    const kick = Math.max(0, Math.sin(time * 3.4)) ** 14;
    const swell = 0.5 + 0.5 * Math.sin(time * 0.9);
    const shimmer = 0.5 + 0.5 * Math.sin(time * 7.2);
    for (let i = 1; i < BIN_COUNT * 0.06; i++) dataArray[i] = lerp(dataArray[i], MAX_DB, kick * 0.82 + 0.04);
    for (let i = BIN_COUNT * 0.06; i < BIN_COUNT * 0.34; i++) dataArray[i] = lerp(dataArray[i], MAX_DB, swell * 0.34);
    for (let i = BIN_COUNT * 0.34; i < BIN_COUNT * 0.78; i++) dataArray[i] = lerp(dataArray[i], MAX_DB, shimmer * 0.16);
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) {
        sum += clamp((data[i] - MIN_DB) / (MAX_DB - MIN_DB), 0, 1);
    }
    return sum / Math.max(1, to - from);
}

function updateVideoField() {
    if (!videoReady || !videoEl || frame % 3 !== 0) return;
    try {
        videoCtx.drawImage(videoEl, 0, 0, videoCanvas.width, videoCanvas.height);
        const pixels = videoCtx.getImageData(0, 0, videoCanvas.width, videoCanvas.height).data;
        const next = [];
        let luma = 0;
        let motion = 0;
        for (let y = 0; y < videoCanvas.height; y++) {
            for (let x = 0; x < videoCanvas.width; x++) {
                const i = (y * videoCanvas.width + x) * 4;
                const v = (pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722) / 255;
                const previous = lastVideoSamples[next.length] ?? v;
                next.push(v);
                luma += v;
                motion += Math.abs(v - previous);
            }
        }
        videoSamples = next;
        lastVideoSamples = next;
        const total = videoCanvas.width * videoCanvas.height;
        videoInfluence = videoInfluence * 0.82 + (luma / total) * 0.18;
        videoMotion = videoMotion * 0.78 + (motion / total) * 0.22;
    } catch (err) {
        videoReady = false;
    }
}

function sampleVideo(x, y) {
    if (!videoSamples.length) return 0;
    const ix = clamp(Math.floor((x / canvas.width) * videoCanvas.width), 0, videoCanvas.width - 1);
    const iy = clamp(Math.floor((y / canvas.height) * videoCanvas.height), 0, videoCanvas.height - 1);
    return videoSamples[iy * videoCanvas.width + ix] || 0;
}

function addBeatInk(W, H, energy) {
    const count = Math.floor(2 + energy * 12);
    for (let i = 0; i < count; i++) {
        const fromVideo = videoSamples.length && Math.random() < 0.58;
        const x = fromVideo ? rand(0.12, 0.88) * W : rand(0, W);
        const y = fromVideo ? rand(0.12, 0.88) * H : rand(0, H);
        droplets.push({
            x,
            y,
            r: rand(10, 86) * (0.55 + energy * 1.2) * (window.devicePixelRatio || 1),
            color: Math.random() > 0.35 ? pick(pal.colors) : pick(pal.accents),
            life: 1,
            alpha: rand(0.1, 0.42),
            phase: rand(0, Math.PI * 2),
            audioBin: Math.floor(rand(0, BINS))
        });
    }
    while (droplets.length > 90) droplets.shift();
}

function drawMarbleRibbon(ribbon, W, H, intensity, react, spin) {
    const c = paintCtx;
    const amp = parseFloat(ctrlNoise.value) * (window.devicePixelRatio || 1);
    const audio = smoothedBins[ribbon.audioBin] || 0;
    const diagonal = Math.hypot(W, H);
    const angle = -0.34 + spin * 0.22 + Math.sin(time * 0.09 + ribbon.phase) * 0.18;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const tx = -ny;
    const ty = nx;
    const centerOffset = ribbon.offset + Math.sin(time * ribbon.speed + ribbon.phase) * diagonal * 0.12;
    const lineWidth = ribbon.width * parseFloat(ctrlThickness.value) * (1 + audio * react * 2.5 + beatPulse * 0.45);
    const passes = audio > 0.35 ? 3 : 2;

    for (let pass = 0; pass < passes; pass++) {
        c.save();
        c.globalCompositeOperation = pass === 0 ? 'source-over' : 'screen';
        c.globalAlpha = ribbon.alpha * intensity * (pass === 0 ? 1 : 0.38);
        c.lineWidth = lineWidth * (1 + pass * 0.65);
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.strokeStyle = pass === 0 ? ribbon.color : ribbon.secondary;
        c.beginPath();
        for (let i = 0; i <= 190; i++) {
            const u = i / 190;
            const base = (u - 0.5) * diagonal * 1.5;
            const cx = W * 0.5 + tx * base + nx * centerOffset;
            const cy = H * 0.5 + ty * base + ny * centerOffset;
            const v = sampleVideo(cx, cy);
            const curl = (fbm(
                cx * 0.0016 + time * (0.07 + audio * 0.06) + ribbon.phase,
                cy * 0.0016 - time * 0.045
            ) - 0.5) * amp * ribbon.bend * 8;
            const fine = Math.sin(u * Math.PI * 18 + ribbon.phase + time * (0.8 + audio)) * amp * 0.6;
            const spectral = Math.sin((ribbon.lane * BINS + time * 8) * 0.12) * audio * amp * react * 4;
            const videoWarp = (v - videoInfluence) * amp * (12 + videoMotion * 120);
            const x = cx + nx * (curl + fine + spectral + videoWarp + pass * lineWidth * 0.18);
            const y = cy + ny * (curl + fine + spectral + videoWarp + pass * lineWidth * 0.18);
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.stroke();
        c.restore();
    }
}

function drawBloom(bloom, W, H, intensity, react) {
    const c = paintCtx;
    const audio = smoothedBins[bloom.audioBin] || 0;
    const video = sampleVideo(bloom.x, bloom.y);
    const radius = bloom.r * (1 + audio * react * 2.2 + videoMotion * 1.7);
    const points = 92;
    const hole = parseFloat(ctrlHole.value);

    bloom.phase += bloom.spin + 0.002 + audio * 0.01;
    bloom.x += bloom.vx * (1 + bassEnergy * 5) + (video - videoInfluence) * 0.9;
    bloom.y += bloom.vy * (1 + midEnergy * 4) + Math.sin(time + bloom.phase) * 0.08;
    if (bloom.x < -radius) bloom.x = W + radius;
    if (bloom.x > W + radius) bloom.x = -radius;
    if (bloom.y < -radius) bloom.y = H + radius;
    if (bloom.y > H + radius) bloom.y = -radius;

    const g = c.createRadialGradient(bloom.x, bloom.y, radius * hole, bloom.x, bloom.y, radius);
    g.addColorStop(0, rgba(bloom.core, bloom.alpha * 0.35 * intensity));
    g.addColorStop(0.42, rgba(bloom.color, bloom.alpha * (0.8 + audio) * intensity));
    g.addColorStop(1, rgba(bloom.color, 0));

    c.save();
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const n = fbm(Math.cos(a) * 2.1 + bloom.phase, Math.sin(a) * 2.1 - time * 0.2);
        const petal = Math.sin(a * bloom.petals + bloom.phase) * 0.14;
        const r = radius * (0.76 + n * 0.42 + petal + audio * 0.18);
        const x = bloom.x + Math.cos(a) * r;
        const y = bloom.y + Math.sin(a) * r;
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.closePath();
    c.fill();

    c.globalCompositeOperation = 'screen';
    c.strokeStyle = rgba(pal.paper, 0.08 + audio * 0.12);
    c.lineWidth = Math.max(1, radius * 0.018);
    c.stroke();
    c.restore();
}

function drawDroplets(W, H, intensity, react) {
    const c = paintCtx;
    for (let i = droplets.length - 1; i >= 0; i--) {
        const d = droplets[i];
        const audio = smoothedBins[d.audioBin] || 0;
        const r = d.r * (1 + (1 - d.life) * 1.8 + audio * react);
        const alpha = d.alpha * d.life * intensity;
        const g = c.createRadialGradient(d.x, d.y, r * 0.1, d.x, d.y, r);
        g.addColorStop(0, rgba(pal.paper, alpha * 0.45));
        g.addColorStop(0.18, rgba(d.color, alpha));
        g.addColorStop(0.68, rgba(d.color, alpha * 0.45));
        g.addColorStop(1, rgba(d.color, 0));

        c.save();
        c.globalCompositeOperation = 'screen';
        c.fillStyle = g;
        c.beginPath();
        c.arc(d.x, d.y, r, 0, Math.PI * 2);
        c.fill();
        c.restore();

        d.life -= 0.008 + audio * 0.008;
        if (d.life <= 0) droplets.splice(i, 1);
    }
}

function drawFoam(W, H, intensity, react) {
    const c = paintCtx;
    c.save();
    c.globalCompositeOperation = 'screen';
    for (const f of foam) {
        const audio = smoothedBins[f.audioBin] || 0;
        const n = fbm(f.x * 0.003 + time * 0.12, f.y * 0.003 - time * 0.08);
        const angle = n * Math.PI * 4 + time * 0.15;
        const video = sampleVideo(f.x, f.y);
        f.x += Math.cos(angle) * (0.25 + audio * react * 2.4) + f.vx + (video - 0.5) * videoMotion * 8;
        f.y += Math.sin(angle) * (0.25 + highEnergy * 2.2) + f.vy;
        if (f.x < 0) f.x = W;
        if (f.x > W) f.x = 0;
        if (f.y < 0) f.y = H;
        if (f.y > H) f.y = 0;

        const r = f.r * (1 + audio * 2.8 + beatPulse * 0.8);
        c.globalAlpha = f.alpha * intensity * (0.35 + audio * 1.2);
        c.strokeStyle = f.color;
        c.lineWidth = Math.max(0.6, r * 0.18);
        c.beginPath();
        c.ellipse(f.x, f.y, r * (1 + video * 1.4), r * 0.62, angle, 0, Math.PI * 2);
        c.stroke();
        if (audio > 0.42 || Math.random() < 0.002) {
            c.fillStyle = rgba(f.color, 0.15);
            c.fill();
        }
    }
    c.restore();
}

function drawSpectralVeins(W, H, intensity, react) {
    const c = paintCtx;
    const count = Math.floor(parseFloat(ctrlRings.value));
    c.save();
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < count; i++) {
        const bin = Math.floor((i / Math.max(1, count - 1)) * (BINS - 1));
        const audio = smoothedBins[bin] || 0;
        if (audio < 0.025 && i % 3 !== 0) continue;
        const yBase = (i / count) * H;
        const color = i % 5 === 0 ? pick(pal.accents) : pal.colors[i % pal.colors.length];
        c.strokeStyle = rgba(color, (0.012 + audio * 0.18) * intensity);
        c.lineWidth = 0.6 + audio * react * 8;
        c.beginPath();
        for (let x = -W * 0.06; x <= W * 1.06; x += Math.max(8, W / 150)) {
            const n = fbm(x * 0.002 + time * 0.18, yBase * 0.002 + i * 0.07);
            const video = sampleVideo(x, yBase);
            const y = yBase + (n - 0.5) * H * 0.12 + Math.sin(x * 0.008 + time + i) * audio * H * 0.07 + (video - videoInfluence) * videoMotion * H * 0.32;
            x <= -W * 0.05 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.stroke();
    }
    c.restore();
}

function compositeToScreen(W, H) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(paintCanvas, 0, 0);

    const shift = beatPulse * 10 + videoMotion * 18;
    if (shift > 0.15) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.08 + beatPulse * 0.12;
        ctx.drawImage(paintCanvas, shift, -shift * 0.25, W, H);
        ctx.globalAlpha = 0.06 + highEnergy * 0.1;
        ctx.drawImage(paintCanvas, -shift * 0.55, shift * 0.2, W, H);
        ctx.restore();
    }

    const veil = ctx.createLinearGradient(0, 0, W, H);
    veil.addColorStop(0, rgba(pal.paper, 0.08 + videoInfluence * 0.04));
    veil.addColorStop(0.48, 'rgba(255,255,255,0)');
    veil.addColorStop(1, rgba(pal.bg, 0.3));
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);

    const vignette = ctx.createRadialGradient(W * 0.5, H * 0.48, Math.min(W, H) * 0.22, W * 0.5, H * 0.5, Math.max(W, H) * 0.74);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.46)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
}

function renderLoop() {
    requestAnimationFrame(renderLoop);
    if (!paintCtx) return;

    time += 0.01;
    frame += 1;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for (let i = 0; i < dataArray.length; i++) {
            if (!Number.isFinite(dataArray[i])) dataArray[i] = MIN_DB;
        }
    } else {
        updateSimulatedFrequencies();
    }

    for (let i = 0; i < BINS; i++) {
        const idx = logIndices[i] || 0;
        const raw = clamp((dataArray[idx] - MIN_DB) / (MAX_DB - MIN_DB), 0, 1);
        smoothedBins[i] = smoothedBins[i] * 0.78 + raw * 0.22;
    }

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT * 0.055));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.055), Math.floor(BIN_COUNT * 0.32));
    const eH = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.32), Math.floor(BIN_COUNT * 0.78));

    bassEnergy = bassEnergy * 0.86 + eB * 0.14;
    midEnergy = midEnergy * 0.86 + eM * 0.14;
    highEnergy = highEnergy * 0.86 + eH * 0.14;
    beatPulse = Math.max(0, beatPulse - 0.035);
    masterPulse = masterPulse * 0.9 + (bassEnergy + midEnergy * 0.55 + highEnergy * 0.25) * 0.1;

    updateVideoField();

    const W = canvas.width;
    const H = canvas.height;
    const intensity = parseFloat(ctrlIntensity.value);
    const react = parseFloat(ctrlReact.value);
    const spin = parseFloat(ctrlSpin.value);

    const isBeat = eB - lastBass > 0.026 && eB > 0.075;
    if (isBeat) {
        beatPulse = 1;
        addBeatInk(W, H, eB);
        if (eB > 0.22 && Math.random() < 0.5) blooms[Math.floor(rand(0, blooms.length))] = createBloom(W, H);
    }
    lastBass = eB;

    paintCtx.globalCompositeOperation = 'source-over';
    paintCtx.globalAlpha = 0.032 + bassEnergy * 0.025;
    paintCtx.fillStyle = pal.bg;
    paintCtx.fillRect(0, 0, W, H);
    paintCtx.globalAlpha = 1;

    for (const ribbon of ribbons) drawMarbleRibbon(ribbon, W, H, intensity, react, spin);
    drawSpectralVeins(W, H, intensity, react);
    for (const bloom of blooms) drawBloom(bloom, W, H, intensity, react);
    drawDroplets(W, H, intensity, react);
    drawFoam(W, H, intensity, react);
    compositeToScreen(W, H);
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
            resetSurface(true);
            initWorld();
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

window.addEventListener('resize', resizeCanvas);
renderPaletteButtons();
resizeCanvas();
