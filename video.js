/* Big videos: accept up to 200 MB, shrink them on the device, and split anything still too big.
   Supabase's free plan refuses single files over 50 MB, so every upload stays under that. */
export const MAX_MB = 200;
const PART = 48 * 1048576, TARGET = 44 * 1048576, SQUEEZE_OVER = 16 * 1048576;
/* 540p is plenty to judge reps on a phone screen, and has about half the pixels of 720p to encode and send */
const SHORT_SIDE = 540, MAX_BPS = 1.2e6, PARALLEL = 2;
const LIB = "https://cdn.jsdelivr.net/npm/mediabunny@1.66.4/dist/bundles/mediabunny.min.mjs";

/* start fetching the video tool as soon as a file is picked, so it's ready by the time they press submit */
let lib = null;
const loadLib = () => (lib ||= import(LIB).catch(e => { lib = null; throw e; }));
export function warm(file) { if (file && file.size > SQUEEZE_OVER && "VideoEncoder" in window) loadLib().catch(() => {}); }

/* keep the screen on for the whole shrink and upload: a locked phone pauses both */
async function awake() {
  let lock = null;
  const grab = async () => { try { lock = await navigator.wakeLock.request("screen"); } catch (e) {} };
  const back = () => { if (document.visibilityState === "visible" && (!lock || lock.released)) grab(); };
  await grab(); document.addEventListener("visibilitychange", back);
  return () => { document.removeEventListener("visibilitychange", back); if (lock) lock.release().catch(() => {}); };
}

async function convert(M, file, hw, onProgress) {
  const input = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) return null;
  const dur = Math.max(1, await input.computeDuration()), w = await track.displayWidth, h = await track.displayHeight, k = Math.min(1, SHORT_SIDE / Math.min(w, h));
  const bitrate = Math.round(Math.min(MAX_BPS, TARGET * 8 / dur - 140e3));
  if (bitrate < 250e3) return null;
  const output = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: "in-memory" }), target: new M.BufferTarget() });
  const even = v => Math.max(2, Math.round(v * k / 2) * 2);
  const conv = await M.Conversion.init({ input, output, video: { width: even(w), height: even(h), fit: "contain", codec: "avc", bitrate, frameRate: 30, forceTranscode: true, ...(hw ? { hardwareAcceleration: "prefer-hardware" } : {}) } });
  if (!conv.isValid) return hw ? undefined : null;
  /* give up if the encoder stalls */
  let last = performance.now(), started = false, timer;
  conv.onProgress = p => { last = performance.now(); started = true; onProgress(p); };
  const stall = new Promise((_, rej) => { timer = setInterval(() => { if (performance.now() - last > 20000) { try { conv.cancel(); } catch (e) {} rej(new Error(started ? "stalled" : "never started")); } }, 2000); });
  try { await Promise.race([conv.execute(), stall]); }
  catch (e) { if (hw && !started) return undefined; throw e; }
  finally { clearInterval(timer); }
  const blob = new Blob([output.target.buffer], { type: "video/mp4" });
  return blob.size > 1000 && blob.size < file.size ? blob : null;
}

/* re-encode to 540p H.264 in the browser; returns a smaller Blob, or null when this device can't.
   Tries the phone's hardware encoder first (much faster), then the default one. */
export async function squeeze(file, onProgress = () => {}) {
  if (!("VideoEncoder" in window) || !("VideoDecoder" in window)) return null;
  try {
    const M = await loadLib();
    let out;
    try { out = await convert(M, file, true, onProgress); } catch (e) { out = undefined; }
    if (out === undefined) out = await convert(M, file, false, onProgress);
    return out || null;
  } catch (e) { console.warn("video compression unavailable:", e && e.message); return null; }
}

/* upload(path, blob, type, onProgress) stores one object; returns the id kept with the submission */
export async function send(file, type, { base, upload, onStage }) {
  const release = await awake();
  try {
    let blob = file, t = type;
    if (file.size > SQUEEZE_OVER) {
      onStage("Getting your video ready…");
      const small = await squeeze(file, p => onStage(`Shrinking your video, ${Math.round(p * 100)}%`));
      if (small) { blob = small; t = "video/mp4"; }
    }
    const ext = t === "video/webm" ? "webm" : "mp4", mb = Math.max(1, Math.round(blob.size / 1048576));
    const n = Math.ceil(blob.size / PART), done = new Array(n).fill(0);
    let shown = -1;
    const tick = () => { const f = done.reduce((a, b) => a + b, 0) / blob.size, pc = Math.min(99, Math.floor(f * 100)); if (pc !== shown) { shown = pc; onStage(`Uploading ${mb} MB, ${pc}%`); } };
    tick();
    if (n === 1) { await upload(`${base}.${ext}`, blob, t, b => { done[0] = b; tick(); }); return `sb:${base}.${ext}`; }
    /* send the pieces a couple at a time, so one slow piece doesn't leave the connection idle */
    let next = 0;
    const worker = async () => { while (next < n) { const i = next++, part = blob.slice(i * PART, (i + 1) * PART, t); await upload(`${base}.p${i + 1}of${n}.${ext}`, part, t, b => { done[i] = b; tick(); }); done[i] = part.size; tick(); } };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, n) }, worker));
    return `sbp:${base}|${n}|${ext}|${Math.round(blob.size / 1048576)}`;
  } finally { release(); }
}
export function parts(id) {
  const [base, n, ext, mb] = id.slice(4).split("|");
  return { paths: Array.from({ length: Number(n) || 0 }, (_, i) => `${base}.p${i + 1}of${n}.${ext}`), type: ext === "webm" ? "video/webm" : "video/mp4", mb: Number(mb) || 0 };
}
/* fetch every part and glue them back together for playback */
export async function join(id, signedUrl, onProgress) {
  const p = parts(id), bufs = [];
  for (let i = 0; i < p.paths.length; i++) {
    const r = await fetch(await signedUrl(p.paths[i]));
    if (!r.ok) throw new Error("part " + (i + 1));
    bufs.push(await r.blob()); onProgress((i + 1) / p.paths.length);
  }
  return URL.createObjectURL(new Blob(bufs, { type: p.type }));
}
