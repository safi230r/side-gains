/* Side Gains visual effects. All original, no libraries:
   ambient arena light (WebGL), ray-marched 3D athletes, foil textures, tilt, particles, liquid shaker, flames, lightning, synthesized sound. */
import { ANIM, FORM } from "./catalog.js";

export const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
let softGL = null;
function isSoft(gl) { if (softGL === null) { const e = gl.getExtension("WEBGL_debug_renderer_info"); softGL = /swiftshader|llvmpipe|software|basic render/i.test(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : ""); } return softGL; }
export const RCOL = { common: "#c6cbd4", rare: "#2f9bff", epic: "#e84bff", legendary: "#ffc02e", signal: "#ff5c1a" };
export const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

/* ---------- sprite helpers for the Figma artwork sheets ---------- */
const cell = (cls, i, cols, rows, style = "") => `<span class="${cls}" style="background-position:${(i % cols) / (cols - 1) * 100}% ${Math.floor(i / cols) / (rows - 1) * 100}%;${style}" aria-hidden="true"></span>`;
export const pin = (i, style) => cell("pin", i, 4, 4, style);
export const rankEm = (i, style) => cell("rank-em", i, 3, 2, style);
export const stk = (i, style) => cell("stk", i, 3, 2, style);

/* ---------- WebGL helpers ---------- */
export function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); throw new Error("shader: " + log); }
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}
const FULL_VS = `#version 300 es
void main(){ vec2 v=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(v*2.-1.,0,1); }`;
const NOISE = `
float h21(vec2 p){ p=fract(p*vec2(234.34,435.345)); p+=dot(p,p+34.23); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.; a*=.5; } return s; }`;

/* ---------- pointer / gyroscope tilt, shared by everything ---------- */
export const tilt = { x: 0, y: 0, tx: 0, ty: 0, gyro: false, last: 0 };
addEventListener("pointermove", e => { if (e.pointerType === "touch" && tilt.gyro) return; tilt.tx = e.clientX / innerWidth * 2 - 1; tilt.ty = e.clientY / innerHeight * 2 - 1; tilt.last = performance.now(); }, { passive: true });
let gyro0 = null;
function onGyro(e) {
  if (e.beta == null) return;
  if (!gyro0) gyro0 = { b: e.beta, g: e.gamma };
  gyro0.b += (e.beta - gyro0.b) * .01; gyro0.g += (e.gamma - gyro0.g) * .01;
  tilt.gyro = true; tilt.last = performance.now();
  tilt.tx = clamp((e.gamma - gyro0.g) / 22, -1, 1); tilt.ty = clamp((e.beta - gyro0.b) / 22, -1, 1);
}
export function askGyro() {
  if (RM || askGyro.done) return; askGyro.done = true;
  try {
    const D = window.DeviceOrientationEvent;
    if (!D) return;
    if (D.requestPermission) D.requestPermission().then(r => { if (r === "granted") addEventListener("deviceorientation", onGyro); }).catch(() => {});
    else addEventListener("deviceorientation", onGyro);
  } catch (e) {}
}

/* ---------- procedural foil textures, handed to CSS ---------- */
function tex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return c; }
export function makeTextures() {
  const root = document.documentElement.style, put = (n, c, type = "image/png", q) => root.setProperty(n, `url(${c.toDataURL(type, q)})`);
  const R = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  /* speckled rubber gym floor */
  put("--tex-floor", tex(320, 320, (g, w, h) => {
    g.fillStyle = "#0d0e11"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 14 + R() * 26 | 0; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(R() * w, R() * h, 1 + R() * 1.5, 1 + R() * 1.5); }
    const cols = ["#ff5c1a", "#f4f1e8", "#2f7bff", "#8d8f98"];
    for (let i = 0; i < 105; i++) { g.globalAlpha = .16 + R() * .34; g.fillStyle = cols[(R() * 4) | 0]; const x = R() * w, y = R() * h, r = .6 + R() * 1.7; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + R(); g.lineTo(x + Math.cos(a) * r * (.6 + R() * .7), y + Math.sin(a) * r * (.6 + R() * .7)); } g.fill(); }
  }), "image/webp", .8);
  /* glitter */
  put("--tex-glitter", tex(220, 220, (g, w, h) => { for (let i = 0; i < 1500; i++) { const v = 80 + R() * 175 | 0; g.globalAlpha = R() * .9; g.fillStyle = `rgb(${v},${v},${v})`; const s = R() < .06 ? 2.4 : 1.1; g.fillRect(R() * w, R() * h, s, s); } }));
  /* cracked glass: voronoi facets */
  put("--tex-shards", tex(280, 280, (g, w, h) => {
    const pts = Array.from({ length: 46 }, () => [R() * w, R() * h, R()]), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let a = 1e9, b = 1e9, v = 0;
      for (const p of pts) { let dx = Math.abs(x - p[0]), dy = Math.abs(y - p[1]); dx = Math.min(dx, w - dx); dy = Math.min(dy, h - dy); const d = dx * dx + dy * dy; if (d < a) { b = a; a = d; v = p[2]; } else if (d < b) b = d; }
      const e = Math.sqrt(b) - Math.sqrt(a), l = e < 1.4 ? 255 : 40 + v * 150, i = (y * w + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = l; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }), "image/webp", .8);
  /* halftone */
  put("--tex-dots", tex(12, 12, g => { g.fillStyle = "#fff"; for (const [x, y] of [[3, 3], [9, 9]]) { g.beginPath(); g.arc(x, y, 1.5, 0, 7); g.fill(); } }));
  /* sunburst */
  put("--tex-rays", tex(400, 400, (g, w, h) => { g.translate(w / 2, h / 2); for (let i = 0; i < 48; i++) { g.rotate(Math.PI / 24); g.fillStyle = i % 2 ? "#fff" : "#333"; g.beginPath(); g.moveTo(0, 0); g.lineTo(400, -27); g.lineTo(400, 27); g.fill(); } }), "image/webp", .7);
}

