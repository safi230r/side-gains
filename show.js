/* Side Gains big moments: ripping a foil pack, the Sunday ceremony, duel intro, shareable recap. */
import * as E from "./engine.js";
import * as FX from "./fx.js";
const { RM, RCOL, PAL, sfx, sleep, buzz, beep } = FX;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const imgCache = {};
export const loadImg = src => imgCache[src] ||= new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function stage(id, label, html) {
  const el = document.createElement("div");
  el.className = "stage"; el.id = id; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", label);
  el.innerHTML = html; document.body.appendChild(el); document.documentElement.classList.add("stage-open");
  return el;
}
function unstage(el, done) { FX.stopRain(); el.classList.add("leaving"); setTimeout(() => { el.remove(); if (!document.querySelector(".stage")) document.documentElement.classList.remove("stage-open"); done && done(); }, RM ? 0 : 320); }

/* ---------- the foil pack (WebGL mesh you tear with your finger) ---------- */
const PACK_VS = `#version 300 es
precision highp float; layout(location=0) in vec2 a; uniform float uPart,uP,uDir,uT,uFly,uSquash; uniform vec2 uTilt,uAsp; uniform float uView; uniform vec3 uOff; out vec2 v; out vec3 wn; out float vs;
float h11(float p){ p=fract(p*.1031); p*=p+33.33; return fract(p*(p+p)); }
float n1(float x){ float i=floor(x),f=fract(x); return mix(h11(i),h11(i+1.),f*f*(3.-2.*f)); }
float tear(float u){ return .108+(n1(u*46.)-.5)*.010+(n1(u*9.+4.)-.5)*.012; }
void main(){
  vec2 uv=a; float tl=tear(uv.x);
  uv.y = uPart<.5 ? mix(tl,1.,a.y) : a.y*tl;
  v=uv; float W=uAsp.x,H=uAsp.y; vec3 p=vec3((uv.x-.5)*W,(.5-uv.y)*H,0.);
  float puff=pow(max(sin(3.1416*uv.x),0.),.6)*pow(max(sin(3.1416*clamp((uv.y-.05)/.9,0.,1.)),0.),.5); p.z+=puff*.085;
  float u=uDir>0.?uv.x:1.-uv.x; float s=max(0.,uP-u)*W; vs=s;
  vec3 n=vec3(0,0,1);
  if(uPart<.5){ float op=smoothstep(0.,.25,uP-u)*exp(-(uv.y-tl)*13.); p.z+=op*.07*sin(3.1416*uv.x); p.y-=op*.012; }
  else if(s>0.){ float R=.13; float th=min(s/R,2.7); float ex=s-th*R; float xF=(uDir>0.?1.:-1.)*((uP-.5)*W); float dx=R*sin(th)+ex*cos(th); float dz=R*(1.-cos(th))+ex*sin(th); p.x=xF-(uDir>0.?1.:-1.)*dx; p.z+=dz*.9; p.y+=s*.22; n=vec3((uDir>0.?1.:-1.)*sin(th),0.,cos(th)); }
  if(uPart>.5&&uFly>0.){ float c=cos(uFly*5.),q=sin(uFly*5.); p.xy=mat2(c,-q,q,c)*p.xy; p+=vec3((uDir>0.?1.:-1.)*uFly*2.2,uFly*1.6-uFly*uFly*2.4,uFly*1.2); }
  p.y*=1.-uSquash; p.x*=1.+uSquash*.6; p+=uOff;
  float ay=uTilt.x*.5,ax=uTilt.y*.35; mat3 ry=mat3(cos(ay),0,-sin(ay),0,1,0,sin(ay),0,cos(ay)); mat3 rx=mat3(1,0,0,0,cos(ax),sin(ax),0,-sin(ax),cos(ax));
  p=rx*(ry*p); wn=rx*(ry*n);
  float z=3.2-p.z; gl_Position=vec4(p.x*3.2/uView,p.y*3.2,(.2-p.z)*.1*z,z); }`;
