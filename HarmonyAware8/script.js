// ============================================================
// MARIONETTE // STRING PROTOCOL — ABOMINATION PHYSICS BUILD
// ============================================================

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const controlsPanel = document.getElementById('controlsPanel');

const ctrlRings     = document.getElementById('ctrlRings');
const ctrlReact     = document.getElementById('ctrlReact');
const ctrlNoise     = document.getElementById('ctrlNoise');
const ctrlSpin      = document.getElementById('ctrlSpin');
const ctrlHole      = document.getElementById('ctrlHole');
const ctrlThickness = document.getElementById('ctrlThickness');
const ctrlIntensity = document.getElementById('ctrlIntensity');

const PALETTES = {
    blood:  { bg: '#050000', primary: '#8a0303', fg: '#ff1a1a', alt: '#4a0000', glow: 'rgba(138,3,3,0.5)' },
    asylum: { bg: '#080808', primary: '#e3dac9', fg: '#8a0303', alt: '#333333', glow: 'rgba(227,218,201,0.3)' },
    rust:   { bg: '#0a0500', primary: '#5e5a19', fg: '#8a0303', alt: '#b54504', glow: 'rgba(94,90,25,0.4)' },
    ghost:  { bg: '#000000', primary: '#4a5c66', fg: '#e3dac9', alt: '#112233', glow: 'rgba(74,92,102,0.4)' }
};

let currentPaletteKey = 'blood';
let pal = PALETTES[currentPaletteKey];

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentPaletteKey = e.target.dataset.preset;
        pal = PALETTES[currentPaletteKey];
    });
});

let audioCtx, analyser, source;
let useRealAudio = false;
const BIN_COUNT = 1024;
const BINS = 64;
const MIN_DB = -90, MAX_DB = -10;
let logIndices = [];
let dataArray;
let time = 0;
let smoothedBins = new Float32Array(BINS).fill(0);

let beatTimer    = 0;
let lastBass     = 0;
let bassEnergy   = 0;
let midEnergy    = 0;
let globalSpin   = 0;
let spinDirection = 1;
let erraticSpike = 0;
let currentScale = 1.0;
let chromaOffset = 0;

let abominationPaths = [];
let erraticPhase = 0;
let erraticPetal = 0;

// Dust Particles
const PARTICLE_COUNT = 40;
let bgParticles = [];
for (let i = 0; i < PARTICLE_COUNT; i++) {
    bgParticles.push({
        x: (Math.random() - 0.5) * 1200,
        y: (Math.random() - 0.5) * 1200,
        size: 1 + Math.random() * 2,
        speedY: -(0.5 + Math.random() * 1.5)
    });
}

// ============================================================
// VERLET PHYSICS ENGINE (APPENDAGES & CORE)
// ============================================================
const points = [];
const sticks = [];
const GRAVITY = 0.9;
const FRICTION = 0.92;

function addPoint(x, y) {
    const p = { x, y, oldx: x, oldy: y };
    points.push(p);
    return p;
}

function addStick(p1, p2, length) {
    sticks.push({ p1, p2, len: length || Math.hypot(p2.x - p1.x, p2.y - p1.y) });
}

// The Skeleton: A massive central core, with 3 dangling physical tentacles
const monster = {
    core: addPoint(0, 80),
    
    // Left Tentacle
    l1: addPoint(-30, 130), l2: addPoint(-40, 180), l3: addPoint(-50, 240),
    
    // Center Tentacle (Longest)
    c1: addPoint(0, 140), c2: addPoint(0, 200), c3: addPoint(0, 280), c4: addPoint(0, 360),
    
    // Right Tentacle
    r1: addPoint(30, 130), r2: addPoint(40, 180), r3: addPoint(50, 240)
};

// Bind tentacles to the core
addStick(monster.core, monster.l1, 50); addStick(monster.l1, monster.l2, 50); addStick(monster.l2, monster.l3, 60);
addStick(monster.core, monster.c1, 60); addStick(monster.c1, monster.c2, 60); addStick(monster.c2, monster.c3, 80); addStick(monster.c3, monster.c4, 80);
addStick(monster.core, monster.r1, 50); addStick(monster.r1, monster.r2, 50); addStick(monster.r2, monster.r3, 60);