/* ---------- ambient arena light behind the whole app ---------- */
export const ambient = { tint: rgb(RCOL.signal), cur: rgb(RCOL.signal), energy: .5, e: .5, pulse: 0, on: false };
export function setTint(hex, energy = .5) { ambient.tint = rgb(hex); ambient.energy = energy; document.documentElement.style.setProperty("--live", hex); }
export function pulse(v = 1) { ambient.pulse = Math.max(ambient.pulse, v); }
export function initAmbient() {
  if (RM) return;
  const cv = $("#ambient"); if (!cv) return;
  const gl = cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
  if (!gl || isSoft(gl)) return;
  let pr;
  try {
    pr = program(gl, FULL_VS, `#version 300 es
precision mediump float; out vec4 o; uniform vec2 uR; uniform float uT,uE,uP,uS; uniform vec3 uC; uniform vec2 uM;${NOISE}
float beam(vec2 p,vec2 a,float ang,float w){ vec2 d=p-a; float c=cos(ang),s=sin(ang); d=vec2(c*d.x-s*d.y,s*d.x+c*d.y); float y=max(-d.y,0.); float r=w*(.05+y*.55); return smoothstep(r,0.,abs(d.x))*exp(-y*.85)*step(0.,-d.y+.02); }
void main(){
  vec2 p=gl_FragCoord.xy/uR; float ar=uR.x/uR.y; vec2 q=vec2((p.x-.5)*ar,p.y);
  float t=uT*.12; vec2 m=uM*.06;
  float dust=fbm(q*2.4+vec2(t,-t*.6))*.75+fbm(q*7.+vec2(-t*1.4,t))*.35;
  float b=0.; vec3 col=vec3(0);
  float s1=.32*sin(t*1.7)+m.x,s2=-.36*sin(t*1.3+1.)+m.x;
  float b1=beam(q,vec2(-ar*.34+m.x,1.12),.34+s1,.5), b2=beam(q,vec2(ar*.34+m.x,1.12),-.34+s2,.5), b3=beam(q,vec2(m.x*2.,1.16),.2*sin(t*.9),.75);
  col+=uC*(b1+b2)*(.35+dust*.9); col+=vec3(.95,.93,.88)*b3*(.12+dust*.28);
  float glow=exp(-length((q-vec2(0.,.62))*vec2(1.1,1.5))*2.4); col+=uC*glow*(.10+.18*uE);
  /* horizon haze on the floor */
  col+=uC*smoothstep(.0,.5,.5-p.y)*.05*dust;
  /* pulse ring */
  float d=length(q-vec2(0.,.55)); float ring=exp(-pow((d-(1.-uP)*1.6)*7.,2.))*uP; col+=uC*ring*.9;
  /* floating chalk */
  vec2 g=q*vec2(16.)+vec2(t*1.3,-t*2.2+uS*.6); vec2 id=floor(g); float rr=h21(id); vec2 f=fract(g)-.5-vec2(sin(uT*.6+rr*40.),cos(uT*.5+rr*30.))*.3; col+=vec3(1.,.97,.9)*smoothstep(.06*rr,.0,length(f))*step(.72,rr)*.45*(.4+b1+b2+b3);
  col*=.42+.4*uE; col+=(h21(gl_FragCoord.xy+uT)-.5)/255.;
  o=vec4(max(col,0.),0.);
}`);
  } catch (e) { return; }
  ambient.on = true;
  let scale = .4, acc = 0, n = 0, last = 0, hidden = false;
  const size = () => { cv.width = Math.max(2, innerWidth * scale | 0); cv.height = Math.max(2, innerHeight * scale | 0); gl.viewport(0, 0, cv.width, cv.height); };
  size(); addEventListener("resize", size);
  document.addEventListener("visibilitychange", () => (hidden = document.hidden));
  const frame = t => {
    requestAnimationFrame(frame);
    if (hidden || t - last < 30 || document.documentElement.classList.contains("stage-open")) return;
    const dt = Math.min(.1, (t - last) / 1000); last = t;
    for (let i = 0; i < 3; i++) ambient.cur[i] += (ambient.tint[i] - ambient.cur[i]) * Math.min(1, dt * 2.2);
    ambient.e += (ambient.energy - ambient.e) * Math.min(1, dt * 2); ambient.pulse = Math.max(0, ambient.pulse - dt * .8);
    gl.useProgram(pr.p);
    gl.uniform2f(pr.u.uR, cv.width, cv.height); gl.uniform1f(pr.u.uT, t / 1000); gl.uniform1f(pr.u.uE, ambient.e); gl.uniform1f(pr.u.uP, ambient.pulse);
    gl.uniform3fv(pr.u.uC, ambient.cur); gl.uniform2f(pr.u.uM, tilt.x, tilt.y); gl.uniform1f(pr.u.uS, scrollY / innerHeight);
    const t0 = performance.now(); gl.drawArrays(gl.TRIANGLES, 0, 3);
    acc += performance.now() - t0; if (++n === 90) { if (acc / n > 8 && scale > .2) { scale *= .7; size(); } acc = n = 0; }
  };
  requestAnimationFrame(frame);
}

