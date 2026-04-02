// ============================================================
// N3 — MASHLE "ERRATIC STROBE & DOPAMINE" ORGANISM
// ============================================================

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const controlsPanel = document.getElementById('controlsPanel');

// DOPAMINE CONTROLS
const ctrlSensitivity = document.getElementById('ctrlSensitivity');
const ctrlBounce = document.getElementById('ctrlBounce');
const ctrlChaos = document.getElementById('ctrlChaos');
const ctrlChomp = document.getElementById('ctrlChomp');
const ctrlQuake = document.getElementById('ctrlQuake');
const ctrlPalette = document.getElementById('ctrlPalette'); // NEW CONTROLLER

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
// COLOR PALETTES (GENRE VIBES)
// ============================================================
const PALETTES = {
    mashle: {
        strobe: ['#F2CC0F', '#0A0A0A', '#F08A2E'],
        core: '#F08A2E',
        cream: '#F8E868',
        highlight: '#FFFFFF',
        ink: '#0A0A0A',
        textFaded: 'rgba(240, 138, 46, 0.6)'
    },
    phonk: {
        strobe: ['#1A0033', '#050010', '#6600FF'],
        core: '#6600FF',
        cream: '#CC00FF',
        highlight: '#FFFFFF',
        ink: '#000000',
        textFaded: 'rgba(102, 0, 255, 0.6)'
    },
    synthwave: {
        strobe: ['#2B00FF', '#090033', '#FF007F'],
        core: '#FF007F',
        cream: '#00F0FF',
        highlight: '#FFFFFF',
        ink: '#090033',
        textFaded: 'rgba(255, 0, 127, 0.6)'
    },
    metal: {
        strobe: ['#590000', '#050000', '#1A0000'],
        core: '#8C0000',
        cream: '#FF1A1A',
        highlight: '#B3B3B3',
        ink: '#000000',
        textFaded: 'rgba(140, 0, 0, 0.6)'
    },
    lofi: {
        strobe: ['#F4E8D6', '#E2D1C3', '#8DAA9D'],
        core: '#8DAA9D',
        cream: '#E9D6EC',
        highlight: '#FFFFFF',
        ink: '#2C363F',
        textFaded: 'rgba(141, 170, 157, 0.6)'
    }
};

let activePalette = PALETTES.mashle;
let bgIndex = 0;
let currentBgColor = activePalette.strobe[0];

// Event Listener for Dropdown
if (ctrlPalette) {
    ctrlPalette.addEventListener('change', (e) => {
        activePalette = PALETTES[e.target.value];
        currentBgColor = activePalette.strobe[0];
    });
}

// Core Data
let targetRadii = new Array(BINS).fill(100);
let snappedRadii = new Array(BINS).fill(100);
let bgElements = [];
let impactGraphics = [];
const GOTHIC_CHARS = ['M', 'A', 'S', 'H', 'L', 'E', '神', '覚', '者'];

for (let i = 0; i < 30; i++) {
    bgElements.push({
        type: Math.random() > 0.4 ? 'text' : 'crescent',
        char: GOTHIC_CHARS[Math.floor(Math.random() * GOTHIC_CHARS.length)],
        x: (Math.random() - 0.5) * 3000,
        y: (Math.random() - 0.5) * 3000,
        size: 200 + Math.random() * 800,
        angle: Math.random() * Math.PI * 2,
        speed: (Math.random() - 0.5) * 0.01,
        parallax: 0.2 + Math.random() * 0.8
    });
}

class ImpactGraphic {
    constructor(cx, cy, bassIntensity) {
        this.x = cx + (Math.random() - 0.5) * canvas.width * 0.8;
        this.y = cy + (Math.random() - 0.5) * canvas.height * 0.8;
        this.size = 150 + Math.random() * 600 * bassIntensity; 
        this.angle = Math.random() * Math.PI * 2;
        this.char = GOTHIC_CHARS[Math.floor(Math.random() * GOTHIC_CHARS.length)];
        this.framesLeft = 3 + Math.floor(Math.random() * 4); 
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.font = `${this.size}px "Pirata One", serif`;
        ctx.fillStyle = bgIndex === 1 ? activePalette.strobe[0] : activePalette.ink; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.char, (Math.random() * 20 - 10), (Math.random() * 20 - 10));
        ctx.restore();
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

startBtn.addEventListener('click', async () => {
    overlay.style.display = 'none';
    if(controlsPanel) controlsPanel.classList.remove('hidden');
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
    const beatSim = Math.sin(t * 8) > 0.8 ? 60 : 0; 
    addPeak(80, 2, 70 + beatSim); 
    addPeak(400, 5, 75 + Math.sin(t * 2)*20); 
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += Math.max(0, (data[i] - MIN_DB) / (MAX_DB - MIN_DB));
    return sum / (to - from);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.03;
    frameCounter++;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for(let i=0; i<dataArray.length; i++) if(!isFinite(dataArray[i])) dataArray[i] = MIN_DB;
    } else {
        updateSimulatedFrequencies();
    }

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT*0.05));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT*0.05), Math.floor(BIN_COUNT*0.3));

    const sensVal = ctrlSensitivity ? parseFloat(ctrlSensitivity.value) : 0.6;
    const spawnThreshold = lerp(0.3, 0.03, sensVal); 
    const deltaThreshold = lerp(0.15, 0.02, sensVal);

    if (eB - lastBass > deltaThreshold && eB > spawnThreshold) {
        beatTimer = 1.0; 
        
        const bounceVal = ctrlBounce ? parseFloat(ctrlBounce.value) : 1.0;
        currentScale = 1.0 + (eB * 0.5 * bounceVal); 
        targetBeatRot += (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 6); 

        bgIndex = (bgIndex + 1) % activePalette.strobe.length;
        currentBgColor = activePalette.strobe[bgIndex];

        if (Math.random() < 0.8) {
            impactGraphics.push(new ImpactGraphic(canvas.width/2, canvas.height/2, eB));
        }
    }
    lastBass = eB;
    beatTimer *= 0.8; 

    currentScale += (1.0 - currentScale) * 0.25; 
    currentBeatRot += (targetBeatRot - currentBeatRot) * 0.2; 
    bassEnergy += (eB - bassEnergy) * 0.4; 
    midEnergy += (eM - midEnergy) * 0.3; 

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

