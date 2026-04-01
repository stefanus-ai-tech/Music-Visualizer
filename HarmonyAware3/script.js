// ============================================================
// N3 — PERSONA 5 PHANTOM THIEF AUDIOVISUAL ORGANISM
// ============================================================

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const stateName = document.getElementById('stateName');
const controlsPanel = document.getElementById('controlsPanel');

// UI Controls
const ctrlFeedback = document.getElementById('ctrlFeedback');
const ctrlRotation = document.getElementById('ctrlRotation');
const ctrlComplexity = document.getElementById('ctrlComplexity');
const ctrlShake = document.getElementById('ctrlShake');
const ctrlSoftness = document.getElementById('ctrlSoftness');

let audioCtx, analyser, source;
let useRealAudio = false;

// Audio Specs[cite: 2]
const BIN_COUNT = 2048; 
const BINS = 64;
const MIN_DB = -80; 
const MAX_DB = -5;
const DECAY = 0.85; 

let logIndices = [];
let smoothedY = new Array(BINS).fill(MIN_DB);
let dataArray;
let time = 0;

let energy = 0, bassEnergy = 0, midEnergy = 0, highEnergy = 0, peakEnergy = 0.01;
let beatTimer = 0;
let lastBass = 0;

// Persona 5 Strict Palette
const COLOR_RED = '#E60012';
const COLOR_BLACK = '#080808';
const COLOR_WHITE = '#F8F8F8';

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

startBtn.addEventListener('click', async () => {
    overlay.style.display = 'none';
    controlsPanel.classList.remove('hidden');
    resizeCanvas();
    dataArray = new Float32Array(BIN_COUNT);

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
    const freqs = Array.from({length: BIN_COUNT}, (_, i) => i * nyquist / BIN_COUNT);
    
    const minLog = Math.log10(20); 
    const maxLog = Math.log10(16000); 
    
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
    addPeak(220 + Math.sin(t * 0.1) * 20, 4, 75 + Math.sin(t * 2)*10); 
    addPeak(800 + Math.cos(t * 0.15) * 50, 6, 70); 
    addPeak(3500 + Math.sin(t * 2) * 500, 10, 65); 
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += Math.max(0, (data[i] + 100) / 100);
    return sum / (to - from);
}

function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.02; // Faster, more kinetic time

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for(let i=0; i<dataArray.length; i++) if(!isFinite(dataArray[i])) dataArray[i] = -100;
    } else updateSimulatedFrequencies();

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT*0.05));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT*0.05), Math.floor(BIN_COUNT*0.3));
    const eH = getEnergy(dataArray, Math.floor(BIN_COUNT*0.3), Math.floor(BIN_COUNT*0.7));

    if (eB - lastBass > 0.08 && eB > 0.3) beatTimer = 1.0; 
    lastBass = eB;
    beatTimer *= 0.85; 

    bassEnergy = lerp(bassEnergy, eB, 0.3); // Faster lerp for snappier movement
    midEnergy = lerp(midEnergy, eM, 0.3); 
    highEnergy = lerp(highEnergy, eH, 0.3);
    
    const raw = eB*0.5 + eM*0.35 + eH*0.15;
    peakEnergy = raw > peakEnergy ? raw : lerp(peakEnergy, raw, 0.001);
    energy = Math.min(1, raw / peakEnergy);

    renderP5Background();

    ctx.save();
    const shakeInt = parseFloat(ctrlShake.value);
    
    // Violent, glitchy camera shake on beats
    if (beatTimer > 0.5 && shakeInt > 0) {
        const shakeMag = beatTimer * 30 * shakeInt;
        ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
    }

    renderJaggedWaveform();

    // Ink splatters on heavy bass
    if (beatTimer > 0.85 && shakeInt > 0.5) {
        drawInkSplatter();
    }

    ctx.restore();
}

