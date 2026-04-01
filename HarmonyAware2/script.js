// ============================================================
// N3 — LIVING AUDIOVISUAL ORGANISM v8 (CRYSTAL KALEIDOSCOPE)
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
// const ctrlColor = document.getElementById('ctrlColor');
const ctrlShake = document.getElementById('ctrlShake');
const ctrlSoftness = document.getElementById('ctrlSoftness');

let audioCtx, analyser, source;
let useRealAudio = false;

// Audio Specs
const SAMPLE_RATE = 44100;
const BIN_COUNT = 2048; 
const CHROMA_BINS = 12;

// --- LOG BINS SPECS ---
const BINS = 64;
const MIN_DB = -80; 
const MAX_DB = -5;
const DECAY = 0.85; 
let logIndices = [];
let smoothedY = new Array(BINS).fill(MIN_DB);
// ----------------------

let dataArray;
let time = 0;

let energy = 0, bassEnergy = 0, midEnergy = 0, highEnergy = 0, peakEnergy = 0.01;
let chromaSmoothed = new Float32Array(CHROMA_BINS).fill(0);

// Beat Detection State
let beatTimer = 0;
let lastBass = 0;

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

function extractChroma(data) {
    const chroma = new Float32Array(12).fill(0), count = new Float32Array(12).fill(0);
    for (let i = 1; i < BIN_COUNT; i++) {
        const freq = (i / BIN_COUNT) * (44100 / 2);
        if (freq < 80 || freq > 4000) continue;
        const db = data[i]; if (db < -70) continue;
        const pc = ((Math.round(12 * Math.log2(freq / 440) + 69) % 12) + 12) % 12;
        chroma[pc] += Math.max(0, (db + 70) / 70); count[pc]++;
    }
    let mx = 0;
    for (let i = 0; i < 12; i++) { if (count[i]>0) chroma[i]/=count[i]; if (chroma[i]>mx) mx=chroma[i]; }
    if (mx > 0) for (let i = 0; i < 12; i++) chroma[i] /= mx;
    return chroma;
}

function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.01;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for(let i=0; i<dataArray.length; i++) if(!isFinite(dataArray[i])) dataArray[i] = -100;
    } else updateSimulatedFrequencies();

    const eB = getEnergy(dataArray,1,Math.floor(BIN_COUNT*0.05));
    const eM = getEnergy(dataArray,Math.floor(BIN_COUNT*0.05),Math.floor(BIN_COUNT*0.3));
    const eH = getEnergy(dataArray,Math.floor(BIN_COUNT*0.3),Math.floor(BIN_COUNT*0.7));

    // BEAT TRIGGER
    if (eB - lastBass > 0.08 && eB > 0.3) beatTimer = 1.0; 
    lastBass = eB;
    beatTimer *= 0.85; 

    bassEnergy = lerp(bassEnergy,eB,0.2); 
    midEnergy = lerp(midEnergy, eM,0.2); 
    highEnergy = lerp(highEnergy,eH,0.15);
    
    const raw = eB*0.5 + eM*0.35 + eH*0.15;
    peakEnergy = raw > peakEnergy ? raw : lerp(peakEnergy, raw, 0.001);
    energy = Math.min(1, raw / peakEnergy);

    const chroma = extractChroma(dataArray);
    for (let i=0;i<12;i++) chromaSmoothed[i]=lerp(chromaSmoothed[i],chroma[i],0.05);

    renderBackground();

// --- BEAT PUNCH (ANTI PUSING EDITION) ---
    ctx.save();
    const shakeInt = parseFloat(ctrlShake.value);
    
    // Zoom punch aja: layar nendang maju ke muka pas beat
    const scalePulse = 1 + (beatTimer * 0.8 * shakeInt) + (bassEnergy * 0.15 * shakeInt);

    // Titik tengah canvas, scale (zoom), lalu kembalikan posisinya (tanpa goyang X/Y/Rotasi)
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.scale(scalePulse, scalePulse);
    ctx.translate(-canvas.width/2, -canvas.height/2);

    // Strobe putih pas beat
    if (beatTimer > 0.8 && shakeInt > 0.5) {
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(200, 240, 255, ${beatTimer * 0.5})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Gambar kristal kaleidoskop
    renderCrystalKaleidoscope();

    ctx.restore();
}

function domHue() { return (chromaSmoothed.reduce((b,v,i)=>v>b.v?{v,i}:b,{v:0,i:0}).i / 12) * 360; }

