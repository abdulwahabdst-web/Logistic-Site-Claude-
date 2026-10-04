/* =========================================================
   Dotted WebGL globe
   - fragment shader renders a dotted land mask on a sphere with an
     orange/blue atmospheric rim (no 3D library needed)
   - a 2D canvas overlay draws animated route arcs
   - DOM labels are projected onto the sphere each frame
   ========================================================= */
(function () {
  'use strict';

  const VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  const FRAG = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
precision highp float;
uniform vec3 uGlobe;      // centre (device px, GL coords) + radius (device px)
uniform mat3 uRot;        // view -> world
uniform sampler2D uLand;
uniform float uRows;
uniform float uTime;
uniform float uFade;
uniform float uGlow;
const float PI = 3.14159265359;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 p = (gl_FragCoord.xy - uGlobe.xy) / uGlobe.z;
  float r = length(p);
  vec2 dir = p / max(r, 1e-4);
  float px = 1.0 / uGlobe.z;

  vec3 orange = vec3(1.0, 0.43, 0.12);
  vec3 blue = vec3(0.09, 0.28, 1.0);
  float up = smoothstep(-0.12, 0.6, dir.y + 0.18 * dir.x);
  vec3 rim = mix(blue, orange, up);

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  if (r < 1.0) {
    float z = sqrt(max(0.0, 1.0 - r * r));
    vec3 w = uRot * vec3(p, z);
    float lat = asin(clamp(w.y, -1.0, 1.0));
    float lon = atan(w.x, w.z);

    float dLat = PI / uRows;
    float row = floor((lat + 0.5 * PI) / dLat);
    float latC = -0.5 * PI + (row + 0.5) * dLat;
    float nLon = max(1.0, floor(2.0 * uRows * cos(latC) + 0.5));
    float dLon = 2.0 * PI / nLon;
    float c = floor((lon + PI) / dLon);
    float lonC = -PI + (c + 0.5) * dLon;
    vec3 dc = vec3(cos(latC) * sin(lonC), sin(latC), cos(latC) * cos(lonC));
    float d = length(w - dc);
    float rad = dLat * 0.25;
#ifdef GL_OES_standard_derivatives
    float aa = max(fwidth(d), 1e-5) * 0.9;
#else
    float aa = px * 0.8;
#endif
    float dotm = 1.0 - smoothstep(rad - aa, rad + aa, d);
    float land = step(0.5, texture2D(uLand, vec2((lonC + PI) / (2.0 * PI), (0.5 * PI - latC) / PI)).r);

    float h = hash(vec2(row, c));
    float tw = 0.78 + 0.22 * sin(uTime * (0.8 + h * 2.2) + h * 40.0);
    float limb = 1.0 - z;

    // dark body with scattering toward the limb
    vec3 body = rim * pow(limb, 2.6) * 1.15;
    body += blue * pow(limb, 1.4) * smoothstep(0.1, 0.9, -dir.y) * 0.32;

    float bright = (0.5 + 0.5 * h) * tw * (0.65 + 0.55 * smoothstep(0.15, 0.95, limb + 0.25 * up));
    vec3 dotCol = mix(vec3(1.0), rim, 0.25 * pow(limb, 2.0)) * bright;
    col = body + dotCol * dotm * land * uFade * smoothstep(0.0, 0.06, z);

    // thin bright rim just inside the edge
    float rimLine = exp(-pow((1.0 - r) / (2.5 * px), 2.0));
    col += rim * rimLine * 1.3 * uGlow;

    float edge = 1.0 - smoothstep(1.0 - 1.5 * px, 1.0, r);
    alpha = edge;
    col *= edge;
  }

  // additive halo outside the disc (alpha 0 -> adds onto the stars)
  float o = max(r - 1.0, 0.0);
  float wide = mix(14.0, 7.5, 1.0 - up);
  float halo = exp(-o * wide) * 0.5 + exp(-o * 55.0) * 0.75;
  halo *= smoothstep(1.0 - 2.0 * px, 1.0, r);
  col += rim * halo * uGlow;

  gl_FragColor = vec4(col, alpha);
}`;

  const DEG = Math.PI / 180;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function vec(lat, lon) {
    const la = lat * DEG, lo = lon * DEG;
    return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
  }

  class Globe {
    constructor(opts) {
      this.canvas = opts.canvas;
      this.arcCanvas = opts.arcCanvas;
      this.labelLayer = opts.labelLayer;
      this.layout = opts.layout;           // () => {x, y, r} in CSS px
      this.places = opts.places || [];
      this.routes = opts.routes || [];
      this.rows = opts.rows || 180;
      this.spin = opts.spin != null ? opts.spin : 0;
      this.tilt = opts.tilt != null ? opts.tilt : 0.2;
      this.speed = opts.speed || 0.07;     // rad / s
      this.boost = 0;                      // extra spin (intro / scroll)
      this.fade = 0;
      this.glow = 0;
      this.labelAlpha = 0;
      this.running = false;
      this.time = 0;
      this.ready = false;
      this._last = 0;
      this._raf = this._raf.bind(this);
      this._init(opts.landSrc);
      this._buildLabels();
      this.resize();
    }

    _init(landSrc) {
      const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
      this.gl = gl;
      if (!gl) return;
      gl.getExtension('OES_standard_derivatives');
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) { this.gl = null; return; }
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.useProgram(prog);
      this.prog = prog;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      ['uGlobe', 'uRot', 'uLand', 'uRows', 'uTime', 'uFade', 'uGlow'].forEach((n) => { this.u[n] = gl.getUniformLocation(prog, n); });

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const img = new Image();
      img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        this.ready = true;
        if (!this.running) this.render();
      };
      img.src = landSrc;
    }

    _buildLabels() {
      this.labels = this.places.map((p) => {
        const el = document.createElement('div');
        el.className = 'gl';
        el.innerHTML = '<b></b><i></i>';
        el.firstChild.textContent = p.name;
        this.labelLayer.appendChild(el);
        return { el, v: vec(p.lat, p.lon), w: 0, h: 0, vis: -1 };
      });
      this.arcs = this.routes.map((r, i) => {
        const a = vec(r[0][0], r[0][1]), b = vec(r[1][0], r[1][1]);
        const ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
        return { a, b, ang, delay: i * 0.6, period: this.routes.length * 0.6 + 1.2 };
      });
    }

    measureLabels() {
      this.labels.forEach((l) => { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; });
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 2);
      this.dpr = dpr;
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      this.cw = w; this.ch = h;
      [this.canvas, this.arcCanvas].forEach((c) => {
        c.width = Math.max(1, Math.round(w * dpr));
        c.height = Math.max(1, Math.round(h * dpr));
      });
      this.ctx = this.arcCanvas.getContext('2d');
      if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.geo = this.layout(w, h);
      this.measureLabels();
      if (!this.running) this.render();
    }

    // world -> view rotation (row-major 3x3) : Rx(tilt) * Ry(spin)
    _matrix() {
      const cs = Math.cos(this.spin), ss = Math.sin(this.spin), ct = Math.cos(this.tilt), st = Math.sin(this.tilt);
      // Ry = [[cs,0,ss],[0,1,0],[-ss,0,cs]] ; Rx = [[1,0,0],[0,ct,-st],[0,st,ct]]
      return [
        cs, 0, ss,
        st * ss, ct, -st * cs,
        -ct * ss, st, ct * cs,
      ];
    }

    _project(m, v, alt) {
      const x = (m[0] * v[0] + m[1] * v[1] + m[2] * v[2]) * alt;
      const y = (m[3] * v[0] + m[4] * v[1] + m[5] * v[2]) * alt;
      const z = (m[6] * v[0] + m[7] * v[1] + m[8] * v[2]) * alt;
      const g = this.geo;
      return { x: g.x + x * g.r, y: g.y - y * g.r, z, rr: Math.sqrt(x * x + y * y) };
    }

    render() {
      const g = this.geo;
      if (!g) return;
      const m = this._matrix();
      const gl = this.gl;
      if (gl && this.ready) {
        const dpr = this.dpr;
        gl.uniform3f(this.u.uGlobe, g.x * dpr, (this.ch - g.y) * dpr, g.r * dpr);
        // view -> world = transpose(world -> view); GL expects column-major => pass row-major m as-is
        gl.uniformMatrix3fv(this.u.uRot, false, new Float32Array(m));
        gl.uniform1f(this.u.uRows, this.rows);
        gl.uniform1f(this.u.uTime, this.time);
        gl.uniform1f(this.u.uFade, this.fade);
        gl.uniform1f(this.u.uGlow, this.glow);
        gl.uniform1i(this.u.uLand, 0);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      this._drawArcs(m);
      this._placeLabels(m);
    }

    _drawArcs(m) {
      const ctx = this.ctx, dpr = this.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.arcCanvas.width, this.arcCanvas.height);
      if (this.fade < 0.05) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const N = 48;
      for (const arc of this.arcs) {
        const t = ((this.time - arc.delay) % arc.period + arc.period) % arc.period;
        const dur = 2.2;
        if (t > dur + 1.4) continue;
        const head = Math.min(1, t / dur);
        const tail = Math.max(0, Math.min(1, (t - 1.0) / (dur + 0.4 - 1.0)));
        if (head <= tail) continue;
        const sinA = Math.sin(arc.ang) || 1e-6;
        let prev = null;
        for (let i = 0; i <= N; i++) {
          const f = tail + (head - tail) * (i / N);
          const k1 = Math.sin((1 - f) * arc.ang) / sinA, k2 = Math.sin(f * arc.ang) / sinA;
          const v = [arc.a[0] * k1 + arc.b[0] * k2, arc.a[1] * k1 + arc.b[1] * k2, arc.a[2] * k1 + arc.b[2] * k2];
          const alt = 1 + Math.sin(Math.PI * f) * (0.06 + arc.ang * 0.16);
          const p = this._project(m, v, alt);
          const hidden = p.z < 0 && p.rr < 1;
          if (prev && !hidden && !prev.hidden) {
            const a = (i / N) * this.fade;
            ctx.strokeStyle = `rgba(255, ${110 + 60 * (i / N)}, 40, ${0.85 * a})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
          p.hidden = hidden;
          prev = p;
        }
        if (prev && !prev.hidden && head < 1) {
          const grd = ctx.createRadialGradient(prev.x, prev.y, 0, prev.x, prev.y, 9);
          grd.addColorStop(0, `rgba(255,190,120,${0.9 * this.fade})`);
          grd.addColorStop(1, 'rgba(255,90,30,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(prev.x, prev.y, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    _placeLabels(m) {
      const W = this.cw, H = this.ch;
      for (const l of this.labels) {
        const p = this._project(m, l.v, 1);
        let o = Math.min(1, Math.max(0, (p.z - 0.12) / 0.25)) * this.labelAlpha;
        if (p.x < -60 || p.x > W + 60 || p.y < -40 || p.y > H + 40) o = 0;
        if (o <= 0.001) {
          if (l.vis !== 0) { l.el.style.opacity = '0'; l.vis = 0; }
          continue;
        }
        l.vis = 1;
        l.el.style.opacity = o.toFixed(3);
        l.el.style.transform = `translate3d(${(p.x - l.w / 2).toFixed(1)}px, ${(p.y - l.h + 3.5).toFixed(1)}px, 0)`;
      }
    }

    _raf(now) {
      if (!this.running) return;
      const dt = this._last ? Math.min(0.05, (now - this._last) / 1000) : 0.016;
      this._last = now;
      this.time += dt;
      this.spin += (this.speed + this.boost) * dt;
      this.render();
      requestAnimationFrame(this._raf);
    }

    start() {
      if (this.running) return;
      this.running = true;
      this._last = 0;
      requestAnimationFrame(this._raf);
    }

    stop() { this.running = false; }

    centerOn(lon) { this.spin = -lon * DEG; }
  }

  window.Globe = Globe;
})();
