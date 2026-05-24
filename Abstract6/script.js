// ============================================================
// ABSTRACT 6 - Three-Layer Volumetric Gas & God Rays
// Three independent colored gas layers that never mix,
// illuminated by a central light with volumetric scattering.
// ============================================================

const canvas = document.getElementById('visualizer');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const controlsPanel = document.getElementById('controlsPanel');

const ctrlReact = document.getElementById('ctrlReact');
const ctrlNoise = document.getElementById('ctrlNoise');
const ctrlHole = document.getElementById('ctrlHole');
const ctrlVorticity = document.getElementById('ctrlVorticity');
const ctrlRayDensity = document.getElementById('ctrlRayDensity');
const ctrlRayDecay = document.getElementById('ctrlRayDecay');
const ctrlExposure = document.getElementById('ctrlExposure');
const ctrlCore = document.getElementById('ctrlCore');

// Each palette now defines 3 distinct layer colors + a core light color
const PALETTES = {
    nebula:    { label: 'NEBULA',    bg: '#030205', layers: ['#ff1493', '#00ffff', '#8b00ff'], core: '#ffffff' },
    toxic:     { label: 'TOXIC',     bg: '#020402', layers: ['#39ff14', '#ffff00', '#00ffaa'], core: '#eaffcc' },
    solar:     { label: 'SOLAR',     bg: '#050200', layers: ['#ff4400', '#ffcc00', '#ff0066'], core: '#ffffff' },
    abyss:     { label: 'ABYSS',     bg: '#000205', layers: ['#0066ff', '#00ffff', '#4400cc'], core: '#ccffff' },
    ethereal:  { label: 'ETHEREAL',  bg: '#040404', layers: ['#ffffff', '#888899', '#aa88cc'], core: '#ffffff' },
    bloodmoon: { label: 'BLOODMOON', bg: '#050101', layers: ['#ff0000', '#ff6600', '#990044'], core: '#ffcccc' }
};

let currentPaletteKey = 'nebula';
let pal = PALETTES[currentPaletteKey];

const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
if (!gl) throw new Error('WebGL2 required');
gl.getExtension('EXT_color_buffer_float');

let W = 1, H = 1;
let simW = 512, simH = 512;
let texel = [1 / simW, 1 / simH];

// Shared velocity field
let velocity, pressure, divergence, curl;
// Three independent density layers — colors never mix
let layer0, layer1, layer2;
let renderBuffer, raysBuffer;

let lastTime = performance.now();
let time = 0, frame = 0;

const BIN_COUNT = 1024, BINS = 96, MIN_DB = -90, MAX_DB = -10;
let audioCtx, analyser, source;
let dataArray = new Float32Array(BIN_COUNT);
let smoothedBins = new Float32Array(BINS);
let logIndices = [];
let useRealAudio = false;
let bass = 0, mid = 0, treble = 0;
let beat = 0;

// ==================== SHADERS ====================

const baseVertex = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const clearFrag = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform float uValue;
in vec2 vUv;
out vec4 fragColor;
void main() { fragColor = texture(uTexture, vUv) * uValue; }`;

const splatFrag = `#version 300 es
precision highp float;
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;
uniform float uAspect;
in vec2 vUv;
out vec4 fragColor;
void main() {
    vec2 p = vUv - uPoint;
    p.x *= uAspect;
    float splat = exp(-dot(p, p) / max(0.00001, uRadius));
    vec3 base = texture(uTarget, vUv).xyz;
    fragColor = vec4(base + uColor * splat, 1.0);
}`;

const advectionFrag = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uDissipation;
in vec2 vUv;
out vec4 fragColor;
void main() {
    vec2 vel = texture(uVelocity, vUv).xy;
    vec2 coord = vUv - vel * uDt * uTexel * 8.0;
    vec4 value = texture(uSource, coord);
    fragColor = value * uDissipation;
}`;

