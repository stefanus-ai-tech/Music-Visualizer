// ============================================================
// N3 — LIVING AUDIOVISUAL ORGANISM v2 (AUTONOMOUS)
// Semi-random simulated spectral engine, harmony-aware
// ============================================================

const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const stateName = document.getElementById('stateName');

// Simulated Audio Constants
const SAMPLE_RATE = 44100;
const BIN_COUNT = 2048; 
const CHROMA_BINS = 12;

const STATES = {
    SILENCE:    'silence',
    HARMONY:    'harmony',
    EXTENSION:  'extension',
    DISSONANCE: 'dissonance',
    TRITONE:    'tritone',
    CLUSTER:    'cluster',
    TENSION:    'tension',
    RESOLUTION: 'resolution',
};

let dataArray;
let time = 0;
let currentState = STATES.SILENCE;
let prevState = STATES.SILENCE;
let stateAge = 0;

let energy = 0;
let bassEnergy = 0;
let midEnergy = 0;
let highEnergy = 0;
let peakEnergy = 0.01;
let chromaSmoothed = new Float32Array(CHROMA_BINS).fill(0);
let dissonanceScore = 0;
let harmonicScore = 0;
let tensionLevel = 0;
let colorSaturation = 0;
let stateTransitionProgress = 1.0;

let particles = [];
let hexGrid = [];
let veins = [];
let bloomParticles = [];

// Handle resizing beautifully
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initHexGrid(); // Rebuild grid on resize
}
window.addEventListener('resize', resizeCanvas);

// ============================================================
// INITIALIZATION
// ============================================================
startBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    resizeCanvas();
    dataArray = new Float32Array(BIN_COUNT);
    initParticles();
    initHexGrid();
    requestAnimationFrame(renderLoop);
});

// ============================================================
// SIMULATED SPECTRAL ENGINE
// Generates semi-random drifting frequency data to feed the brain
// ============================================================
function updateSimulatedFrequencies() {
    // 1. Fill with base noise floor (-100dB to -95dB)
    for (let i = 0; i < BIN_COUNT; i++) {
        dataArray[i] = -100 + Math.random() * 5;
    }

    // Helper to draw a "bump" in the frequency spectrum
    const addPeak = (freq, widthBins, ampDb) => {
        const centerBin = (freq / (SAMPLE_RATE / 2)) * BIN_COUNT;
        const start = Math.max(0, Math.floor(centerBin - widthBins * 3));
        const end = Math.min(BIN_COUNT, Math.ceil(centerBin + widthBins * 3));
        
        for (let i = start; i < end; i++) {
            const dist = Math.abs(i - centerBin);
            const bump = ampDb * Math.exp(-(dist * dist) / (widthBins * widthBins));
            // Additive blending for overlapping frequencies
            if (-100 + bump > dataArray[i]) {
                dataArray[i] = -100 + bump;
            }
        }
    };

    const t = time * 0.4; // Global progression speed

    // 2. Rhythmic Bass
    const bassAmp = 75 + Math.sin(t * 8) * 20; 
    addPeak(60, 2, bassAmp);

    // 3. Drifting Root Note (approx A3 to C4)
    const rootFreq = 220 + Math.sin(t * 0.15) * 40;
    addPeak(rootFreq, 3, 90 + Math.sin(t * 2)*10);

    // 4. Sweeping Intervals (Creates Harmony vs Dissonance organically)
    // First sweeping voice
    const interval1 = 1.2 + Math.sin(t * 0.3) * 0.35; // Sweeps 0.85 -> 1.55
    addPeak(rootFreq * interval1, 4, 85 + Math.cos(t * 1.5) * 10);

    // Second sweeping voice
    const interval2 = 1.45 + Math.cos(t * 0.22) * 0.4; // Sweeps 1.05 -> 1.85
    addPeak(rootFreq * interval2, 4, 80 + Math.sin(t * 0.9) * 15);

    // Occasional high harmonic
    const interval3 = 2.0 + Math.sin(t * 0.1) * 0.5;
    addPeak(rootFreq * interval3, 5, 75);

    // 5. Tension / Cluster Spikes (Randomly forces dense, clashing notes)
    // Math.sin creates waves; max() clips the bottom to only trigger occasionally
    const clusterTrigger = Math.max(0, Math.sin(t * 0.45) - 0.75) * 4; 
    if (clusterTrigger > 0) {
        addPeak(rootFreq * 1.05, 2, 85 * clusterTrigger);
        addPeak(rootFreq * 1.10, 2, 85 * clusterTrigger);
        addPeak(rootFreq * 1.15, 2, 85 * clusterTrigger);
    }

    // 6. High Shimmer
    addPeak(3500 + Math.sin(t * 2.5) * 1000, 10, 65 + Math.random() * 10);
}