function renderBackground() {
    ctx.fillStyle = currentBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(time * 0.005); 

    for (let i = 0; i < bgElements.length; i++) {
        let el = bgElements[i];
        const dynamicSpeed = el.speed + (el.speed * beatTimer * 10);
        el.angle += dynamicSpeed;

        ctx.save();
        const driftX = Math.cos(el.angle) * el.parallax * (200 + midEnergy * 1000); 
        const driftY = Math.sin(el.angle) * el.parallax * (200 + midEnergy * 1000);
        ctx.translate(el.x + driftX, el.y + driftY);
        
        const elementScale = 1.0 + (beatTimer * 0.3 * el.parallax);
        ctx.scale(elementScale, elementScale);
        ctx.rotate(el.angle);

        if (el.type === 'text') {
            ctx.font = `${el.size}px "Pirata One", serif`;
            ctx.fillStyle = bgIndex === 2 ? 'rgba(0,0,0,0.4)' : activePalette.textFaded; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(el.char, 0, 0);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, el.size / 2, 0, Math.PI * 2);
            ctx.fillStyle = bgIndex === 1 ? activePalette.highlight : activePalette.ink;
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(el.size * 0.15, 0, el.size * 0.55, 0, Math.PI * 2);
            ctx.fillStyle = currentBgColor; 
            ctx.fill();
        }
        ctx.restore();
    }
    ctx.restore();
}

function renderErraticCore() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseRadius = Math.min(canvas.width, canvas.height) * 0.15;
    const maxSpike = Math.min(canvas.width, canvas.height) * 0.5; 
    const chaosVal = ctrlChaos ? parseFloat(ctrlChaos.value) : 0.6;

    for (let i = 0; i < BINS; i++) {
        let rawDb = dataArray[logIndices[i]];
        if (!isFinite(rawDb)) rawDb = MIN_DB;
        rawDb = Math.max(MIN_DB, Math.min(MAX_DB, rawDb));
        const normalized = Math.pow((rawDb - MIN_DB) / (MAX_DB - MIN_DB), 2);
        targetRadii[i] = baseRadius + (normalized * maxSpike * (1 + bassEnergy));
        snappedRadii[i] += (targetRadii[i] - snappedRadii[i]) * 0.5; 
    }

    const drawJagged = (scale = 1, yOffset = 0) => {
        ctx.beginPath();
        for (let i = 0; i < BINS; i++) {
            const angle = (i / BINS) * Math.PI * 2;
            const jitter = (Math.random() - 0.5) * beatTimer * (0.3 * chaosVal);
            let r = snappedRadii[i] * scale * (1 + jitter);
            
            if (i % 2 !== 0) {
                const innerCut = lerp(1.0, 0.4, chaosVal);
                r *= innerCut; 
            }
            const x = Math.cos(angle + jitter) * r;
            const y = Math.sin(angle + jitter) * r + yOffset;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y); 
        }
        ctx.closePath();
    };

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(currentScale, currentScale);
    ctx.rotate(currentBeatRot);
    ctx.lineJoin = 'miter'; 
    ctx.miterLimit = 15;
    
    const chompVal = ctrlChomp ? parseFloat(ctrlChomp.value) : 150;
    const splitDistance = (bassEnergy * chompVal) + (beatTimer * (chompVal * 0.4)); 
    
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

    // Bottom shell
    drawWithOuterStroke(() => drawJagged(1.0, splitDistance), activePalette.core);

    // Inner core
    drawJagged(0.75 + (beatTimer * 0.15), 0);
    ctx.fillStyle = activePalette.cream;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = activePalette.ink;
    ctx.stroke();

    // Top shell
    drawWithOuterStroke(() => drawJagged(1.0, -splitDistance), activePalette.core);

    ctx.restore();
}

function renderImpacts() {
    for (let i = impactGraphics.length - 1; i >= 0; i--) {
        let impact = impactGraphics[i];
        impact.draw(ctx);
        impact.framesLeft--;
        if (impact.framesLeft <= 0) impactGraphics.splice(i, 1);
    }
}