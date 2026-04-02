// ============================================================
// N3 — LIVING AUDIOVISUAL ORGANISM v6
// ============================================================

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const controlsPanel = document.getElementById('controlsPanel');

// Controls
const ctrlSensitivity  = document.getElementById('ctrlSensitivity');
const ctrlBounce       = document.getElementById('ctrlBounce');
const ctrlChaos        = document.getElementById('ctrlChaos');
const ctrlChomp        = document.getElementById('ctrlChomp');
const ctrlQuake        = document.getElementById('ctrlQuake');
const ctrlPalette      = document.getElementById('ctrlPalette');
const ctrlBgShape      = document.getElementById('ctrlBgShape');
const ctrlFlashShape   = document.getElementById('ctrlFlashShape');
const ctrlCoreShape    = document.getElementById('ctrlCoreShape');
const ctrlMirror       = document.getElementById('ctrlMirror');
const ctrlAfterimage   = document.getElementById('ctrlAfterimage');
const ctrlRotSpeed     = document.getElementById('ctrlRotSpeed');
const ctrlStrobe       = document.getElementById('ctrlStrobe');

let audioCtx, analyser, source;
let useRealAudio = false;

const BIN_COUNT = 2048;
const BINS = 64;
const MIN_DB = -80;
const MAX_DB = -5;

let logIndices = [];
let dataArray;
let time = 0;
let frameCounter = 0;

let energy = 0, bassEnergy = 0, midEnergy = 0, highEnergy = 0;
let beatTimer = 0;
let lastBass = 0;
let currentScale = 1.0;
let currentBeatRot = 0;
let targetBeatRot = 0;

// ============================================================
// COLOR PALETTES
// ============================================================
const PALETTES = {
    mashle: {
        strobe: ['#F2CC0F', '#0A0A0A', '#F08A2E'],
        core: '#F08A2E', cream: '#F8E868',
        highlight: '#FFFFFF', ink: '#0A0A0A',
        textFaded: 'rgba(240,138,46,0.6)'
    },
    phonk: {
        strobe: ['#1A0033', '#050010', '#6600FF'],
        core: '#6600FF', cream: '#CC00FF',
        highlight: '#FFFFFF', ink: '#000000',
        textFaded: 'rgba(102,0,255,0.6)'
    },
    synthwave: {
        strobe: ['#2B00FF', '#090033', '#FF007F'],
        core: '#FF007F', cream: '#00F0FF',
        highlight: '#FFFFFF', ink: '#090033',
        textFaded: 'rgba(255,0,127,0.6)'
    },
    metal: {
        strobe: ['#590000', '#050000', '#1A0000'],
        core: '#8C0000', cream: '#FF1A1A',
        highlight: '#B3B3B3', ink: '#000000',
        textFaded: 'rgba(140,0,0,0.6)'
    },
    lofi: {
        strobe: ['#F4E8D6', '#E2D1C3', '#8DAA9D'],
        core: '#8DAA9D', cream: '#E9D6EC',
        highlight: '#FFFFFF', ink: '#2C363F',
        textFaded: 'rgba(141,170,157,0.6)'
    },
    jungle: {
        strobe: ['#0D2B00', '#1A4D00', '#39FF14'],
        core: '#39FF14', cream: '#CCFF00',
        highlight: '#FFFFFF', ink: '#0D2B00',
        textFaded: 'rgba(57,255,20,0.5)'
    },
    vapor: {
        strobe: ['#FFB3DE', '#C9B8FF', '#87CEEB'],
        core: '#FF6EFF', cream: '#FFFFFF',
        highlight: '#FFFFFF', ink: '#4B0082',
        textFaded: 'rgba(255,110,255,0.5)'
    },
    rave: {
        strobe: ['#FF0000', '#00FF00', '#0000FF'],
        core: '#FF00FF', cream: '#FFFF00',
        highlight: '#FFFFFF', ink: '#000000',
        textFaded: 'rgba(255,0,255,0.7)'
    }
};

let activePalette = PALETTES.mashle;
let bgIndex = 0;
let currentBgColor = activePalette.strobe[0];

if (ctrlPalette) {
    ctrlPalette.addEventListener('change', (e) => {
        activePalette = PALETTES[e.target.value];
        currentBgColor = activePalette.strobe[0];
        bgIndex = 0;
    });
}

// ============================================================
// CORE DATA
// ============================================================
let targetRadii = new Array(BINS).fill(100);
let snappedRadii = new Array(BINS).fill(100);
let bgElements = [];
let impactGraphics = [];

const GOTHIC_CHARS = ['M','A','S','H','L','E','神','覚','者','魔','王','破','滅'];