/* ---------- 3D athletes: the 2D pose keyframes become a ray-marched chrome body ---------- */
const lerp = (a, b, u) => a + (b - a) * u, lp = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
const ease = u => (u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
function lerpPose(a, b, u) {
  const r = { s: lp(a.s, b.s, u), h: lp(a.h, b.h, u), m: [lp(a.m[0], b.m[0], u), lp(a.m[1], b.m[1], u)], f: [lp(a.f[0], b.f[0], u), lp(a.f[1], b.f[1], u)] };
  if (a.toe && b.toe) r.toe = [lp(a.toe[0], b.toe[0], u), lp(a.toe[1], b.toe[1], u)];
  r.hf = lerp(a.hf || 0, b.hf || 0, u);
  return r;
}
export function poseAt(A, ms) {
  const fr = A.frames, total = fr.reduce((n, f) => n + f.hold + f.t, 0);
  let x = ((ms % total) + total) % total;
  for (let i = 0; i < fr.length; i++) {
    const f = fr[i];
    if (x < f.hold) return f;
    x -= f.hold;
    if (x < f.t) return lerpPose(f, fr[(i + 1) % fr.length], ease(x / f.t));
    x -= f.t;
  }
  return fr[0];
}
function ik(a, t, l1, l2, sign) {
  const dx = t[0] - a[0], dy = t[1] - a[1], d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + .01, l1 + l2 - .01);
  const c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), th = Math.atan2(dy, dx) + sign * Math.acos(clamp(c, -1, 1));
  return [a[0] + l1 * Math.cos(th), a[1] + l1 * Math.sin(th)];
}
const NP = 30;
const bufA = new Float32Array(NP * 4), bufB = new Float32Array(NP * 4), bufG = new Float32Array(NP);
const W3 = (p, z) => [(p[0] - 100) / 50, (112 - p[1]) / 50, z];
function bones(pose, A, hi) {
  let n = 0;
  const G = g => (hi === "full" ? 1 : hi === g ? 1 : 0);
  const cap = (a, b, r1, r2, g) => { bufA.set(a, n * 4); bufA[n * 4 + 3] = r1; bufB.set(b, n * 4); bufB[n * 4 + 3] = r2; if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) bufB[n * 4] += .002; bufG[n] = g; n++; };
  const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const S = W3(pose.s, 0), H = W3(pose.h, 0);
  let dx = S[0] - H[0], dy = S[1] - H[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const fx = dy, fy = -dx; /* the way the chest faces */
  const at = (u, f, z) => [H[0] + dx * L * u + fx * f, H[1] + dy * L * u + fy * f, z];
  const hf = (pose.hf || 0) * .12;
  let head = [S[0] + dx * .27 + fx * (.03 + hf), S[1] + dy * .27 + fy * (.03 + hf), 0];
  if (head[1] < .13) head[1] = .13;
  const body = hi === "core" ? 1 : 0;
  cap(head, [head[0] + dx * .055, head[1] + dy * .055, 0], .118, .108, 0);
  cap(at(1, .0, 0), head, .068, .06, 0);
  cap(at(0, 0, -.075), at(0, 0, .075), .125, .125, hi === "full" ? 1 : 0);           /* pelvis */
  cap(at(.08, .005, 0), at(.5, .015, 0), .132, .125, Math.max(body, G("full")));       /* waist */
  cap(at(.3, .055, 0), at(.62, .06, 0), .085, .088, body || G("full"));                /* abs */
  cap(at(.82, .015, -.12), at(.82, .015, .12), .135, .135, G("full"));                 /* rib cage */
  cap(at(.46, -.01, -.06), at(.84, -.03, -.17), .1, .095, G("full"));                  /* lats */
  cap(at(.46, -.01, .06), at(.84, -.03, .17), .1, .095, G("full"));
  cap(at(.79, .1, -.045), at(.81, .085, -.12), .078, .07, G("arms"));                  /* pecs */
  cap(at(.79, .1, .045), at(.81, .085, .12), .078, .07, G("arms"));
  cap(at(.97, -.03, -.1), at(.97, -.03, .1), .088, .088, 0);                            /* traps */
  for (let i = 0; i < 2; i++) {
    const z = i ? -1 : 1;
    const kn = ik(pose.h, pose.f[i], 27, 27, A.k), el = ik(pose.s, pose.m[i], 19, 19, A.e);
    const hip = W3(pose.h, z * .1), knee = W3(kn, z * .125), ank = W3(pose.f[i], z * .12);
    const sh = W3(pose.s, z * .225), elb = W3(el, z * .275), hnd = W3(pose.m[i], z * .235);
    ank[1] = Math.max(ank[1], .06);
    cap(hip, knee, .132, .088, G("legs"));
    cap(mix3(hip, knee, .22), mix3(hip, knee, .62), .108, .1, G("legs"));
    cap([H[0] - fx * .07 - dx * .02, H[1] - fy * .07 - dy * .02, z * .085], [hip[0] - fx * .03, hip[1] - fy * .03, z * .1], .115, .1, G("legs")); /* glutes */
    cap(knee, ank, .082, .05, G("legs"));
    cap(mix3(knee, ank, .2), mix3(knee, ank, .46), .083, .068, G("legs"));
    const toe = pose.toe ? pose.toe[i] : pose.f[i][1] - kn[1] > 18 ? [pose.f[i][0] + 9, pose.f[i][1] + 1] : [pose.f[i][0] - 2, pose.f[i][1] + 4];
    const te = W3(toe, z * .12); te[1] = Math.max(te[1], .035);
    cap(ank, te, .055, .042, 0);
    cap(sh, mix3(sh, elb, .28), .112, .092, G("arms"));
    cap(mix3(sh, elb, .2), elb, .082, .062, G("arms"));
    cap(elb, hnd, .068, .046, G("arms"));
  }
  /* hands share the last slots */
  while (n < NP) { bufA.set([0, -9, 0, .01], n * 4); bufB.set([.01, -9, 0, .01], n * 4); bufG[n] = 0; n++; }
  return { head, H, S };
}
const ATH_FS = `#version 300 es
precision highp float; out vec4 o;
uniform vec2 uR,uO; uniform vec4 uA[${NP}]; uniform vec4 uB[${NP}]; uniform float uG[${NP}];
uniform float uYaw,uPitch,uZoom,uT,uChrome,uFade; uniform vec3 uC,uTint; uniform int uProp;
float cone(vec3 p,vec4 a,vec4 b){ vec3 pa=p-a.xyz,ba=b.xyz-a.xyz; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-mix(a.w,b.w,h); }
float box(vec3 p,vec3 b,float r){ vec3 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r; }
vec2 body(vec3 p){ float d=4.,m=0.; for(int i=0;i<${NP};i++){ float c=cone(p,uA[i],uB[i]); float k=.05; float h=clamp(.5+.5*(d-c)/k,0.,1.); d=mix(d,c,h)-k*h*(1.-h); m=mix(m,uG[i],h); } return vec2(d,m); }
float prop(vec3 p){ float d=9.;
  if((uProp&1)!=0) d=min(d,box(p-vec3(0.,-.025,0.),vec3(1.72,.025,.42),.02));
  if((uProp&2)!=0) d=min(d,box(p-vec3(-.95,1.1,0.),vec3(.06,1.14,.62),.02));
  if((uProp&4)!=0) d=min(d,box(p-vec3(.69,1.4,0.),vec3(.06,1.44,.62),.02));
  if((uProp&8)!=0){ d=min(d,box(p-vec3(-.38,.61,0.),vec3(.4,.035,.3),.025)); d=min(d,box(p-vec3(-.74,1.,0.),vec3(.03,.38,.28),.02)); vec3 q=vec3(abs(p.x+.38)-.35,p.y-.28,abs(p.z)-.25); d=min(d,box(q,vec3(.025,.3,.025),.01)); }
  return d; }
vec3 env(vec3 r){
  vec3 c=mix(vec3(.015,.015,.02),vec3(.17,.175,.2),smoothstep(-.4,1.,r.y));
  c+=vec3(1.25)*smoothstep(.6,.72,r.y)*smoothstep(.95,.5,abs(r.x-.1));
  c+=vec3(.95)*smoothstep(.72,.8,-r.x*.93+r.z*.2)*smoothstep(.75,.2,abs(r.y-.1));
  c+=uTint*1.5*smoothstep(.45,.85,r.x)*smoothstep(.8,.1,abs(r.y+.05));
  c+=vec3(.3,.29,.28)*smoothstep(.05,.0,abs(r.y))*.6;
  c=mix(c,vec3(.02),smoothstep(-.02,-.25,r.y)*.75);
  return c; }
vec3 pal(float t){ return .5+.5*cos(6.2832*(t+vec3(0.,.33,.67))); }
void main(){
  vec2 fc=gl_FragCoord.xy-uO; vec2 uv=(fc*2.-uR)/uR.y;
  float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);
  vec3 f=vec3(sy*cp,-sp,-cy*cp), r=vec3(cy,0.,sy), u=cross(r,f);
  vec3 ro=uC-f*6., rd=normalize(f*6.+(r*uv.x+u*uv.y)*uZoom);
  float t=3.2,tm=9.4,md=9.; bool hit=false; float hm=0.; int kind=0; bool hasP=uProp>1;
  for(int i=0;i<54;i++){ vec3 p=ro+rd*t; vec2 b=body(p); float d=b.x; int k=0; if(hasP){ float pd=prop(p); if((uProp&1)!=0){} if(pd<d){ d=pd; k=1; } } if(k==0) md=min(md,d); if(d<.0035){ hit=true; hm=b.y; kind=k; break; } t+=d*.92; if(t>tm) break; }
  vec3 col=vec3(0.); float al=0.;
  /* floor: mat and contact shadow */
  float tp=(0.-ro.y)/rd.y;
  if(tp>0.&&(!hit||tp<t)){ vec3 p=ro+rd*tp; float d=body(p+vec3(0,.02,0)).x; float sh=exp(-max(d,0.)*7.)*.75; float rim=smoothstep(2.4,.2,length(p.xz*vec2(.8,1.5)));
    float mat=0.; if((uProp&1)!=0){ vec2 q=abs(p.xz)-vec2(1.72,.42); float e=max(q.x,q.y); mat=smoothstep(.012,-.012,e); vec3 mc=mix(vec3(.055,.056,.066),uTint*.6,smoothstep(.03,.0,abs(e+.035))); col=mix(col,mc*(1.-sh*.85),mat); col+=mat*uTint*.06*exp(-d*3.); }
    al=max(mat,sh*rim*.8); if(hit) hit=false; }
  if(hit){
    vec3 p=ro+rd*t; vec2 e=vec2(.0045,-.0045); vec3 n;
    if(kind==0) n=normalize(e.xyy*body(p+e.xyy).x+e.yyx*body(p+e.yyx).x+e.yxy*body(p+e.yxy).x+e.xxx*body(p+e.xxx).x);
    else n=normalize(e.xyy*prop(p+e.xyy)+e.yyx*prop(p+e.yyx)+e.yxy*prop(p+e.yxy)+e.xxx*prop(p+e.xxx));
    vec3 v=-rd, rf=reflect(rd,n); vec3 nv=vec3(dot(n,r),dot(n,u),dot(n,-f)); vec3 rv=vec3(dot(rf,r),dot(rf,u),dot(rf,-f));
    float fr=pow(1.-max(dot(n,v),0.),3.); float df=max(dot(nv,normalize(vec3(-.45,.75,.5))),0.);
    float ao=clamp(.35+.65*smoothstep(0.,.5,p.y),0.,1.);
    if(kind==1){ col=vec3(.05,.052,.06)+vec3(.10)*df+uTint*fr*.25; al=1.; }
    else {
      vec3 chrome=env(rv)*(.75+.5*fr);
      chrome=mix(chrome,chrome*(.45+1.1*pal(nv.x*.35+nv.y*.5+p.y*.25)),uChrome);
      vec3 hot=uTint*(.16+.95*df)+uTint*env(rv)*.55+vec3(1.)*pow(max(dot(rv,normalize(vec3(-.4,.8,.45))),0.),26.)*.8;
      /* screen-print halftone on the working muscles */
      vec2 hp=fc/(uR.y/118.); hp=mat2(.866,.5,-.5,.866)*hp; float dot_=length(fract(hp)-.5); hot*=mix(1.,.5,smoothstep(.02,.16,dot_-.42*(df*1.25+.12))*.8);
      col=mix(chrome,hot,hm*.92); col+=uTint*fr*.75+vec3(.5)*pow(fr,2.)*.4; col*=ao; al=1.;
    }
  } else if(al<.99) { float g=exp(-max(md,0.)*26.)*.5; col+=uTint*g*.55*(1.-al); }
  float ea=hit?1.:al; col=col/(1.+max(col-.85,0.)*.6);
  o=vec4(col*uFade,ea*uFade);
}`;
const PROPBIT = { mat: 1, wallL: 2, wallR: 4, chair: 8 };
const ath = { gl: null, pr: null, cv: null, ok: null, q: Math.min(1.35, (devicePixelRatio || 1) * .75), slow: 0, items: new Map() };
function athInit() {
  if (ath.ok !== null) return ath.ok;
  try {
    ath.cv = document.createElement("canvas"); ath.cv.width = 512; ath.cv.height = 512;
    const gl = ath.gl = ath.cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw 0;
    if (isSoft(gl)) { ath.still = true; ath.q = .5; }
    ath.pr = program(gl, FULL_VS, ATH_FS);
    ath.cv.addEventListener("webglcontextlost", e => { e.preventDefault(); ath.ok = false; document.documentElement.classList.add("no-ath"); });
    ath.ok = true;
  } catch (e) { ath.ok = false; document.documentElement.classList.add("no-ath"); if (e) console.warn(e.message || e); }
  return ath.ok;
}
const athIO = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { e.target._vis = e.isIntersecting; }), { rootMargin: "60px" }) : null;
/* <canvas class="ath" data-ath="squat" data-tint="#hex" data-hero> */
export const athCanvas = (key, { tint = "", hero = false, speed = 1, cls = "", chrome = 0, yaw = null, still = false } = {}) => `<canvas class="ath ${cls}" data-ath="${key}" ${tint ? `data-tint="${tint}"` : ""} ${hero ? "data-hero" : ""} ${still ? "data-still" : ""} data-speed="${speed}" data-chrome="${chrome}" ${yaw !== null ? `data-yaw="${yaw}"` : ""} role="img" aria-label="${FORM[key] ? FORM[key].name : key} demonstration"></canvas>`;
function drag(cv) {
  if (cv._drag) return; cv._drag = { yaw: 0, v: 0 };
  if (!cv.hasAttribute("data-hero")) return;
  let on = false, x0 = 0;
  cv.addEventListener("pointerdown", e => { if (cv.closest(".nodrag")) return; on = true; x0 = e.clientX; });
  addEventListener("pointermove", e => { if (!on) return; cv._drag.yaw -= (e.clientX - x0) * .012; cv._drag.v = -(e.clientX - x0) * .012; x0 = e.clientX; });
  addEventListener("pointerup", () => (on = false));
}
function drawAth(cv, t) {
  const key = cv.dataset.ath, A = ANIM[key]; if (!A) return;
  const r = { w: cv.clientWidth, h: cv.clientHeight }; if (!r.w || !r.h) return;
  const hero = cv.hasAttribute("data-hero"), q = hero ? ath.q : Math.min(ath.q, 1);
  const w = Math.max(16, r.w * q | 0), h = Math.max(16, r.h * q | 0);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  if (ath.cv.width < w || ath.cv.height < h) { ath.cv.width = Math.max(ath.cv.width, w); ath.cv.height = Math.max(ath.cv.height, h); }
  const gl = ath.gl, u = ath.pr.u, speed = Number(cv.dataset.speed) || 1;
  const still = RM || ath.still || cv.hasAttribute("data-still"), pose = still ? A.frames[A.frames.length > 1 ? 1 : 0] : poseAt(A, t * speed);
  bones(pose, A, (FORM[key] || {}).hi);
  if (!A._b) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const f of A.frames) for (const [x, y] of [f.s, f.h, ...f.m, ...f.f]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y - (x === f.s[0] ? 26 : 4)); y1 = Math.max(y1, y); } A._b = { cx: ((x0 + x1) / 2 - 100) / 50, cy: (112 - (y0 + Math.max(y1, 114)) / 2) / 50, hw: (x1 - x0) / 100 + .2, hh: (Math.max(y1, 114) - y0) / 100 + .1 }; }
  const asp = w / h, cx = A._b.cx, cyy = A._b.cy, half = Math.max(A._b.hh, A._b.hw / asp, .66) * (Number(cv.dataset.zoom) || 1);
  const d = cv._drag || { yaw: 0 }; if (d.v) { d.yaw += d.v; d.v *= .9; if (Math.abs(d.v) < .001) d.v = 0; }
  const base = cv.dataset.yaw !== undefined ? Number(cv.dataset.yaw) : key === "handstand" ? .62 : -.42;
  const yaw = base + d.yaw + (still ? 0 : Math.sin(t / 2600 + key.length) * .3 + tilt.x * .18);
  gl.viewport(0, ath.cv.height - h, w, h); gl.scissor(0, ath.cv.height - h, w, h); gl.enable(gl.SCISSOR_TEST);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(ath.pr.p);
  gl.uniform2f(u.uR, w, h); gl.uniform4fv(u.uA, bufA); gl.uniform4fv(u.uB, bufB); gl.uniform1fv(u.uG, bufG);
  gl.uniform1f(u.uYaw, yaw); gl.uniform1f(u.uPitch, .2 + tilt.y * .06); gl.uniform1f(u.uZoom, half); gl.uniform1f(u.uT, t / 1000);
  gl.uniform3f(u.uC, cx, cyy, 0); gl.uniform3fv(u.uTint, rgb(cv.dataset.tint || RCOL.signal)); gl.uniform1f(u.uChrome, Number(cv.dataset.chrome) || 0); gl.uniform1f(u.uFade, 1);
  gl.uniform1i(u.uProp, (A.props || []).reduce((n, p) => n | (PROPBIT[p] || 0), 0));
  gl.uniform2f(u.uO, 0, ath.cv.height - h);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const c2 = cv._c2 || (cv._c2 = cv.getContext("2d"));
  c2.clearRect(0, 0, w, h); c2.drawImage(ath.cv, 0, 0, w, h, 0, 0, w, h);
}
/* no WebGL: a simple drawn figure instead */
function draw2D(cv, t) {
  const A = ANIM[cv.dataset.ath], W = cv.clientWidth, H = cv.clientHeight; if (!A || !W) return;
  const dpr = Math.min(2, devicePixelRatio || 1); if (cv.width !== (W * dpr | 0)) { cv.width = W * dpr | 0; cv.height = H * dpr | 0; }
  const c = cv._c2 || (cv._c2 = cv.getContext("2d")), P = RM || cv.hasAttribute("data-still") ? A.frames[A.frames.length - 1] : poseAt(A, t), k = Math.min(W / 176, H / 150), tint = cv.dataset.tint || RCOL.signal, hi = (FORM[cv.dataset.ath] || {}).hi;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); c.translate(W / 2 - 100 * k, H - 122 * k); c.scale(k, k); c.lineCap = c.lineJoin = "round"; c.lineWidth = 9;
  const line = (col, ...p) => { c.strokeStyle = col; c.beginPath(); p.forEach(q => c.lineTo(q[0], q[1])); c.stroke(); }, on = g => (hi === g || hi === "full" ? tint : "#c9ccd4");
  for (const i of [1, 0]) { c.globalAlpha = i ? .45 : 1; line(on("legs"), P.h, ik(P.h, P.f[i], 27, 27, A.k), P.f[i]); if (!i) line(on("core"), P.h, P.s); line(on("arms"), P.s, ik(P.s, P.m[i], 19, 19, A.e), P.m[i]); }
  const l = Math.hypot(P.s[0] - P.h[0], P.s[1] - P.h[1]) || 1; c.fillStyle = "#f4f1e8"; c.beginPath(); c.arc(P.s[0] + (P.s[0] - P.h[0]) / l * 13, Math.min(106, P.s[1] + (P.s[1] - P.h[1]) / l * 13), 8, 0, 7); c.fill();
}
let athLast = 0, athFrame = 0;
export function athLoop(t) {
  requestAnimationFrame(athLoop);
  if (document.hidden) return;
  tilt.x += (tilt.tx - tilt.x) * .08; tilt.y += (tilt.ty - tilt.y) * .08;
  athFrame++;
  const list = document.querySelectorAll("canvas.ath");
  if (!list.length) return;
  if (!athInit()) { for (const cv of list) { if (!cv._reg) { cv._reg = true; cv._vis = !athIO; if (athIO) athIO.observe(cv); } if (cv._vis && athFrame % 2) draw2D(cv, t); } return; }
  const dt = t - athLast; athLast = t;
  const stage = document.documentElement.classList.contains("stage-open");
  let i = 0;
  for (const cv of list) {
    if (!cv._reg) { cv._reg = true; cv._vis = !athIO; if (athIO) athIO.observe(cv); drag(cv); }
    if (!cv._vis || (stage && !cv.closest(".stage"))) continue;
    if ((RM || ath.still || cv.hasAttribute("data-still")) && cv._drawn && cv._drawnKey === cv.dataset.ath && cv._w === cv.clientWidth) continue;
    const hero = cv.hasAttribute("data-hero"); i++;
    if (!hero && cv._drawn && (athFrame + i) % 4) continue;
    if (hero && cv._drawn && dt < 12 && athFrame % 2) continue;
    drawAth(cv, t); cv._drawn = true; cv._drawnKey = cv.dataset.ath; cv._w = cv.clientWidth;
  }
  /* adaptive quality */
  if (i && dt > 0 && dt < 400) { ath.slow += dt > 30 ? 1 : -.5; if (ath.slow < 0) ath.slow = 0; if (ath.slow > 40 && ath.q > .5) { ath.q *= .82; ath.slow = 0; } }
}

