/* Profile pictures: pick a photo, drag and zoom it into a circle, get back a small JPEG that fits inside the member record.
   No storage bucket needed, and it is as private as the rest of the crew's data. */
const OUT = 256, MAX = 90000;
/* anything else stored in a member record is ignored, so nobody can smuggle in a link or an SVG */
export const valid = p => typeof p === "string" && p.length < MAX && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(p);

async function load(file) {
  if (file.size > 40 * 1048576) throw new Error("That photo is over 40 MB. Pick a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight; if (!w || !h) throw 0;
    /* work from a smaller copy so dragging stays smooth with big phone photos */
    const k = Math.min(1, 1200 / Math.min(w, h), 4000 / Math.max(w, h)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext("2d"); g.fillStyle = "#1b1d22"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } catch (e) { throw new Error("That photo can't be opened here. Try a JPG or PNG."); }
  finally { URL.revokeObjectURL(url); }
}

/* canvas: the square stage (shown as a circle). zoom: a range input from 1 to 4. */
export async function cropper(canvas, zoom, file) {
  const src = await load(file), g = canvas.getContext("2d"), N = canvas.width;
  let z = 1, cx = src.width / 2, cy = src.height / 2;
  const side = () => Math.min(src.width, src.height) / z;
  const clamp = () => { const s = side() / 2; cx = Math.min(src.width - s, Math.max(s, cx)); cy = Math.min(src.height - s, Math.max(s, cy)); };
  const paint = (ctx, n) => { const s = side(); ctx.imageSmoothingQuality = "high"; ctx.drawImage(src, cx - s / 2, cy - s / 2, s, s, 0, 0, n, n); };
  const draw = () => { clamp(); zoom.value = z; paint(g, N); };
  const setZ = v => { z = Math.min(4, Math.max(1, v)); draw(); };
  const move = (dx, dy) => { const f = side() / canvas.clientWidth; cx -= dx * f; cy -= dy * f; draw(); };
  const pts = new Map(), gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
  canvas.onpointerdown = e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); };
  canvas.onpointermove = e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const was = pts.size === 2 ? gap() : 0; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (was) setZ(z * gap() / was); else if (pts.size === 1) move(e.clientX - p[0], e.clientY - p[1]);
  };
  canvas.onpointerup = canvas.onpointercancel = e => pts.delete(e.pointerId);
  canvas.onwheel = e => { e.preventDefault(); setZ(z * Math.exp(-e.deltaY / 400)); };
  canvas.onkeydown = e => { const d = { ArrowLeft: [12, 0], ArrowRight: [-12, 0], ArrowUp: [0, 12], ArrowDown: [0, -12] }[e.key]; if (d) { e.preventDefault(); move(...d); } };
  zoom.oninput = () => setZ(Number(zoom.value));
  draw();
  return () => {
    const c = document.createElement("canvas"); c.width = c.height = OUT; paint(c.getContext("2d"), OUT);
    for (const q of [.85, .7, .5, .3]) { const d = c.toDataURL("image/jpeg", q); if (valid(d)) return d; }
    throw new Error("That photo can't be saved. Try another one.");
  };
}
