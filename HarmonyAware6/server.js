// ============================================================
// N3 — LIVING AUDIOVISUAL ORGANISM (ERRATIC RAVE DAISY)
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
const ctrlIntensity = document.getElementById('ctrlIntensity'); // New Erratic Slider

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

// Beat, Erratic & Dynamics Variables
let beatTimer = 0;
let lastBass = 0;
let bassEnergy = 0;
let midEnergy = 0;
let globalSpin = 0;
let erraticPhaseShift = 0;
let erraticPetalMod = 0;
let erraticSpinSpike = 0;

// Flashy Color Palette
const flashColors = ['#f7f5f9', '#0a0a0a', '#FF0055', '#00FFCC', '#FFD700', '#734488', '#FF5500', '#39FF14'];
let currentBg = '#f7f5f9';
let currentFg = '#734488';
let currentAlt = '#FFD700';

// Background Elements
let bgElements = [];
for (let i = 0; i < 35; i++) {
    bgElements.push({
        type: 'flower',
        x: (Math.random() - 0.5) * 3000,
        y: (Math.random() - 0.5) * 3000,
        size: 30 + Math.random() * 60,
        angle: Math.random() * Math.PI * 2,
        speed: (Math.random() - 0.5) * 0.015,
        parallax: 0.2 + Math.random() * 0.8,
        hasFace: Math.random() > 0.3
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
        analyser.smoothingTimeConstant = 0.6; // Diturunkan agar pergerakannya lebih kasar & responsif
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
    time += 0.004;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for (let i = 0; i < dataArray.length; i++) if (!isFinite(dataArray[i])) dataArray[i] = MIN_DB;
    } else updateSimulatedFrequencies();

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT * 0.05));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.05), Math.floor(BIN_COUNT * 0.3));
    const intensity = ctrlIntensity ? parseFloat(ctrlIntensity.value) : 1.0;

    // DETEKSI BEAT DROP BRUTAL
  if (eB - lastBass > 0.04 && eB > 0.08) { 
        beatTimer = 1.0; 
        
        if (intensity > 0.1) {
            // ----------------------------------------------------
            // COLOR SWAP HAPPENS HERE
            // ----------------------------------------------------
            currentBg = flashColors[Math.floor(Math.random() * flashColors.length)];
            currentFg = flashColors[Math.floor(Math.random() * flashColors.length)];
            
            // Mencegah warna bunga utama sama dengan warna background
            while (currentFg === currentBg) {
                currentFg = flashColors[Math.floor(Math.random() * flashColors.length)];
            }
            
            currentAlt = flashColors[Math.floor(Math.random() * flashColors.length)];
            // ----------------------------------------------------

            // Mutasi Morphology
            erraticPhaseShift = (Math.random() * Math.PI * 4) * intensity;
            erraticPetalMod = Math.floor((Math.random() - 0.5) * 12 * intensity);
            erraticSpinSpike = (Math.random() - 0.5) * 0.5 * intensity;
        }
    }
    lastBass = eB;
    beatTimer *= 0.8; // Decay lebih cepat agar terkesan patah-patah/strobe
    bassEnergy += (eB - bassEnergy) * 0.4;
    midEnergy += (eM - midEnergy) * 0.3;

    // Decay sistem erratic kembali ke normal pelan-pelan
    erraticPhaseShift *= 0.9;
    erraticPetalMod *= 0.9;
    erraticSpinSpike *= 0.85;

    // Putaran utama + spike saat beat
    const baseSpinSpeed = parseFloat(ctrlSpin.value) * 0.02;
    globalSpin += baseSpinSpeed + erraticSpinSpike;

    for (let i = 0; i < BINS; i++) {
        const rawDb = dataArray[logIndices[i]] || MIN_DB;
        const norm = Math.max(0, (rawDb - MIN_DB) / (MAX_DB - MIN_DB));
        // Jika intensity tinggi, snapping audio data makin agresif (kasar)
        const lerpVal = intensity > 1.0 ? 0.3 : 0.15;
        smoothedBins[i] += (norm - smoothedBins[i]) * lerpVal; 
    }

    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = currentBg;
    ctx.fillRect(0, 0, W, H);

    renderBackground(intensity);
    renderLayeredFlower(intensity);
}