/* ---------- foil cards: feed pointer/tilt into CSS ---------- */
export function holoLoop(t) {
  requestAnimationFrame(holoLoop);
  if (document.hidden || RM) return;
  const idle = performance.now() - tilt.last > 2500;
  for (const el of document.querySelectorAll(".holo")) {
    if (!el._h) { el._h = { x: .5, y: .5, tx: .5, ty: .5, over: false }; el.addEventListener("pointermove", e => { const r = el.getBoundingClientRect(); el._h.tx = clamp((e.clientX - r.left) / r.width, 0, 1); el._h.ty = clamp((e.clientY - r.top) / r.height, 0, 1); el._h.over = true; }, { passive: true }); el.addEventListener("pointerleave", () => (el._h.over = false)); }
    const b = el.getBoundingClientRect(); if (b.bottom < -50 || b.top > innerHeight + 50 || !b.width) continue;
    const h = el._h;
    if (!h.over) { if (tilt.gyro && !idle) { h.tx = .5 + tilt.x * .5; h.ty = .5 + tilt.y * .5; } else { const s = t / 1900 + b.left * .003; h.tx = .5 + Math.sin(s) * .28; h.ty = .5 + Math.cos(s * .77) * .24; } }
    h.x += (h.tx - h.x) * .09; h.y += (h.ty - h.y) * .09;
    const st = el.style, amp = Number(el.dataset.amp || 1);
    st.setProperty("--mx", (h.x * 100).toFixed(1) + "%"); st.setProperty("--my", (h.y * 100).toFixed(1) + "%");
    st.setProperty("--ry", ((h.x - .5) * 22 * amp).toFixed(2) + "deg"); st.setProperty("--rx", ((.5 - h.y) * 18 * amp).toFixed(2) + "deg");
    st.setProperty("--fp", ((h.x + h.y) * 50).toFixed(1) + "%"); st.setProperty("--fo", (Math.min(1, Math.hypot(h.x - .5, h.y - .5) * 2.4 + .25)).toFixed(2));
  }
}