// ============================================================

function resizeCanvas() {
    canvas.width  = window.innerWidth; 
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
        const idx = freqs.findIndex(f => f >= targetFreq);
        logIndices.push(idx === -1 ? freqs.length - 1 : idx);
    }
}

function updateSimulatedFrequencies() {
    for (let i = 0; i < BIN_COUNT; i++) dataArray[i] = -100 + Math.random() * 5;
    const t = time * 0.5;
    const addPeak = (s, e, a) => { for (let i = s; i < e; i++) if (-100 + a > dataArray[i]) dataArray[i] = -100 + a; };
    if (Math.sin(t * 8) > 0.8) addPeak(1, 5, 80);
    addPeak(10, 15, 60 + Math.sin(t * 2) * 20);
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += Math.max(0, (data[i] - MIN_DB) / (MAX_DB - MIN_DB));
    return sum / Math.max(1, to - from);
}

const toggleUIBtn = document.createElement('button');
toggleUIBtn.id = 'toggleUIBtn';
toggleUIBtn.innerText = '[ HIDE UI ]';
toggleUIBtn.style.cssText = "position:fixed;top:10px;right:10px;z-index:9999;padding:6px 12px;font-family:'Courier Prime',monospace;font-size:10px;background:rgba(0,0,0,0.7);color:#8a0303;border:1px solid #8a0303;cursor:pointer;";
document.body.appendChild(toggleUIBtn);
toggleUIBtn.addEventListener('click', () => {
    controlsPanel.classList.toggle('hidden');
    toggleUIBtn.innerText = controlsPanel.classList.contains('hidden') ? '[ SHOW UI ]' : '[ HIDE UI ]';
});

// ============================================================
// RENDER LOOP
// ============================================================
function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.01;

    if (useRealAudio && analyser) {
        analyser.getFloatFrequencyData(dataArray);
        for (let i = 0; i < dataArray.length; i++) if (!isFinite(dataArray[i])) dataArray[i] = MIN_DB;
    } else {
        updateSimulatedFrequencies();
    }

    const eB = getEnergy(dataArray, 1, Math.floor(BIN_COUNT * 0.05));
    const eM = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.05), Math.floor(BIN_COUNT * 0.3));
    const intensity = parseFloat(ctrlIntensity.value);

    // Violent Physics Snaps
    if (eB - lastBass > 0.03 && eB > 0.08) {
        beatTimer    = 1.0;
        currentScale = 1.05 + eB * 0.2 * intensity;
        chromaOffset = (Math.random() - 0.5) * 8 * intensity;
        erraticSpike = (Math.random() - 0.5) * 0.8 * intensity;
        
        erraticPhase = (Math.random() * Math.PI * 4) * intensity;
        erraticPetal = Math.floor((Math.random() - 0.5) * 12 * intensity);

        // PHYSICS YANK: Drop the heavy core downwards
        monster.core.y += eB * 100 * intensity;
        
        // Thrash the tentacles
        monster.l3.x += (Math.random() - 0.5) * 60 * intensity;
        monster.r3.x += (Math.random() - 0.5) * 60 * intensity;
        monster.c4.x += (Math.random() - 0.5) * 80 * intensity;
    }
    lastBass = eB;

    beatTimer    *= 0.65; 
    chromaOffset *= 0.7;
    currentScale += (1.0 - currentScale) * 0.4;
    bassEnergy   += (eB - bassEnergy) * 0.7;
    midEnergy    += (eM - midEnergy) * 0.6;
    erraticSpike *= 0.8;
    erraticPhase *= 0.9;
    erraticPetal *= 0.9;

    // Pendulum Swing Logic
    let spinVelocity = parseFloat(ctrlSpin.value) * 0.02 + (erraticSpike * 0.1);
    globalSpin += spinVelocity * spinDirection;
    const MAX_SWING_ANGLE = 1.0;

    if (globalSpin > MAX_SWING_ANGLE) {
        globalSpin = MAX_SWING_ANGLE;
        spinDirection = -1;
    } else if (globalSpin < -MAX_SWING_ANGLE) {
        globalSpin = -MAX_SWING_ANGLE;
        spinDirection = 1;
    }

    for (let i = 0; i < BINS; i++) {
        const norm = Math.max(0, ((dataArray[logIndices[i]] || MIN_DB) - MIN_DB) / (MAX_DB - MIN_DB));
        smoothedBins[i] += (norm - smoothedBins[i]) * 0.4;
    }

    const W = canvas.width, H = canvas.height;

    if (Math.abs(chromaOffset) > 0.4) {
        canvas.style.filter = `hue-rotate(${chromaOffset * 5}deg) contrast(1.3) saturate(1.2)`;
        setTimeout(() => { canvas.style.filter = 'none'; }, 40);
    }

    const shakeMag = beatTimer > 0.2 ? beatTimer * 12 * intensity : 0;
    const shakeX = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag : 0;
    const shakeY = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag : 0;

    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);

    drawDust(W, H);
    drawBackgroundStrings(W, H, intensity);

    ctx.save();
    ctx.translate(W / 2 + shakeX, H * 0.15 + shakeY);
    
    const swing = Math.sin(time) * 0.1 + globalSpin;
    ctx.rotate(swing);
    ctx.scale(currentScale, currentScale);

    processRagdollPhysics(intensity);
    drawEntity(intensity);

    ctx.restore();
    drawVignette(W, H);
}

