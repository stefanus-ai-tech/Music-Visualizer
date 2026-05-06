// ============================================================
// ABSTRACT5 - ARFV Stable Fluids WebGL implementation
// Audio -> FFT bands -> force/density injection -> GPU fluid -> display
// ============================================================

const canvas = document.getElementById('visualizer');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const controlsPanel = document.getElementById('controlsPanel');

const ctrlRings = document.getElementById('ctrlRings');
const ctrlReact = document.getElementById('ctrlReact');
const ctrlNoise = document.getElementById('ctrlNoise');
const ctrlSpin = document.getElementById('ctrlSpin');
const ctrlHole = document.getElementById('ctrlHole');
const ctrlThickness = document.getElementById('ctrlThickness');
const ctrlIntensity = document.getElementById('ctrlIntensity');
const ctrlBounce = document.getElementById('ctrlBounce');

const PALETTES = {
    cyberfluid: { label: 'CYBERFLUID', bg: '#020616', colors: ['#00f6ff', '#ff3df2', '#fcee09'], accents: ['#ffffff', '#00ffb3', '#7d5cff'] },
    plasma: { label: 'PLASMA', bg: '#08020f', colors: ['#ff2bd6', '#7b2cff', '#00e5ff'], accents: ['#ffffff', '#fffb7d', '#ff6a00'] },
    abyss: { label: 'ABYSS', bg: '#020611', colors: ['#86e8ff', '#2192da', '#9e82e8'], accents: ['#ffffff', '#64fff1', '#071a48'] },
    indigo: { label: 'INDIGO', bg: '#050619', colors: ['#c4ccff', '#7c8df6', '#3745bb'], accents: ['#ffffff', '#5669ff', '#82d8ff'] },
    lilac: { label: 'LILAC', bg: '#100818', colors: ['#e6d1ff', '#c49be8', '#f0bce4'], accents: ['#ffffff', '#c99aff', '#7de8ff'] },
    crimson: { label: 'CRIMSON', bg: '#070408', colors: ['#f2e8d5', '#d10f2f', '#821020'], accents: ['#ffffff', '#ff2845', '#f0b982'] },
    opal: { label: 'OPAL', bg: '#061014', colors: ['#d8fff5', '#b7dcff', '#ffd4ef'], accents: ['#ffffff', '#fff0ad', '#78d9ff'] },
    toxic: { label: 'TOXIC', bg: '#030a05', colors: ['#c8ff35', '#00ffaa', '#00a35a'], accents: ['#ffffff', '#f4ff7d', '#0bff00'] },
    ember: { label: 'EMBER', bg: '#090503', colors: ['#ffeac4', '#f56b21', '#bd2a15'], accents: ['#ffffff', '#ffb13d', '#ff2845'] },
    mono: { label: 'MONO', bg: '#050607', colors: ['#ffffff', '#9ea8b5', '#303945'], accents: ['#ffffff', '#00f6ff', '#ff3df2'] }
};

let currentPaletteKey = 'cyberfluid';
let pal = PALETTES[currentPaletteKey];

const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
if (!gl) throw new Error('WebGL2 is required for Abstract5');

const extColorBufferFloat = gl.getExtension('EXT_color_buffer_float');
if (!extColorBufferFloat) console.warn('EXT_color_buffer_float unavailable; this GPU/browser may not render half/float targets correctly.');

let W = 1;
let H = 1;
let simW = 512;
let simH = 512;
let texel = [1 / simW, 1 / simH];
let velocity;
let density;
let pressure;
let divergence;
let curl;
let bloomA;
let bloomB;
let lastTime = performance.now();
let time = 0;
let frame = 0;

const BIN_COUNT = 1024;
const BINS = 96;
const MIN_DB = -88;
const MAX_DB = -12;
let audioCtx;
let analyser;
let source;
let dataArray = new Float32Array(BIN_COUNT);
let smoothedBins = new Float32Array(BINS);
let logIndices = [];
let useRealAudio = false;
let bass = 0;
let mid = 0;
let treble = 0;
let lastBass = 0;
let beat = 0;
let pendingExplosions = [];

