// ============================================================
// N3 — ERRATIC RAVE DAISY (AESTHETIC PASTEL VERSION)
// ============================================================

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const controlsPanel = document.getElementById('controlsPanel');

// Controls
const ctrlRings = document.getElementById('ctrlRings');
const ctrlReact = document.getElementById('ctrlReact');
const ctrlNoise = document.getElementById('ctrlNoise');
const ctrlSpin = document.getElementById('ctrlSpin');
const ctrlHole = document.getElementById('ctrlHole');
const ctrlThickness = document.getElementById('ctrlThickness');
const ctrlIntensity = document.getElementById('ctrlIntensity');

// Palettes
const PALETTES = {
    lilac: ['#FCF9FF', '#E5D9F2', '#CDC1FF', '#A594F9'],
    sakura: ['#FFF0F5', '#FFD1DC', '#E6A8D7', '#DDA0DD'],
    midnight: ['#1A1025', '#2D1B4E', '#4B3F72', '#7D5BA6'],
    matcha: ['#F3F8FF', '#E2F1E7', '#C4D7E0', '#9B86BD']
};

let currentPalette = PALETTES.lilac;
let currentBg = currentPalette[0];
let currentFg = currentPalette[2];
let currentAlt = currentPalette[3];

// Palette Selection Logic
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const presetKey = e.target.dataset.preset;
        currentPalette = PALETTES[presetKey];
        
        // Langsung update warna saat diklik
        currentBg = currentPalette[0];
        currentFg = currentPalette[2];
        currentAlt = currentPalette[3];
    });
});

// Audio variables
let audioCtx, analyser, source;
let useRealAudio = false;
const BIN_COUNT = 1024;
const BINS = 64;
const MIN_DB = -90, MAX_DB = -10;
let logIndices = [];
let dataArray;
let time = 0;
let smoothedBins = new Float32Array(BINS).fill(0);

// Beat & Erratic Variables
let beatTimer = 0;
let lastBass = 0;
let bassEnergy = 0;
let midEnergy = 0;
let globalSpin = 0;
let erraticPhaseShift = 0;
let erraticPetalMod = 0;
let erraticSpinSpike = 0;
let currentScale = 1.0;

// Background Elements (Tanpa Wajah)
let bgElements = [];
for (let i = 0; i < 35; i++) {
    bgElements.push({
        x: (Math.random() - 0.5) * 3000,
        y: (Math.random() - 0.5) * 3000,
        size: 50 + Math.random() * 100,
        angle: Math.random() * Math.PI * 2,
        speed: (Math.random() - 0.5) * 0.02,
        parallax: 0.2 + Math.random() * 0.8
    });
}

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
        const index = freqs.findIndex(f => f >= targetFreq);
        logIndices.push(index === -1 ? freqs.length - 1 : index);
    }
}

function updateSimulatedFrequencies() {
    for (let i = 0; i < BIN_COUNT; i++) dataArray[i] = -100 + Math.random() * 5;
    const t = time * 0.5;
    const addPeak = (binStart, binEnd, amp) => {
        for(let i=binStart; i<binEnd; i++) {
            if (-100 + amp > dataArray[i]) dataArray[i] = -100 + amp;
        }
    }
    if (Math.sin(t * 8) > 0.8) addPeak(1, 5, 80);
    addPeak(10, 15, 60 + Math.sin(t * 2) * 20);
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) {
        sum += Math.max(0, (data[i] - MIN_DB) / (MAX_DB - MIN_DB));
    }
    return sum / Math.max(1, (to - from));
}