const PACK_FS = `#version 300 es
precision highp float; in vec2 v; in vec3 wn; in float vs; out vec4 o; uniform sampler2D uTex; uniform float uPart,uP,uDir,uT,uGlow; uniform vec2 uTilt; uniform vec3 uC;
float h11(float p){ p=fract(p*.1031); p*=p+33.33; return fract(p*(p+p)); }
float n1(float x){ float i=floor(x),f=fract(x); return mix(h11(i),h11(i+1.),f*f*(3.-2.*f)); }
float tear(float u){ return .108+(n1(u*46.)-.5)*.010+(n1(u*9.+4.)-.5)*.012; }
float h21(vec2 p){ p=fract(p*vec2(234.34,435.345)); p+=dot(p,p+34.23); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float crk(vec2 p){ float s=0.; s+=abs(vn(p*5.)-.5)*.9; s+=abs(vn(p*11.+3.)-.5)*.45; s+=abs(vn(p*23.+9.)-.5)*.2; return s; }
float hgt(vec2 u){ float puff=pow(max(sin(3.1416*u.x),0.),.6)*pow(max(sin(3.1416*clamp((u.y-.05)/.9,0.,1.)),0.),.5); float edge=smoothstep(.0,.16,u.x)*smoothstep(1.,.84,u.x); float seam=smoothstep(.16,.07,u.y)+smoothstep(.84,.93,u.y); return puff*.35+crk(u*vec2(1.,1.5))*(.055+.10*(1.-edge)+.09*seam); }
vec3 pal(float t){ return .5+.5*cos(6.2832*(t+vec3(0.,.33,.67))); }
void main(){
  float zig=.007*abs(fract(v.x*34.)-.5)*2.; if(v.y<zig||v.y>1.-zig) discard;
  bool back=gl_FrontFacing; vec2 e=vec2(.004,0.);
  float hx=hgt(v+e.xy)-hgt(v-e.xy), hy=hgt(v+e.yx)-hgt(v-e.yx);
  vec3 n=normalize(vec3(-hx*9.,hy*6.,1.)); n=normalize(n+vec3(wn.xy*1.4,0.)); n.xy+=uTilt*vec2(.42,-.32); n=normalize(n);
  vec3 L=normalize(vec3(-.4+uTilt.x*.9,.65-uTilt.y*.7,.75)); float df=max(dot(n,L),0.); vec3 R=reflect(vec3(0.,0.,-1.),n); float sp=pow(max(dot(R,L),0.),22.), sp2=pow(max(dot(R,normalize(vec3(.6,-.2,.7))),0.),14.);
  vec3 art=texture(uTex,v).rgb; float lum=dot(art,vec3(.3,.6,.1));
  float crimp=smoothstep(.072,.066,v.y)+smoothstep(.928,.934,v.y);
  vec3 col=art*(.42+.85*df)+vec3(1.)*sp*.75+uC*sp2*.22;
  col+=pal(n.x*.9+n.y*.7+v.x*.4-v.y*.3)*(.10+.5*sp+.25*pow(1.-n.z,1.5))*(.35+.65*(1.-lum));
  if(crimp>.5){ float rg=.5+.5*sin(v.y*900.); float m=.32+.5*rg*df+.6*sp; col=mix(vec3(.62,.63,.67)*m*1.25,pal(v.x*1.2+n.x)*m,.16); }
  if(back){ float b=.55+.4*df; col=vec3(.74,.75,.79)*b+pal(v.x+n.x)*.12; }
  float u=uDir>0.?v.x:1.-v.x;
  /* torn white edge */
  if(u<uP+.006){ float d=abs(v.y-tear(v.x)); col=mix(vec3(.97,.97,1.)*(.7+.35*df),col,smoothstep(.003,.0085+.004*vn(v*vec2(160.,20.)),d)); }
  /* dotted tear guide before the rip starts */
  if(uP<.02&&!back){ float d=abs(v.y-.108); float dash=step(.45,fract(v.x*26.)); col=mix(col,vec3(1.),smoothstep(.003,.0015,d)*dash*.75); }
  o=vec4(col,1.);
}`;
async function packFace(label) {
  const c = document.createElement("canvas"); c.width = 768; c.height = 1152; const g = c.getContext("2d");
  try { g.drawImage(await loadImg("img/pack.webp"), 0, 0, 768, 1152); } catch (e) { g.fillStyle = "#ff5c1a"; g.fillRect(0, 0, 768, 1152); }
  try { await Promise.race([document.fonts.load("900 120px Anybody"), sleep(900)]); } catch (e) {}
  const fade = g.createLinearGradient(0, 0, 0, 1152); fade.addColorStop(0, "rgba(13,14,17,.9)"); fade.addColorStop(.2, "rgba(13,14,17,0)"); fade.addColorStop(.8, "rgba(13,14,17,0)"); fade.addColorStop(1, "rgba(13,14,17,.92)"); g.fillStyle = fade; g.fillRect(0, 0, 768, 1152);
  g.textAlign = "center"; g.fillStyle = "#f4f1e8";
  const fit = (t, w, max, weight = 900) => { let s = max; do { g.font = `${weight} ${s}px Anybody, Impact, sans-serif`; s -= 2; } while (g.measureText(t).width > w && s > 12); };
  fit("SIDE GAINS", 640, 108); g.fillText("SIDE GAINS", 384, 226);
  g.fillStyle = "#ff5c1a"; fit(label, 600, 40, 800); g.fillText(label, 384, 984);
  g.fillStyle = "#f4f1e8"; g.font = "700 25px Archivo, sans-serif"; g.fillText("1 QUEST CARD INSIDE · NOBODY KNOWS WHICH", 384, 1032);
  return c;
}
function makePack(cv, face) {
  const gl = cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return null;
  let pr; try { pr = FX.program(gl, PACK_VS, PACK_FS); } catch (e) { console.warn(e.message); return null; }
  const nx = 64, ny = 48, pts = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j], [i + 1, j + 1], [i, j + 1]]; for (const [x, y] of q) pts.push(x / nx, y / ny); }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, face); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.enable(gl.DEPTH_TEST);
  const S = { p: 0, dir: 1, off: [0, 0, 0], fly: 0, squash: 0, tint: FX.rgb("#ffffff"), stripOnly: false, alive: true, pw: 1, ph: 1 };
  S.draw = ts => {
    const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth * dpr | 0, h = cv.clientHeight * dpr | 0; if (!w) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    /* pack height is 1.16 of clip space (58% of the canvas), width follows 2:3 */
    const H = 1.16, W = H * 2 / 3; S.pw = W / (w / h) * .5; S.ph = H * .5;
    gl.useProgram(pr.p); const u = pr.u;
    gl.uniform2f(u.uAsp, W, H); gl.uniform1f(u.uView, w / h); gl.uniform1f(u.uP, S.p); gl.uniform1f(u.uDir, S.dir); gl.uniform1f(u.uT, ts / 1000); gl.uniform3fv(u.uOff, S.off); gl.uniform3fv(u.uC, S.tint); gl.uniform1f(u.uSquash, S.squash);
    const wob = RM ? 0 : 1; gl.uniform2f(u.uTilt, FX.tilt.x * .8 + Math.sin(ts / 1400) * .22 * wob, FX.tilt.y * .7 + Math.cos(ts / 1700) * .16 * wob);
    gl.uniform1f(u.uPart, 0); gl.uniform1f(u.uFly, 0); gl.drawArrays(gl.TRIANGLES, 0, pts.length / 2);
    if (S.fly < 1.6) { gl.uniform1f(u.uPart, 1); gl.uniform1f(u.uFly, S.fly); gl.drawArrays(gl.TRIANGLES, 0, pts.length / 2); }
  };
  S.kill = () => { S.alive = false; const x = gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); };
  return S;
}