// ============================================================
// SCENE & PHYSICS COMPONENTS
// ============================================================

function processRagdollPhysics(intensity) {
    const react = parseFloat(ctrlReact.value);
    const noise = parseFloat(ctrlNoise.value);
    
    // 1. Apply Gravity and Momentum
    for (let p of points) {
        let vx = (p.x - p.oldx) * FRICTION;
        let vy = (p.y - p.oldy) * FRICTION;
        p.oldx = p.x;
        p.oldy = p.y;
        p.x += vx;
        p.y += vy + GRAVITY; 
    }

    // 2. Control Strings (Pulling the heavy core back up to the crossbar)
    const barY = -50;
    const bJerkX = (Math.random() - 0.5) * noise * beatTimer * intensity * 5;

    // The main string pulls the core back to its resting spot
    monster.core.x += (bJerkX - monster.core.x) * 0.2;
    monster.core.y += ((barY + 140) - monster.core.y) * 0.15; // Spring back up after dropping

    // Inject audio jitter directly into tentacles
    monster.l3.x += (Math.random() - 0.5) * smoothedBins[2] * react * intensity * 15;
    monster.r3.x += (Math.random() - 0.5) * smoothedBins[6] * react * intensity * 15;

    // 3. Resolve Constraints (Stick lengths)
    for (let i = 0; i < 5; i++) {
        for (let s of sticks) {
            let dx = s.p2.x - s.p1.x;
            let dy = s.p2.y - s.p1.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) continue; 
            let difference = s.len - dist;
            let percent = (difference / dist) / 2;
            let offsetX = dx * percent;
            let offsetY = dy * percent;

            s.p1.x -= offsetX; s.p1.y -= offsetY;
            s.p2.x += offsetX; s.p2.y += offsetY;
        }
    }
}