// ============================================================
// MAIN RENDER LOOP
// ============================================================
function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.005;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for (let i = 0; i < dataArray.length; i++) if (!isFinite(dataArray[i])) dataArray[i] = MIN_DB;
    } else updateSimulatedFrequencies();

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT * 0.05));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.05), Math.floor(BIN_COUNT * 0.3));
    const intensity = ctrlIntensity ? parseFloat(ctrlIntensity.value) : 1.5;

    // BEAT DROP DETECTION
    if (eB - lastBass > 0.02 && eB > 0.05) { 
        beatTimer = 1.0; 
        currentScale = 1.1 + (eB * 0.3 * intensity);

        if (intensity > 0.1) {
            // SWAP WARNA dalam Palet Aesthetic
            currentBg = currentPalette[Math.floor(Math.random() * currentPalette.length)];
            currentFg = currentPalette.find(c => c !== currentBg) || currentPalette[0];
            currentAlt = currentPalette.find(c => c !== currentBg && c !== currentFg) || currentPalette[1];

            // Mutasi Morphology
            erraticPhaseShift = (Math.random() * Math.PI * 4) * intensity;
            erraticPetalMod = Math.floor((Math.random() - 0.5) * 16 * intensity);
            erraticSpinSpike = (Math.random() - 0.5) * 0.8 * intensity;
        }
    }
    lastBass = eB;
    
    beatTimer *= 0.75; 
    currentScale += (1.0 - currentScale) * 0.25; 
    bassEnergy += (eB - bassEnergy) * 0.4;
    midEnergy += (eM - midEnergy) * 0.3;

    erraticPhaseShift *= 0.85;
    erraticPetalMod *= 0.85;
    erraticSpinSpike *= 0.8;

    const baseSpinSpeed = parseFloat(ctrlSpin.value) * 0.03;
    globalSpin += baseSpinSpeed + erraticSpinSpike;

    for (let i = 0; i < BINS; i++) {
        const rawDb = dataArray[logIndices[i]] || MIN_DB;
        const norm = Math.max(0, (rawDb - MIN_DB) / (MAX_DB - MIN_DB));
        const lerpVal = beatTimer > 0.5 ? 0.6 : 0.2; 
        smoothedBins[i] += (norm - smoothedBins[i]) * lerpVal; 
    }

    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = currentBg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);

    if (intensity > 0) {
        const shakeMag = beatTimer * 30 * intensity;
        ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
    }
    
    ctx.scale(currentScale, currentScale);

    renderBackground(intensity);
    renderLayeredFlower(intensity);

    ctx.restore();
}