function buildBgElements() {
    bgElements = [];
    const shapeType = ctrlBgShape ? ctrlBgShape.value : 'mixed';
    for (let i = 0; i < 30; i++) {
        let type;
        if (shapeType === 'mixed') {
            const r = Math.random();
            type = r < 0.4 ? 'crescent' : r < 0.6 ? 'triangle' : r < 0.75 ? 'cross' : 'text';
        } else {
            type = shapeType;
        }
        bgElements.push({
            type,
            char: GOTHIC_CHARS[Math.floor(Math.random() * GOTHIC_CHARS.length)],
            x: (Math.random() - 0.5) * 3000,
            y: (Math.random() - 0.5) * 3000,
            size: 200 + Math.random() * 800,
            angle: Math.random() * Math.PI * 2,
            speed: (Math.random() - 0.5) * 0.01,
            parallax: 0.2 + Math.random() * 0.8
        });
    }
}
buildBgElements();

if (ctrlBgShape) ctrlBgShape.addEventListener('change', buildBgElements);

// ============================================================
// IMPACT GRAPHICS
// ============================================================
class ImpactGraphic {
    constructor(cx, cy, bassIntensity) {
        this.x = cx + (Math.random() - 0.5) * canvas.width * 0.8;
        this.y = cy + (Math.random() - 0.5) * canvas.height * 0.8;
        this.size = 150 + Math.random() * 600 * bassIntensity;
        this.angle = Math.random() * Math.PI * 2;
        this.char = GOTHIC_CHARS[Math.floor(Math.random() * GOTHIC_CHARS.length)];
        this.framesLeft = 3 + Math.floor(Math.random() * 4);
        this.flashShape = ctrlFlashShape ? ctrlFlashShape.value : 'mixed';
        this.bass = bassIntensity;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.random() * 0.1);
        const col = bgIndex === 1 ? activePalette.strobe[0] : activePalette.ink;
        ctx.fillStyle = col;
        ctx.strokeStyle = col;

        const shape = this.flashShape === 'mixed'
            ? ['slash','ring','text','burst'][Math.floor(Math.random() * 4)]
            : this.flashShape;