/* ---------- particles: confetti, foil shards, chalk, sparks ---------- */
export const PAL = {
  common: ["#f4f1e8", "#c6cbd4", "#8d93a0", "#ff5c1a"],
  rare: ["#2f9bff", "#7dd3fc", "#e0f2fe", "#1e5bff"],
  epic: ["#e84bff", "#ff8ad8", "#8b5cff", "#ffd1fb"],
  legendary: ["#ffc02e", "#fff1b8", "#ff8a1a", "#ffffff"],
  signal: ["#ff5c1a", "#f4f1e8", "#ffb08a", "#2f7bff"],
  red: ["#ff3b3b", "#ff8d8d", "#f4f1e8"],
};
let parts = [], pRaf = 0, rainUntil = 0, rainCols = null, pLast = 0;
function pctx() { const cv = $("#confetti"), dpr = Math.min(2, devicePixelRatio || 1); if (cv.width !== (innerWidth * dpr | 0) || cv.height !== (innerHeight * dpr | 0)) { cv.width = innerWidth * dpr | 0; cv.height = innerHeight * dpr | 0; } const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); return c; }
function pRun() {
  if (pRaf) return; pLast = performance.now();
  const step = t => {
    const c = pctx(), k = Math.min(2.5, (t - pLast) / 16.7); pLast = t;
    c.clearRect(0, 0, innerWidth, innerHeight);
    if (t < rainUntil) for (let i = 0; i < 2; i++) if (Math.random() < .5) parts.push({ k: "c", x: Math.random() * innerWidth, y: -12, vx: (Math.random() - .5) * 2, vy: 1 + Math.random() * 2, r: 4 + Math.random() * 7, a: Math.random() * 6, va: (Math.random() - .5) * .4, w: Math.random() * 3, c: rainCols[Math.random() * rainCols.length | 0], l: 1 });
    const keep = [];
    for (const p of parts) {
      if (p.k === "d") { p.vx *= Math.pow(.9, k); p.vy = p.vy * Math.pow(.9, k) - .02 * k; p.r += .55 * k; p.l -= .022 * k; }
      else if (p.k === "s") { p.vy += .12 * k; p.vx *= .99; p.l -= .03 * k; }
      else { p.vy += .3 * k; p.vx *= Math.pow(.985, k); p.vy *= Math.pow(.985, k); p.a += p.va * k; p.w += .08 * k; if (p.vy > 4.6) p.vy = 4.6; p.l -= p.k === "f" ? .006 * k : 0; }
      p.x += p.vx * k + (p.k === "c" ? Math.sin(p.w) * .8 : 0); p.y += p.vy * k;
      if (p.l <= 0 || p.y > innerHeight + 40) continue; keep.push(p);
      if (p.k === "d") { const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, `rgba(244,241,232,${.34 * p.l})`); g.addColorStop(1, "rgba(244,241,232,0)"); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); }
      else if (p.k === "s") { c.strokeStyle = p.c; c.globalAlpha = p.l; c.lineWidth = p.r; c.lineCap = "round"; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); c.stroke(); c.globalAlpha = 1; }
      else { c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.scale(1, Math.abs(Math.cos(p.w)) * .85 + .15); c.globalAlpha = Math.min(1, p.l * 2); c.fillStyle = p.c; if (p.k === "f") { c.beginPath(); c.moveTo(-p.r, p.r * .6); c.lineTo(p.r * .2, -p.r); c.lineTo(p.r, p.r * .3); c.closePath(); c.fill(); c.fillStyle = "rgba(255,255,255,.6)"; c.fillRect(-1, -1, 2, 2); } else c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); c.restore(); }
    }
    parts = keep;
    if (parts.length || t < rainUntil) pRaf = requestAnimationFrame(step); else { pRaf = 0; c.clearRect(0, 0, innerWidth, innerHeight); }
  };
  pRaf = requestAnimationFrame(step);
}
export function confetti({ cols = PAL.signal, n = 160, x = .5, y = .38, rain = 0, power = 1 } = {}) {
  if (RM) return;
  const ox = innerWidth * x, oy = innerHeight * y;
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (Math.random() * 15 + 4) * power; parts.push({ k: Math.random() < .25 ? "f" : "c", x: ox + (Math.random() - .5) * 60, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 7, r: Math.random() * 7 + 4, a: Math.random() * 6, va: (Math.random() - .5) * .45, w: Math.random() * 3, c: cols[Math.random() * cols.length | 0], l: 1 }); }
  if (rain) { rainUntil = performance.now() + rain; rainCols = cols; }
  pRun();
}
export function stopRain() { rainUntil = 0; }
export function chalk(x, y, n = 14, power = 1) { if (RM) return; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = Math.random() * 5 * power; parts.push({ k: "d", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - .6, r: 3 + Math.random() * 7, l: .75 + Math.random() * .25 }); } pRun(); }
export function sparks(x, y, cols, n = 16, power = 1) { if (RM) return; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (2 + Math.random() * 8) * power; parts.push({ k: "s", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1 + Math.random() * 2, c: cols[Math.random() * cols.length | 0], l: .6 + Math.random() * .5 }); } pRun(); }
export function shards(x, y, cols, n = 6) { if (RM) return; for (let i = 0; i < n; i++) parts.push({ k: "f", x, y, vx: (Math.random() - .5) * 9, vy: -Math.random() * 7, r: 3 + Math.random() * 6, a: Math.random() * 6, va: (Math.random() - .5) * .6, w: Math.random() * 3, c: cols[Math.random() * cols.length | 0], l: 1 }); pRun(); }