let videoEl;
let videoReady = false;
let videoCanvas = document.createElement('canvas');
let videoCtx = videoCanvas.getContext('2d', { willReadFrequently: true });
let videoMotion = 0;
let videoLuma = 0;
let lastVideo = [];

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
void main() {
    fragColor = texture(uTexture, vUv) * uValue;
}`;

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
vec4 bilerp(sampler2D sam, vec2 uv) {
    return texture(sam, uv);
}
void main() {
    vec2 vel = texture(uVelocity, vUv).xy;
    vec2 coord = vUv - vel * uDt * uTexel * 70.0;
    fragColor = bilerp(uSource, coord) * uDissipation;
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
    float div = 0.5 * (R - L + T - B);
    fragColor = vec4(div, 0.0, 0.0, 1.0);
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
    float c = R - L - T + B;
    fragColor = vec4(c, 0.0, 0.0, 1.0);
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
    float p = (L + R + B + T - div) * 0.25;
    fragColor = vec4(p, 0.0, 0.0, 1.0);
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

const bloomFrag = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uTexel;
uniform vec2 uDirection;
in vec2 vUv;
out vec4 fragColor;
void main() {
    vec3 c = texture(uTexture, vUv).rgb * 0.227027;
    c += texture(uTexture, vUv + uDirection * uTexel * 1.384615).rgb * 0.316216;
    c += texture(uTexture, vUv - uDirection * uTexel * 1.384615).rgb * 0.316216;
    c += texture(uTexture, vUv + uDirection * uTexel * 3.230769).rgb * 0.070270;
    c += texture(uTexture, vUv - uDirection * uTexel * 3.230769).rgb * 0.070270;
    fragColor = vec4(c, 1.0);
}`;

const displayFrag = `#version 300 es
precision highp float;
uniform sampler2D uDensity;
uniform sampler2D uVelocity;
uniform sampler2D uBloom;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uBg;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBloomStrength;
uniform float uIntensity;
uniform vec2 uResolution;
in vec2 vUv;
out vec4 fragColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
    vec2 uv = vUv;
    vec2 vel = texture(uVelocity, uv).xy;
    vec3 d = texture(uDensity, uv + vel * 0.008).rgb;
    float mag = length(d);
    float speed = length(vel);
    d = d / (1.0 + d * 1.65);
    vec3 color = uBg * 0.72;
    color = mix(color, uColorA, smoothstep(0.04, 0.72, d.r) * 0.72);
    color = mix(color, uColorB, smoothstep(0.06, 0.82, d.g) * 0.62);
    color = mix(color, uColorC, smoothstep(0.08, 0.95, d.b) * 0.54);
    color += normalize(uColorA + uColorB + uColorC + 0.001) * speed * 0.18;
    color += texture(uBloom, uv).rgb * uBloomStrength * 0.32;
    color *= 0.52 + uIntensity * 0.34;
    color += vec3(hash(uv * uResolution + uTime) - 0.5) * 0.025;
    color += vec3(0.0, 0.8, 1.0) * (sin(uv.y * uResolution.y * 2.2) * 0.5 + 0.5) * 0.01;
    color = color / (1.0 + color * 0.92);
    float vignette = smoothstep(0.92, 0.22, distance(uv, vec2(0.5)));
    color *= vignette;
    fragColor = vec4(pow(max(color, 0.0), vec3(0.88)), 1.0);
}`;

function compile(type, sourceText) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, sourceText);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
}

function program(fragment) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, baseVertex));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment));
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
    bloom: program(bloomFrag),
    display: program(displayFrag)
};

const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

function bindProgram(prg) {
    gl.useProgram(prg.p);
    const loc = gl.getAttribLocation(prg.p, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

function createFbo(width, height, internalFormat = gl.RGBA16F, format = gl.RGBA, type = gl.HALF_FLOAT) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, width, height };
}

