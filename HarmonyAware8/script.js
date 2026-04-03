// ============================================================
// MARIONETTE // STRING PROTOCOL — HORROR BUILD
// ============================================================

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const controlsPanel = document.getElementById('controlsPanel');

const ctrlRings     = document.getElementById('ctrlRings'); // Now controls background string density
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
let lastSwapTime = 0;
const SWAP_COOLDOWN = 800;

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
let erraticSpike = 0;
let currentScale = 1.0;
let glitchTimer  = 0;
let chromaOffset = 0;
let spinDirection = 1;

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

// UI Toggle
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

    // Jerky snap logic
    if (eB - lastBass > 0.03 && eB > 0.08) {
        beatTimer    = 1.0;
        currentScale = 1.05 + eB * 0.15 * intensity;
        glitchTimer  = 1.0;
        chromaOffset = (Math.random() - 0.5) * 8 * intensity;
        erraticSpike = (Math.random() - 0.5) * 0.5 * intensity;
    }
    lastBass = eB;

    beatTimer    *= 0.65; // Fast decay for sharp jerks
    chromaOffset *= 0.7;
    currentScale += (1.0 - currentScale) * 0.4;
    bassEnergy   += (eB - bassEnergy) * 0.7;
    midEnergy    += (eM - midEnergy) * 0.6;
    erraticSpike *= 0.8;

    // ============================================================
    // CRITICAL FIX: PENDULUM BOUNCE
    // ============================================================
    // Calculate current velocity based on UI slider and audio spikes
    let spinVelocity = parseFloat(ctrlSpin.value) * 0.02 + (erraticSpike * 0.1);
    
    // Apply velocity in the current direction
    globalSpin += spinVelocity * spinDirection;

    // Set a hard limit to prevent the puppet from going horizontal or upside down.
    // 1.2 radians is roughly 70 degrees.
    const MAX_SWING_ANGLE = 1.2;

    if (globalSpin > MAX_SWING_ANGLE) {
        globalSpin = MAX_SWING_ANGLE;
        spinDirection = -1; // Hit the right wall, violently bounce left
    } else if (globalSpin < -MAX_SWING_ANGLE) {
        globalSpin = -MAX_SWING_ANGLE;
        spinDirection = 1;  // Hit the left wall, violently bounce right
    }
    // ============================================================

    for (let i = 0; i < BINS; i++) {
        const norm = Math.max(0, ((dataArray[logIndices[i]] || MIN_DB) - MIN_DB) / (MAX_DB - MIN_DB));
        smoothedBins[i] += (norm - smoothedBins[i]) * 0.4;
    }

    const W = canvas.width, H = canvas.height;

    // CSS hue glitch
    if (Math.abs(chromaOffset) > 0.4) {
        canvas.style.filter = `hue-rotate(${chromaOffset * 5}deg) contrast(1.2)`;
        setTimeout(() => { canvas.style.filter = 'none'; }, 40);
    }

    const shakeMag = beatTimer > 0.2 ? beatTimer * 10 * intensity : 0;
    const shakeX = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag : 0;
    const shakeY = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag : 0;

    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);

    drawDust(W, H);
    drawBackgroundStrings(W, H, intensity);

    ctx.save();
    // Anchor the marionette near the top of the screen
    ctx.translate(W / 2 + shakeX, H * 0.2 + shakeY);
    
    // The entire setup swings slightly
    const swing = Math.sin(time) * 0.1 + globalSpin;
    ctx.rotate(swing);
    ctx.scale(currentScale, currentScale);

    drawMarionette(intensity);

    ctx.restore();
    drawVignette(W, H);
}

// ============================================================
// SCENE COMPONENTS
// ============================================================

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
        // Strings vibrate based on audio bins
        const bin = smoothedBins[i % BINS] || 0;
        const vibration = Math.sin(time * 10 + i) * bin * 20 * intensity;
        
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.quadraticCurveTo(xPos + vibration, H/2, xPos, H);
        ctx.stroke();
    }
}