/* ---------- liquid shaker: spring-column water in a bottle, sloshes with tilt and scroll ---------- */
const BOT = { w: 150, h: 250 };
function bottlePath(c) { c.beginPath(); c.moveTo(22, 34); c.lineTo(128, 34); c.quadraticCurveTo(132, 34, 132, 40); c.lineTo(120, 232); c.quadraticCurveTo(119, 244, 108, 244); c.lineTo(42, 244); c.quadraticCurveTo(31, 244, 30, 232); c.lineTo(18, 40); c.quadraticCurveTo(18, 34, 22, 34); c.closePath(); }
let shakeScroll = 0, lastScroll = 0;
addEventListener("scroll", () => { shakeScroll += (scrollY - lastScroll) * .02; lastScroll = scrollY; }, { passive: true });
function drawShaker(cv, t) {
  const S = cv._s || (cv._s = { n: 40, y: new Float32Array(40), v: new Float32Array(40), lvl: 0, bub: [], px: 0 });
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  if (cv.width !== (W * dpr | 0)) { cv.width = W * dpr | 0; cv.height = H * dpr | 0; }
  const c = cv.getContext("2d"), k = Math.min(W / BOT.w, H / BOT.h);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); c.translate((W - BOT.w * k) / 2, (H - BOT.h * k) / 2); c.scale(k, k);
  const target = clamp(Number(cv.dataset.v) || 0, 0, 1), col = cv.dataset.tint || RCOL.signal;
  S.lvl += (target - S.lvl) * .03; if (RM) S.lvl = target;
  const lean = tilt.x * 10 + shakeScroll; shakeScroll *= .9;
  const ax = lean - S.px; S.px = lean;
  for (let i = 0; i < S.n; i++) { const u = i / (S.n - 1) - .5; S.v[i] += ax * u * 1.6; if (Math.random() < .004 && target > 0) S.v[i] -= 1.2; }
  for (let i = 0; i < S.n; i++) { const l = S.y[Math.max(0, i - 1)], r = S.y[Math.min(S.n - 1, i + 1)]; S.v[i] += (l + r - 2 * S.y[i]) * .22 - S.y[i] * .025; S.v[i] *= .965; }
  for (let i = 0; i < S.n; i++) S.y[i] = clamp(S.y[i] + S.v[i], -22, 22);
  bottlePath(c); c.fillStyle = "rgba(255,255,255,.05)"; c.fill();
  c.save(); bottlePath(c); c.clip();
  const top = 244 - S.lvl * 204, surf = i => top + S.y[i] + (i / (S.n - 1) - .5) * -lean * 2.4 + Math.sin(t / 420 + i * .35) * 1.1;
  if (S.lvl > .004) {
    const g = c.createLinearGradient(0, top, 0, 244), [r, gg, b] = rgb(col).map(v => v * 255 | 0);
    g.addColorStop(0, `rgb(${Math.min(255, r + 40)},${Math.min(255, gg + 40)},${Math.min(255, b + 40)})`); g.addColorStop(.25, col); g.addColorStop(1, `rgb(${r * .45 | 0},${gg * .4 | 0},${b * .45 | 0})`);
    c.beginPath(); c.moveTo(0, 250); for (let i = 0; i < S.n; i++) c.lineTo(i / (S.n - 1) * 150, surf(i)); c.lineTo(150, 250); c.closePath(); c.fillStyle = g; c.fill();
    c.beginPath(); for (let i = 0; i < S.n; i++) c.lineTo(i / (S.n - 1) * 150, surf(i) + 1); c.strokeStyle = "rgba(255,255,255,.65)"; c.lineWidth = 2; c.stroke();
    if (S.bub.length < 16 && Math.random() < .12) S.bub.push({ x: 34 + Math.random() * 82, y: 240, r: 1 + Math.random() * 3 });
    c.fillStyle = "rgba(255,255,255,.28)";
    S.bub = S.bub.filter(b => { b.y -= .5 + b.r * .25; b.x += Math.sin(t / 250 + b.r * 9) * .35; if (b.y < top + 4) return false; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill(); return true; });
  }
  /* mixing ball */
  const by = Math.min(228, Math.max(top + 12, 228 - S.lvl * 30 + Math.sin(t / 700) * 6)), bx = 75 + lean * 1.6; c.strokeStyle = "rgba(230,232,238,.75)"; c.lineWidth = 1.6; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(bx, by, 11, Math.abs(Math.cos(t / 900 + i * .8)) * 11 + .5, i * .8, 0, 7); c.stroke(); }
  c.restore();
  /* ticks, glass, lid */
  c.fillStyle = "rgba(244,241,232,.6)"; c.font = "700 9px Archivo, sans-serif"; c.textAlign = "right";
  for (let i = 1; i <= 4; i++) { const y = 244 - i * 51; c.fillRect(112, y, 11, 1.5); c.fillText(i * 25 + "%", 108, y + 3); }
  bottlePath(c); c.lineWidth = 3; c.strokeStyle = "rgba(244,241,232,.5)"; c.stroke();
  c.fillStyle = "rgba(255,255,255,.14)"; c.beginPath(); c.roundRect(34, 50, 9, 160, 5); c.fill();
  c.fillStyle = "#23252d"; c.beginPath(); c.roundRect(14, 12, 122, 26, 8); c.fill(); c.fillStyle = col; c.beginPath(); c.roundRect(92, 1, 26, 15, 5); c.fill(); c.fillStyle = "rgba(255,255,255,.12)"; for (let x = 20; x < 132; x += 7) c.fillRect(x, 15, 2, 20);
}
/* ---------- flame (streak) ---------- */
function drawFlame(cv, t) {
  const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  if (cv.width !== (W * dpr | 0)) { cv.width = W * dpr | 0; cv.height = H * dpr | 0; }
  const c = cv.getContext("2d"), v = clamp(Number(cv.dataset.v) || 0, 0, 1), P = cv._p || (cv._p = []);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  if (v <= 0) return;
  const ice = cv.dataset.ice === "1", rate = 1 + v * 2;
  for (let i = 0; i < rate; i++) if (Math.random() < .75) P.push({ x: W / 2 + (Math.random() - .5) * W * .34, y: H * .86, vx: (Math.random() - .5) * .3, vy: -(H * .011 + Math.random() * H * .014) * (.6 + v * .6), r: W * (.11 + Math.random() * .12) * (.65 + v * .35), l: 1 });
  c.globalCompositeOperation = "lighter";
  cv._p = P.filter(p => {
    p.x += p.vx + Math.sin(t / 130 + p.y * .2) * .25 + (W / 2 - p.x) * .03; p.y += p.vy; p.l -= .032; p.r *= .972; if (p.l <= 0) return false;
    const [r, g, b] = ice ? (p.l > .6 ? [200, 240, 255] : p.l > .3 ? [80, 170, 255] : [20, 60, 180]) : p.l > .72 ? [255, 226, 140] : p.l > .4 ? [255, 120, 26] : [200, 30, 20];
    const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); gr.addColorStop(0, `rgba(${r},${g},${b},${.5 * p.l})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); return true;
  });
  c.globalCompositeOperation = "source-over";
}
/* ---------- lightning (duels) ---------- */
function drawBolt(cv, t) {
  const dpr = Math.min(1.5, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  if (cv.width !== (W * dpr | 0)) { cv.width = W * dpr | 0; cv.height = H * dpr | 0; }
  const c = cv.getContext("2d"); if (cv._n && t < cv._n) return; cv._n = t + 55 + Math.random() * 70;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const path = (x1, y1, x2, y2, d) => { if (d < 3) { c.lineTo(x2, y2); return; } const mx = (x1 + x2) / 2 + (Math.random() - .5) * d, my = (y1 + y2) / 2 + (Math.random() - .5) * d * .4; path(x1, y1, mx, my, d / 2); path(mx, my, x2, y2, d / 2); };
  const x0 = W * .62, x1 = W * .38;
  for (const [w, col, j] of [[9, "rgba(255,255,255,.12)", 30], [3.5, "rgba(255,255,255,.55)", 24], [1.6, "#fff", 24]]) { c.beginPath(); c.moveTo(x0, -10); c.lineWidth = w; c.strokeStyle = col; c.lineJoin = "round"; path(x0, -10, x1, H + 10, j); c.stroke(); }
  if (Math.random() < .5) { const y = Math.random() * H, x = lerp(x0, x1, y / H); c.beginPath(); c.moveTo(x, y); c.lineWidth = 1; c.strokeStyle = "rgba(255,255,255,.5)"; path(x, y, x + (Math.random() - .5) * W * .35, y + Math.random() * 50, 20); c.stroke(); }
}
export function fxLoop(t) {
  requestAnimationFrame(fxLoop);
  if (document.hidden) return;
  for (const cv of document.querySelectorAll("canvas[data-fx]")) {
    if (!cv._reg) { cv._reg = true; cv._vis = !athIO; if (athIO) athIO.observe(cv); }
    if (!cv._vis) continue;
    if (RM && cv._once === cv.dataset.v + cv.clientWidth) continue; cv._once = cv.dataset.v + cv.clientWidth;
    const k = cv.dataset.fx; if (k === "shaker") drawShaker(cv, t); else if (k === "flame") drawFlame(cv, t); else if (k === "bolt") drawBolt(cv, t);
  }
}

/* ---------- sound, synthesized ---------- */
let actx = null, noiseBuf = null;
export const SOUND = { on: true };
try { SOUND.on = localStorage.getItem("sg-sound") !== "off"; } catch (e) {}
function ac() { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); return actx; }
export function tone(freq, dur = .05, vol = .04, type = "sine", when = 0, slideTo = 0) {
  if (!SOUND.on) return;
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + when;
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .03);
  } catch (e) {}
}
export function noise(dur = .1, vol = .05, freq = 2500, q = .8, when = 0, slide = 0) {
  if (!SOUND.on) return;
  try {
    const a = ac(), t = a.currentTime + when;
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = "bandpass"; f.frequency.setValueAtTime(freq, t); if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur); f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f).connect(g).connect(a.destination); s.start(t, Math.random()); s.stop(t + dur + .02);
  } catch (e) {}
}
export const beep = (f, d = .04, v = .04, type = "square") => tone(f, d, v, type);
export const sfx = {
  tap: () => tone(1350, .03, .018), tab: () => { tone(420, .06, .03, "triangle", 0, 640); noise(.05, .012, 3000); },
  on: () => { tone(660, .07, .04, "triangle"); tone(990, .1, .04, "triangle", .06); }, off: () => { tone(520, .07, .035, "triangle"); tone(350, .1, .03, "triangle", .06); },
  yes: () => [523, 784, 1047].forEach((f, i) => tone(f, .13, .045, "triangle", i * .065)), no: () => { tone(240, .22, .05, "sawtooth", 0, 110); noise(.12, .03, 400); },
  water: () => { tone(260, .16, .05, "sine", 0, 760); tone(900, .05, .02, "sine", .14); },
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, .05, "triangle", i * .08)), error: () => { tone(190, .12, .05, "square"); tone(150, .16, .05, "square", .12); },
  notify: () => { tone(880, .14, .045); tone(1320, .22, .04, "sine", .11); }, go: () => { tone(392, .1, .05, "square"); tone(784, .25, .05, "square", .09); },
  rip: v => noise(.06, .03 + Math.min(.1, v * .1), 2600 + Math.random() * 2600, 1.2), ripEnd: () => { noise(.35, .14, 5200, .6, 0, 900); tone(1200, .25, .03, "sine", .05, 2600); },
  whoosh: () => noise(.4, .06, 500, .7, 0, 3200), slam: () => { tone(110, .35, .16, "sine", 0, 38); noise(.22, .12, 260, .7); }, flip: () => noise(.14, .05, 1400, .9, 0, 4200),
  sticker: () => { noise(.05, .09, 1700, .8); tone(170, .09, .07, "sine", 0, 90); }, whistle: () => { for (let i = 0; i < 9; i++) tone(2500 + (i % 2) * 180, .05, .04, "square", i * .045); },
  crowd: () => { for (let i = 0; i < 4; i++) noise(1.6, .025, 700 + i * 300, .4, i * .12, 1500); }, drum: n => { for (let i = 0; i < n; i++) noise(.06, .02 + i / n * .05, 320, .8, i * .052); },
  fanfare: () => [[392, 0], [523, .12], [659, .24], [784, .36], [1047, .5], [784, .62], [1047, .72]].forEach(([f, w]) => { tone(f, .26, .05, "sawtooth", w); tone(f * 1.5, .22, .02, "triangle", w); }),
  thunder: () => { noise(.9, .15, 160, .5, 0, 60); noise(.08, .1, 5000, .5); }, siren: () => { for (let i = 0; i < 3; i++) { tone(520, .22, .05, "sawtooth", i * .3, 880); tone(880, .1, .04, "sawtooth", i * .3 + .2, 520); } },
};
export function setSound(on) { SOUND.on = on; try { localStorage.setItem("sg-sound", on ? "on" : "off"); } catch (e) {} if (on) sfx.on(); }

export function startFx() {
  makeTextures();
  initAmbient();
  requestAnimationFrame(athLoop); requestAnimationFrame(holoLoop); requestAnimationFrame(fxLoop);
}