function renderBackground() {
    ctx.globalCompositeOperation = 'source-over';
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const fbIntensity = parseFloat(ctrlFeedback.value);
    const rotSpeed = parseFloat(ctrlRotation.value);
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(0.002 * rotSpeed); 
    const s = 1.002 + (fbIntensity * 0.02) + (beatTimer * 0.01 * parseFloat(ctrlShake.value));
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();

    // Background dibikin gelap kebiruan biar vibe es/kristalnya dapet
    const clearAlpha = 1.0 - fbIntensity; 
    ctx.fillStyle = `rgba(2, 5, 10, ${clearAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ----------------------------------------------------
// FUNGSI BARU: CRYSTAL KALEIDOSCOPE
// ----------------------------------------------------
function renderCrystalKaleidoscope() {
    if (logIndices.length === 0) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    // Setup warna dasar (Icy blue/silver tapi tetep bisa geser dikit)
    // Warna muter pelan secara natural, TAPI pas ada beat warnanya langsung loncat berlawanan (invert/hue shift otomatis)
    const baseHue = (200 + domHue() * 0.2 + (time * 30) + (beatTimer * 180) + (energy * 50)) % 360;
    const rotSpeed = parseFloat(ctrlRotation.value);
    
    // Complexity ngatur jumlah lipatan simetri (mirip kaca spion di kaleidoskop)
    const slices = 4 + parseInt(ctrlComplexity.value) * 2; // 6, 8, 10, 12...
    const angleStep = (Math.PI * 2) / slices;

    const maxRadius = canvas.height * 0.6;
    const rings = 8; // Jumlah layer kedalaman kristal

    ctx.globalCompositeOperation = parseFloat(ctrlSoftness.value) > 0.5 ? 'lighten' : 'screen';

    // Kalkulasi poin-poin kristal berdasarkan audio
    let grid = [];
    for (let r = 0; r <= rings; r++) {
        let ringPoints = [];
        for (let s = 0; s <= slices; s++) {
            // Ambil data frekuensi. Makin luar ring, makin tinggi frekuensi yang diambil
            let binIndex = Math.floor((r / rings) * (BINS * 0.8));
            let rawDb = dataArray[logIndices[binIndex]];
            if (!isFinite(rawDb)) rawDb = MIN_DB;
            rawDb = Math.max(MIN_DB, Math.min(MAX_DB, rawDb));

            if (rawDb > smoothedY[binIndex]) {
                smoothedY[binIndex] = rawDb; 
            } else {
                smoothedY[binIndex] = (rawDb * (1.0 - DECAY)) + (smoothedY[binIndex] * DECAY);
            }
            const normalized = (smoothedY[binIndex] - MIN_DB) / (MAX_DB - MIN_DB);

            // Twist angle biar pecahannya miring pas ada beat
            const twist = (normalized * Math.PI * 0.2) * (r / rings);
            const angle = (s * angleStep) + (time * 0.2 * rotSpeed) + twist;
            
            // Radius menonjol tajam ngikutin beat & frekuensi
            const radDistortion = normalized * (maxRadius / rings) * (1 + beatTimer * 0.5);
            const dist = (r * (maxRadius / rings)) + radDistortion;

            ringPoints.push({
                x: cx + Math.cos(angle) * dist,
                y: cy + Math.sin(angle) * dist,
                norm: normalized
            });
        }
        grid.push(ringPoints);
    }

    // Gambar facet (poligon segitiga) dari grid yang udah dibikin
    for (let r = 0; r < rings; r++) {
        for (let s = 0; s < slices; s++) {
            const p1 = grid[r][s];
            const p2 = grid[r+1][s];
            const p3 = grid[r+1][s+1];
            const p4 = grid[r][s+1];

            // Rata-rata intensitas untuk pewarnaan
            const avgNorm = (p1.norm + p2.norm + p3.norm) / 3;
            
            // Gradasi metalik/kristal: kontras tinggi antara gelap dan terang
            const lightness = 10 + (avgNorm * 70) + (beatTimer * 30);
            const saturation = 40 + (avgNorm * 60);
            
            // Segitiga Kiri
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();
            
            let grad1 = ctx.createLinearGradient(p1.x, p1.y, p3.x, p3.y);
            grad1.addColorStop(0, `hsla(${baseHue}, ${saturation}%, ${lightness}%, ${0.5 + avgNorm})`);
            grad1.addColorStop(1, `hsla(${baseHue + 20}, ${saturation}%, ${lightness * 0.3}%, ${0.2 + avgNorm})`);
            ctx.fillStyle = grad1;
            ctx.fill();
            ctx.lineWidth = 1 + avgNorm * 2;
            ctx.strokeStyle = `hsla(${baseHue}, 100%, 80%, ${0.3 + beatTimer * 0.4})`;
            ctx.stroke();

            // Segitiga Kanan (ngebentuk efek berlian 3D)
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            
            let grad2 = ctx.createLinearGradient(p4.x, p4.y, p1.x, p1.y);
            grad2.addColorStop(0, `hsla(${baseHue - 15}, ${saturation}%, ${lightness * 1.2}%, ${0.6 + avgNorm})`);
            grad2.addColorStop(1, `hsla(${baseHue}, ${saturation}%, ${lightness * 0.5}%, ${0.3 + avgNorm})`);
            ctx.fillStyle = grad2;
            ctx.fill();
            ctx.stroke();
        }
    }

    // CORE BINTANG TAJAM DI TENGAH
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-time * 0.5 * rotSpeed);
    const starR = canvas.height * 0.05 + bassEnergy * canvas.height * 0.1;
    
    ctx.beginPath();
    for (let i = 0; i <= slices * 2; i++) {
        const angle = (i / (slices * 2)) * Math.PI * 2;
        // Bikin selang-seling panjang pendek biar ngebentuk bintang ninja
        const dist = i % 2 === 0 ? starR : starR * 0.3 * (1 + beatTimer);
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `hsla(${baseHue}, 90%, 80%, ${0.8 + beatTimer})`;
    ctx.shadowBlur = 30;
    ctx.shadowColor = `hsla(${baseHue}, 100%, 70%, 1)`;
    ctx.fill();
    ctx.restore();
}

function lerp(a,b,t){return a+(b-a)*t;}