// ============================================================
// AUDIO ANALYSIS (Now running on Simulated Data)
// ============================================================
function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) {
        const db = data[i];
        if (!isFinite(db)) continue;
        sum += Math.max(0, (db + 100) / 100);
    }
    return sum / (to - from);
}

function extractChroma(data) {
    const chroma = new Float32Array(12).fill(0);
    const count  = new Float32Array(12).fill(0);
    for (let i = 1; i < BIN_COUNT; i++) {
        const freq = (i / BIN_COUNT) * (SAMPLE_RATE / 2);
        if (freq < 80 || freq > 4000) continue;
        const db = data[i];
        if (!isFinite(db) || db < -70) continue;
        const midi = 12 * Math.log2(freq / 440) + 69;
        const pc = ((Math.round(midi) % 12) + 12) % 12;
        const lin = Math.max(0, (db + 70) / 70);
        chroma[pc] += lin; count[pc]++;
    }
    let mx = 0;
    for (let i = 0; i < 12; i++) { if (count[i]>0) chroma[i]/=count[i]; if (chroma[i]>mx) mx=chroma[i]; }
    if (mx > 0) for (let i = 0; i < 12; i++) chroma[i] /= mx;
    return chroma;
}

const CONSONANT = [0,3,4,5,7,8,9];
const DISSONANT  = [1,2,10,11];

function analyzeHarmony(chroma) {
    let consonance=0, dissonance=0, tritone=0, activeNotes=0;
    let mx=0, root=0;
    for (let i=0;i<12;i++) { if(chroma[i]>mx){mx=chroma[i];root=i;} if(chroma[i]>0.25) activeNotes++; }
    for (let i=0;i<12;i++) {
        if (i===root||chroma[i]<0.15) continue;
        const iv = Math.abs(i-root)%12;
        if (iv===6) tritone+=chroma[i];
        else if (DISSONANT.includes(iv)) dissonance+=chroma[i];
        else if (CONSONANT.includes(iv)) consonance+=chroma[i];
    }
    let clusterScore=0;
    for (let i=0;i<12;i++) if(chroma[i]>0.3&&chroma[(i+1)%12]>0.3&&chroma[(i+2)%12]>0.3) clusterScore++;
    return { consonance, dissonance, tritone, activeNotes, clusterScore: clusterScore/3,
             isExtension: activeNotes>=4 && consonance>dissonance };
}

function determineState(h, e) {
    if (e < 0.08) return STATES.SILENCE;
    const tot = h.consonance+h.dissonance+h.tritone+0.001;
    const dR = (h.dissonance+h.tritone)/tot;
    const cR = h.consonance/tot;
    const tR = h.tritone/tot;
    if (h.clusterScore>0.4)     return STATES.CLUSTER;
    if (tR>0.35)                return STATES.TRITONE;
    if (dR>0.5) return tensionLevel>0.5 ? STATES.TENSION : STATES.DISSONANCE;
    if (prevState===STATES.TENSION && cR>0.4) return STATES.RESOLUTION;
    if (h.isExtension && cR>0.35) return STATES.EXTENSION;
    if (cR>0.25 || e>0.2)       return STATES.HARMONY;
    return STATES.SILENCE;
}

