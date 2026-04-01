// ============================================================
// N3 — PERSONA 5 "SHATTERED CALLING CARD" ORGANISM
// ============================================================

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const controlsPanel = document.getElementById('controlsPanel');

// UI Controls
const ctrlFeedback = document.getElementById('ctrlFeedback');
const ctrlRotation = document.getElementById('ctrlRotation');
const ctrlComplexity = document.getElementById('ctrlComplexity');
const ctrlShake = document.getElementById('ctrlShake');
const ctrlSoftness = document.getElementById('ctrlSoftness');

let audioCtx, analyser, source;
let useRealAudio = false;

// Audio Specs
const BIN_COUNT = 2048; 
const BINS = 32; 
const MIN_DB = -80; 
const MAX_DB = -5;

let logIndices = [];
let dataArray;
let time = 0;
let frameCounter = 0; 

let energy = 0, bassEnergy = 0, midEnergy = 0, highEnergy = 0, peakEnergy = 0.01;
let beatTimer = 0;
let lastBass = 0;

// Persona 5 Strict Palette
const COLOR_RED = '#E60012';
const COLOR_BLACK = '#080808';
const COLOR_WHITE = '#F8F8F8';
const COLOR_DARK_GREY = '#1A1A1A';
const COLOR_MID_GREY = '#333333';

// Shattered Core Data
let targetRadii = new Array(BINS).fill(100);
let snappedRadii = new Array(BINS).fill(100);
let angleJitters = new Array(BINS).fill(0).map(() => (Math.random() - 0.5) * 0.15);
let ransomStrips = [];

// ============================================================
// BACKGROUND STAR FIELD MOTIF
// ============================================================
// Generate a dense, center-biased field of 150 stars
const bgStars = [];
for (let i = 0; i < 150; i++) {
    // Bias positions slightly closer to the center instead of a pure random square
    const dist = Math.pow(Math.random(), 0.8) * 1800; 
    const angle = Math.random() * Math.PI * 2;
    
    bgStars.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        r: 50 + Math.random() * 200, // Slightly smaller max radius to prevent overlapping clutter
        angle: Math.random() * Math.PI * 2,
        speed: (Math.random() - 0.5) * 0.005,
        colorVariant: Math.random() 
    });
}
class RansomStrip {
    constructor(cx, cy, bassIntensity) {
        this.x = cx + (Math.random() - 0.5) * canvas.width * 0.8;
        this.y = cy + (Math.random() - 0.5) * canvas.height * 0.8;
        this.width = 100 + Math.random() * 300 * bassIntensity;
        this.height = 30 + Math.random() * 80;
        this.angle = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.3); 
        this.color = Math.random() > 0.3 ? COLOR_WHITE : COLOR_RED;
        this.framesLeft = 2 + Math.floor(Math.random() * 3);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.fillStyle = this.color;
        ctx.strokeStyle = COLOR_BLACK;
        ctx.lineWidth = 6;
        ctx.lineJoin = 'miter';
        ctx.miterLimit = 10;

        ctx.beginPath();
        ctx.moveTo(-this.width / 2, -this.height / 2 + (Math.random() * 10 - 5));
        ctx.lineTo(this.width / 2, -this.height / 2 + (Math.random() * 10 - 5));
        ctx.lineTo(this.width / 2 - (Math.random() * 15), this.height / 2);
        ctx.lineTo(-this.width / 2 + (Math.random() * 15), this.height / 2);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();
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
        console.warn("Desktop audio capture failed or cancelled. Using simulation.", err);
        useRealAudio = false;
        setupLogBins(true); 
    }
    requestAnimationFrame(renderLoop);
});