// ============================================================
// RENDER BACKGROUND (TANPA WAJAH)
// ============================================================
function renderBackground(intensity) {
    ctx.save();
    ctx.rotate(-globalSpin * 0.8);

    for (let i = 0; i < bgElements.length; i++) {
        let el = bgElements[i];
        
        const dynamicSpeed = el.speed + (el.speed * beatTimer * 10 * intensity);
        el.angle += dynamicSpeed;

        ctx.save();
        const driftX = Math.cos(el.angle) * el.parallax * (600 + midEnergy * (300 + intensity * 200)); 
        const driftY = Math.sin(el.angle) * el.parallax * (600 + midEnergy * (300 + intensity * 200));
        
        ctx.translate(el.x + driftX, el.y + driftY);
        
        if (beatTimer > 0.4 && intensity > 0.8) {
            ctx.translate((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
        }

        const elementScale = 1.0 + (beatTimer * 0.5 * el.parallax * intensity);
        ctx.scale(elementScale, elementScale);
        ctx.rotate(el.angle);

        ctx.globalAlpha = 0.6; 
        ctx.fillStyle = (i % 2 === 0) ? currentFg : currentAlt; 
        ctx.strokeStyle = currentBg; 
        
        ctx.lineWidth = el.size * 0.15;
        ctx.lineJoin = 'round'; 

        const numPetals = 5;
        const petalRadius = el.size * 0.45;
        const centerDistance = el.size * 0.35;

        // Gambar Kelopak
        for (let p = 0; p < numPetals; p++) {
            const pAngle = (Math.PI * 2 / numPetals) * p;
            const px = Math.cos(pAngle) * centerDistance;
            const py = Math.sin(pAngle) * centerDistance;
            ctx.beginPath();
            ctx.arc(px, py, petalRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Gambar Inti Bunga
        ctx.beginPath();
        ctx.arc(0, 0, el.size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = currentAlt;
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
    ctx.restore();
}

// ============================================================
// RENDER CORE
// ============================================================
function renderLayeredFlower(intensity) {
    const baseRingCount = parseInt(ctrlRings.value);
    const reactAmp = parseFloat(ctrlReact.value);
    const noiseAmp = parseFloat(ctrlNoise.value) / 25; 
    const holeSize = parseFloat(ctrlHole.value);
    const lineThick = parseFloat(ctrlThickness.value);
    
    const maxRadius = Math.min(canvas.width, canvas.height) * 0.42;
    
    ctx.lineJoin = beatTimer > 0.2 && intensity > 0.5 ? 'miter' : 'round';
    ctx.miterLimit = 5;

    function drawFloralLayer(ringCount, layerRadius, layerAmp, basePetals, phaseShiftMult, isSharp, colorAlpha, audioStart, audioEnd) {
        ctx.strokeStyle = currentFg;
        ctx.fillStyle = currentAlt;
        ctx.globalAlpha = colorAlpha;
        
        ctx.lineWidth = lineThick + (beatTimer * intensity * 5); 

        const currentPetals = Math.max(1, basePetals + erraticPetalMod);

        for (let i = 0; i < ringCount; i++) {
            const ringNorm = ringCount > 1 ? i / (ringCount - 1) : 0;
            const rBase = (holeSize * maxRadius) + (layerRadius * (0.1 + 0.9 * ringNorm));
            
            const phase = (ringNorm * phaseShiftMult) + erraticPhaseShift;

            ctx.beginPath();
            const resolution = 180; 

            for (let j = 0; j <= resolution; j++) {
                const t = (j / resolution) * Math.PI * 2;
                const angle = t + globalSpin;

                const binRatio = Math.sin((j / resolution) * Math.PI);
                const binIndex = Math.floor(audioStart + (audioEnd - audioStart) * binRatio);
                const audioData = smoothedBins[binIndex] || 0;

                let wave;
                if (isSharp) {
                    wave = Math.abs(Math.sin((currentPetals * t + phase) / 2)) * 2 - 1;
                } else {
                    wave = Math.cos(currentPetals * t + phase);
                }

                const glitch = intensity > 0.8 ? (Math.random() - 0.5) * beatTimer * intensity * 40 : 0;
                const activeAmp = layerAmp * noiseAmp + (audioData * maxRadius * 0.4 * reactAmp * (1 + intensity));
                
                const r = rBase + (activeAmp * wave) + glitch;
                const x = r * Math.cos(angle);
                const y = r * Math.sin(angle);

                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y); 
            }
            ctx.closePath();
            
            if (beatTimer > 0.8 && Math.random() > 0.7 && intensity > 1.0) {
                ctx.globalAlpha = 0.3;
                ctx.fill();
                ctx.globalAlpha = colorAlpha;
            }
            ctx.stroke();
        }
    }

    // LAYER 3: LUAR
    drawFloralLayer(
        Math.floor(baseRingCount * 0.5), maxRadius * 0.8, maxRadius * 0.3, 8, Math.PI, false, 1.0, 0, 10
    );
    // LAYER 2: TENGAH
    drawFloralLayer(
        Math.floor(baseRingCount * 0.35), maxRadius * 0.45, maxRadius * 0.2, 16, Math.PI * 2, true, 1.0, 10, 30
    );
    // LAYER 1: INTI
    ctx.lineWidth = lineThick * 2; 
    drawFloralLayer(
        Math.floor(baseRingCount * 0.15), maxRadius * 0.2, maxRadius * 0.1, 24, Math.PI * 4, true, 1.0, 30, 60
    );
}