/* opts: { quest, label, sub, incoming, cardHTML, onSeen, onClose } */
export async function ripPack(opts) {
  if ($("#reveal")) return;
  const { quest: q } = opts, col = RCOL[q.rarity], pal = PAL[q.rarity];
  const order = E.RORDER, rseq = Array.from({ length: 26 }, (_, i) => order[(i * 3 + (i % 5)) % 4]).concat(q.rarity);
  const moves = E.pickable(), mseq = Array.from({ length: 34 }, () => moves[Math.random() * moves.length | 0]).concat(q.u.length > 22 ? q.n : q.u);
  const el = stage("reveal", "Quest pack", `
    <div class="rv-bg"></div><div class="rv-rays"></div><div class="rv-flash"></div>
    <button type="button" class="stage-skip" data-act="skip">Skip</button>
    <div class="rv-head"><div class="rv-eyebrow">${esc(opts.sub)}</div><div class="rv-title">${esc(opts.label)}</div></div>
    <div class="rv-leak"></div>
    <div class="rv-cardwrap" hidden><div class="rv-flip"><div class="rv-back"><img src="img/pack.webp" alt=""><b>SIDE<br>GAINS</b></div><div class="rv-front">${opts.cardHTML}</div></div></div>
    <canvas class="rv-pack" aria-hidden="true"></canvas>
    <div class="rv-hint"><span class="rv-finger"></span><span>Swipe across the top to rip it</span><button type="button" class="btn ghost" data-act="auto">Rip it for me</button></div>
    <div class="rv-slots" hidden><div class="rv-reel"><div class="strip" data-r="r">${rseq.map(r => `<i style="color:${RCOL[r]}">${E.RARITY[r].label}</i>`).join("")}</div></div><div class="rv-reel"><div class="strip" data-r="m">${mseq.map(m => `<i>${esc(m)}</i>`).join("")}</div></div></div>
    <button type="button" class="btn primary big rv-go" data-act="go" hidden>Let's go</button>`);
  el.style.setProperty("--rv", "#ff5c1a");
  const cv = el.querySelector(".rv-pack"), wrap = el.querySelector(".rv-cardwrap"), flip = el.querySelector(".rv-flip");
  let state = "wait", pack = null;
  const finish = async skipped => {
    if (state === "done") return; state = "done";
    if (pack) { pack.kill(); } cv.remove(); el.querySelector(".rv-hint").hidden = true; el.querySelector(".rv-slots").hidden = true; el.querySelector(".rv-leak").hidden = true;
    el.style.setProperty("--rv", col); wrap.hidden = false; wrap.getAnimations().forEach(a => a.cancel()); flip.getAnimations().forEach(a => a.cancel());
    wrap.classList.add("landed"); flip.classList.add("faceup"); el.classList.add("burst");
    opts.onSeen && opts.onSeen();
    el.querySelector(".stage-skip").hidden = true; const go = el.querySelector(".rv-go"); go.hidden = false;
    el.querySelector(".rv-title").textContent = E.RARITY[q.rarity].label; el.querySelector(".rv-eyebrow").textContent = "You pulled";
    if (!skipped && !RM) {
      const fl = el.querySelector(".rv-flash"); fl.classList.remove("on"); void fl.offsetWidth; fl.classList.add("on"); el.classList.add("quake"); sfx.slam(); buzz([80, 40, 140]);
      [523, 659, 784, 1047, 1319].slice(0, q.rarity === "common" ? 3 : 5).forEach((f, i) => setTimeout(() => beep(f, .22, .05, "triangle"), 120 + i * 85));
      FX.confetti({ cols: pal, n: { common: 120, rare: 200, epic: 280, legendary: 420 }[q.rarity], y: .45, rain: { common: 2500, rare: 4500, epic: 6500, legendary: 10000 }[q.rarity] });
      FX.sparks(innerWidth / 2, innerHeight * .45, pal, 50, 1.8); FX.chalk(innerWidth / 2, innerHeight * .62, 40, 2.2);
      if (q.rarity === "legendary") { sfx.fanfare(); setTimeout(() => FX.confetti({ cols: pal, n: 200, y: .3 }), 500); }
    }
    setTimeout(() => go.focus({ preventScroll: true }), 350);
  };
  el.addEventListener("click", e => {
    const a = e.target.closest("[data-act]"); if (!a) return;
    if (a.dataset.act === "skip") finish(true);
    if (a.dataset.act === "go") { FX.askGyro(); if (pack) pack.alive = false; unstage(el, opts.onClose); }
    if (a.dataset.act === "auto") autoRip();
  });
  const onKey = e => { if (!el.isConnected) { removeEventListener("keydown", onKey); return; } if (e.key === "Escape") state === "done" ? unstage(el, opts.onClose) : finish(true); if ((e.key === "Enter" || e.key === " ") && state === "ready" && !e.target.closest("button")) { e.preventDefault(); autoRip(); } };
  addEventListener("keydown", onKey);
  if (RM) { finish(true); return el; }
  const face = await packFace(opts.label.toUpperCase());
  if (state === "done") return el;
  pack = makePack(cv, face);
  if (!pack) { finish(true); return el; }
  const loop = t => { if (!pack.alive || !el.isConnected) return; pack.draw(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  /* entrance: the pack slams in from above */
  const spring = async (ms, f) => { const t0 = performance.now(); for (;;) { const u = Math.min(1, (performance.now() - t0) / ms); f(u); if (u >= 1 || state === "done") return; await new Promise(requestAnimationFrame); } };
  sfx.whoosh();
  await spring(opts.incoming ? 520 : 460, u => { pack.off[1] = (1 - u * u) * 2.4 + .02; });
  if (state === "done") return el;
  sfx.slam(); buzz(60); el.classList.add("quake"); FX.chalk(innerWidth / 2, innerHeight * .77, 34, 2.4); if (opts.incoming) sfx.siren();
  await spring(420, u => { pack.squash = Math.sin(u * 9) * .09 * (1 - u); });
  el.classList.remove("quake"); pack.squash = 0; pack.off[1] = .02;
  state = "ready"; el.classList.add("ready"); 

  const rect = () => { const r = cv.getBoundingClientRect(), w = pack.pw * r.width / 2, h = pack.ph * r.height / 2; return { l: r.left + r.width / 2 - w, r: r.left + r.width / 2 + w, t: r.top + r.height / 2 - h - .01 * r.height, b: r.top + r.height / 2 + h, w: w * 2, h: h * 2 }; };
  let active = false, startX = 0, lastX = 0, lastT = 0, acc = 0;
  const tearY = r => r.t + r.h * .11;
  const prog = np => {
    const r = rect(), old = pack.p; np = Math.min(1.02, Math.max(old, np)); pack.p = np;
    el.style.setProperty("--leak", np.toFixed(3));
    const d = np - old; acc += d;
    if (acc > .018) { acc = 0; sfx.rip(d * 14); buzz(6); const x = pack.dir > 0 ? r.l + np * r.w : r.r - np * r.w; FX.shards(x, tearY(r), ["#e8e9ee", "#b9bcc6", "#ff5c1a", "#ffffff"], 3); FX.sparks(x, tearY(r), [col, "#fff"], 3, .6); }
    if (np >= .97 && state === "ready") open();
  };
  cv.addEventListener("pointerdown", e => {
    if (state !== "ready") return; const r = rect(); if (e.clientY > r.t + r.h * .55) { el.classList.add("nudge"); setTimeout(() => el.classList.remove("nudge"), 500); return; }
    active = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} startX = lastX = e.clientX; lastT = e.timeStamp;
    if (pack.p < .02) pack.dir = e.clientX > innerWidth / 2 ? -1 : 1;
  });
  cv.addEventListener("pointermove", e => { if (!active || state !== "ready") return; const r = rect(); const x = pack.dir > 0 ? (e.clientX - r.l) / r.w : (r.r - e.clientX) / r.w; const moved = Math.abs(e.clientX - startX); if (moved > 4) { const cap = pack.p + .12; prog(Math.min(x, cap)); } lastX = e.clientX; });
  const up = () => { active = false; if (state === "ready" && pack.p > .8) autoRip(); };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  async function autoRip() { if (state !== "ready") return; el.classList.add("ripping"); const from = pack.p; await spring(650 * (1 - from) + 80, u => { if (state === "ready") prog(from + (1 - from) * u * u); }); if (state === "ready") prog(1); }

  async function open() {
    state = "open"; el.classList.add("opened"); el.classList.remove("ready"); sfx.ripEnd(); buzz([30, 30, 60]);
    const fl = el.querySelector(".rv-flash"); fl.classList.add("soft");
    const rr = rect(); FX.shards(innerWidth / 2, tearY(rr), ["#e8e9ee", "#ff5c1a", "#fff"], 26);
    spring(700, u => { pack.fly = u * 1.6; });
    /* card rises out of the pack, face down */
    wrap.hidden = false; wrap.style.setProperty("--pw", rr.w + "px");
    await wrap.animate([{ transform: "translate(-50%,-38%) scale(.8)" }, { transform: "translate(-50%,-94%) scale(.84)" }], { duration: 900, easing: "cubic-bezier(.2,.75,.2,1)", fill: "forwards" }).finished.catch(() => {});
    if (state === "done") return;
    sfx.whoosh(); spring(520, u => { pack.off[1] = .02 - u * u * 3; pack.off[2] = -u * .4; });
    await wrap.animate([{ transform: "translate(-50%,-94%) scale(.84)" }, { transform: "translate(-50%,-56%) scale(.96)" }], { duration: 560, easing: "cubic-bezier(.3,1.5,.5,1)", fill: "forwards" }).finished.catch(() => {});
    if (state === "done") return;
    /* slot machine */
    const slots = el.querySelector(".rv-slots"); slots.hidden = false;
    const [a, b] = slots.querySelectorAll(".strip"), H = a.children[0].getBoundingClientRect().height, dur = { common: 2300, rare: 2700, epic: 3300, legendary: 4000 }[q.rarity];
    const run = (s, d) => s.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-(s.children.length - 1) * H}px)` }], { duration: d, easing: "cubic-bezier(.12,.68,.14,1)", fill: "forwards" });
    const A = run(a, dur * .72), B = run(b, dur);
    let last = -1;
    (function tick() { if (state === "done" || !el.isConnected || B.playState === "finished") return; const y = -new DOMMatrixReadOnly(getComputedStyle(b).transform).m42, i = Math.round(y / H); if (i !== last) { last = i; beep(460 + (i % 5) * 60, .025, .03); buzz(4); } if (A.playState === "running") { const ai = Math.min(rseq.length - 1, Math.round(-new DOMMatrixReadOnly(getComputedStyle(a).transform).m42 / H)); el.style.setProperty("--rv", RCOL[rseq[Math.max(0, ai)]]); } requestAnimationFrame(tick); })();
    await A.finished.catch(() => {}); if (state === "done") return;
    el.style.setProperty("--rv", col); buzz(40); beep(q.rarity === "legendary" ? 1046 : 660, .2, .06, "triangle"); el.classList.add("rarity-set"); FX.sparks(innerWidth / 2, innerHeight * .45, pal, 26, 1.3);
    if (q.rarity === "epic" || q.rarity === "legendary") { sfx.thunder(); el.classList.add("quake"); }
    await B.finished.catch(() => {}); if (state === "done") return;
    await sleep(160); sfx.flip();
    await flip.animate([{ transform: "rotateY(0deg) scale(1)" }, { transform: "rotateY(540deg) scale(1.1)", offset: .7 }, { transform: "rotateY(900deg) scale(1.04)" }], { duration: 900, easing: "cubic-bezier(.3,.1,.2,1)", fill: "forwards" }).finished.catch(() => {});
    finish(false);
  }
  return el;
}

/* ---------- duel accepted: VS slam ---------- */
export async function duelIntro({ a, b, label, stake }) {
  const el = stage("vs", "Duel", `<div class="vs-bg"></div><canvas data-fx="bolt" class="vs-bolt"></canvas><div class="vs-name l" style="--n:${a.length * .8}">${esc(a)}</div><div class="vs-vs">VS</div><div class="vs-name r" style="--n:${b.length * .8}">${esc(b)}</div><div class="vs-info"><b>${esc(label)}</b><span>${stake} points at stake</span></div><button type="button" class="btn primary big">Fight</button>`);
  sfx.thunder(); buzz([60, 30, 120]); setTimeout(() => { sfx.slam(); if (!RM) { FX.sparks(innerWidth / 2, innerHeight / 2, ["#fff", "#ff5c1a", "#2f9bff"], 60, 2); FX.chalk(innerWidth / 2, innerHeight / 2, 30, 2.5); } }, 480);
  const x = el.querySelector("button"); x.addEventListener("click", () => unstage(el)); x.focus();
}

/* ---------- Sunday ceremony ---------- */
/* d: ceremonyData; h: { name(id), avatar(id), punishment, wkLabel, fmtMs, onClose, onShare } */
export async function ceremony(d, h) {
  if ($("#ceremony")) return;
  const r = d.rank.filter(x => x.pts !== 0 || d.rank.length <= 3), top = r.slice(0, 3);
  const aw = [];
  if (d.awards.quick) aw.push(["6", "Fastest finger", d.awards.quick.id, h.fmtMs(d.awards.quick.v) + " after a drop"]);
  if (d.awards.reps) aw.push(["8", "Workhorse", d.awards.reps.id, d.awards.reps.v + " reps"]);
  if (d.awards.firsts) aw.push(["1", "First blood", d.awards.firsts.id, d.awards.firsts.v + (d.awards.firsts.v === 1 ? " first place" : " first places")]);
  if (d.awards.hard) aw.push(["5", "No mercy", d.awards.hard.id, d.awards.hard.v + " Hard finishes"]);
  if (d.awards.loved) aw.push(["14", "Crowd favourite", d.awards.loved.id, d.awards.loved.v + " reactions"]);
  const el = stage("ceremony", "Sunday ceremony", `
    <div class="cm-arena"></div><div class="cm-beam b1"></div><div class="cm-beam b2"></div><div class="rv-flash"></div>
    <button type="button" class="stage-skip" data-act="skip">Skip</button>
    <div class="cm-act" data-a="0"><div class="cm-eyebrow">${esc(h.wkLabel)}</div><div class="cm-big">The<br>Sunday<br>Ceremony</div></div>
    <div class="cm-act" data-a="1">
      <div class="cm-eyebrow">Champion of the week</div><div class="cm-champ" id="cm-champ">&nbsp;</div>
      <img class="cm-trophy" src="img/trophy.webp" alt="">
      <div class="cm-podium">${[1, 0, 2].map(i => top[i] ? `<div class="cm-col p${i + 1}" data-p="${i + 1}"><div class="cm-who">${h.avatar(top[i].id)}<b>${esc(h.name(top[i].id))}</b><span>${top[i].pts}</span></div><div class="cm-block"><i>${i + 1}</i></div></div>` : `<div class="cm-col p${i + 1}"></div>`).join("")}</div>
    </div>
    <div class="cm-act" data-a="2"><div class="cm-eyebrow">Awards</div><div class="cm-awards">${aw.map(([pin, t, id, v]) => `<div class="cm-aw">${FX.pin(Number(pin))}<div><small>${esc(t)}</small><b>${esc(h.name(id))}</b><span>${esc(v)}</span></div></div>`).join("") || `<p>No awards this week.</p>`}</div>
      <div class="cm-team">${d.goal ? `<div><b>${d.goal.total}</b><span>of ${d.goal.target} crew reps${d.goal.hitOn ? ` · shaker filled, +${E.GOAL_BONUS} each` : ""}</span></div>` : ""}${d.squads[0] && d.squads[0].avg > 0 ? `<div><b>${esc(d.squads[0].name)}</b><span>top squad, +${E.SQUAD_BONUS} each</span></div>` : ""}</div></div>
    ${d.last.length ? `<div class="cm-act red" data-a="3"><img src="img/redcard.webp" alt=""><div class="cm-red"><div class="cm-eyebrow">Last place</div><div class="cm-champ">${d.last.map(id => esc(h.name(id))).join(" & ")}</div><p>${esc(h.punishment)}</p></div></div>` : ""}
    <div class="cm-nav"><button type="button" class="btn chalk" data-act="share" hidden>Share the recap</button><button type="button" class="btn primary big" data-act="next">Start</button></div>`);
  const acts = [...el.querySelectorAll(".cm-act")], next = el.querySelector('[data-act="next"]'), share = el.querySelector('[data-act="share"]');
  let i = 0;
  const show = async n => {
    i = n; acts.forEach((a, k) => a.classList.toggle("on", k === n));
    const a = acts[n].dataset.a, lastAct = n === acts.length - 1;
    next.textContent = lastAct ? "Done" : n === 0 ? "Start" : "Next"; share.hidden = n === 0;
    if (a === "0") { sfx.crowd(); }
    if (a === "1") {
      const name = h.name(top[0].id), champ = $("#cm-champ"); champ.innerHTML = "&nbsp;";
      const cols = el.querySelectorAll(".cm-col[data-p]"); cols.forEach(c => c.classList.remove("up"));
      el.classList.remove("crowned");
      for (const p of [3, 2]) { const c = el.querySelector(`.cm-col[data-p="${p}"]`); if (!c) continue; await sleep(RM ? 0 : 500); if (i !== n) return; c.classList.add("up"); sfx.slam(); FX.chalk(...center(c), 16, 1.5); }
      if (!RM) { sfx.drum(24); await sleep(1400); } if (i !== n) return;
      el.querySelector('.cm-col[data-p="1"]').classList.add("up"); sfx.slam(); buzz([70, 40, 160]);
      champ.innerHTML = [...name].map((c, k) => `<i style="--k:${k}">${c === " " ? "&nbsp;" : esc(c)}</i>`).join("");
      el.classList.add("crowned"); sfx.fanfare(); setTimeout(() => sfx.crowd(), 300);
      const fl = el.querySelector(".rv-flash"); fl.classList.remove("on"); void fl.offsetWidth; fl.classList.add("on");
      FX.confetti({ cols: PAL.legendary, n: 260, x: .1, y: .7, power: 1.5, rain: 9000 }); FX.confetti({ cols: PAL.signal, n: 200, x: .9, y: .7, power: 1.5 });
    }
    if (a === "2") [...el.querySelectorAll(".cm-aw")].forEach((x, k) => setTimeout(() => beep(520 + k * 90, .12, .04, "triangle"), 150 + k * 160));
    if (a === "3") { FX.stopRain(); sfx.whistle(); buzz([200]); el.classList.add("quake"); setTimeout(() => el.classList.remove("quake"), 500); }
  };
  const center = n => { const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + 20]; };
  const close = () => unstage(el, h.onClose);
  el.addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (!b) return; if (b.dataset.act === "skip") close(); else if (b.dataset.act === "share") h.onShare(); else if (i === acts.length - 1) close(); else show(i + 1); });
  addEventListener("keydown", function k(e) { if (!el.isConnected) { removeEventListener("keydown", k); return; } if (e.key === "Escape") close(); });
  show(0); next.focus();
}

/* ---------- recap poster, 1080 x 1920 ---------- */
export async function recapPoster(d, h) {
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1920; const g = c.getContext("2d");
  await Promise.race([Promise.all([document.fonts.load("900 100px Anybody"), document.fonts.load("700 60px 'Qwitcher Grypen'"), document.fonts.load("600 30px Archivo")]), sleep(1500)]).catch(() => {});
  g.fillStyle = "#0d0e11"; g.fillRect(0, 0, 1080, 1920);
  try { g.drawImage(await loadImg("img/arena.webp"), 0, 0, 1080, 1620); } catch (e) {}
  const gr = g.createLinearGradient(0, 700, 0, 1300); gr.addColorStop(0, "rgba(13,14,17,0)"); gr.addColorStop(1, "#0d0e11"); g.fillStyle = gr; g.fillRect(0, 700, 1080, 1220);
  const fit = (t, w, max, fam = "Anybody", weight = 900) => { let s = max; do { g.font = `${weight} ${s}px ${fam}, sans-serif`; s -= 2; } while (g.measureText(t).width > w && s > 14); return s; };
  g.textAlign = "center"; g.fillStyle = "#f4f1e8"; fit("SIDE GAINS", 500, 60); g.fillText("SIDE GAINS", 540, 110);
  g.fillStyle = "#ff5c1a"; fit(h.wkLabel.toUpperCase(), 800, 34, "Anybody", 800); g.fillText(h.wkLabel.toUpperCase(), 540, 162);
  const top = d.rank.slice(0, 3);
  g.fillStyle = "#f4f1e8"; const nm = h.name(top[0].id).toUpperCase(); const ns = fit(nm, 980, 170); g.fillText(nm, 540, 220 + ns * .82);
  g.fillStyle = "#ffc02e"; fit("CHAMPION OF THE WEEK", 700, 40, "Anybody", 800); g.fillText("CHAMPION OF THE WEEK", 540, 275 + ns * .82);
  try { const t = await loadImg("img/trophy.webp"); const th = 450, tw = th * t.width / t.height; g.drawImage(t, 540 - tw / 2, 462, tw, th); } catch (e) {}
  const cols = [[1, 130, 1130, 250, "#c6cbd4"], [0, 400, 1010, 370, "#ffc02e"], [2, 670, 1190, 190, "#ff5c1a"]];
  for (const [k, x, y, hh, col] of cols) { const p = top[k]; if (!p) continue; g.fillStyle = col; g.beginPath(); g.roundRect(x, y, 270, hh, [18, 18, 0, 0]); g.fill(); g.fillStyle = "#0d0e11"; g.font = "900 110px Anybody, sans-serif"; g.fillText(String(k + 1), x + 135, y + 130); g.fillStyle = "#f4f1e8"; fit(h.name(p.id), 250, 34, "Archivo", 700); g.fillText(h.name(p.id), x + 135, y - 56); fit(p.pts + " pts", 250, 34, "Anybody", 900); g.fillText(p.pts + " pts", x + 135, y - 16); }
  g.fillStyle = "#16171c"; g.fillRect(0, 1380, 1080, 540);
  g.textAlign = "left"; let y = 1462; const line = (a, b) => { if (y > 1800) return; g.fillStyle = "#a3a4ad"; g.font = "600 32px Archivo, sans-serif"; g.fillText(a, 80, y); g.fillStyle = "#f4f1e8"; g.textAlign = "right"; fit(b, 560, 38, "Anybody", 800); g.fillText(b, 1000, y); g.textAlign = "left"; g.fillStyle = "#33363f"; g.fillRect(80, y + 22, 920, 2); y += 76; };
  line("Crew reps", `${d.total}${d.goal && d.goal.hitOn ? " · shaker filled" : ""}`);
  if (d.awards.quick) line("Fastest after a drop", `${h.name(d.awards.quick.id)}, ${h.fmtMs(d.awards.quick.v)}`);
  if (d.awards.reps) line("Workhorse", `${h.name(d.awards.reps.id)}, ${d.awards.reps.v} reps`);
  if (d.squads[0] && d.squads[0].avg > 0) line("Top squad", d.squads[0].name);
  if (d.last.length) { g.fillStyle = "#ff3b3b"; g.beginPath(); g.roundRect(80, 1790, 64, 88, 8); g.fill(); g.fillStyle = "#f4f1e8"; const t = `${d.last.map(h.name).join(" & ")}: ${h.punishment}`; fit(t, 820, 40, "Archivo", 800); g.fillText(t, 172, 1848); }
  return new Promise(res => c.toBlob(res, "image/png"));
}