const divergenceFrag = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;
void main() {
    float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
    float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
    float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
    float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
    fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const curlFrag = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;
void main() {
    float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
    float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
    float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
    float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
    fragColor = vec4(R - L - T + B, 0.0, 0.0, 1.0);
}`;

const vorticityFrag = `#version 300 es
precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uCurlForce;
uniform float uDt;
in vec2 vUv;
out vec4 fragColor;
void main() {
    float L = abs(texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x);
    float R = abs(texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x);
    float B = abs(texture(uCurl, vUv - vec2(0.0, uTexel.y)).x);
    float T = abs(texture(uCurl, vUv + vec2(0.0, uTexel.y)).x);
    float C = texture(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(T - B, L - R);
    force /= length(force) + 0.0001;
    force *= uCurlForce * C;
    vec2 vel = texture(uVelocity, vUv).xy + force * uDt;
    fragColor = vec4(vel, 0.0, 1.0);
}`;

const pressureFrag = `#version 300 es
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;
void main() {
    float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
    float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
    float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
    float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
    float div = texture(uDivergence, vUv).x;
    fragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const gradientFrag = `#version 300 es
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 fragColor;
void main() {
    float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
    float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
    float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
    float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
    vec2 vel = texture(uVelocity, vUv).xy - vec2(R - L, T - B) * 0.5;
    fragColor = vec4(vel, 0.0, 1.0);
}`;

// Composite 3 separate density layers into colored gas + light core
const gasRenderFrag = `#version 300 es
precision highp float;
uniform sampler2D uLayer0;
uniform sampler2D uLayer1;
uniform sampler2D uLayer2;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uCoreColor;
uniform float uBass;
uniform float uCoreBrightness;
uniform float uTime;
in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
    // Sample each independent layer (stored in .r channel)
    float d0 = texture(uLayer0, vUv).r;
    float d1 = texture(uLayer1, vUv).r;
    float d2 = texture(uLayer2, vUv).r;

    // Smooth gas density mapping per layer
    float g0 = smoothstep(0.0, 0.6, d0);
    float g1 = smoothstep(0.0, 0.6, d1);
    float g2 = smoothstep(0.0, 0.6, d2);

    // Each layer contributes its own pure color — no cross-contamination
    vec3 color = vec3(0.0);
    color += uColor0 * g0;
    color += uColor1 * g1;
    color += uColor2 * g2;

    // Subtle noise texture on the gas
    float n = noise(vUv * 12.0 + uTime * 0.3);
    color *= (0.85 + 0.15 * n);

    // Central light core
    float dist = distance(vUv, vec2(0.5));
    float core = exp(-dist * 18.0) * uCoreBrightness * (1.0 + uBass * 2.5);

    // Gas occludes the core — thicker gas = less core shine-through
    float totalDensity = d0 + d1 + d2;
    float occlusion = 1.0 / (1.0 + totalDensity * 4.0);
    color += uCoreColor * core * occlusion;

    fragColor = vec4(color, 1.0);
}`;

// Volumetric Light Scattering (God Rays)
const godRaysFrag = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uLightPos;
uniform float uDensity;
uniform float uWeight;
uniform float uDecay;
uniform float uExposure;
in vec2 vUv;
out vec4 fragColor;

const int NUM_SAMPLES = 80;

void main() {
    vec2 tc = vUv;
    vec2 deltaTexCoord = (tc - uLightPos);
    deltaTexCoord *= 1.0 / float(NUM_SAMPLES) * uDensity;

    vec3 color = texture(uTexture, tc).rgb;
    float illuminationDecay = 1.0;

    for (int i = 0; i < NUM_SAMPLES; i++) {
        tc -= deltaTexCoord;
        vec3 sampleColor = texture(uTexture, tc).rgb;
        sampleColor *= illuminationDecay * uWeight;
        color += sampleColor;
        illuminationDecay *= uDecay;
    }

    fragColor = vec4(color * uExposure, 1.0);
}`;

const compositeFrag = `#version 300 es
precision highp float;
uniform sampler2D uGas;
uniform sampler2D uRays;
uniform vec3 uBg;
in vec2 vUv;
out vec4 fragColor;
void main() {
    vec3 gas = texture(uGas, vUv).rgb;
    vec3 rays = texture(uRays, vUv).rgb;
    vec3 finalColor = uBg + gas + rays;
    // ACES filmic tone mapping
    finalColor = (finalColor * (2.51 * finalColor + 0.03)) / (finalColor * (2.43 * finalColor + 0.59) + 0.14);
    fragColor = vec4(finalColor, 1.0);
}`;

// ==================== GL UTILITIES ====================

function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
}

function program(frag) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, baseVertex));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const uniforms = {};
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
        const name = gl.getActiveUniform(p, i).name;
        uniforms[name] = gl.getUniformLocation(p, name);
    }
    return { p, uniforms };
}

const programs = {
    clear: program(clearFrag),
    splat: program(splatFrag),
    advection: program(advectionFrag),
    divergence: program(divergenceFrag),
    curl: program(curlFrag),
    vorticity: program(vorticityFrag),
    pressure: program(pressureFrag),
    gradient: program(gradientFrag),
    gasRender: program(gasRenderFrag),
    godRays: program(godRaysFrag),
    composite: program(compositeFrag)
};

const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

function bindProgram(prg) {
    gl.useProgram(prg.p);
    const loc = gl.getAttribLocation(prg.p, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

function createFbo(w, h, internalFormat = gl.RGBA16F, format = gl.RGBA, type = gl.HALF_FLOAT) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, width: w, height: h };
}

function doubleFbo(w, h) {
    let read = createFbo(w, h);
    let write = createFbo(w, h);
    return {
        get read() { return read; },
        get write() { return write; },
        swap() { const t = read; read = write; write = t; }
    };
}

function target(fbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo ? fbo.fbo : null);
    gl.viewport(0, 0, fbo ? fbo.width : W, fbo ? fbo.height : H);
}

function draw() { gl.drawArrays(gl.TRIANGLES, 0, 6); }

function bindTex(loc, tex, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
}

function rgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
}

// ==================== SIMULATION ====================

function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.floor(window.innerWidth * dpr);
    H = Math.floor(window.innerHeight * dpr);
    canvas.width = W; canvas.height = H;

    const base = W * H > 1400 * 900 ? 512 : 384;
    simW = base; simH = Math.round(base * H / W);
    texel = [1 / simW, 1 / simH];

    velocity   = doubleFbo(simW, simH);
    pressure   = doubleFbo(simW, simH);
    divergence = createFbo(simW, simH);
    curl       = createFbo(simW, simH);

    // Three independent gas layers
    layer0 = doubleFbo(simW, simH);
    layer1 = doubleFbo(simW, simH);
    layer2 = doubleFbo(simW, simH);

    renderBuffer = createFbo(W, H);
    raysBuffer   = createFbo(Math.floor(W / 2), Math.floor(H / 2));
}

function clearBuffer(buf, val) {
    bindProgram(programs.clear);
    bindTex(programs.clear.uniforms.uTexture, buf.read.tex, 0);
    gl.uniform1f(programs.clear.uniforms.uValue, val);
    target(buf.write); draw(); buf.swap();
}

function splat(buf, x, y, dx, dy, dz, radius) {
    bindProgram(programs.splat);
    bindTex(programs.splat.uniforms.uTarget, buf.read.tex, 0);
    gl.uniform2f(programs.splat.uniforms.uPoint, x, y);
    gl.uniform3f(programs.splat.uniforms.uColor, dx, dy, dz);
    gl.uniform1f(programs.splat.uniforms.uRadius, radius);
    gl.uniform1f(programs.splat.uniforms.uAspect, W / H);
    target(buf.write); draw(); buf.swap();
}

function advect(buf, src, dt, dissipation) {
    bindProgram(programs.advection);
    bindTex(programs.advection.uniforms.uVelocity, velocity.read.tex, 0);
    bindTex(programs.advection.uniforms.uSource, src.read.tex, 1);
    gl.uniform2f(programs.advection.uniforms.uTexel, texel[0], texel[1]);
    gl.uniform1f(programs.advection.uniforms.uDt, dt);
    gl.uniform1f(programs.advection.uniforms.uDissipation, dissipation);
    target(buf.write); draw(); buf.swap();
}

function step(dt) {
    const vort = Number(ctrlVorticity.value);
    const diss = Number(ctrlHole.value);

    // Advect the shared velocity field
    advect(velocity, velocity, dt, 0.99);

    // Advect each gas layer independently through the same velocity field
    advect(layer0, layer0, dt, diss);
    advect(layer1, layer1, dt, diss);
    advect(layer2, layer2, dt, diss);

    // Curl
    bindProgram(programs.curl);
    bindTex(programs.curl.uniforms.uVelocity, velocity.read.tex, 0);
    gl.uniform2f(programs.curl.uniforms.uTexel, texel[0], texel[1]);
    target(curl); draw();

    // Vorticity confinement
    bindProgram(programs.vorticity);
    bindTex(programs.vorticity.uniforms.uVelocity, velocity.read.tex, 0);
    bindTex(programs.vorticity.uniforms.uCurl, curl.tex, 1);
    gl.uniform2f(programs.vorticity.uniforms.uTexel, texel[0], texel[1]);
    gl.uniform1f(programs.vorticity.uniforms.uCurlForce, vort);
    gl.uniform1f(programs.vorticity.uniforms.uDt, dt);
    target(velocity.write); draw(); velocity.swap();

    // Divergence
    bindProgram(programs.divergence);
    bindTex(programs.divergence.uniforms.uVelocity, velocity.read.tex, 0);
    gl.uniform2f(programs.divergence.uniforms.uTexel, texel[0], texel[1]);
    target(divergence); draw();

    // Pressure solve
    clearBuffer(pressure, 0);
    for (let i = 0; i < 14; i++) {
        bindProgram(programs.pressure);
        bindTex(programs.pressure.uniforms.uPressure, pressure.read.tex, 0);
        bindTex(programs.pressure.uniforms.uDivergence, divergence.tex, 1);
        gl.uniform2f(programs.pressure.uniforms.uTexel, texel[0], texel[1]);
        target(pressure.write); draw(); pressure.swap();
    }

    // Subtract gradient
    bindProgram(programs.gradient);
    bindTex(programs.gradient.uniforms.uPressure, pressure.read.tex, 0);
    bindTex(programs.gradient.uniforms.uVelocity, velocity.read.tex, 1);
    gl.uniform2f(programs.gradient.uniforms.uTexel, texel[0], texel[1]);
    target(velocity.write); draw(); velocity.swap();
}

// ==================== AUDIO INJECTION ====================

function injectAudioForces() {
    const react = Number(ctrlReact.value);
    const noiseAmt = Number(ctrlNoise.value) * 0.01;
    const layers = [layer0, layer1, layer2];

    const push = (0.03 + bass * 0.2) * react;

    // Each layer has its own emitter zone at 120° apart
    for (let L = 0; L < 3; L++) {
        const baseAngle = L * Math.PI * 2 / 3;
        const orbit = time * 0.12 + baseAngle;

        // 2 emitters per layer, slightly offset
        for (let e = 0; e < 2; e++) {
            const a = orbit + e * 0.6;
            const bandIdx = Math.floor(((L * 2 + e) / 6) * (BINS - 1));
            const band = smoothedBins[bandIdx] || 0;

            const r = 0.14 + mid * 0.08 + e * 0.06;
            const x = 0.5 + Math.cos(a) * r;
            const y = 0.5 + Math.sin(a) * r;

            // Tangent swirl + mild outward push
            const tangent = a + Math.PI * 0.5 + (Math.random() - 0.5) * noiseAmt;
            const fMag = push * (0.15 + band * 0.8);
            const vx = Math.cos(tangent) * fMag + Math.cos(a) * fMag * 0.1;
            const vy = Math.sin(tangent) * fMag + Math.sin(a) * fMag * 0.1;

            // Velocity is shared — all layers contribute to one flow field
            splat(velocity, x, y, vx, vy, 0, 0.006 + band * 0.01);

            // Density goes ONLY into this layer's own buffer (single-channel .r)
            const dAmt = 0.12 + band * 0.35;
            splat(layers[L], x, y, dAmt, 0, 0, 0.012 + treble * 0.006);
        }
    }

    // Gentle central push on beats
    if (beat > 0.5) {
        const bPush = push * 1.0;
        splat(velocity, 0.5, 0.5, (Math.random()-0.5)*bPush, (Math.random()-0.5)*bPush, 0, 0.03);
    }
}

// ==================== RENDER PIPELINE ====================

function render() {
    // Pass 1 — Composite 3 gas layers + light core
    const prg = programs.gasRender;
    bindProgram(prg);
    bindTex(prg.uniforms.uLayer0, layer0.read.tex, 0);
    bindTex(prg.uniforms.uLayer1, layer1.read.tex, 1);
    bindTex(prg.uniforms.uLayer2, layer2.read.tex, 2);

    const c0 = rgb(pal.layers[0]);
    const c1 = rgb(pal.layers[1]);
    const c2 = rgb(pal.layers[2]);
    const cc = rgb(pal.core);

    gl.uniform3f(prg.uniforms.uColor0, c0[0], c0[1], c0[2]);
    gl.uniform3f(prg.uniforms.uColor1, c1[0], c1[1], c1[2]);
    gl.uniform3f(prg.uniforms.uColor2, c2[0], c2[1], c2[2]);
    gl.uniform3f(prg.uniforms.uCoreColor, cc[0], cc[1], cc[2]);
    gl.uniform1f(prg.uniforms.uBass, bass);
    gl.uniform1f(prg.uniforms.uCoreBrightness, Number(ctrlCore.value));
    gl.uniform1f(prg.uniforms.uTime, time);
    target(renderBuffer); draw();

    // Pass 2 — God Rays
    bindProgram(programs.godRays);
    bindTex(programs.godRays.uniforms.uTexture, renderBuffer.tex, 0);
    gl.uniform2f(programs.godRays.uniforms.uLightPos, 0.5, 0.5);
    gl.uniform1f(programs.godRays.uniforms.uDensity, Number(ctrlRayDensity.value));
    gl.uniform1f(programs.godRays.uniforms.uWeight, 0.05);
    gl.uniform1f(programs.godRays.uniforms.uDecay, Number(ctrlRayDecay.value));
    gl.uniform1f(programs.godRays.uniforms.uExposure, Number(ctrlExposure.value) + bass * 0.12);
    target(raysBuffer); draw();

    // Pass 3 — Final composite to screen
    bindProgram(programs.composite);
    bindTex(programs.composite.uniforms.uGas, renderBuffer.tex, 0);
    bindTex(programs.composite.uniforms.uRays, raysBuffer.tex, 1);
    const bg = rgb(pal.bg);
    gl.uniform3f(programs.composite.uniforms.uBg, bg[0], bg[1], bg[2]);
    target(null); draw();
}

// ==================== AUDIO ====================

function setupLogBins(sim = false) {
    logIndices = [];
    const nyq = (sim ? 44100 : audioCtx.sampleRate) / 2;
    const lo = Math.log10(20), hi = Math.log10(16000);
    for (let i = 0; i < BINS; i++) {
        const f = Math.pow(10, lo + (i / (BINS - 1)) * (hi - lo));
        logIndices.push(Math.max(0, Math.min(BIN_COUNT - 1, Math.floor((f / nyq) * BIN_COUNT))));
    }
}

function getEnergy(data, from, to) {
    let s = 0;
    for (let i = from; i < to; i++) s += Math.max(0, Math.min(1, (data[i] - MIN_DB) / (MAX_DB - MIN_DB)));
    return s / Math.max(1, to - from);
}

function simulatedAudio() {
    for (let i = 0; i < BIN_COUNT; i++) dataArray[i] = MIN_DB + Math.random() * 4;
    const k = Math.max(0, Math.sin(time * 2.0)) ** 12;
    const p = 0.5 + 0.5 * Math.sin(time * 0.4);
    const t = 0.5 + 0.5 * Math.sin(time * 12.0);
    for (let i = 1; i < BIN_COUNT * 0.05; i++) dataArray[i] = MIN_DB + k * 80;
    for (let i = BIN_COUNT * 0.05; i < BIN_COUNT * 0.3; i++) dataArray[i] = MIN_DB + p * 40;
    for (let i = BIN_COUNT * 0.3; i < BIN_COUNT * 0.8; i++) dataArray[i] = MIN_DB + t * 25;
}

function updateAudio() {
    if (useRealAudio && analyser) analyser.getFloatFrequencyData(dataArray);
    else simulatedAudio();

    for (let i = 0; i < BINS; i++) {
        const raw = Math.max(0, Math.min(1, (dataArray[logIndices[i] || 0] - MIN_DB) / (MAX_DB - MIN_DB)));
        smoothedBins[i] = smoothedBins[i] * 0.82 + raw * 0.18;
    }
    const b = getEnergy(dataArray, 1, Math.floor(BIN_COUNT * 0.05));
    const m = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.05), Math.floor(BIN_COUNT * 0.3));
    const t = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.3), Math.floor(BIN_COUNT * 0.8));

    bass   = bass   * 0.82 + b * 0.18;
    mid    = mid    * 0.86 + m * 0.14;
    treble = treble * 0.86 + t * 0.14;

    if (b - bass > 0.12) beat = 1.0;
    beat = Math.max(0, beat - 0.04);
}

// ==================== MAIN LOOP ====================

function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, Math.max(0.008, (now - lastTime) / 1000));
    lastTime = now; time += dt; frame++;
    updateAudio();
    injectAudioForces();
    step(dt);
    render();
}

// ==================== UI ====================

function renderPaletteButtons() {
    const grid = document.getElementById('presetGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.entries(PALETTES).forEach(([key, palette]) => {
        const btn = document.createElement('button');
        btn.className = `preset-btn${key === currentPaletteKey ? ' active' : ''}`;
        btn.textContent = palette.label;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPaletteKey = key;
            pal = PALETTES[key];
        });
        grid.appendChild(btn);
    });
}

startBtn.addEventListener('click', async () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.display = 'none', 1500);
    controlsPanel.classList.remove('hidden');
    resize();
    renderPaletteButtons();

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        if (stream.getAudioTracks().length) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = BIN_COUNT * 2;
            analyser.minDecibels = MIN_DB;
            analyser.maxDecibels = MAX_DB;
            analyser.smoothingTimeConstant = 0.8;
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            useRealAudio = true;
            setupLogBins();
        } else {
            useRealAudio = false;
            setupLogBins(true);
        }
    } catch (err) {
        useRealAudio = false;
        setupLogBins(true);
    }
    lastTime = performance.now();
    requestAnimationFrame(loop);
});

const toggleUIBtn = document.createElement('button');
toggleUIBtn.id = 'toggleUIBtn';
toggleUIBtn.innerText = 'HIDE UI';
document.body.appendChild(toggleUIBtn);
toggleUIBtn.addEventListener('click', () => {
    controlsPanel.classList.toggle('hidden');
    toggleUIBtn.innerText = controlsPanel.classList.contains('hidden') ? 'SHOW UI' : 'HIDE UI';
});

window.addEventListener('resize', () => {
    if (!controlsPanel.classList.contains('hidden')) resize();
});