function drawMarionette(intensity) {
    const react = parseFloat(ctrlReact.value);
    const noise = parseFloat(ctrlNoise.value);
    const thick = parseFloat(ctrlThickness.value);
    const hole  = parseFloat(ctrlHole.value);

    // CRITICAL FIX: The X axis can jitter left/right, but the Y axis 
    // now exclusively pushes DOWN based on the bass energy to simulate a heavy drop.
    const bJerkX = (Math.random() - 0.5) * noise * beatTimer * intensity;
    const dropY  = (Math.random() * noise * 0.2 * beatTimer) + (bassEnergy * 80 * intensity);
    
    // Control Bar Math (Stays anchored at the top)
    const barWidth = 240 + smoothedBins[5] * 50 * react;
    const barY = -100;

    // Puppet Skeleton Nodes - ALL nodes now inherit the `dropY` so the whole body sinks
    const headRadius = 25 + (hole * 100);
    const headCenter = { x: bJerkX, y: 80 + dropY };
    const pelvis     = { x: bJerkX * 2, y: 220 + dropY };
    
    // Limbs react to different frequency bins, stretching DOWN and OUT
    const leftArmTwitch = smoothedBins[12] * 120 * react * intensity;
    const rightArmTwitch = smoothedBins[18] * 120 * react * intensity;
    const leftLegTwitch = smoothedBins[2] * 100 * react * intensity;
    const rightLegTwitch = smoothedBins[6] * 100 * react * intensity;

    const lElbow = { x: -60 - leftArmTwitch, y: 130 + dropY + leftArmTwitch * 0.3 };
    const lHand  = { x: -80 - leftArmTwitch * 1.5, y: 200 + dropY + leftArmTwitch * 0.8 };
    
    const rElbow = { x: 60 + rightArmTwitch, y: 130 + dropY + rightArmTwitch * 0.3 };
    const rHand  = { x: 80 + rightArmTwitch * 1.5, y: 200 + dropY + rightArmTwitch * 0.8 };

    const lKnee  = { x: -40 - leftLegTwitch, y: 320 + dropY + leftLegTwitch * 0.5 };
    const lFoot  = { x: -50 - leftLegTwitch * 0.5, y: 400 + dropY + leftLegTwitch * 1.2 };

    const rKnee  = { x: 40 + rightLegTwitch, y: 320 + dropY + rightLegTwitch * 0.5 };
    const rFoot  = { x: 50 + rightLegTwitch * 0.5, y: 400 + dropY + rightLegTwitch * 1.2 };

    // 1. Draw the Control Strings
    ctx.strokeStyle = pal.alt;
    ctx.lineWidth = thick * 0.8;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    
    // Connect bar points to puppet joints
    const drawString = (startX, targetX, targetY) => {
        ctx.moveTo(startX, barY);
        // Strings bend slightly based on the horizontal jitter
        ctx.quadraticCurveTo(startX + (targetX-startX)/2 + bJerkX, barY + (targetY-barY)/2, targetX, targetY);
    };

    drawString(-barWidth/2, lHand.x, lHand.y); // Left string to hand
    drawString(-barWidth/4, lKnee.x, lKnee.y); // Inner left string to knee
    drawString(0, headCenter.x, headCenter.y - headRadius); // Center to head
    drawString(barWidth/4, rKnee.x, rKnee.y);  // Inner right to knee
    drawString(barWidth/2, rHand.x, rHand.y);  // Right string to hand
    ctx.stroke();

    // 2. Draw Puppeteer Control Bar (The Cross)
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

    // 3. Draw The Puppet (Bone Structure)
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = thick * 2.5 + beatTimer * 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = pal.glow;
    ctx.beginPath();

    // Head
    ctx.arc(headCenter.x, headCenter.y, headRadius, 0, Math.PI * 2);
    
    // Spine
    ctx.moveTo(headCenter.x, headCenter.y + headRadius);
    ctx.lineTo(pelvis.x, pelvis.y);

    // Arms
    ctx.moveTo(headCenter.x, headCenter.y + headRadius + 10);
    ctx.lineTo(lElbow.x, lElbow.y);
    ctx.lineTo(lHand.x, lHand.y);

    ctx.moveTo(headCenter.x, headCenter.y + headRadius + 10);
    ctx.lineTo(rElbow.x, rElbow.y);
    ctx.lineTo(rHand.x, rHand.y);

    // Legs
    ctx.moveTo(pelvis.x, pelvis.y);
    ctx.lineTo(lKnee.x, lKnee.y);
    ctx.lineTo(lFoot.x, lFoot.y);

    ctx.moveTo(pelvis.x, pelvis.y);
    ctx.lineTo(rKnee.x, rKnee.y);
    ctx.lineTo(rFoot.x, rFoot.y);

    ctx.stroke();
    ctx.shadowBlur = 0; // reset
}

function drawVignette(W, H) {
    const gradient = ctx.createRadialGradient(W/2, H/2, H*0.4, W/2, H/2, H*0.8);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
}