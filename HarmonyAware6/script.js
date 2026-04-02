// ============================================================
// N3 — LIVING AUDIOVISUAL ORGANISM (FLOWER/DAISY MODEL)
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
        analyser.smoothingTimeConstant = 0.85;
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
    // Simulate kick
    if (Math.sin(t * 8) > 0.8) addPeak(1, 5, 80);
    // Simulate melody
    addPeak(10, 15, 60 + Math.sin(t * 2) * 20);
}

// Seamless Circular Noise Function
function circularNoise(angle, ringProgression, t) {
    let val = 0;
    
    // 1. STRUKTUR KELOPAK DASAR (5 Kelopak)
    const petalCount = 5;
    // Gelombang dominan yang memaksa bentuknya mekar beraturan
    val += Math.cos(angle * petalCount) * 1.5;

    // 2. DISTORSI ORGANIK
    // Angka pengali (2 dan 3) WAJIB bilangan bulat agar lingkaran menyambung sempurna tanpa patahan
    val += Math.sin(angle * 2 + t + ringProgression * 5) * 0.5;
    val += Math.cos(angle * 3 - t * 0.5) * 0.3;
    
    return val;
}

function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.005;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for (let i = 0; i < dataArray.length; i++) if (!isFinite(dataArray[i])) dataArray[i] = MIN_DB;
    } else updateSimulatedFrequencies();

    // Smooth bins for organic movement
    for (let i = 0; i < BINS; i++) {
        const rawDb = dataArray[logIndices[i]] || MIN_DB;
        const norm = Math.max(0, (rawDb - MIN_DB) / (MAX_DB - MIN_DB));
        smoothedBins[i] += (norm - smoothedBins[i]) * 0.15; // lerp
    }

    renderFlowerScene();
}

function renderFlowerScene() {
    const W = canvas.width, H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    // Background terang
    ctx.fillStyle = '#f4f2f5';
    ctx.fillRect(0, 0, W, H);

    const numRings = parseInt(ctrlRings.value);
    const reactAmp = parseFloat(ctrlReact.value);
    const noiseAmp = parseFloat(ctrlNoise.value); // Slider ini sekarang mengontrol kelebaran kelopak
    const spin = parseFloat(ctrlSpin.value) * time;
    const holeSize = parseFloat(ctrlHole.value);
    
    ctx.strokeStyle = '#734488';
    ctx.lineWidth = parseFloat(ctrlThickness.value);
    ctx.lineJoin = 'round';

    const maxRadius = Math.min(W, H) * 0.42;
    const pointsPerRing = 200; // Resolusi dinaikkan agar kurva kelopak lebih halus

    for (let i = 1; i <= numRings; i++) {
        const ringProgression = i / numRings; 
        const baseR = (holeSize * maxRadius) + (ringProgression * maxRadius * (1 - holeSize));

        ctx.beginPath();

        for (let j = 0; j <= pointsPerRing; j++) {
            const angleRatio = j / pointsPerRing; 
            const angle = angleRatio * Math.PI * 2;
            const rotatedAngle = angle + spin;

            // FIX PATAHAN: Menggunakan gelombang Math.sin untuk membaca data audio secara bolak-balik.
            // Memastikan data di titik 0 derajat dan 360 derajat nilainya persis sama sehingga garis menyambung mulus.
            const smoothBinRatio = Math.sin(angleRatio * Math.PI); 
            const binIndex = Math.floor(smoothBinRatio * 0.99 * (BINS - 1));
            const audioData = smoothedBins[binIndex] || 0;

            const shapeNoise = circularNoise(rotatedAngle, ringProgression, time * 0.5);
            
            // Reaksi audio memantul searah dengan pertumbuhan kelopak
            const audioBump = audioData * maxRadius * 0.15 * reactAmp * ringProgression;
            
            // Kalkulasi radius final
            const r = baseR + (shapeNoise * noiseAmp * ringProgression) + audioBump;

            const x = cx + r * Math.cos(rotatedAngle);
            const y = cy + r * Math.sin(rotatedAngle);

            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.stroke();
    }
}