// ============================================================
// RENDER LOOP
// ============================================================
function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.01; stateAge++;

    // Generate simulated frequency peaks instead of asking the microphone
    updateSimulatedFrequencies();

    const bassEnd = Math.floor(BIN_COUNT*0.05);
    const midEnd  = Math.floor(BIN_COUNT*0.3);

    const rB = getEnergy(dataArray,1,bassEnd);
    const rM = getEnergy(dataArray,bassEnd,midEnd);
    const rH = getEnergy(dataArray,midEnd,Math.floor(BIN_COUNT*0.7));

    bassEnergy = lerp(bassEnergy,rB,0.2);
    midEnergy  = lerp(midEnergy, rM,0.2);
    highEnergy = lerp(highEnergy,rH,0.15);

    const raw = rB*0.5 + rM*0.35 + rH*0.15;
    if (raw > peakEnergy) peakEnergy = raw;
    else peakEnergy = lerp(peakEnergy, raw, 0.001);
    energy = Math.min(1, raw / peakEnergy);

    const chroma = extractChroma(dataArray);
    for (let i=0;i<12;i++) chromaSmoothed[i]=lerp(chromaSmoothed[i],chroma[i],0.12);

    const harmony = analyzeHarmony(chromaSmoothed);
    const tot = harmony.consonance+harmony.dissonance+harmony.tritone+0.001;
    dissonanceScore = lerp(dissonanceScore,(harmony.dissonance+harmony.tritone)/tot,0.1);
    harmonicScore   = lerp(harmonicScore,  harmony.consonance/tot,0.1);

    const ns = determineState(harmony, energy);
    if (ns !== currentState) {
        prevState = currentState; currentState = ns; stateAge=0; stateTransitionProgress=0;
        if (ns===STATES.RESOLUTION) triggerBloom();
        if (ns===STATES.TENSION)    initVeins();
    }
    stateTransitionProgress = Math.min(1, stateTransitionProgress+0.025);

    if ([STATES.TENSION,STATES.DISSONANCE].includes(currentState)) tensionLevel=Math.min(1,tensionLevel+0.008);
    else tensionLevel=Math.max(0,tensionLevel-0.015);

    if ([STATES.HARMONY,STATES.EXTENSION,STATES.RESOLUTION].includes(currentState)) colorSaturation=Math.min(1,colorSaturation+0.025);
    else if ([STATES.DISSONANCE,STATES.CLUSTER].includes(currentState)) colorSaturation=Math.max(0,colorSaturation-0.04);

    stateName.textContent = `STATE: [ ${currentState.toUpperCase()} ]   ENERGY: ${energy.toFixed(2)}`;

    renderBackground();
    switch(currentState) {
        case STATES.HARMONY:    renderHarmony();    break;
        case STATES.EXTENSION:  renderExtension();  break;
        case STATES.DISSONANCE: renderDissonance(); break;
        case STATES.TRITONE:    renderTritone();    break;
        case STATES.CLUSTER:    renderCluster();    break;
        case STATES.TENSION:    renderTension();    break;
        case STATES.RESOLUTION: renderResolution(); break;
        case STATES.SILENCE:    renderSilence();    break;
    }
    renderBloom();
    renderParticles();
}

// ============================================================
// BACKGROUND
// ============================================================
function renderBackground() {
    ctx.globalCompositeOperation = 'source-over';
    let alpha;
    if ([STATES.DISSONANCE,STATES.CLUSTER].includes(currentState)) alpha=0.35;
    else if (currentState===STATES.TENSION)  alpha=0.10+tensionLevel*0.08;
    else if ([STATES.HARMONY,STATES.EXTENSION].includes(currentState)) alpha=0.04;
    else if (currentState===STATES.RESOLUTION) alpha=0.03;
    else alpha=0.14;
    const d = currentState===STATES.TENSION ? Math.floor(tensionLevel*8) : 2;
    ctx.fillStyle=`rgba(${d},${d},${d+3},${alpha})`;
    ctx.fillRect(0,0,canvas.width,canvas.height);
}

// ============================================================
// HARMONY
// ============================================================
function domHue() {
    const idx = chromaSmoothed.reduce((b,v,i)=>v>b.v?{v,i}:b,{v:0,i:0}).i;
    return (idx/12)*360;
}

