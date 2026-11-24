/* Big videos: accept up to 200 MB, shrink them on the device, and split anything still too big.
   Supabase's free plan refuses single files over 50 MB, so every upload stays under that. */
export const MAX_MB = 200;
const PART = 48 * 1048576, TARGET = 44 * 1048576, SQUEEZE_OVER = 16 * 1048576;
const LIB = "https://cdn.jsdelivr.net/npm/mediabunny@1.66.4/dist/bundles/mediabunny.min.mjs";

/* re-encode to 720p H.264 in the browser; returns a smaller Blob, or null when this device can't */
export async function squeeze(file, onProgress = () => {}) {
  if (!("VideoEncoder" in window) || !("VideoDecoder" in window)) return null;
  let lock = null;
  try { lock = await navigator.wakeLock.request("screen"); } catch (e) {}
  try {
    const M = await import(LIB);
    const input = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const dur = Math.max(1, await input.computeDuration()), w = await track.displayWidth, h = await track.displayHeight, k = Math.min(1, 720 / Math.min(w, h));
    const bitrate = Math.round(Math.min(1.8e6, TARGET * 8 / dur - 140e3));
    if (bitrate < 250e3) return null;
    const output = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: "in-memory" }), target: new M.BufferTarget() });
    const even = v => Math.max(2, Math.round(v * k / 2) * 2);
    const conv = await M.Conversion.init({ input, output, video: { width: even(w), height: even(h), fit: "contain", codec: "avc", bitrate, frameRate: 30, forceTranscode: true } });
    if (!conv.isValid) return null;
    /* give up if the encoder stalls */
    let last = performance.now(), timer;
    conv.onProgress = p => { last = performance.now(); onProgress(p); };
    const stall = new Promise((_, rej) => { timer = setInterval(() => { if (performance.now() - last > 25000) { try { conv.cancel(); } catch (e) {} rej(new Error("stalled")); } }, 2000); });
    try { await Promise.race([conv.execute(), stall]); } finally { clearInterval(timer); }
    const blob = new Blob([output.target.buffer], { type: "video/mp4" });
    return blob.size > 1000 && blob.size < file.size ? blob : null;
  } catch (e) { console.warn("video compression unavailable:", e && e.message); return null; }
  finally { if (lock) lock.release().catch(() => {}); }
}

/* upload(path, blob, type) stores one object; returns the id kept with the submission */
export async function send(file, type, { base, upload, onStage }) {
  let blob = file, t = type;
  if (file.size > SQUEEZE_OVER) {
    onStage("Getting your video ready…");
    const small = await squeeze(file, p => onStage(`Shrinking your video, ${Math.round(p * 100)}%`));
    if (small) { blob = small; t = "video/mp4"; }
  }
  const ext = t === "video/webm" ? "webm" : "mp4";
  if (blob.size <= PART) { onStage("Uploading…"); await upload(`${base}.${ext}`, blob, t); return `sb:${base}.${ext}`; }
  const n = Math.ceil(blob.size / PART);
  for (let i = 0; i < n; i++) { onStage(`Uploading part ${i + 1} of ${n}…`); await upload(`${base}.p${i + 1}of${n}.${ext}`, blob.slice(i * PART, (i + 1) * PART, t), t); }
  return `sbp:${base}|${n}|${ext}|${Math.round(blob.size / 1048576)}`;
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