        if (shape === 'slash') {
            // Claw slash lines
            ctx.lineWidth = this.size * 0.06;
            ctx.lineCap = 'round';
            const slashes = 3 + Math.floor(this.bass * 3);
            for (let s = 0; s < slashes; s++) {
                const ox = (s - slashes/2) * this.size * 0.15;
                ctx.beginPath();
                ctx.moveTo(ox - this.size * 0.3, -this.size * 0.5);
                ctx.lineTo(ox + this.size * 0.3,  this.size * 0.5);
                ctx.stroke();
            }
        } else if (shape === 'ring') {
            // Concentric rings
            const rings = 2 + Math.floor(this.bass * 4);
            for (let r = rings; r > 0; r--) {
                ctx.beginPath();
                ctx.arc(0, 0, (this.size / rings) * r, 0, Math.PI * 2);
                ctx.lineWidth = this.size * 0.03;
                ctx.stroke();
            }
        } else if (shape === 'burst') {
            // Star burst
            const spikes = 6 + Math.floor(this.bass * 6);
            ctx.beginPath();
            for (let s = 0; s < spikes * 2; s++) {
                const a = (s / (spikes * 2)) * Math.PI * 2;
                const r = s % 2 === 0 ? this.size * 0.5 : this.size * 0.2;
                s === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r)
                        : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            // Gothic text
            ctx.font = `${this.size}px "Pirata One", serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.char, (Math.random()*20-10), (Math.random()*20-10));
        }
        ctx.restore();
    }
}

// ============================================================
// SETUP
// ============================================================
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

startBtn.addEventListener('click', async () => {
    overlay.style.display = 'none';
    if (controlsPanel) controlsPanel.classList.remove('hidden');
    resizeCanvas();
    dataArray = new Float32Array(BIN_COUNT);

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: { noiseSuppression: false, echoCancellation: false },
            video: true
        });
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
    const freqs = Array.from({length: BIN_COUNT}, (_, i) => i * nyquist / BIN_COUNT);
    const minLog = Math.log10(60);
    const maxLog = Math.log10(8000);
    for (let i = 0; i < BINS; i++) {
        const targetFreq = Math.pow(10, minLog + (i / BINS) * (maxLog - minLog));
        const idx = freqs.findIndex(f => f >= targetFreq);
        logIndices.push(idx === -1 ? freqs.length - 1 : idx);
    }
}

function updateSimulatedFrequencies() {
    for (let i = 0; i < BIN_COUNT; i++) dataArray[i] = -100 + Math.random() * 5;
    const addPeak = (freq, w, amp) => {
        const c = (freq / (44100 / 2)) * BIN_COUNT;
        for (let i = Math.max(0, Math.floor(c - w*3)); i < Math.min(BIN_COUNT, Math.ceil(c + w*3)); i++) {
            const bump = amp * Math.exp(-(Math.abs(i - c) ** 2) / (w * w));
            if (-100 + bump > dataArray[i]) dataArray[i] = -100 + bump;
        }
    };
    const t = time * 0.4;
    const beatSim = Math.sin(t * 8) > 0.8 ? 60 : 0;
    addPeak(80,  2,  70 + beatSim);
    addPeak(400, 5,  75 + Math.sin(t * 2) * 20);
    addPeak(2000,10, 65 + beatSim * 0.5);
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += Math.max(0, (data[i] - MIN_DB) / (MAX_DB - MIN_DB));
    return sum / (to - from);
}

function lerp(a, b, t) { return a + (b - a) * t; }

// ============================================================
// RENDER LOOP
// ============================================================
function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.03;
    frameCounter++;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for (let i = 0; i < dataArray.length; i++) if (!isFinite(dataArray[i])) dataArray[i] = MIN_DB;
    } else {
        updateSimulatedFrequencies();
    }

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT * 0.05));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.05), Math.floor(BIN_COUNT * 0.3));

    const sensVal = ctrlSensitivity ? parseFloat(ctrlSensitivity.value) : 0.6;
    const spawnThreshold = lerp(0.3, 0.03, sensVal);
    const deltaThreshold = lerp(0.15, 0.02, sensVal);

    if (eB - lastBass > deltaThreshold && eB > spawnThreshold) {
        beatTimer = 1.0;
        const bounceVal = ctrlBounce ? parseFloat(ctrlBounce.value) : 1.0;
        currentScale = 1.0 + (eB * 0.5 * bounceVal);
        targetBeatRot += (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 6);

        const strobeVal = ctrlStrobe ? parseFloat(ctrlStrobe.value) : 1.0;
        if (strobeVal > 0.05) {
            bgIndex = (bgIndex + 1) % activePalette.strobe.length;
            currentBgColor = activePalette.strobe[bgIndex];
        }

        if (Math.random() < 0.8) {
            impactGraphics.push(new ImpactGraphic(canvas.width/2, canvas.height/2, eB));
        }
    }
    lastBass = eB;
    beatTimer *= 0.8;

    currentScale += (1.0 - currentScale) * 0.25;
    currentBeatRot += (targetBeatRot - currentBeatRot) * 0.2;
    bassEnergy += (eB - bassEnergy) * 0.4;
    midEnergy  += (eM - midEnergy)  * 0.3;

    // Afterimage trail
    const afterVal = ctrlAfterimage ? parseFloat(ctrlAfterimage.value) : 0.0;
    if (afterVal > 0) {
        ctx.fillStyle = `rgba(0,0,0,${lerp(1.0, 0.05, afterVal)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        renderBackground();
    }

    if (afterVal === 0) {
        ctx.save();
        const quakeVal = ctrlQuake ? parseFloat(ctrlQuake.value) : 1.5;
        if (beatTimer > 0.1 && quakeVal > 0) {
            const shakeMag = beatTimer * 40 * quakeVal;
            ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
        }
        renderErraticCore();
        renderImpacts();
        ctx.restore();
    } else {
        renderBackground();
        ctx.save();
        const quakeVal = ctrlQuake ? parseFloat(ctrlQuake.value) : 1.5;
        if (beatTimer > 0.1 && quakeVal > 0) {
            const shakeMag = beatTimer * 40 * quakeVal;
            ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
        }
        renderErraticCore();
        renderImpacts();
        ctx.restore();
    }
}

// ============================================================
// BACKGROUND
// ============================================================
function renderBackground() {
    ctx.fillStyle = currentBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    const rotSpeed = ctrlRotSpeed ? parseFloat(ctrlRotSpeed.value) : 0.5;
    ctx.rotate(time * 0.005 * rotSpeed);

    for (let el of bgElements) {
        const dynamicSpeed = el.speed + (el.speed * beatTimer * 10);
        el.angle += dynamicSpeed;

        ctx.save();
        const driftX = Math.cos(el.angle) * el.parallax * (200 + midEnergy * 1000);
        const driftY = Math.sin(el.angle) * el.parallax * (200 + midEnergy * 1000);
        ctx.translate(el.x + driftX, el.y + driftY);
        const elementScale = 1.0 + (beatTimer * 0.3 * el.parallax);
        ctx.scale(elementScale, elementScale);
        ctx.rotate(el.angle);

        const contrastCol = bgIndex === 2 ? 'rgba(0,0,0,0.4)' : activePalette.textFaded;

        if (el.type === 'text') {
            ctx.font = `${el.size}px "Pirata One", serif`;
            ctx.fillStyle = contrastCol;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(el.char, 0, 0);
        } else if (el.type === 'crescent') {
            ctx.beginPath();
            ctx.arc(0, 0, el.size/2, 0, Math.PI*2);
            ctx.fillStyle = bgIndex === 1 ? activePalette.highlight : activePalette.ink;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(el.size * 0.15, 0, el.size * 0.55, 0, Math.PI*2);
            ctx.fillStyle = currentBgColor;
            ctx.fill();
        } else if (el.type === 'triangle') {
            const s = el.size * 0.55;
            ctx.beginPath();
            ctx.moveTo(0, -s);
            ctx.lineTo(s * 0.866, s * 0.5);
            ctx.lineTo(-s * 0.866, s * 0.5);
            ctx.closePath();
            ctx.fillStyle = bgIndex === 1 ? activePalette.highlight : activePalette.ink;
            ctx.fill();
            // Inner cutout for depth
            ctx.beginPath();
            const si = s * 0.45;
            ctx.moveTo(0, -si);
            ctx.lineTo(si * 0.866, si * 0.5);
            ctx.lineTo(-si * 0.866, si * 0.5);
            ctx.closePath();
            ctx.fillStyle = currentBgColor;
            ctx.fill();
        } else if (el.type === 'cross') {
            const arm = el.size * 0.18;
            const len = el.size * 0.5;
            ctx.fillStyle = bgIndex === 1 ? activePalette.highlight : activePalette.ink;
            ctx.fillRect(-arm, -len, arm*2, len*2);
            ctx.fillRect(-len, -arm, len*2, arm*2);
        }
        ctx.restore();
    }
    ctx.restore();
}

// ============================================================
// ERRATIC CORE
// ============================================================
function renderErraticCore() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseRadius = Math.min(canvas.width, canvas.height) * 0.15;
    const maxSpike   = Math.min(canvas.width, canvas.height) * 0.5;
    const chaosVal   = ctrlChaos ? parseFloat(ctrlChaos.value) : 0.6;
    const coreShape  = ctrlCoreShape ? ctrlCoreShape.value : 'jagged';
    const rotSpeed   = ctrlRotSpeed ? parseFloat(ctrlRotSpeed.value) : 0.5;
    const mirrorMode = ctrlMirror ? ctrlMirror.value : 'none';

    for (let i = 0; i < BINS; i++) {
        let rawDb = dataArray[logIndices[i]];
        if (!isFinite(rawDb)) rawDb = MIN_DB;
        rawDb = Math.max(MIN_DB, Math.min(MAX_DB, rawDb));
        const normalized = Math.pow((rawDb - MIN_DB) / (MAX_DB - MIN_DB), 2);
        targetRadii[i] = baseRadius + (normalized * maxSpike * (1 + bassEnergy));
        snappedRadii[i] += (targetRadii[i] - snappedRadii[i]) * 0.5;
    }

    // Build path based on coreShape
    const buildPath = (scale = 1, yOffset = 0) => {
        ctx.beginPath();

        if (coreShape === 'jagged') {
            for (let i = 0; i < BINS; i++) {
                const angle = (i / BINS) * Math.PI * 2;
                const jitter = (Math.random() - 0.5) * beatTimer * (0.3 * chaosVal);
                let r = snappedRadii[i] * scale * (1 + jitter);
                if (i % 2 !== 0) r *= lerp(1.0, 0.4, chaosVal);
                const x = Math.cos(angle + jitter) * r;
                const y = Math.sin(angle + jitter) * r + yOffset;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
        } else if (coreShape === 'blob') {
            // Smooth blob using quadratic curves
            for (let i = 0; i < BINS; i++) {
                const angle = (i / BINS) * Math.PI * 2;
                const nextAngle = ((i + 1) / BINS) * Math.PI * 2;
                const r = snappedRadii[i] * scale * (1 + (Math.random()-0.5)*0.05*chaosVal);
                const rn = snappedRadii[(i+1)%BINS] * scale;
                const mx = (Math.cos(angle)*r + Math.cos(nextAngle)*rn) / 2;
                const my = (Math.sin(angle)*r + Math.sin(nextAngle)*rn) / 2;
                if (i === 0) ctx.moveTo(Math.cos(angle)*r, Math.sin(angle)*r + yOffset);
                ctx.quadraticCurveTo(Math.cos(angle)*r, Math.sin(angle)*r + yOffset, mx, my + yOffset);
            }
        } else if (coreShape === 'star') {
            // Clean star — always alternating inner/outer, no jitter
            for (let i = 0; i < BINS; i++) {
                const angle = (i / BINS) * Math.PI * 2;
                const r = i % 2 === 0
                    ? snappedRadii[i] * scale
                    : snappedRadii[i] * scale * 0.45;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r + yOffset;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
        } else if (coreShape === 'mandala') {
            // Petals — radial symmetry, 8-fold
            const petals = 8;
            for (let p = 0; p < petals; p++) {
                const baseAngle = (p / petals) * Math.PI * 2;
                for (let i = 0; i < BINS / petals; i++) {
                    const binIdx = Math.floor((i / (BINS/petals)) * BINS);
                    const a = baseAngle + (i / (BINS/petals)) * (Math.PI*2/petals);
                    const r = snappedRadii[binIdx % BINS] * scale;
                    const x = Math.cos(a) * r, y = Math.sin(a) * r + yOffset;
                    p === 0 && i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
            }
        } else if (coreShape === 'worm') {
            // Bar-style: semicircle arc unwrapped as radial worm
            const segments = BINS;
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const outerR = snappedRadii[i] * scale;
                const innerR = baseRadius * 0.7 * scale;
                const x = Math.cos(angle) * outerR;
                const y = Math.sin(angle) * outerR + yOffset;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            for (let i = BINS - 1; i >= 0; i--) {
                const angle = (i / BINS) * Math.PI * 2;
                const innerR = baseRadius * 0.7 * scale;
                ctx.lineTo(Math.cos(angle)*innerR, Math.sin(angle)*innerR + yOffset);
            }
        }

        ctx.closePath();
    };

    const drawWithOuterStroke = (drawFunc, fillColor) => {
        drawFunc();
        ctx.lineWidth = 14;
        ctx.strokeStyle = activePalette.highlight;
        ctx.stroke();
        ctx.lineWidth = 6;
        ctx.strokeStyle = activePalette.ink;
        ctx.stroke();
        ctx.fillStyle = fillColor;
        ctx.fill();
    };

    const chompVal = ctrlChomp ? parseFloat(ctrlChomp.value) : 150;
    const splitDistance = (bassEnergy * chompVal) + (beatTimer * (chompVal * 0.4));

    // Mirror draw helper
    const drawMirrored = (drawCoreFn) => {
        if (mirrorMode === 'none') {
            drawCoreFn(1, 1);
        } else if (mirrorMode === 'horizontal') {
            drawCoreFn(1, 1);
            ctx.save(); ctx.scale(-1, 1); drawCoreFn(-1, 1); ctx.restore();
        } else if (mirrorMode === 'vertical') {
            drawCoreFn(1, 1);
            ctx.save(); ctx.scale(1, -1); drawCoreFn(1, -1); ctx.restore();
        } else if (mirrorMode === 'quad') {
            drawCoreFn(1, 1);
            ctx.save(); ctx.scale(-1, 1); drawCoreFn(-1, 1); ctx.restore();
            ctx.save(); ctx.scale(1, -1); drawCoreFn(1, -1); ctx.restore();
            ctx.save(); ctx.scale(-1, -1); drawCoreFn(-1, -1); ctx.restore();
        } else if (mirrorMode === 'kaleid') {
            for (let k = 0; k < 6; k++) {
                ctx.save();
                ctx.rotate((k / 6) * Math.PI * 2);
                if (k % 2 === 1) ctx.scale(1, -1);
                drawCoreFn(1, 1);
                ctx.restore();
            }
        }
    };

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(currentScale, currentScale);
    ctx.rotate(currentBeatRot + time * 0.01 * rotSpeed);
    ctx.lineJoin = coreShape === 'blob' ? 'round' : 'miter';
    ctx.miterLimit = 15;

    drawMirrored(() => {
        drawWithOuterStroke(() => buildPath(1.0, splitDistance), activePalette.core);
        buildPath(0.75 + (beatTimer * 0.15), 0);
        ctx.fillStyle = activePalette.cream;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = activePalette.ink;
        ctx.stroke();
        drawWithOuterStroke(() => buildPath(1.0, -splitDistance), activePalette.core);
    });

    ctx.restore();
}

// ============================================================
// IMPACTS
// ============================================================
function renderImpacts() {
    for (let i = impactGraphics.length - 1; i >= 0; i--) {
        let impact = impactGraphics[i];
        impact.draw(ctx);
        impact.framesLeft--;
        if (impact.framesLeft <= 0) impactGraphics.splice(i, 1);
    }
}