function doubleFbo(width, height, internalFormat, format, type) {
    let read = createFbo(width, height, internalFormat, format, type);
    let write = createFbo(width, height, internalFormat, format, type);
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

function draw() {
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function bindTex(location, texture, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(location, unit);
}

function rgb(color) {
    const hsl = color.startsWith('hsl');
    if (hsl) return [0, 1, 1];
    const h = color.replace('#', '');
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.4);
    W = Math.floor(window.innerWidth * dpr);
    H = Math.floor(window.innerHeight * dpr);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const base = W * H > 1400 * 900 ? 640 : 512;
    simW = base;
    simH = Math.round(base * H / W);
    texel = [1 / simW, 1 / simH];

    velocity = doubleFbo(simW, simH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    density = doubleFbo(simW, simH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    pressure = doubleFbo(simW, simH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    divergence = createFbo(simW, simH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    curl = createFbo(simW, simH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    bloomA = createFbo(Math.max(2, Math.floor(simW / 2)), Math.max(2, Math.floor(simH / 2)), gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    bloomB = createFbo(bloomA.width, bloomA.height, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
}

function clearBuffer(buffer, value) {
    const prg = programs.clear;
    bindProgram(prg);
    bindTex(prg.uniforms.uTexture, buffer.read.tex, 0);
    gl.uniform1f(prg.uniforms.uValue, value);
    target(buffer.write);
    draw();
    buffer.swap();
}

function splat(buffer, x, y, dx, dy, dz, radius) {
    const prg = programs.splat;
    bindProgram(prg);
    bindTex(prg.uniforms.uTarget, buffer.read.tex, 0);
    gl.uniform2f(prg.uniforms.uPoint, x, y);
    gl.uniform3f(prg.uniforms.uColor, dx, dy, dz);
    gl.uniform1f(prg.uniforms.uRadius, radius);
    gl.uniform1f(prg.uniforms.uAspect, W / H);
    target(buffer.write);
    draw();
    buffer.swap();
}

function advect(buffer, source, dt, dissipation) {
    const prg = programs.advection;
    bindProgram(prg);
    bindTex(prg.uniforms.uVelocity, velocity.read.tex, 0);
    bindTex(prg.uniforms.uSource, source.read.tex, 1);
    gl.uniform2f(prg.uniforms.uTexel, texel[0], texel[1]);
    gl.uniform1f(prg.uniforms.uDt, dt);
    gl.uniform1f(prg.uniforms.uDissipation, dissipation);
    target(buffer.write);
    draw();
    buffer.swap();
}

function step(dt) {
    const quality = Number(ctrlRings.value);
    const vorticity = Number(ctrlNoise.value) * (0.55 + mid * 1.5);
    const densityDissipation = Number(ctrlHole.value);

    advect(velocity, velocity, dt, 0.988);
    advect(density, density, dt, densityDissipation);

    bindProgram(programs.curl);
    bindTex(programs.curl.uniforms.uVelocity, velocity.read.tex, 0);
    gl.uniform2f(programs.curl.uniforms.uTexel, texel[0], texel[1]);
    target(curl);
    draw();

    bindProgram(programs.vorticity);
    bindTex(programs.vorticity.uniforms.uVelocity, velocity.read.tex, 0);
    bindTex(programs.vorticity.uniforms.uCurl, curl.tex, 1);
    gl.uniform2f(programs.vorticity.uniforms.uTexel, texel[0], texel[1]);
    gl.uniform1f(programs.vorticity.uniforms.uCurlForce, vorticity);
    gl.uniform1f(programs.vorticity.uniforms.uDt, dt);
    target(velocity.write);
    draw();
    velocity.swap();

    bindProgram(programs.divergence);
    bindTex(programs.divergence.uniforms.uVelocity, velocity.read.tex, 0);
    gl.uniform2f(programs.divergence.uniforms.uTexel, texel[0], texel[1]);
    target(divergence);
    draw();

    clearBuffer(pressure, 0);
    for (let i = 0; i < quality; i++) {
        bindProgram(programs.pressure);
        bindTex(programs.pressure.uniforms.uPressure, pressure.read.tex, 0);
        bindTex(programs.pressure.uniforms.uDivergence, divergence.tex, 1);
        gl.uniform2f(programs.pressure.uniforms.uTexel, texel[0], texel[1]);
        target(pressure.write);
        draw();
        pressure.swap();
    }

    bindProgram(programs.gradient);
    bindTex(programs.gradient.uniforms.uPressure, pressure.read.tex, 0);
    bindTex(programs.gradient.uniforms.uVelocity, velocity.read.tex, 1);
    gl.uniform2f(programs.gradient.uniforms.uTexel, texel[0], texel[1]);
    target(velocity.write);
    draw();
    velocity.swap();
}

function injectAudioForces() {
    const react = Number(ctrlReact.value);
    const bassForce = Number(ctrlBounce.value);
    const densityGain = Number(ctrlIntensity.value);
    const spin = Number(ctrlSpin.value);
    const colors = [rgb(pal.colors[0]), rgb(pal.colors[1]), rgb(pal.colors[2])];

    const beatKick = beat * (1 + bass * 2.5);
    const centerPush = (0.8 + bass * 5.2) * bassForce * react;
    const angle = time * 0.9 + spin * 1.7;
    splat(velocity, 0.5, 0.5, Math.cos(angle) * centerPush, Math.sin(angle) * centerPush, 0, 0.006 + bass * 0.018 + beatKick * 0.018);
    splat(density, 0.5, 0.5, colors[0][0] * densityGain * (0.34 + beatKick * 1.15), colors[0][1] * densityGain * (0.34 + beatKick * 1.15), colors[0][2] * densityGain * (0.34 + beatKick * 1.15), 0.01 + beatKick * 0.02);

    const emitters = 5;
    for (let i = 0; i < emitters; i++) {
        const band = smoothedBins[Math.floor((i / emitters) * (BINS - 1))] || 0;
        const a = time * (0.45 + i * 0.08) + i * Math.PI * 2 / emitters;
        const x = 0.5 + Math.cos(a) * (0.18 + mid * 0.18);
        const y = 0.5 + Math.sin(a * 1.13) * (0.18 + treble * 0.12);
        const force = (0.18 + band * 2.7 + mid * 1.6) * react;
        const tangent = a + Math.PI * 0.5 + spin * 0.25;
        splat(velocity, x, y, Math.cos(tangent) * force, Math.sin(tangent) * force, 0, 0.0035 + band * 0.012);
        const c = colors[i % colors.length];
        splat(density, x, y, c[0] * densityGain * (0.12 + band * 0.48), c[1] * densityGain * (0.12 + band * 0.48), c[2] * densityGain * (0.12 + band * 0.48), 0.004 + treble * 0.008);
    }

    while (pendingExplosions > 0) {
        fluidExplosion();
        pendingExplosions -= 1;
    }
}

function fluidExplosion() {
    const react = Number(ctrlReact.value);
    const bassForce = Number(ctrlBounce.value);
    const densityGain = Number(ctrlIntensity.value);
    const colors = [rgb(pal.colors[0]), rgb(pal.colors[1]), rgb(pal.colors[2]), rgb(pal.accents[1] || pal.colors[1])];
    const cx = 0.5 + (Math.random() - 0.5) * 0.06;
    const cy = 0.5 + (Math.random() - 0.5) * 0.06;
    const power = (3.2 + bass * 8.5) * Math.max(0.25, bassForce) * react;
    const densityPower = densityGain * (0.7 + bass * 1.4);

    splat(velocity, cx, cy, 0, 0, 0, 0.045 + bass * 0.035);
    for (let i = 0; i < 18; i++) {
        const t = i / 18;
        const a = t * Math.PI * 2 + time * 0.7 + Math.sin(i * 17.13) * 0.28;
        const ring = 0.025 + (i % 3) * 0.018 + Math.random() * 0.02;
        const x = cx + Math.cos(a) * ring;
        const y = cy + Math.sin(a) * ring;
        const radial = power * (0.65 + Math.random() * 0.7);
        const swirl = power * 0.32 * (i % 2 === 0 ? 1 : -1);
        const vx = Math.cos(a) * radial + Math.cos(a + Math.PI * 0.5) * swirl;
        const vy = Math.sin(a) * radial + Math.sin(a + Math.PI * 0.5) * swirl;
        const c = colors[i % colors.length];

        splat(velocity, x, y, vx, vy, 0, 0.008 + Math.random() * 0.015 + bass * 0.012);
        splat(density, x, y, c[0] * densityPower * 0.85, c[1] * densityPower * 0.85, c[2] * densityPower * 0.85, 0.01 + Math.random() * 0.018);
    }

    const core = colors[0];
    splat(density, cx, cy, core[0] * densityPower * 1.35, core[1] * densityPower * 1.35, core[2] * densityPower * 1.35, 0.025 + bass * 0.025);
}

function bloomPass() {
    bindProgram(programs.bloom);
    bindTex(programs.bloom.uniforms.uTexture, density.read.tex, 0);
    gl.uniform2f(programs.bloom.uniforms.uTexel, 1 / simW, 1 / simH);
    gl.uniform2f(programs.bloom.uniforms.uDirection, 1, 0);
    target(bloomA);
    draw();
    bindTex(programs.bloom.uniforms.uTexture, bloomA.tex, 0);
    gl.uniform2f(programs.bloom.uniforms.uTexel, 1 / bloomA.width, 1 / bloomA.height);
    gl.uniform2f(programs.bloom.uniforms.uDirection, 0, 1);
    target(bloomB);
    draw();
}

function render() {
    bloomPass();
    const prg = programs.display;
    bindProgram(prg);
    bindTex(prg.uniforms.uDensity, density.read.tex, 0);
    bindTex(prg.uniforms.uVelocity, velocity.read.tex, 1);
    bindTex(prg.uniforms.uBloom, bloomB.tex, 2);
    const a = rgb(pal.colors[0]);
    const b = rgb(pal.colors[1]);
    const c = rgb(pal.colors[2]);
    const bg = rgb(pal.bg);
    gl.uniform3f(prg.uniforms.uColorA, a[0], a[1], a[2]);
    gl.uniform3f(prg.uniforms.uColorB, b[0], b[1], b[2]);
    gl.uniform3f(prg.uniforms.uColorC, c[0], c[1], c[2]);
    gl.uniform3f(prg.uniforms.uBg, bg[0], bg[1], bg[2]);
    gl.uniform1f(prg.uniforms.uTime, time);
    gl.uniform1f(prg.uniforms.uBass, bass);
    gl.uniform1f(prg.uniforms.uMid, mid);
    gl.uniform1f(prg.uniforms.uTreble, treble);
    gl.uniform1f(prg.uniforms.uBloomStrength, Number(ctrlThickness.value));
    gl.uniform1f(prg.uniforms.uIntensity, Number(ctrlIntensity.value));
    gl.uniform2f(prg.uniforms.uResolution, W, H);
    target(null);
    draw();
}

function setupLogBins(isSimulated = false) {
    logIndices = [];
    const nyquist = (isSimulated ? 44100 : audioCtx.sampleRate) / 2;
    const minLog = Math.log10(20);
    const maxLog = Math.log10(16000);
    for (let i = 0; i < BINS; i++) {
        const f = Math.pow(10, minLog + (i / (BINS - 1)) * (maxLog - minLog));
        logIndices.push(Math.max(0, Math.min(BIN_COUNT - 1, Math.floor((f / nyquist) * BIN_COUNT))));
    }
}

function getEnergy(data, from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += Math.max(0, Math.min(1, (data[i] - MIN_DB) / (MAX_DB - MIN_DB)));
    return sum / Math.max(1, to - from);
}

function simulatedAudio() {
    for (let i = 0; i < BIN_COUNT; i++) dataArray[i] = MIN_DB + Math.random() * 4;
    const kick = Math.max(0, Math.sin(time * 3.1)) ** 18;
    const pad = 0.5 + 0.5 * Math.sin(time * 0.7);
    const tick = 0.5 + 0.5 * Math.sin(time * 9.0);
    for (let i = 1; i < BIN_COUNT * 0.05; i++) dataArray[i] = MIN_DB + kick * 76;
    for (let i = BIN_COUNT * 0.05; i < BIN_COUNT * 0.34; i++) dataArray[i] = MIN_DB + pad * 42;
    for (let i = BIN_COUNT * 0.34; i < BIN_COUNT * 0.82; i++) dataArray[i] = MIN_DB + tick * 24;
}

function updateAudio() {
    if (useRealAudio && analyser) analyser.getFloatFrequencyData(dataArray);
    else simulatedAudio();

    for (let i = 0; i < BINS; i++) {
        const raw = Math.max(0, Math.min(1, (dataArray[logIndices[i] || 0] - MIN_DB) / (MAX_DB - MIN_DB)));
        smoothedBins[i] = smoothedBins[i] * 0.72 + raw * 0.28;
    }
    const b = getEnergy(dataArray, 1, Math.floor(BIN_COUNT * 0.055));
    const m = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.055), Math.floor(BIN_COUNT * 0.34));
    const t = getEnergy(dataArray, Math.floor(BIN_COUNT * 0.34), Math.floor(BIN_COUNT * 0.82));
    bass = bass * 0.78 + b * 0.22;
    mid = mid * 0.82 + m * 0.18;
    treble = treble * 0.84 + t * 0.16;
    const isBeat = b - lastBass > 0.018 && b > 0.052;
    beat = Math.max(0, beat - 0.04);
    if (isBeat) {
        beat = Math.min(1.65, 1 + Number(ctrlBounce.value) * 0.18);
        pendingExplosions = Math.min(2, pendingExplosions + 1);
    }
    lastBass = b;
}

function updateVideo() {
    if (!videoReady || !videoEl || frame % 4 !== 0) return;
    videoCanvas.width = 24;
    videoCanvas.height = 14;
    try {
        videoCtx.drawImage(videoEl, 0, 0, videoCanvas.width, videoCanvas.height);
        const px = videoCtx.getImageData(0, 0, videoCanvas.width, videoCanvas.height).data;
        let luma = 0;
        let motion = 0;
        for (let i = 0; i < px.length; i += 4) {
            const v = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255;
            const j = i / 4;
            motion += Math.abs(v - (lastVideo[j] ?? v));
            lastVideo[j] = v;
            luma += v;
        }
        const total = videoCanvas.width * videoCanvas.height;
        videoLuma = videoLuma * 0.86 + (luma / total) * 0.14;
        videoMotion = videoMotion * 0.78 + (motion / total) * 0.22;
        if (videoMotion > 0.008) {
            const c = rgb(pal.accents[1]);
            splat(density, 0.5 + (videoLuma - 0.5) * 0.5, 0.5, c[0] * videoMotion * 4.5, c[1] * videoMotion * 4.5, c[2] * videoMotion * 4.5, 0.014 + videoMotion * 0.025);
        }
    } catch (err) {
        videoReady = false;
    }
}

function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.033, Math.max(0.008, (now - lastTime) / 1000));
    lastTime = now;
    time += dt;
    frame += 1;
    updateAudio();
    updateVideo();
    injectAudioForces();
    step(dt);
    render();
}

function renderPaletteButtons() {
    const grid = document.getElementById('presetGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.entries(PALETTES).forEach(([key, palette]) => {
        const btn = document.createElement('button');
        btn.className = `preset-btn${key === currentPaletteKey ? ' active' : ''}`;
        btn.dataset.preset = key;
        btn.textContent = palette.label || key.toUpperCase();
        btn.style.setProperty('--swatch-a', palette.colors[0]);
        btn.style.setProperty('--swatch-b', palette.colors[1]);
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
    overlay.style.display = 'none';
    controlsPanel.classList.remove('hidden');
    resize();
    dataArray = new Float32Array(BIN_COUNT);
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: { frameRate: 30, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        videoEl = document.createElement('video');
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.srcObject = stream;
        await videoEl.play();
        videoReady = true;
        if (stream.getAudioTracks().length) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = BIN_COUNT * 2;
            analyser.minDecibels = MIN_DB;
            analyser.maxDecibels = MAX_DB;
            analyser.smoothingTimeConstant = 0.58;
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            useRealAudio = true;
            setupLogBins();
        } else {
            useRealAudio = false;
            setupLogBins(true);
        }
    } catch (err) {
        videoReady = false;
        useRealAudio = false;
        setupLogBins(true);
    }
    lastTime = performance.now();
    requestAnimationFrame(loop);
});

const toggleUIBtn = document.createElement('button');
toggleUIBtn.id = 'toggleUIBtn';
toggleUIBtn.innerText = '[ HIDE UI ]';
document.body.appendChild(toggleUIBtn);
toggleUIBtn.addEventListener('click', () => {
    controlsPanel.classList.toggle('hidden');
    toggleUIBtn.innerText = controlsPanel.classList.contains('hidden') ? '[ SHOW UI ]' : '[ HIDE UI ]';
});

window.addEventListener('resize', resize);
renderPaletteButtons();
resize();
setupLogBins(true);
