// ============================================================
// N3 — LIVING AUDIOVISUAL ORGANISM (LAYERED SPIROGRAPH DAISY)
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

// Beat & Dynamics Variables
let beatTimer = 0;
let lastBass = 0;
let bassEnergy = 0;
let midEnergy = 0;

// ============================================================
// BACKGROUND ELEMENTS (BUNGA UCU GEMOI)
// ============================================================
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

    if (eB - lastBass > 0.08 && eB > 0.15) {
        beatTimer = 1.0; 
    }
    lastBass = eB;
    beatTimer *= 0.85; 
    bassEnergy += (eB - bassEnergy) * 0.4;
    midEnergy += (eM - midEnergy) * 0.3;

    for (let i = 0; i < BINS; i++) {
        const rawDb = dataArray[logIndices[i]] || MIN_DB;
        const norm = Math.max(0, (rawDb - MIN_DB) / (MAX_DB - MIN_DB));
        smoothedBins[i] += (norm - smoothedBins[i]) * 0.15; 
    }

    const W = canvas.width, H = canvas.height;
    // Latar putih terang sedikit bertekstur ungu tipis dari glow
    ctx.fillStyle = '#f7f5f9';
    ctx.fillRect(0, 0, W, H);

    renderBackground();
    renderLayeredFlower();
}

// ============================================================
// RENDER BACKGROUND (BUNGA UCU GEMOI)
// ============================================================
function renderBackground() {
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    const globalRot = time * 0.3 * parseFloat(ctrlSpin.value);
    ctx.rotate(-globalRot); // Muter berlawanan arah dari core

    for (let i = 0; i < bgElements.length; i++) {
        let el = bgElements[i];
        
        const dynamicSpeed = el.speed + (el.speed * beatTimer * 3);
        el.angle += dynamicSpeed;

        ctx.save();
        const driftX = Math.cos(el.angle) * el.parallax * (400 + midEnergy * 300); 
        const driftY = Math.sin(el.angle) * el.parallax * (400 + midEnergy * 300);
        
        ctx.translate(el.x + driftX, el.y + driftY);
        
        const elementScale = 1.0 + (beatTimer * 0.4 * el.parallax);
        ctx.scale(elementScale, elementScale);
        ctx.rotate(el.angle);

        // Opacity sedikit dikurangi agar tidak menutupi bunga utama
        ctx.globalAlpha = 0.5;

        let centerColor = '#FFD700'; 
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#734488'; 
        ctx.lineWidth = el.size * 0.08;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

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
        ctx.fillStyle = centerColor;
        ctx.fill();
        ctx.stroke();

        // if (el.hasFace) {
        //     ctx.fillStyle = 'rgba(255, 105, 180, 0.6)'; 
        //     ctx.beginPath();
        //     ctx.arc(-el.size * 0.15, el.size * 0.05, el.size * 0.08, 0, Math.PI*2);
        //     ctx.arc(el.size * 0.15, el.size * 0.05, el.size * 0.08, 0, Math.PI*2);
        //     ctx.fill();

        //     ctx.fillStyle = '#333333';
        //     ctx.beginPath();
        //     ctx.arc(-el.size * 0.1, -el.size * 0.05, el.size * 0.04, 0, Math.PI*2);
        //     ctx.arc(el.size * 0.1, -el.size * 0.05, el.size * 0.04, 0, Math.PI*2);
        //     ctx.fill();

        //     ctx.beginPath();
        //     ctx.arc(0, el.size * 0.02, el.size * 0.08, 0.1, Math.PI - 0.1, false);
        //     ctx.lineWidth = el.size * 0.035;
        //     ctx.strokeStyle = '#333333';
        //     ctx.stroke();
        // }
        ctx.restore();
    }
    ctx.restore();
}