// ============================================================
// RENDER BACKGROUND
// ============================================================
function renderBackground(intensity) {
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-globalSpin * 0.5);

    for (let i = 0; i < bgElements.length; i++) {
        let el = bgElements[i];
        
        const dynamicSpeed = el.speed + (el.speed * beatTimer * 10 * intensity);
        el.angle += dynamicSpeed;

        ctx.save();
        const driftX = Math.cos(el.angle) * el.parallax * (400 + midEnergy * (300 + intensity * 200)); 
        const driftY = Math.sin(el.angle) * el.parallax * (400 + midEnergy * (300 + intensity * 200));
        
        ctx.translate(el.x + driftX, el.y + driftY);
        
        // Jitter / Gempa lokal untuk tiap bunga di background saat beat kencang
        if (beatTimer > 0.5 && intensity > 1.0) {
            ctx.translate((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
        }

        const elementScale = 1.0 + (beatTimer * 0.6 * el.parallax * intensity);
        ctx.scale(elementScale, elementScale);
        ctx.rotate(el.angle);

        ctx.globalAlpha = 0.6;
        ctx.fillStyle = (i % 2 === 0) ? currentFg : currentAlt; // Warna gonta-ganti sesuai tema baru
        ctx.strokeStyle = currentBg; 
        ctx.lineWidth = el.size * 0.08;
        ctx.lineJoin = 'miter'; // Dibuat tajam sudutnya

        const numPetals = 5;
        const petalRadius = el.size * 0.45;
        const centerDistance = el.size * 0.35;

        for (let p = 0; p < numPetals; p++) {
            const pAngle = (Math.PI * 2 / numPetals) * p;
            const px = Math.cos(pAngle) * centerDistance;
            const py = Math.sin(pAngle) * centerDistance;
            ctx.beginPath();
            ctx.arc(px, py, petalRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(0, 0, el.size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = currentAlt;
        ctx.fill();
        ctx.stroke();

        // if (el.hasFace) {
        //     ctx.fillStyle = currentBg;
        //     ctx.beginPath();
        //     ctx.arc(-el.size * 0.1, -el.size * 0.05, el.size * 0.04, 0, Math.PI*2);
        //     ctx.arc(el.size * 0.1, -el.size * 0.05, el.size * 0.04, 0, Math.PI*2);
        //     ctx.fill();
        //     ctx.beginPath();
        //     ctx.arc(0, el.size * 0.02, el.size * 0.08, 0.1, Math.PI - 0.1, false);
        //     ctx.lineWidth = el.size * 0.035;
        //     ctx.strokeStyle = currentBg;
        //     ctx.stroke();
        // }
        // ctx.restore();
    }
    ctx.restore();
}

// ============================================================
// RENDER CORE (ERRATIC SPIROGRAPH)
// ============================================================
function renderLayeredFlower(intensity) {
    const W = canvas.width, H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const baseRingCount = parseInt(ctrlRings.value);
    const reactAmp = parseFloat(ctrlReact.value);
    const noiseAmp = parseFloat(ctrlNoise.value) / 25; 
    const holeSize = parseFloat(ctrlHole.value);
    const lineThick = parseFloat(ctrlThickness.value);
    
    const maxRadius = Math.min(W, H) * 0.42;
    
    // Saat erratic jalan, line join diubah jadi tajam (miter) sehingga bentuknya seperti pecahan kaca
    ctx.lineJoin = beatTimer > 0.3 && intensity > 0.8 ? 'miter' : 'round';

    function drawFloralLayer(ringCount, layerRadius, layerAmp, basePetals, phaseShiftMult, isSharp, colorAlpha, audioStart, audioEnd) {
        // Gunakan currentFg yang dirotasi warnanya setiap beat
        ctx.strokeStyle = currentFg;
        ctx.globalAlpha = colorAlpha;
        ctx.lineWidth = lineThick + (beatTimer * intensity * 2); // Garis menebal drastis saat beat

        // Mutasi jumlah kelopak secara acak pada beat
        const currentPetals = Math.max(1, basePetals + erraticPetalMod);

        for (let i = 0; i < ringCount; i++) {
            const ringNorm = ringCount > 1 ? i / (ringCount - 1) : 0;
            const rBase = (holeSize * maxRadius) + (layerRadius * (0.1 + 0.9 * ringNorm));
            
            // Distorsi phase shift
            const phase = (ringNorm * phaseShiftMult) + erraticPhaseShift;

            ctx.beginPath();
            const resolution = 200; 

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

                // Glitch Noise yang sangat kasar diinjeksi saat intensitas tinggi
                const glitch = intensity > 0.5 ? (Math.random() - 0.5) * beatTimer * intensity * 30 : 0;
                
                const activeAmp = layerAmp * noiseAmp + (audioData * maxRadius * 0.25 * reactAmp * (1 + intensity));
                const r = rBase + (activeAmp * wave) + glitch;

                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);

                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }
    }

    // LAYER 3: LUAR
    drawFloralLayer(
        Math.floor(baseRingCount * 0.5), 
        maxRadius * 0.8,                 
        maxRadius * 0.2,                 
        8,                               
        Math.PI,                         
        false,                           
        0.5,                             
        0, 10                            
    );

    // LAYER 2: TENGAH
    drawFloralLayer(
        Math.floor(baseRingCount * 0.35),
        maxRadius * 0.45,
        maxRadius * 0.15,
        16,                              
        Math.PI * 2,                     
        true,                            
        0.8,                             
        10, 30                           
    );

    // LAYER 1: INTI
    ctx.lineWidth = lineThick * 2; 
    drawFloralLayer(
        Math.floor(baseRingCount * 0.15),
        maxRadius * 0.2,
        maxRadius * 0.08,
        24,                              
        Math.PI * 4,
        true,
        1.0,                             
        30, 60                           
    );

    ctx.globalAlpha = 1.0;
}