function paintBlob(cx, cy, radius, hue, sat, lit, alpha) {
    const g = ctx.createRadialGradient(cx,cy,0, cx,cy,radius);
    g.addColorStop(0,   `hsla(${hue%360},${sat}%,${lit}%,${alpha})`);
    g.addColorStop(0.35,`hsla(${(hue+25)%360},${sat-10}%,${lit-8}%,${alpha*0.6})`);
    g.addColorStop(0.7, `hsla(${(hue+55)%360},${sat-20}%,${lit-15}%,${alpha*0.25})`);
    g.addColorStop(1,   `hsla(${(hue+80)%360},${sat-30}%,${lit-20}%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);
}

function renderHarmony() {
    ctx.globalCompositeOperation = 'screen';
    const cx = canvas.width/2, cy = canvas.height/2;
    const bh = domHue();
    const e2 = 0.3 + energy * 0.7; 

    for (let l = 0; l < 3; l++) {
        const t = time * (0.12 + l*0.06);
        const hue = (bh + l*70 + time*6) % 360;
        const ox = Math.sin(t*0.5 + l*2.1) * canvas.width  * 0.25;
        const oy = Math.cos(t*0.4 + l*1.7) * canvas.height * 0.18;
        const rad = canvas.height * (0.55 + l*0.15) * e2;
        paintBlob(cx+ox, cy+oy, rad, hue, 70, 48, 0.18 + energy*0.12);
    }

    for (let l = 0; l < 5; l++) {
        const t = time * (0.2 + l*0.07);
        const hue = (bh + l*44 + time*10) % 360;
        const breathe = 1 + Math.sin(t + l*1.3)*0.18 + bassEnergy*1.2;
        const rad = (canvas.height*0.14 + l*canvas.height*0.07) * breathe * e2;
        const ox = Math.sin(t*0.55 + l*1.05) * canvas.width  * 0.2;
        const oy = Math.cos(t*0.38 + l*0.85) * canvas.height * 0.14;
        paintBlob(cx+ox, cy*0.9+oy, rad, hue, 82, 62, 0.28 + energy*0.22);
    }

    for (let l = 0; l < 3; l++) {
        const t = time * (0.5 + l*0.15);
        const hue = (bh + l*120 + time*18) % 360;
        const rad = canvas.height * 0.06 * (1 + highEnergy*3) * e2;
        const ox = Math.sin(t*1.1 + l*2.0) * canvas.width  * 0.28;
        const oy = Math.cos(t*0.9 + l*1.6) * canvas.height * 0.3;
        paintBlob(cx+ox, cy+oy, rad, hue, 90, 75, 0.4 + energy*0.3);
    }

    {
        const pulse = 1 + Math.sin(time*1.8)*0.1 + bassEnergy*0.6;
        const fRad = canvas.height * 0.22 * pulse * e2;
        const fHue = 230 + Math.sin(time*0.4)*30; 
        paintBlob(cx + Math.sin(time*0.3)*40, cy*0.95 + Math.cos(time*0.22)*30,
                  fRad, fHue, 65, 55, 0.22 + energy*0.18);
    }

    renderMountainHorizon(harmonicScore*0.7 + 0.3);
    renderAurora();
}

function renderAurora() {
    ctx.globalCompositeOperation = 'screen';
    const bh = domHue();
    const bandCount = 4;
    for (let b = 0; b < bandCount; b++) {
        const yBase = canvas.height * (0.25 + b*0.14 + Math.sin(time*0.18+b)*0.04);
        const height = canvas.height * (0.06 + b*0.02) * (0.5 + energy*0.8);
        const hue = (bh + b*50 + time*8) % 360;
        const alpha = (0.06 + energy*0.08) * (1 - b*0.18);

        const g = ctx.createLinearGradient(0, yBase-height, 0, yBase+height);
        g.addColorStop(0,   'transparent');
        g.addColorStop(0.3, `hsla(${hue},80%,65%,${alpha})`);
        g.addColorStop(0.5, `hsla(${(hue+35)%360},85%,70%,${alpha*1.4})`);
        g.addColorStop(0.7, `hsla(${(hue+70)%360},75%,55%,${alpha})`);
        g.addColorStop(1,   'transparent');

        ctx.beginPath();
        ctx.moveTo(0, yBase + height);
        const segs = 40;
        for (let i = 0; i <= segs; i++) {
            const x = (i/segs) * canvas.width;
            const wave = Math.sin(i*0.3 + time*(0.4+b*0.1) + b*2) * height * 0.6;
            ctx.lineTo(x, yBase - height*0.5 + wave);
        }
        ctx.lineTo(canvas.width, yBase + height);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
    }
}

function renderMountainHorizon(strength) {
    ctx.globalCompositeOperation = 'screen';
    const hy = canvas.height*0.64, segs = 80, w = canvas.width/segs;
    const hue = domHue();

    ctx.beginPath(); ctx.moveTo(0, canvas.height);
    for (let i=0;i<=segs;i++) {
        const x=i*w;
        const h1=Math.sin(i*0.09+time*0.12)*canvas.height*0.10;
        const h2=Math.sin(i*0.05+time*0.08+3)*canvas.height*0.06;
        ctx.lineTo(x, hy-(h1+h2)*strength*(0.5+energy*0.5));
    }
    ctx.lineTo(canvas.width,canvas.height); ctx.closePath();
    const g1=ctx.createLinearGradient(0,hy-canvas.height*0.15,0,canvas.height);
    g1.addColorStop(0,`hsla(${(hue+40)%360},55%,38%,${0.14+energy*0.12})`);
    g1.addColorStop(1,`hsla(${(hue+40)%360},35%,12%,0.02)`);
    ctx.fillStyle=g1; ctx.fill();

    ctx.beginPath(); ctx.moveTo(0, canvas.height);
    for (let i=0;i<=segs;i++) {
        const x=i*w;
        const h1=Math.sin(i*0.14+time*0.22)*canvas.height*0.13;
        const h2=Math.sin(i*0.07+time*0.16+1.5)*canvas.height*0.07;
        const h3=Math.sin(i*0.3+time*0.35+0.8)*canvas.height*0.025;
        ctx.lineTo(x, (hy+canvas.height*0.04)-(h1+h2+h3)*strength*(0.6+energy*0.7));
    }
    ctx.lineTo(canvas.width,canvas.height); ctx.closePath();
    const g2=ctx.createLinearGradient(0,hy,0,canvas.height);
    g2.addColorStop(0,`hsla(${hue},70%,42%,${0.22+energy*0.18})`);
    g2.addColorStop(0.5,`hsla(${hue},50%,22%,0.1)`);
    g2.addColorStop(1,`hsla(${hue},30%,8%,0.02)`);
    ctx.fillStyle=g2; ctx.fill();
}

function renderExtension() {
    renderHarmony();
    ctx.globalCompositeOperation = 'screen';
    const cx=canvas.width/2, cy=canvas.height*0.4;

    for (let i=0;i<6;i++) {
        const hue=(domHue()+i*35+time*8)%360;
        const t=time*(0.3+i*0.07);
        const rad=canvas.width*(0.3+i*0.1)*(0.6+energy*1.0);
        const ox=Math.sin(t*0.4+i*1.2)*canvas.width*0.18;
        const oy=Math.cos(t*0.3+i*1.0)*canvas.height*0.12;
        paintBlob(cx+ox, cy+oy, rad, hue, 88, 68, 0.16 + energy*0.16);
    }

    ctx.globalCompositeOperation = 'overlay';
    for (let i=0;i<3;i++) {
        const hue=(domHue()+i*80+time*12)%360;
        const rad=canvas.width*(0.2+i*0.08)*(0.5+midEnergy*1.5);
        const ox=Math.sin(time*0.6+i*2)*canvas.width*0.12;
        paintBlob(cx+ox, cy, rad, hue, 70, 80, 0.08+energy*0.08);
    }
    ctx.globalCompositeOperation = 'screen';
}

// ============================================================
// DISSONANCE & OTHERS
// ============================================================
function renderDissonance() {
    ctx.globalCompositeOperation='source-over';
    const n=Math.floor(20+dissonanceScore*50+energy*60);
    for (let i=0;i<n;i++) {
        const x1=Math.random()*canvas.width, y1=Math.random()*canvas.height;
        const a=Math.random()*Math.PI*2;
        const len=30+Math.random()*220*(0.4+energy*0.8);
        const x2=x1+Math.cos(a)*len, y2=y1+Math.sin(a)*len;
        const bri=100+Math.random()*155;
        ctx.strokeStyle=`rgba(${bri},${bri},${bri},${0.3+Math.random()*0.55+energy*0.15})`;
        ctx.lineWidth=0.5+Math.random()*3*(0.5+energy);
        ctx.beginPath(); ctx.moveTo(x1,y1);
        ctx.lineTo(x1+(x2-x1)*(0.3+Math.random()*0.4)+(Math.random()-0.5)*80,
                   y1+(y2-y1)*(0.3+Math.random()*0.4)+(Math.random()-0.5)*80);
        ctx.lineTo(x2,y2); ctx.stroke();
    }
    if (Math.random()<0.25+dissonanceScore*0.4) {
        ctx.strokeStyle=`rgba(255,255,255,${0.08+Math.random()*0.2})`;
        ctx.lineWidth=0.4+Math.random()*0.8;
        ctx.setLineDash([2,4+Math.random()*8]);
        const sx=Math.random()*canvas.width, sy=Math.random()*canvas.height;
        const sa=Math.random()*Math.PI;
        ctx.beginPath(); ctx.moveTo(sx,sy);
        ctx.lineTo(sx+Math.cos(sa)*(60+Math.random()*200),sy+Math.sin(sa)*(60+Math.random()*200));
        ctx.stroke(); ctx.setLineDash([]);
    }
}

function initHexGrid() {
    hexGrid=[];
    const s=90;
    const cols=Math.ceil(window.innerWidth/(s*1.5))+2;
    const rows=Math.ceil(window.innerHeight/(s*Math.sqrt(3)))+2;
    for (let c=-1;c<cols;c++) for (let r=-1;r<rows;r++) {
        hexGrid.push({x:c*s*1.5, y:r*s*Math.sqrt(3)+(c%2)*s*Math.sqrt(3)/2,
                      size:s*0.46, crack:0, crackAngle:Math.random()*Math.PI, opacity:0});
    }
}

function renderTritone() {
    ctx.globalCompositeOperation='source-over';
    hexGrid.forEach(h=>{
        const dist=Math.hypot(h.x-canvas.width/2, h.y-canvas.height/2);
        h.opacity=lerp(h.opacity, Math.max(0,1-dist/(canvas.height*0.55))*(0.4+energy*0.6), 0.06);
        h.crack=lerp(h.crack,0.85,0.025);
        if (h.opacity<0.02) return;
        const bri=Math.floor(160+energy*90);
        ctx.strokeStyle=`rgba(${bri},${bri},${bri},${h.opacity})`;
        ctx.lineWidth=1+energy*2;
        ctx.beginPath();
        for (let i=0;i<6;i++){const a=(i/6)*Math.PI*2-Math.PI/6; i===0?ctx.moveTo(h.x+Math.cos(a)*h.size,h.y+Math.sin(a)*h.size):ctx.lineTo(h.x+Math.cos(a)*h.size,h.y+Math.sin(a)*h.size);}
        ctx.closePath(); ctx.stroke();
        if (h.crack>0.3) for(let c=0;c<3;c++){
            const ca=h.crackAngle+c*(Math.PI/3), cl=h.size*h.crack*(0.4+Math.random()*0.5);
            ctx.strokeStyle=`rgba(${bri},${bri},${bri},${h.opacity*0.4})`;
            ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(h.x,h.y);
            ctx.lineTo(h.x+Math.cos(ca)*cl,h.y+Math.sin(ca)*cl); ctx.stroke();
        }
    });
}

function renderCluster() {
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle=`rgba(240,238,230,${0.04+energy*0.08})`; ctx.fillRect(0,0,canvas.width,canvas.height);
    const blades=Math.floor(80+energy*280);
    for(let z=0;z<5;z++){
        const zx=canvas.width*(0.08+z*0.21), zy=canvas.height*(0.5+Math.sin(time+z*1.2)*0.18);
        const spread=canvas.width*0.07+midEnergy*canvas.width*0.12;
        for(let i=0;i<blades/5;i++){
            const x=zx+(Math.random()-0.5)*spread*2, by=zy+(Math.random()-0.5)*80;
            const h=30+Math.random()*130*(0.4+energy*1.8), lean=(Math.random()-0.5)*25+midEnergy*35;
            const bri=Math.floor(8+Math.random()*35);
            ctx.strokeStyle=`rgba(${bri},${bri},${bri},${0.45+Math.random()*0.45})`;
            ctx.lineWidth=0.5+Math.random()*1.8;
            ctx.beginPath(); ctx.moveTo(x,by);
            ctx.quadraticCurveTo(x+lean*0.5,by-h*0.5,x+lean,by-h); ctx.stroke();
        }
    }
}

function initVeins() {
    veins=[];
    const cx=canvas.width/2, cy=canvas.height/2;
    for(let i=0;i<25;i++){
        const sx=cx+(Math.random()-0.5)*300, sy=cy+(Math.random()-0.5)*400;
        const pts=[{x:sx,y:sy}]; let x=sx,y=sy;
        for(let j=0;j<5+Math.floor(Math.random()*5);j++){
            const a=Math.random()*Math.PI*2;
            x+=Math.cos(a)*(40+Math.random()*120); y+=Math.sin(a)*(40+Math.random()*120);
            pts.push({x,y});
        }
        veins.push({pts,opacity:0,grow:0});
    }
}

function renderTension() {
    ctx.globalCompositeOperation='source-over';
    const cx=canvas.width/2,cy=canvas.height/2;
    const dg=ctx.createRadialGradient(cx,cy,0,cx,cy,canvas.height*0.7);
    dg.addColorStop(0,`rgba(0,0,0,${tensionLevel*0.5})`); dg.addColorStop(1,'transparent');
    ctx.fillStyle=dg; ctx.fillRect(0,0,canvas.width,canvas.height);
    const pr=canvas.height*0.08*(1+energy*1.5)*(1+Math.sin(time*3)*0.12);
    ctx.strokeStyle=`rgba(${Math.floor(100+tensionLevel*155)},15,15,${0.3+tensionLevel*0.4})`;
    ctx.lineWidth=2+tensionLevel*5; ctx.beginPath(); ctx.arc(cx,cy,pr,0,Math.PI*2); ctx.stroke();
    ctx.globalCompositeOperation='screen';
    veins.forEach(v=>{
        v.grow=lerp(v.grow,1,0.04); v.opacity=lerp(v.opacity,tensionLevel*0.65,0.04);
        const n=Math.floor(v.pts.length*v.grow); if(n<2) return;
        const r=Math.floor(80+tensionLevel*140+energy*35);
        ctx.strokeStyle=`rgba(${r},12,12,${v.opacity})`; ctx.lineWidth=0.8+energy*2.5;
        ctx.shadowBlur=10; ctx.shadowColor=`rgba(${r},0,0,0.6)`;
        ctx.beginPath(); ctx.moveTo(v.pts[0].x,v.pts[0].y);
        for(let i=1;i<n;i++) ctx.lineTo(v.pts[i].x,v.pts[i].y);
        ctx.stroke(); ctx.shadowBlur=0;
    });
}

function triggerBloom() {
    bloomParticles=[];
    const cx=canvas.width/2, cy=canvas.height*0.45;
    const count=200+Math.floor(energy*300);
    for(let i=0;i<count;i++){
        const a=Math.random()*Math.PI*2;
        const spd=0.5+Math.random()*6;
        const hue=domHue()+( Math.random()-0.5)*120;
        bloomParticles.push({
            x:cx+(Math.random()-0.5)*120, y:cy+(Math.random()-0.5)*120,
            vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
            life:1.0, decay:0.004+Math.random()*0.01,
            size:3+Math.random()*12, hue:hue%360,
            glow:15+Math.random()*35,
            layer: Math.random() < 0.3 ? 'outer' : 'inner'
        });
    }
}

function renderBloom() {
    if(!bloomParticles.length) return;
    ctx.globalCompositeOperation='screen';
    bloomParticles = bloomParticles.filter(p=>p.life>0);
    bloomParticles.forEach(p=>{
        const drag = p.layer==='outer' ? 0.985 : 0.972;
        p.x+=p.vx; p.y+=p.vy;
        p.vx*=drag; p.vy*=drag;
        p.life-=p.decay; p.size*=0.996;

        const r = Math.max(0.5, p.size);
        const glow = ctx.createRadialGradient(p.x,p.y,0, p.x,p.y, r*5);
        const h2 = (p.hue+40)%360;
        glow.addColorStop(0,   `hsla(${p.hue},92%,82%,${p.life*0.8})`);
        glow.addColorStop(0.25,`hsla(${p.hue},88%,68%,${p.life*0.5})`);
        glow.addColorStop(0.6, `hsla(${h2},80%,55%,${p.life*0.2})`);
        glow.addColorStop(1,   'transparent');
        ctx.fillStyle=glow;
        ctx.beginPath();
        ctx.arc(p.x,p.y,r*5,0,Math.PI*2);
        ctx.fill();
    });
}

function renderResolution() {
    ctx.globalCompositeOperation='screen';
    const cx=canvas.width/2, cy=canvas.height*0.45;
    for(let r=0;r<5;r++){
        const phase=(stateAge*0.012+r*0.3)%1;
        const radius=phase*canvas.height*0.65;
        const opacity=(1-phase)*(0.18+energy*0.15);
        const hue=(45+r*55+time*18)%360;
        ctx.strokeStyle=`hsla(${hue},85%,72%,${opacity})`;
        ctx.lineWidth=2+(1-phase)*3;
        ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.stroke();
    }
    if(stateAge>20){ctx.globalAlpha=Math.min(1,(stateAge-20)/50); renderHarmony(); ctx.globalAlpha=1;}
}

function renderSilence() {
    ctx.globalCompositeOperation='screen';
    const cx=canvas.width/2, cy=canvas.height/2;
    const r=canvas.height*0.12*(1+Math.sin(time*0.9)*0.07);
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    g.addColorStop(0,'rgba(25,30,45,0.07)'); g.addColorStop(1,'transparent');
    ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
}

function initParticles() {
    particles=[];
    for(let i=0;i<300;i++) particles.push({
        x:Math.random()*window.innerWidth,
        y:Math.random()*window.innerHeight,
        vx:(Math.random()-0.5)*0.3,
        vy:(Math.random()-0.5)*0.3 - 0.1,
        hue:Math.random()*360,
        size:0.5+Math.random()*4,
        opacity:0, targetOpacity:0,
        tx:Math.random()*window.innerWidth,
        ty:Math.random()*window.innerHeight,
        wobble:Math.random()*Math.PI*2,
        wobbleSpeed:0.01+Math.random()*0.03,
    });
}

function renderParticles() {
    ctx.globalCompositeOperation = 'screen';
    const mono = [STATES.DISSONANCE,STATES.CLUSTER].includes(currentState);
    const baseOp = currentState===STATES.SILENCE ? 0.04
                 : currentState===STATES.TENSION  ? 0.02
                 : 0.25 + energy*0.25;

    particles.forEach((p) => {
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble)*0.6 + p.vx*energy*5;
        p.y += p.vy + Math.cos(p.wobble*0.7)*0.4 + p.vy*energy*5;

        if (p.x < -10) p.x = canvas.width+10;
        if (p.x > canvas.width+10) p.x = -10;
        if (p.y < -10) p.y = canvas.height+10;
        if (p.y > canvas.height+10) p.y = -10;

        p.targetOpacity = baseOp * (0.5 + Math.random()*0.5);
        p.opacity = lerp(p.opacity, p.targetOpacity, 0.03);

        const hue = mono ? 0 : (p.hue + time*15) % 360;
        const sat = mono ? 0 : 75;
        const lit = mono ? 70 : 70;
        const size = Math.max(0.3, p.size*(1+energy*3));

        const glow = ctx.createRadialGradient(p.x,p.y,0, p.x,p.y, size*4);
        glow.addColorStop(0,   `hsla(${hue},${sat}%,${lit}%,${p.opacity})`);
        glow.addColorStop(0.3, `hsla(${(hue+20)%360},${sat}%,${lit-10}%,${p.opacity*0.5})`);
        glow.addColorStop(1,   `hsla(${(hue+40)%360},${sat-20}%,${lit-20}%,0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size*4, 0, Math.PI*2);
        ctx.fill();
    });
}

function lerp(a,b,t){return a+(b-a)*t;}