function setupLogBins(isSimulated = false) {
    logIndices = [];
    const nyquist = (isSimulated ? 44100 : audioCtx.sampleRate) / 2;
    const freqs = Array.from({length: BIN_COUNT}, (_, i) => i * nyquist / BIN_COUNT);
    const minLog = Math.log10(40); 
    const maxLog = Math.log10(12000); 
    
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
    const beatSim = Math.sin(t * 8) > 0.8 ? 40 : 0;
    
    addPeak(60, 2, 60 + beatSim); 
    addPeak(300, 4, 75 + Math.sin(t * 2)*20); 
    addPeak(2500, 10, 65 + beatSim * 0.5); 
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += Math.max(0, (data[i] - MIN_DB) / (MAX_DB - MIN_DB));
    return sum / (to - from);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.02;
    frameCounter++;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for(let i=0; i<dataArray.length; i++) if(!isFinite(dataArray[i])) dataArray[i] = MIN_DB;
    } else {
        updateSimulatedFrequencies();
    }

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT*0.05));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT*0.05), Math.floor(BIN_COUNT*0.3));
    const eH = getEnergy(dataArray, Math.floor(BIN_COUNT*0.3), Math.floor(BIN_COUNT*0.7));

    const glitchSensitivity = ctrlFeedback ? parseFloat(ctrlFeedback.value) : 0.9;
    const spawnThreshold = 0.5 - (glitchSensitivity * 0.3); 

    if (eB - lastBass > 0.12 && eB > spawnThreshold) {
        beatTimer = 1.0; 
        if (Math.random() < glitchSensitivity) {
            const numStrips = 1 + Math.floor(Math.random() * (glitchSensitivity * 4));
            for(let i=0; i<numStrips; i++) {
                ransomStrips.push(new RansomStrip(canvas.width/2, canvas.height/2, eB));
            }
        }
    }
    lastBass = eB;
    beatTimer *= 0.8; 

    bassEnergy = lerp(bassEnergy, eB, 0.4); 
    midEnergy = lerp(midEnergy, eM, 0.4); 
    highEnergy = lerp(highEnergy, eH, 0.4);

    renderBackgroundStars();

    ctx.save();
    
    // UI CONTROL: Shake
    const shakeInt = ctrlShake ? parseFloat(ctrlShake.value) : 0.6;
    if (beatTimer > 0.4 && shakeInt > 0) {
        const shakeMag = beatTimer * 50 * shakeInt;
        ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
    }

    renderShatteredCore();
    renderRansomStrips();

    ctx.restore();
}

function drawConcentricStar(ctx, radius, fillColor, isBeat) {
    const spikes = 5;
    const inset = 0.45;
    
    const path = new Path2D();
    for (let i = 0; i < spikes * 2; i++) {
        const r = (i % 2 === 0) ? radius : radius * inset;
        const angle = (i * Math.PI) / spikes;
        const x = Math.cos(angle - Math.PI/2) * r;
        const y = Math.sin(angle - Math.PI/2) * r;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
    }
    path.closePath();

    // Thick outer stroke
    ctx.lineWidth = 12;
    ctx.strokeStyle = COLOR_BLACK;
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 15;
    
    // Fill the solid background of the star
    ctx.fillStyle = fillColor;
    ctx.fill(path);
    ctx.stroke(path);

    // Draw the inner nested line for the illusion of vibration
    ctx.save();
    ctx.scale(0.65, 0.65);
    ctx.lineWidth = 5;
    
    // If it's a white/red star during a beat, give it a black inner line.
    // If it's a dark background star, give it a subtle dark line.
    if (fillColor === COLOR_WHITE || fillColor === COLOR_RED) {
        ctx.strokeStyle = COLOR_BLACK;
    } else {
        ctx.strokeStyle = COLOR_BLACK; 
    }
    
    ctx.stroke(path);
    ctx.restore();
}