function renderP5Background() {
    ctx.globalCompositeOperation = 'source-over';
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    // Background flashes Red on big beats, otherwise mostly black/white
    ctx.fillStyle = beatTimer > 0.8 ? COLOR_RED : COLOR_WHITE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw heavy diagonal stripes moving across the screen
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4); // 45 degree angle
    
    const stripeWidth = 60 + (energy * 20);
    const gap = 100;
    const offset = (time * 200 * parseFloat(ctrlRotation.value)) % (stripeWidth + gap);
    
    ctx.fillStyle = COLOR_BLACK;
    const diagSpan = canvas.width + canvas.height; // Ensure it covers the rotated screen
    
    for (let x = -diagSpan; x < diagSpan; x += (stripeWidth + gap)) {
        // Occasionally make a stripe red for kinetic variation
        if (Math.abs(x % 300) < 50 && beatTimer < 0.5) {
             ctx.fillStyle = COLOR_RED;
        } else {
             ctx.fillStyle = COLOR_BLACK;
        }
        ctx.fillRect(x + offset, -diagSpan, stripeWidth, diagSpan * 2);
    }
    
    // Halftone illusion: A grid of dots overlay when energy is mid
    if (parseFloat(ctrlComplexity.value) > 4) {
        ctx.fillStyle = `rgba(0, 0, 0, ${0.1 + (midEnergy * 0.2)})`;
        for (let i = -diagSpan; i < diagSpan; i+= 20) {
            for (let j = -diagSpan; j < diagSpan; j+= 20) {
                if ((i+j) % 40 === 0) {
                    ctx.beginPath();
                    ctx.arc(i + offset*0.5, j, 3, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
    }
    ctx.restore();
}

function drawInkSplatter() {
    ctx.save();
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    const splatColor = Math.random() > 0.5 ? COLOR_BLACK : COLOR_RED;
    ctx.fillStyle = splatColor;

    // Draw 1-3 central splatters
    for(let k = 0; k < 3; k++) {
        ctx.beginPath();
        const basex = cx + (Math.random() - 0.5) * canvas.width * 0.8;
        const basey = cy + (Math.random() - 0.5) * canvas.height * 0.8;
        const radius = 20 + Math.random() * 50;
        
        // Create jagged star/ink blot shape
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const rad = radius * (1 + (Math.random() - 0.5));
            const x = basex + Math.cos(angle) * rad;
            const y = basey + Math.sin(angle) * rad;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.fill();

        // Draw smaller satellite droplets
        for(let j=0; j<5; j++) {
            ctx.beginPath();
            ctx.arc(
                basex + (Math.random() - 0.5) * radius * 3, 
                basey + (Math.random() - 0.5) * radius * 3, 
                Math.random() * 10, 0, Math.PI*2
            );
            ctx.fill();
        }
    }
    ctx.restore();
}

function renderJaggedWaveform() {
    if (logIndices.length === 0) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseRadius = 150 + (bassEnergy * 100);
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter'; // Miter gives sharp, pointy corners
    ctx.miterLimit = 2;

    // Function to draw one continuous jagged shape
    const drawSpikes = (offsetRadius, strokeColor, fillColor, scaleX, scaleY) => {
        ctx.save();
        ctx.translate(cx, cy);
        
        // Rotates violently on beat
        const rot = beatTimer > 0.7 ? (Math.random() > 0.5 ? 0.1 : -0.1) : 0;
        ctx.rotate(rot);
        ctx.scale(scaleX, scaleY);

        ctx.beginPath();
        for (let i = 0; i <= BINS; i++) {
            let idx = i === BINS ? 0 : i; // Close the loop
            let rawDb = dataArray[logIndices[idx]];
            if (!isFinite(rawDb)) rawDb = MIN_DB;
            rawDb = Math.max(MIN_DB, Math.min(MAX_DB, rawDb));

            // Faster decay for snappier drop-offs
            smoothedY[idx] = (rawDb * 0.4) + (smoothedY[idx] * 0.6);
            const normalized = Math.pow((smoothedY[idx] - MIN_DB) / (MAX_DB - MIN_DB), 1.5); // Pow makes peaks sharper

            const angle = (idx / BINS) * Math.PI * 2 - (Math.PI / 2);
            
            // Alternate adding extreme jaggedness
            const spike = (idx % 2 === 0) ? (normalized * 300 * (1 + bassEnergy)) : (normalized * 50);
            const r = baseRadius + offsetRadius + spike;
            
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        
        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }
        if (strokeColor) {
            ctx.lineWidth = 15; // Thick comic book outlines
            ctx.strokeStyle = strokeColor;
            ctx.stroke();
        }
        ctx.restore();
    };

    // Draw multiple overlapping layers for the "Paper Cutout" UI effect
    
    // Layer 1: Thick Black silhouette/shadow (offset slightly down and right)
    drawSpikes(20, COLOR_BLACK, COLOR_BLACK, 1.05, 1.05);
    
    // Layer 2: Solid White border
    drawSpikes(10, COLOR_BLACK, COLOR_WHITE, 1.0, 1.0);
    
    // Layer 3: Inner Red kinetic core
    drawSpikes(-10, COLOR_BLACK, COLOR_RED, 0.9, 0.9);
}

function lerp(a,b,t){return a+(b-a)*t;}