function buildAbominationPaths(intensity) {
    const reactAmp  = parseFloat(ctrlReact.value);
    const noiseAmp  = parseFloat(ctrlNoise.value) / 25;
    const holeSize  = parseFloat(ctrlHole.value);
    const lineThick = parseFloat(ctrlThickness.value);
    const maxRadius = Math.min(canvas.width, canvas.height) * 0.12;

    abominationPaths = [];
    const resolution = 80; // Lower resolution for sharper, creepier angles

    function buildLayer(layerRadius, layerAmp, basePetals, phaseMult, alpha, audioStart, audioEnd, color) {
        const petals = Math.max(1, basePetals + Math.round(erraticPetal));
        const pts = new Float32Array((resolution + 1) * 2);
        const rBase = holeSize * maxRadius + layerRadius;
        const phase = phaseMult + erraticPhase;

        for (let j = 0; j <= resolution; j++) {
            const t = (j / resolution) * Math.PI * 2;
            const angle = t + (time * 0.5);
            const binIdx = Math.floor(audioStart + (audioEnd - audioStart) * Math.sin((j / resolution) * Math.PI));
            const audio = smoothedBins[binIdx] || 0;
            
            // Sharp, erratic wave equation
            const wave = Math.abs(Math.sin((petals * t + phase) / 2)) * 2 - 1;
            const amp = layerAmp * noiseAmp + audio * maxRadius * 0.6 * reactAmp * (1 + intensity);
            const r = rBase + amp * wave;
            
            pts[j * 2]     = r * Math.cos(angle);
            pts[j * 2 + 1] = r * Math.sin(angle);
        }
        abominationPaths.push({ pts, color, alpha, lineWidth: lineThick + beatTimer * intensity * 2 });
    }

    // Three layers of jagged geometric horror
    buildLayer(maxRadius * 0.9, maxRadius * 0.4, 6, Math.PI, 0.9, 0, 10, pal.primary);
    buildLayer(maxRadius * 0.5, maxRadius * 0.3, 12, Math.PI * 2, 0.85, 10, 30, pal.fg);
    buildLayer(maxRadius * 0.2, maxRadius * 0.1, 18, Math.PI * 4, 0.95, 30, 60, pal.alt);
}

function drawEntity(intensity) {
    const thick = parseFloat(ctrlThickness.value);
    const react = parseFloat(ctrlReact.value);
    
    const barWidth = 240 + smoothedBins[5] * 50 * react;
    const barY = -50;

    // 1. Draw Control Bar
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = pal.fg;
    ctx.lineWidth = thick * 3;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(-barWidth/2 - 20, barY);
    ctx.lineTo(barWidth/2 + 20, barY);
    ctx.moveTo(0, barY - 40);
    ctx.lineTo(0, barY + 40);
    ctx.stroke();

    // 2. Draw Main Strings attaching to the Core
    ctx.strokeStyle = pal.alt;
    ctx.lineWidth = thick * 0.8;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(-barWidth/3, barY); ctx.lineTo(monster.core.x - 20, monster.core.y - 20);
    ctx.moveTo(barWidth/3, barY); ctx.lineTo(monster.core.x + 20, monster.core.y - 20);
    ctx.moveTo(0, barY); ctx.lineTo(monster.core.x, monster.core.y - 40);
    ctx.stroke();

    // 3. Draw Dangling Appendages (Physics Tentacles)
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = thick * 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (let s of sticks) {
        ctx.moveTo(s.p1.x, s.p1.y);
        ctx.lineTo(s.p2.x, s.p2.y);
    }
    ctx.stroke();

    // 4. Draw the Abomination Body over the Core
    ctx.save();
    // Move the canvas origin to wherever the physics engine put the core
    ctx.translate(monster.core.x, monster.core.y);
    
    buildAbominationPaths(intensity);
    
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 8;
    ctx.shadowBlur = 10;
    ctx.shadowColor = pal.glow;

    for (const p of abominationPaths) {
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth   = p.lineWidth;
        ctx.beginPath();
        const pts = p.pts;
        ctx.moveTo(pts[0], pts[1]);
        for (let j = 2; j < pts.length; j += 2) ctx.lineTo(pts[j], pts[j + 1]);
        ctx.closePath();
        ctx.stroke();
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawDust(W, H) {
    ctx.fillStyle = pal.fg;
    for (let p of bgParticles) {
        p.y += p.speedY;
        if (p.y < 0) { p.y = H; p.x = (Math.random() - 0.5) * W * 1.5 + W/2; }
        ctx.globalAlpha = Math.random() * 0.3 * bassEnergy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
    }
}

function drawBackgroundStrings(W, H, intensity) {
    const stringCount = parseInt(ctrlRings.value);
    ctx.strokeStyle = pal.primary;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 1;

    for(let i=0; i<stringCount; i++) {
        const xPos = (i / stringCount) * W;
        const bin = smoothedBins[i % BINS] || 0;
        const vibration = Math.sin(time * 10 + i) * bin * 20 * intensity;
        
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.quadraticCurveTo(xPos + vibration, H/2, xPos, H);
        ctx.stroke();
    }
}

function drawVignette(W, H) {
    const gradient = ctx.createRadialGradient(W/2, H/2, H*0.4, W/2, H/2, H*0.8);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
}