function renderBackgroundStars() {
    ctx.globalCompositeOperation = 'source-over';
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    // Solid base color to wipe the frame
    ctx.fillStyle = COLOR_BLACK;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(cx, cy);
    
    // UI CONTROL: Master Rotation
    const rotVal = ctrlRotation ? parseFloat(ctrlRotation.value) : 0.5;
    
    // FIX 1: Removed the jarring bassEnergy jitter. 
    // The starfield now drifts smoothly and constantly.
    ctx.rotate(time * 0.02 * rotVal); 
// Allow the shockwave to travel much further (exponent lowered to 1.2, multiplier raised to 2500)
    const shockwaveRadius = Math.pow(midEnergy, 1.2) * 2500; 

    for (let i = 0; i < bgStars.length; i++) {
        let s = bgStars[i];
        
        s.angle += s.speed * rotVal;

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);

        const distFromCenter = Math.hypot(s.x, s.y);
        const isShocked = (distFromCenter < shockwaveRadius) && (midEnergy > 0.1);

        // CRITICAL FIX: No more invisible black stars. 
        // 60% of stars flash White, 40% flash Red.
        let fillColor;
        if (s.colorVariant > 0.4) {
            fillColor = isShocked ? COLOR_WHITE : COLOR_DARK_GREY;
        } else {
            fillColor = isShocked ? COLOR_RED : COLOR_MID_GREY;
        }

        let dynamicRadius = s.r;
        if (isShocked) {
            const shockIntensity = 1 - (distFromCenter / Math.max(1, shockwaveRadius));
            // Keep the scaling gentle (0.2) to avoid the dizzying effect
            dynamicRadius = s.r * (1 + (shockIntensity * 0.2) + (bassEnergy * 0.1));
        }

        drawConcentricStar(ctx, dynamicRadius, fillColor, isShocked);
        ctx.restore();
    }
    
    ctx.restore();
}

function renderShatteredCore() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const baseRadius = Math.min(canvas.width, canvas.height) * 0.15;
    const maxSpike = Math.min(canvas.width, canvas.height) * 0.4;

    for (let i = 0; i < BINS; i++) {
        let rawDb = dataArray[logIndices[i]];
        if (!isFinite(rawDb)) rawDb = MIN_DB;
        rawDb = Math.max(MIN_DB, Math.min(MAX_DB, rawDb));
        
        const normalized = Math.pow((rawDb - MIN_DB) / (MAX_DB - MIN_DB), 2);
        targetRadii[i] = baseRadius + (normalized * maxSpike * (1 + bassEnergy * 0.5));
    }

    // UI CONTROL: "Softness" maps to Stop-Motion Frame Delay
    const softnessVal = ctrlSoftness ? parseFloat(ctrlSoftness.value) : 0.8;
    const frameDelay = Math.max(1, Math.floor((1.1 - softnessVal) * 8));

    if (frameCounter % frameDelay === 0 || beatTimer > 0.9) {
        for (let i = 0; i < BINS; i++) {
            snappedRadii[i] = targetRadii[i];
        }
    }

    // UI CONTROL: "Complexity" dictates how deeply the polygon cuts inward
    const compVal = ctrlComplexity ? parseFloat(ctrlComplexity.value) : 5;
    const innerCutMultiplier = 1.0 - (compVal * 0.08); 

    const createPath = (scale = 1) => {
        ctx.beginPath();
        for (let i = 0; i < BINS; i++) {
            const angle = (i / BINS) * Math.PI * 2 + angleJitters[i] + (time * 0.2 * (ctrlRotation ? parseFloat(ctrlRotation.value) : 1));
            const r = snappedRadii[i] * scale;
            
            const actualR = (i % 2 === 0) ? r : r * innerCutMultiplier; 
            
            const x = Math.cos(angle) * actualR;
            const y = Math.sin(angle) * actualR;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    };

    ctx.save();
    ctx.translate(cx, cy);

    ctx.lineJoin = 'miter';
    ctx.miterLimit = 20;

    const offsetMag = 15 + (beatTimer * 30);
    ctx.translate(offsetMag, offsetMag);
    createPath(1.05); 
    ctx.fillStyle = COLOR_RED;
    ctx.fill();
    ctx.translate(-offsetMag, -offsetMag);

    createPath(1.0);
    ctx.fillStyle = COLOR_WHITE;
    ctx.fill();

    ctx.lineWidth = 12 + (beatTimer * 10);
    ctx.strokeStyle = COLOR_BLACK;
    ctx.stroke();

    ctx.restore();
}

function renderRansomStrips() {
    for (let i = ransomStrips.length - 1; i >= 0; i--) {
        let strip = ransomStrips[i];
        strip.draw(ctx);
        strip.framesLeft--;
        
        if (strip.framesLeft <= 0) {
            ransomStrips.splice(i, 1);
        }
    }
}