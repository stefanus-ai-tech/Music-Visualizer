const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');

// --- Technical Specs ---
const BINS = 64;
const MIN_DB = -75; 
const MAX_DB = -5;
const DECAY = 0.82; 

let audioCtx, analyser, dataArray;
let smoothedY = new Array(BINS).fill(MIN_DB);
let logIndices = [];
let time = 0; // Used to slowly evolve the shapes over time

startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true, 
            audio: true  
        });
        overlay.style.display = 'none';
        setupAudio(stream);
    } catch (err) {
        console.error("Audio capture failed:", err);
        alert("Audio capture is required.");
    }
});

function setupAudio(stream) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096; 
    analyser.smoothingTimeConstant = 0.0; 

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    dataArray = new Float32Array(analyser.frequencyBinCount);

    setupLogBins();
    requestAnimationFrame(renderLoop);
}

function setupLogBins() {
    const sampleRate = audioCtx.sampleRate;
    const nyquist = sampleRate / 2;
    const freqs = Array.from({length: analyser.frequencyBinCount}, (_, i) => i * nyquist / analyser.frequencyBinCount);
    
    const minLog = Math.log10(20);
    const maxLog = Math.log10(16000);
    
    for (let i = 0; i < BINS; i++) {
        const targetFreq = Math.pow(10, minLog + (i / BINS) * (maxLog - minLog));
        const index = freqs.findIndex(f => f >= targetFreq);
        logIndices.push(index === -1 ? freqs.length - 1 : index);
    }
}

function renderLoop() {
    requestAnimationFrame(renderLoop);
    time += 0.01; // Advance internal clock for organic movement

    analyser.getFloatFrequencyData(dataArray);

    // Fade the background slightly to create light trails
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(5, 5, 8, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Switch to additive blending for that "holographic neon" look
    ctx.globalCompositeOperation = 'screen';

    const baseHeight = canvas.height   / BINS;
    const centerX = canvas.width / 2;

    for (let i = 0; i < BINS; i++) {
        let rawDb = dataArray[logIndices[i]];
        if (!isFinite(rawDb)) rawDb = MIN_DB;
        rawDb = Math.max(MIN_DB, Math.min(MAX_DB, rawDb));

        // Gravity Math
        if (rawDb > smoothedY[i]) {
            smoothedY[i] = rawDb; // Instant Attack
        } else {
            smoothedY[i] = (rawDb * (1.0 - DECAY)) + (smoothedY[i] * DECAY);
        }

        const normalized = (smoothedY[i] - MIN_DB) / (MAX_DB - MIN_DB);
        
        // --- Abstract Geometry Math ---
        // 1. Stretch: How far out from the center the shape reaches
        const stretch = normalized * (canvas.width / 2) * 1.5; 
        
        // 2. Thickness: Shapes get fatter as they get louder
        const thickness = baseHeight * (0.5 + (normalized * 2.5)); 
        
        // 3. Rotation: Base rotation shifts down the spine, but audio energy twists it further
        const baseAngle = (i * 0.15) + time; 
        const twist = normalized * (Math.PI*3); 
        const rotation = baseAngle + twist;

        // 4. Evolving Color: Hue shifts based on both frequency bin and time
        const hue = ((i / BINS) * 200 + (time * 20)) % 360; 
        const color = `hsla(${hue}, 100%, 65%, 0.8)`;

        ctx.fillStyle = color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;

        const y = canvas.height - (i * baseHeight) - baseHeight;

        // Draw Abstract Symmetrical Elements
        ctx.beginPath();
        
        // Right Side Morphing Ellipse
        ctx.ellipse(
            centerX + (stretch / 2), y, // Center X, Y
            stretch / 2, thickness,     // Radius X, Radius Y
            rotation, 0, Math.PI * 2    // Rotation, Start Angle, End Angle
        );
        
        // Left Side Morphing Ellipse (Mirrored rotation)
        ctx.ellipse(
            centerX - (stretch / 2), y, 
            stretch / 2, thickness,     
            -rotation, 0, Math.PI * 2   
        );
        
        ctx.fill();
    }
}