// ============================================================
// RENDER CORE (LAYERED SPIROGRAPH / MANDALA FLOWER)
// ============================================================
function renderLayeredFlower() {
    const W = canvas.width, H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const baseRingCount = parseInt(ctrlRings.value);
    const reactAmp = parseFloat(ctrlReact.value);
    const noiseAmp = parseFloat(ctrlNoise.value) / 25; // Normalisasi skala slider
    const spin = parseFloat(ctrlSpin.value) * time;
    const holeSize = parseFloat(ctrlHole.value);
    const lineThick = parseFloat(ctrlThickness.value);
    
    const maxRadius = Math.min(W, H) * 0.42;
    
    // Efek cahaya (Glow) ungu halus
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(165, 100, 210, 0.4)';
    ctx.lineJoin = 'round';

    // Fungsi khusus untuk menggambar satu blok layer (inti, tengah, atau luar)
    function drawFloralLayer(ringCount, layerRadius, layerAmp, numPetals, phaseShiftMult, isSharp, colorAlpha, audioStart, audioEnd) {
        ctx.strokeStyle = `rgba(115, 68, 136, ${colorAlpha})`;
        ctx.lineWidth = lineThick;

        for (let i = 0; i < ringCount; i++) {
            // Normalisasi dari 0.0 ke 1.0 untuk penyebaran ring
            const ringNorm = ringCount > 1 ? i / (ringCount - 1) : 0;
            
            // Jari-jari dasar cincin ini (memperhitungkan holeSize di tengah)
            const rBase = (holeSize * maxRadius) + (layerRadius * (0.1 + 0.9 * ringNorm));
            
            // Phase shift membuat efek garis bersilangan (Spirograph mesh)
            const phase = ringNorm * phaseShiftMult;

            ctx.beginPath();
            const resolution = 240; // Kerapatan garis lengkung

            for (let j = 0; j <= resolution; j++) {
                const t = (j / resolution) * Math.PI * 2;
                const angle = t + spin;

                // Mapping frekuensi audio ke keliling lingkaran
                const binRatio = Math.sin((j / resolution) * Math.PI); // Loop bolak-balik tanpa patahan
                const binIndex = Math.floor(audioStart + (audioEnd - audioStart) * binRatio);
                const audioData = smoothedBins[binIndex] || 0;

                // Hitung bentuk kelopak (Wave form)
                let wave;
                if (isSharp) {
                    // Membuat ujung runcing seperti mandala
                    wave = Math.abs(Math.sin((numPetals * t + phase) / 2)) * 2 - 1;
                } else {
                    // Gelombang meliuk halus
                    wave = Math.cos(numPetals * t + phase);
                }

                // Audio memperbesar ukuran kelopak (memukul ke luar)
                const activeAmp = layerAmp * noiseAmp + (audioData * maxRadius * 0.15 * reactAmp);
                
                // Radius akhir di titik ini
                const r = rBase + (activeAmp * wave);

                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);

                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }
    }

    // MENGGAMBAR 3 LAYER BERBEDA UNTUK MENCIPTAKAN KEDALAMAN

    // LAYER 3: KELOPAK LUAR (Besar, Menyapu halus, bereaksi ke BASS)
    drawFloralLayer(
        Math.floor(baseRingCount * 0.5), // Jumlah garis
        maxRadius * 0.8,                 // Ukuran Radius
        maxRadius * 0.2,                 // Tinggi gelombang
        8,                               // Jumlah Kelopak Besar
        Math.PI,                         // Persilangan garis
        false,                           // Halus, tidak runcing
        0.3,                             // Opacity warna (transparan sedikit)
        0, 10                            // Frekuensi Audio (0-10 = Bass)
    );

    // LAYER 2: KELOPAK TENGAH (Mendetail, sedikit meruncing, bereaksi ke MID)
    drawFloralLayer(
        Math.floor(baseRingCount * 0.35),
        maxRadius * 0.45,
        maxRadius * 0.15,
        16,                              // 16 Kelopak sedang
        Math.PI * 2,                     
        true,                            // Dibuat runcing/tajam (Sharp)
        0.6,                             // Lebih pekat warnanya
        10, 30                           // Frekuensi Audio (Mid-range)
    );

    // LAYER 1: INTI TENGAH / MANDALA CORE (Kecil, padat, bereaksi ke TREBLE/HIGH)
    // Supaya intinya kelihatan jelas, garisnya kita tebalkan dikit
    ctx.lineWidth = lineThick * 1.5; 
    drawFloralLayer(
        Math.floor(baseRingCount * 0.15),
        maxRadius * 0.2,
        maxRadius * 0.08,
        24,                              // 24 sudut kecil
        Math.PI * 4,
        true,
        1.0,                             // Warna solid
        30, 60                           // Frekuensi Audio (Highs)
    );

    // Reset shadow agar tidak mengganggu frame berikutnya
    ctx.shadowBlur = 0;
}