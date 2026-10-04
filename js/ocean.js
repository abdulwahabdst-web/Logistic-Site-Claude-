/* =========================================================
   Procedural ocean (WebGL fragment shader)
   deep-water colour field + wave normals + sun glints,
   and a foam wake generated around a ship rectangle.
   ========================================================= */
(function () {
  'use strict';

  const VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;      // world units per device pixel
uniform vec2 uOffset;      // world-space flow offset
uniform vec4 uShip;        // ship centre (device px, GL coords), half width, half length
uniform float uWake;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.03; a *= 0.5; }
  return v;
}
float waves(vec2 p, float t) {
  float h = fbm(p + vec2(t * 0.05, -t * 0.08));
  h += 0.5 * fbm(p * 2.3 + vec2(-t * 0.09, t * 0.04));
  return h;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 wp = (frag - 0.5 * uRes) * uScale + uOffset;
  float t = uTime;

  // texture space partially compensates the camera zoom, so the water gets
  // finer as the camera rises without turning into large cloudy blotches
  float zf = sqrt(max(uScale, 0.25));
  vec2 wq = wp / zf;

  // large depth / wind patches
  float patchN = fbm(wq * 0.0008 + vec2(0.0, t * 0.002));
  float patch2 = fbm(wq * 0.0024 - vec2(t * 0.003, 0.0));
  float contrast = mix(1.0, 0.55, smoothstep(1.5, 10.0, uScale));
  vec3 deep = vec3(0.012, 0.07, 0.29);
  vec3 mid = vec3(0.035, 0.18, 0.56);
  vec3 col = mix(deep, mid, smoothstep(-0.4, 0.45, (patchN * 0.9 + patch2 * 0.55) * contrast + 0.02));

  // soft wind ripples
  vec2 q = vec2(wq.x * 0.03, wq.y * 0.046);
  float e = 0.35;
  float h0 = waves(q, t);
  float hx = waves(q + vec2(e, 0.0), t);
  float hy = waves(q + vec2(0.0, e), t);
  vec3 n = normalize(vec3((h0 - hx) * 0.9, (h0 - hy) * 0.9, 1.0));
  vec3 L = normalize(vec3(-0.4, 0.5, 0.75));
  col *= 0.8 + 0.34 * clamp(dot(n, L), 0.0, 1.0);
  // lighter streaks where the wind roughens the surface
  col += vec3(0.03, 0.08, 0.18) * smoothstep(0.1, 0.7, patch2 + 0.25) * 0.6;

  // sparse sun glints
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 260.0);
  float sparse = smoothstep(0.1, 0.55, fbm(wp * 0.0035 + vec2(t * 0.01, 0.0)));
  col += vec3(0.85, 0.92, 1.0) * spec * sparse * 1.1;

  // ---------------- wake / foam ----------------
  vec2 sp = frag - uShip.xy;
  float hw = max(uShip.z, 1.0), hl = max(uShip.w, 1.0);
  float s = sp.y + hl;                 // distance from bow (bow at bottom, stern at top)
  float ax = abs(sp.x);
  float foamTex = fbm(wp * 0.011 + vec2(0.0, -t * 0.25)) * 0.7 + fbm(wp * 0.031 + vec2(t * 0.1, -t * 0.6)) * 0.45;
  float streak = fbm(vec2(wp.x * 0.02, wp.y * 0.0045 - t * 0.35));

  float foam = 0.0;
  // hull foam along both sides
  float along = clamp(s / (2.0 * hl), 0.0, 1.2);
  float side = ax - hw;
  float hullW = hw * (0.22 + 0.6 * smoothstep(0.0, 1.0, along));
  if (s > -hw * 0.2 && s < 2.0 * hl - hw * 0.15) {
    float band = 1.0 - smoothstep(0.0, hullW, side);
    band *= smoothstep(-hw * 0.12, 0.0, side);
    float core = (1.0 - smoothstep(0.0, hullW * 0.35, side)) * smoothstep(-hw * 0.04, hw * 0.03, side);
    foam = max(foam, band * smoothstep(0.0, 0.42, foamTex + 0.25 * streak + 0.22));
    foam = max(foam, core * 0.85);
  }
  // bow pressure wave
  float bow = exp(-pow(length(vec2(sp.x * 0.8, s + hw * 0.1)) / (hw * 0.75), 2.0));
  foam = max(foam, bow * smoothstep(0.0, 0.5, foamTex + 0.35));
  // Kelvin wake arms
  if (s > 0.0) {
    float armX = hw * 0.85 + s * 0.354;
    float armW = hw * 0.12 + s * 0.035;
    float arm = exp(-pow((ax - armX) / armW, 2.0)) * exp(-s / (hl * 5.0));
    foam = max(foam, arm * smoothstep(0.1, 0.6, foamTex + 0.2) * 0.85);
  }
  // turbulent trail behind the stern
  float b = s - 2.0 * hl;
  if (b > -hw) {
    float trailW = hw * (0.8 + 0.18 * max(b, 0.0) / hw);
    float trail = (1.0 - smoothstep(trailW * 0.55, trailW, ax)) * exp(-max(b, 0.0) / (hl * 3.2));
    trail *= smoothstep(-hw, 0.0, b);
    foam = max(foam, trail * smoothstep(0.0, 0.55, foamTex + 0.25 * streak + 0.28));
    // lighter churned water in the trail
    col = mix(col, vec3(0.07, 0.3, 0.75), trail * 0.45);
  }
  foam *= uWake;
  col = mix(col, vec3(0.86, 0.92, 1.0), clamp(foam, 0.0, 1.0) * 0.92);

  // vignette
  vec2 uv = frag / uRes;
  col *= 0.82 + 0.18 * smoothstep(1.25, 0.25, length(uv - 0.5) * 1.4);

  gl_FragColor = vec4(col, 1.0);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }

  class Ocean {
    constructor(opts) {
      this.canvas = opts.canvas;
      this.quality = opts.quality || 0.75;   // render-scale relative to CSS px
      this.zoom = 1;                          // world units per CSS px
      this.flow = 60;                         // water speed (world units / s)
      this.offset = [0, 0];
      this.ship = { x: 0, y: 0, hw: 0, hl: 0 };
      this.wake = 1;
      this.time = Math.random() * 100;
      this.running = false;
      this._raf = this._raf.bind(this);
      const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
      this.gl = gl;
      if (!gl) return;
      const vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) { this.gl = null; return; }
      const prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      ['uRes', 'uTime', 'uScale', 'uOffset', 'uShip', 'uWake'].forEach((n) => { this.u[n] = gl.getUniformLocation(prog, n); });
      this.resize();
    }

    resize() {
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      this.cw = w; this.ch = h;
      this.k = this.quality;
      this.canvas.width = Math.max(1, Math.round(w * this.k));
      this.canvas.height = Math.max(1, Math.round(h * this.k));
      if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      if (!this.running) this.render();
    }

    /* ship rect in CSS px (centre x/y from the top-left, half width, half length) */
    setShip(x, y, hw, hl) { this.ship.x = x; this.ship.y = y; this.ship.hw = hw; this.ship.hl = hl; }

    render() {
      const gl = this.gl;
      if (!gl) return;
      const k = this.k;
      gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.u.uTime, this.time);
      gl.uniform1f(this.u.uScale, this.zoom / k);
      gl.uniform2f(this.u.uOffset, this.offset[0], this.offset[1]);
      gl.uniform4f(this.u.uShip, this.ship.x * k, (this.ch - this.ship.y) * k, this.ship.hw * k, this.ship.hl * k);
      gl.uniform1f(this.u.uWake, this.wake);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    _raf(now) {
      if (!this.running) return;
      const dt = this._last ? Math.min(0.05, (now - this._last) / 1000) : 0.016;
      this._last = now;
      this.time += dt;
      this.offset[1] -= this.flow * dt;
      this.render();
      requestAnimationFrame(this._raf);
    }

    start() { if (this.running || !this.gl) return; this.running = true; this._last = 0; requestAnimationFrame(this._raf); }
    stop() { this.running = false; }
  }

  window.Ocean = Ocean;
})();
