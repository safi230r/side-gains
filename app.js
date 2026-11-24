/* Side Gains app: state, pages, storage, notifications. Rules live in engine.js, visuals in fx.js, big moments in show.js. */
import * as E from "./engine.js";
import * as FX from "./fx.js";
import * as SHOW from "./show.js";
import * as VID from "./video.js";
import { FORM, ANIM, FLEX_PATH, ICON, HABITS, WATER_GOAL, TIPS } from "./catalog.js";
const { RM, RCOL, PAL, sfx, pin, rankEm, stk, athCanvas } = FX;

const CONF = window.SIDEGAINS_CONFIG || {};
E.configure(CONF);
const Q = new URLSearchParams(location.search);

/* ---------- state ---------- */
const COLLS = ["members", "subs", "votes", "quests", "pens", "ideas", "ivotes", "habits", "push", "drops", "meta", "reacts", "comments", "duels", "powers"];
const S = { mode: "boot", db: null, user: null, assets: null, uid: null, isOwner: false, canWrite: null, confirmed: {}, range: "season", view: "today", train: "form", slot: null, lv: "normal", busy: false, seenSubs: new Set(), ripped: new Set(), offered: new Set(), now: E.now() };
for (const c of COLLS) S[c] = {};
/* real drop times live in the database; until it answers (or while signed out) nothing is known, so never guess */
if (CONF.supabaseUrl && !Q.has("demo") && !window.claude) S.meta = { engine: { drops: true, since: E.CFG.since } };
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
S.range = ["week", "season", "all"].includes(store.get("sg-range2")) ? store.get("sg-range2") : "week";
S.lv = E.LEVELS[store.get("sg-lv")] ? store.get("sg-lv") : "normal";

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const today = () => E.keyAt(E.now());
const dObj = k => new Date(k + "T12:00:00Z");
const fmtDay = (k, o = { weekday: "short", day: "numeric", month: "short" }) => dObj(k).toLocaleDateString(undefined, { ...o, timeZone: "UTC" });
const fmtTime = ms => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: E.CFG.tz });
const fmtMs = ms => { const s = Math.max(0, Math.round(ms / 1000)); if (s >= 172800) return `${Math.floor(s / 86400)} d ${Math.floor(s / 3600) % 24} h`; return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.floor(s / 60) % 60} min`; };
const hms = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const nameOf = id => (S.members[id] && S.members[id].name) || "Someone";
const COLORS = ["#2f6bff", "#d6307f", "#0f9d6b", "#d9770a", "#8a4bff", "#0e8fb5", "#dc2f2f", "#5d8a12", "#b13ad6", "#0f7a70"];
/* one colour per member, in joining order, so two people never share one until there are more than ten */
let colorKey = null, colorMap = {};
const colorOf = id => { if (colorKey !== S.members) { colorKey = S.members; colorMap = {}; Object.keys(S.members).sort((a, b) => (S.members[a].joined || 0) - (S.members[b].joined || 0) || (a < b ? -1 : 1)).forEach((m, i) => (colorMap[m] = COLORS[i % COLORS.length])); } return colorMap[id] || "#5a5d68"; };
const avatar = (id, cls = "") => `<span class="av ${cls}" style="background:${colorOf(id)}" aria-hidden="true">${esc((nameOf(id)[0] || "?").toUpperCase())}</span>`;
const nameBtn = id => `<button type="button" class="namebtn" data-prof="${esc(id)}">${esc(nameOf(id))}${id === S.uid ? " (you)" : ""}</button>`;
const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 >> 3) ^ 1 && n % 10] || "th");
const safeLink = u => (/^https:\/\/[^\s"'<>]+$/i.test(u || "") ? u : null);
const isMember = () => !!(S.uid && S.members[S.uid]);
const monthName = se => new Date(se + "-15T12:00:00Z").toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
let toastT;
function toast(msg) { const t = $("#toast"); t.hidden = true; void t.offsetWidth; t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3800); }
const chains = {};
function queueWrite(path, fn) { const p = (chains[path] || Promise.resolve()).then(fn, fn); chains[path] = p.catch(() => {}); return p; }
function dbErr(e) {
  const c = e && e.code;
  if (c === "invalid_argument") return "You don't have permission to save that. If this is new, the crew owner needs to run the latest database update.";
  if (c === "quota_exceeded") return "The crew's storage is full. The owner needs to clear out old data.";
  if (c === "resource_exhausted") return "Too many changes at once. Wait a moment and try again.";
  return "Couldn't save. Check your connection and try again.";
}
/* change my own document in a collection: mut gets a deep copy and returns the new value */
async function mine(coll, mut) {
  if (!S.db || !S.uid) { toast("Sign in first."); throw new Error("no user"); }
  const path = coll + "/" + S.uid;
  return queueWrite(path, () => { const cur = JSON.parse(JSON.stringify(S[coll][S.uid] || {})); return S.db.doc(path).set(mut(cur) || cur); });
}
const notify = body => { if (S.sb) S.sb.functions.invoke("notify", { body }).catch(() => {}); };
const keyed = (el, key) => { const k = typeof key === "string" ? key : JSON.stringify(key); if (el.dataset.k === k) return false; el.dataset.k = k; return true; };

/* ---------- quest card ---------- */
document.documentElement.style.setProperty("--flex", `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="24 44 464 426"><path d="${FLEX_PATH}"/></svg>`)}")`);
const cardNo = qid => `${qid.slice(8, 10)}·${qid.slice(5, 7)}${qid.slice(10).toUpperCase() ? " " + qid.slice(10).toUpperCase() : ""}`;
function cardBits(q, lv) {
  const x = E.atLevel(q, lv), numeric = /^[\d:]+$/.test(x.n), base = E.RARITY[q.rarity].base * E.LEVELS[lv].pts;
  return { x, numeric, nCls: !numeric ? "word" : (x.n.length > 3 ? "l4" : "") + (x.n.includes(":") ? " time" : ""), pts: [base, base * 1.5, base * 1.25, base * 1.1].map(Math.round) };
}
function cardHTML(q, { qid, lv = "normal", mini = false, stamp = "", cls = "", tag = "div", attrs = "" } = {}) {
  const b = cardBits(q, lv), keys = E.keysFor(q.u + " · " + q.n), R = E.RARITY[q.rarity];
  const art = mini ? (keys.length ? athCanvas(keys[0], { tint: q.rarity === "common" ? RCOL.signal : RCOL[q.rarity], still: true, chrome: q.rarity === "legendary" ? .8 : q.rarity === "epic" ? .45 : 0 }) : `<i class="qc-silh"></i>`) : keys.length ? athCanvas(keys[0], { tint: q.rarity === "common" ? RCOL.signal : RCOL[q.rarity], hero: true, chrome: q.rarity === "legendary" ? .8 : q.rarity === "epic" ? .45 : 0, speed: lv === "hard" ? 1.25 : 1 }) : `<i class="qc-silh"></i>`;
  return `<${tag} class="qcard ${mini ? "" : "holo"} ${cls}" data-r="${q.rarity}" ${attrs}><span class="qc-art"></span>${art}<span class="qc-shade"></span><span class="qc-foil"></span><span class="qc-foil2"></span><span class="qc-glare"></span>
    <span class="qc-top"><span class="r">${mini ? "" : `<span class="pips">${[1, 2, 3, 4].map(i => `<i class="${i <= R.pips ? "on" : ""}"></i>`).join("")}</span>`}${R.label}</span><span class="no">${esc(cardNo(qid))}</span></span>
    <span class="qc-bot" style="display:block"><span class="qc-n ${b.nCls}" style="display:block">${esc(b.x.n)}</span><span class="qc-u ${b.x.u.length > 24 ? "long" : ""}" style="display:block">${esc(b.x.u)}</span>
    <span class="qc-strip">${["Points", "1st", "2nd", "3rd"].map((l, i) => `<span>${l}<b>${b.pts[i]}</b></span>`).join("")}</span></span>
    ${stamp}<span class="qc-frame"></span></${tag}>`;
}

/* ---------- render ---------- */
let rafId = 0;
function scheduleRender() { if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; render(); }); }
function seen(qid) { return S.ripped.has(qid) || store.get("sg-rip-" + qid) === "1"; }
function markSeen(qid) { S.ripped.add(qid); store.set("sg-rip-" + qid, "1"); }
const fresh = () => S.mode !== "live" || (S.confirmed.members && S.confirmed.subs && S.confirmed.drops && S.confirmed.meta);

function render() {
  S.now = E.now();
  const C = S.C = E.compute(S);
  if (!S.slot || !C.slots.some(s => s.qid === S.slot)) S.slot = pickSlot(C);
  const t = liveTint(C); FX.setTint(t[0], t[1]);
  renderNote(); renderHeader(C);
  $("#v-today").classList.toggle("auth", S.mode === "signin");
  if (S.view === "today") { renderTrack(C); renderDeck(C); renderPenance(C); renderAction(C); renderFinishers(C); renderPower(C); renderQueue(C); renderCoach(C); }
  if (S.view === "board") { renderBoard(C); renderRace(C); renderSeason(C); renderCeremonyBanner(C); }
  if (S.view === "arena") { renderDuels(C); renderGoal(C); renderSquads(C); }
  if (S.view === "punish") { renderRed(C); renderIdeas(C); renderMyIdea(); renderPenBox(C); }
  if (S.view === "train") renderTrain();
  if (S.view === "me") renderMe(C);
  updateModalVC(C);
  afterRender(C);
  hydrateMedia();
}
function liveTint(C) {
  const open = C.slots.filter(s => s.state === "open");
  const cur = C.slots.find(s => s.qid === S.slot);
  if (S.view === "punish") return ["#ff3b3b", .6];
  if (cur && cur.quest && seen(cur.qid)) return [RCOL[cur.quest.rarity] === RCOL.common ? "#ff5c1a" : RCOL[cur.quest.rarity], open.length ? .9 : .5];
  return ["#ff5c1a", open.length ? 1 : .55];
}
function pickSlot(C) {
  const open = C.slots.filter(s => s.state === "open"), todo = open.filter(s => !s.list.some(x => x.uid === S.uid));
  return (todo[todo.length - 1] || open[open.length - 1] || C.slots.find(s => s.state === "waiting") || C.slots[C.slots.length - 1]).qid;
}
function renderHeader(C) {
  const st = S.uid && C.stats[S.uid], p = $("#streak-pill");
  p.hidden = !st;
  if (st) { $("#streak-n").textContent = st.cur; const cv = p.querySelector("canvas"); cv.dataset.v = st.cur ? Math.min(1, .25 + st.cur / 14).toFixed(2) : 0; cv.dataset.ice = st.frozen.includes(E.shiftKey(C.today, -1)) && !st.doneToday ? "1" : "0"; p.title = `${st.cur}-day streak`; }
  const dot = (id, v) => { const d = $("#dot-" + id); d.hidden = !v; d.textContent = v || ""; };
  const unrip = C.slots.filter(s => s.state === "open" && !seen(s.qid)).length, lastTape = Number(store.get("sg-tape") || 0);
  dot("today", unrip ? "!" : S.view !== "today" && S.uid ? C.subs.filter(s => s.uid !== S.uid && s.at > lastTape && !s.locked).length : 0);
  if (S.view === "today" && fresh()) store.set("sg-tape", String(S.now));
  dot("arena", S.uid ? C.duels.filter(d => d.b === S.uid && d.state === "open").length : 0);
  const list = E.ideasFor(S, C.wk), myV = S.uid && S.ivotes[S.uid] && S.ivotes[S.uid].w && S.ivotes[S.uid].w[C.wk];
  dot("punish", isMember() && !myV && list.some(i => i.uid !== S.uid) ? "!" : 0);
  const cw = E.ceremonyWeek(S, C); dot("board", cw && !store.get("sg-cer-" + cw) ? "!" : 0);
}
function renderNote() {
  const n = $("#status-note"); let h = "";
  if (S.loadFail) h = "<strong>Couldn't reach the login service.</strong> Check your connection and reload the page.";
  else if (S.mode === "offline") h = "<strong>You're viewing a preview.</strong> No database is connected yet. See the README for setup.";
  else if (S.mode === "demo" || S.demo) h = "<strong>Demo crew.</strong> Everything here is made up and stays on this device. Nothing is sent anywhere.";
  else if (S.err) h = "<strong>Lost the connection.</strong> Reload the page to reconnect.";
  else if (S.slow) h = "<strong>Still loading the crew's data.</strong> Scores may be out of date until it arrives.";
  else if (S.mode === "live" && S.canWrite === false) h = "<strong>You can watch but not compete yet.</strong> Ask the owner to share this page with you as an Editor.";
  n.innerHTML = h; n.hidden = !h;
}

/* ---------- today: day track + deck ---------- */
function chanceNext(C) {
  const m = E.minutesAt(C.now), cf = E.CFG, span = cf.lastDrop - cf.firstDrop - cf.gap;
  const w = C.slots.filter(s => s.state === "waiting"); if (!w.length) return null;
  if (w[0].slot === "a") { const sv = t => { const x = Math.min(1, Math.max(0, (t - cf.firstDrop) / span)); return (1 - x) * (1 - x); }; const p0 = sv(m); return p0 <= 0 ? 1 : 1 - sv(m + 60) / p0; }
  const a = C.slots.find(s => s.slot === "a"); if (!a || !a.drop) return null;
  const lo = Math.max(m, E.minutesAt(a.drop.at) + cf.gap); if (lo >= cf.lastDrop) return 1;
  return Math.max(0, Math.min(1, (m + 60 - lo) / (cf.lastDrop - lo)));
}
function renderTrack(C) {
  const el = $("#track"), W = el.clientWidth || 340, m = E.minutesAt(C.now), lo = E.CFG.firstDrop, hi = E.CFG.close;
  if (!keyed(el, [W, Math.floor(m), C.today, C.slots.map(s => [s.state, s.drop && s.drop.at, seen(s.qid)])])) return;
  if (C.slots[0].slot === "") { el.hidden = true; return; } el.hidden = false;
  const x = v => 20 + (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * (W - 40);
  const markX = C.slots.filter(s => s.drop).map(s => x(E.minutesAt(s.drop.at))), ticks = []; for (let h = 8; h <= 22; h++) { const X = x(h * 60), big = h % 2 === 0; ticks.push(`<line x1="${X}" x2="${X}" y1="${big ? 16 : 21}" y2="34" stroke="${big ? "#6a6d78" : "#3b3e48"}" stroke-width="2"/>`); if (big && (W > 480 || h % 4 === 0 || h === 22) && !markX.some(m => Math.abs(m - X) < 50)) ticks.push(`<text x="${X}" y="52" text-anchor="middle">${h % 12 || 12}${h < 12 ? " AM" : " PM"}</text>`); }
  const wait = C.slots.filter(s => s.state === "waiting"), hl = x(Math.max(m, lo)), hr = x(E.CFG.lastDrop);
  const heat = wait.length && hr > hl ? `<clipPath id="tc"><rect x="${hl}" y="8" width="${hr - hl}" height="30" rx="8"/></clipPath><rect class="heat" x="${hl}" y="8" width="${hr - hl}" height="30" rx="8"/><g clip-path="url(#tc)"><rect x="0" y="8" width="60" height="30" fill="url(#tg)"><animate attributeName="x" from="${hl - 60}" to="${hr}" dur="2.6s" repeatCount="indefinite"/></rect></g>` : "";
  const marks = C.slots.filter(s => s.drop).map(s => { const X = x(E.minutesAt(s.drop.at)), c = seen(s.qid) ? RCOL[s.quest.rarity] : RCOL.signal; return `<g><rect x="${X - 6}" y="7" width="12" height="32" rx="4" fill="${c}"/><text x="${Math.min(W - 34, Math.max(30, X))}" y="52" text-anchor="middle" style="fill:${c};font-weight:800;paint-order:stroke;stroke:#16171c;stroke-width:6px">${esc(fmtTime(s.drop.at))}</text></g>`; }).join("");
  const nx = x(m), inDay = m >= lo && m <= hi;
  el.innerHTML = `<svg viewBox="0 0 ${W} 62" aria-hidden="true"><defs><linearGradient id="tg"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#ff5c1a" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient></defs>${heat}${ticks.join("")}${marks}${inDay ? `<line class="needle" x1="${nx}" x2="${nx}" y1="3" y2="42"/><circle class="needle-dot" cx="${nx}" cy="5" r="4.5"/>` : ""}</svg>`;
}
function slotInner(C, s) {
  const two = s.slot !== "", label = two ? (s.slot === "a" ? "Drop 1" : "Drop 2") : "Daily quest";
  const mineSub = S.uid && s.list.find(x => x.uid === S.uid);
  const head = r => `<div class="slot-h"><b>${label}</b><span>${r}</span></div>`;
  if (s.state === "none") return head("No drop") + `<div class="sealed dark"><div class="pk"><b>SIDE GAINS</b></div><div class="say">No drop<em>today</em></div></div>`;
  if (s.state === "waiting") {
    const m = E.minutesAt(C.now), a = C.slots[0];
    let say;
    if (S.mode === "signin") say = `Crew<em>only</em><small>Sign in to see today's packs</small>`;
    else if (S.mode === "boot" || (S.mode === "live" && !fresh())) say = `Checking<em>for drops</em>`;
    else if (!two) say = `Opens at<em>12 PM</em><small>The last single-quest day. From tomorrow there are two a day, at random times.</small>`;
    else if (s.slot === "b" && !a.drop) say = `After<em>drop 1</em><small>At least ${E.CFG.gap / 60} hours later, by ${E.hourLabel(E.CFG.lastDrop)}</small>`;
    else if (m < E.CFG.firstDrop) say = `Asleep<em>till 8 AM</em><small>Then it could land at any moment</small>`;
    else { const lo = s.slot === "b" ? E.minutesAt(a.drop.at) + E.CFG.gap : 0; say = lo > m ? `Recharging<em>till ${E.hourLabel(Math.ceil(lo / 5) * 5)}</em><small>Then it could land at any moment</small>` : `Could drop<em>any second</em><small>${Math.max(1, Math.round((chanceNext(C) || 0) * 100))}% chance in the next hour</small>`; }
    const hot = /any second/.test(say);
    return head("Sealed") + `<div class="sealed dark">${hot ? `<i class="ring"></i><i class="ring"></i><i class="radar"></i>` : ""}<div class="pk"><b>SIDE GAINS</b></div><div class="say">${say}</div></div>`;
  }
  const right = s.state === "open" ? `Closes in <b class="num" data-until="${s.drop.close}">${hms(s.drop.close - C.now)}</b>` : "Closed";
  if (!seen(s.qid) && s.state === "open") return head(right) + `<button type="button" class="sealed live" data-rip="${s.qid}"><i class="ring"></i><i class="ring"></i><div class="pk"><b>SIDE GAINS</b></div><span class="btn primary big cta">Rip the pack</span></button>`;
  let stamp = "";
  if (mineSub && mineSub.status === "approved") stamp = `<span class="qc-stamp">Done<small>${ord(mineSub.place)} place, +${mineSub.points}</small></span>`;
  else if (mineSub) stamp = `<span class="qc-stamp no">No rep<small>${esc(mineSub.no[0] ? mineSub.no[0].why || "Voted out" : "Voted out")}</small></span>`;
  else if (s.state === "closed") stamp = `<span class="qc-stamp shut">Missed</span>`;
  return head(right) + cardHTML(s.quest, { qid: s.qid, lv: mineSub ? mineSub.lv : S.lv, stamp, cls: s.state === "closed" && !mineSub ? "shut" : "" });
}
function renderDeck(C) {
  const el = $("#deck");
  if (!keyed(el, C.slots.map(s => s.qid))) { /* keep nodes */ } else {
    el.innerHTML = C.slots.map(s => `<div class="slot" data-slot="${s.qid}"></div>`).join("");
    el.dataset.n = C.slots.length;
    requestAnimationFrame(() => scrollToSlot(false));
  }
  C.slots.forEach(s => {
    const n = el.querySelector(`[data-slot="${s.qid}"]`), mineSub = S.uid && s.list.find(x => x.uid === S.uid);
    n.classList.toggle("on", s.qid === S.slot || C.slots.length === 1);
    const m = Math.floor(E.minutesAt(C.now) / 5);
    if (keyed(n, [s.state, s.state === "waiting" ? [m, C.slots[0].state, S.mode, fresh()] : 0, seen(s.qid), s.quest, mineSub && [mineSub.status, mineSub.place, mineSub.points, mineSub.lv, mineSub.no.length]])) n.innerHTML = slotInner(C, s);
  });
}
function scrollToSlot(smooth = true) { const d = $("#deck"), n = d.querySelector(`[data-slot="${S.slot}"]`); if (n && d.scrollWidth > d.clientWidth + 4) d.scrollTo({ left: n.offsetLeft - (d.clientWidth - n.offsetWidth) / 2, behavior: smooth && !RM ? "smooth" : "auto" }); }
let scT;
$("#deck").addEventListener("scroll", () => { clearTimeout(scT); scT = setTimeout(() => { const d = $("#deck"); if (d.scrollWidth <= d.clientWidth + 4) return; const c = d.scrollLeft + d.clientWidth / 2; let best = null, bd = 1e9; for (const n of d.children) { const x = Math.abs(n.offsetLeft + n.offsetWidth / 2 - c); if (x < bd) { bd = x; best = n; } } if (best && best.dataset.slot !== S.slot) { S.slot = best.dataset.slot; sfx.tap(); scheduleRender(); } }, 90); }, { passive: true });

/* ---------- today: action panel ---------- */
const uploadFields = p => `
  <div class="drop"><label class="lab" for="${p}-video">Your video</label><input type="file" id="${p}-video" accept="video/mp4,video/webm,video/quicktime,video/*" ${S.assets ? "" : "disabled"}><span class="muted small">Film it now or pick one, up to ${maxMB()} MB. Big files are shrunk on your phone first. Videos are deleted after two days.</span></div>
  <div class="or">or</div>
  <div class="field"><label for="${p}-link">Video link</label><input type="url" id="${p}-link" placeholder="https://youtu.be/… or a Google Drive link" inputmode="url"></div>
  <div class="field"><label for="${p}-note">Note for the crew (optional)</label><textarea id="${p}-note" maxlength="280"></textarea></div>
  <p class="err" id="${p}-err" hidden></p>`;
function renderAction(C) {
  const el = $("#action"), s = C.slots.find(x => x.qid === S.slot);
  if (S.mode === "boot") { if (keyed(el, "boot")) el.innerHTML = `<h2>Connecting…</h2>`; return; }
  if (S.mode === "offline") { if (keyed(el, "off")) el.innerHTML = `<h2>Preview</h2><p class="muted">Connect a database to submit videos.</p>`; return; }
  if (S.mode === "signin") {
    const signup = S.authMode === "signup"; if (!keyed(el, "sign" + signup)) return;
    el.innerHTML = `<h2>${signup ? "Join the crew" : "Welcome back"}</h2><div class="seg full" role="group" aria-label="Account"><button type="button" data-auth="login" aria-pressed="${!signup}">Log in</button><button type="button" data-auth="signup" aria-pressed="${signup}">Create account</button></div>
      <form id="signin-form" class="field" style="gap:14px" data-mode="${signup ? "signup" : "login"}">
        <div class="field"><label for="si-user">Username</label><input type="text" id="si-user" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="20" placeholder="e.g. ironmike"></div>
        <div class="field"><label for="si-pass">Password</label><input type="password" id="si-pass" autocomplete="${signup ? "new-password" : "current-password"}" required minlength="6" placeholder="${signup ? "At least 6 characters" : "Your password"}"></div>
        ${signup ? `<p class="muted small">Your username is also the name on the leaderboard. You can change the display name later.</p>` : ""}
        <p class="err" id="si-err" hidden></p><button class="btn primary big" type="submit" id="si-btn">${signup ? "Create account" : "Log in"}</button></form>`;
    return;
  }
  if (!S.uid) { if (keyed(el, "nouid")) el.innerHTML = `<h2>Your run</h2><p class="muted">Sign in to join the crew.</p>`; return; }
  if (!isMember()) {
    if (!S.confirmed.members) { if (keyed(el, "lm")) el.innerHTML = `<h2>Loading the crew…</h2>`; return; }
    if (S.canWrite === false) { if (keyed(el, "ro")) el.innerHTML = `<h2>Join the crew</h2><p class="muted">You need Editor access to join. Ask the owner to share this page with you as an Editor.</p>`; return; }
    if (S.autoName && S.db && !S.autoJoining) {
      S.autoJoining = true; if (keyed(el, "aj")) el.innerHTML = `<h2>Setting up your profile…</h2>`;
      S.db.doc("members/" + S.uid).set({ name: S.autoName.slice(0, 24), joined: Date.now() }).then(() => toast(`Welcome to the crew, ${S.autoName}`)).catch(() => { S.autoName = ""; scheduleRender(); });
      return;
    }
    if (S.autoJoining && S.autoName) return;
    if (keyed(el, "join")) el.innerHTML = `<h2>Join the crew</h2><form id="join-form" class="field"><label for="j-name">Your name on the leaderboard</label><input type="text" id="j-name" maxlength="24" required autocomplete="nickname" placeholder="e.g. Iron Mike"><button class="btn primary big" type="submit">Join</button></form>`;
    return;
  }
  const mineSub = s.list.find(x => x.uid === S.uid), isSeen = seen(s.qid);
  const key = [s.qid, s.state, isSeen, mineSub && [mineSub.key, mineSub.status, mineSub.place, mineSub.points, mineSub.locked, mineSub.reacts.length, mineSub.no.length], S.redo, s.quest && s.quest.u];
  if (S.busy || !keyed(el, key)) return;
  if (s.state === "waiting" || s.state === "none") {
    const other = C.slots.find(x => x.state === "open" && x.qid !== s.qid);
    el.innerHTML = `<h2>${s.state === "none" ? "Nothing here" : "Stay ready"}</h2><p class="muted">${s.state === "none" ? "This pack never dropped." : "Nobody knows when this pack drops. The first person to finish takes a 50% bonus, so get the alert the moment it lands."}</p>
      <div class="row">${s.state === "waiting" ? `<button type="button" class="btn primary" data-notif>Turn on drop alerts</button>` : ""}${other ? `<button type="button" class="btn" data-goslot="${other.qid}">Go to the live one</button>` : ""}</div>`;
    return;
  }
  if (!isSeen && s.state === "open") { el.innerHTML = `<h2>A pack is live</h2><p class="muted">Rip it open to see today's move. Dropped at ${esc(fmtTime(s.drop.at))}.</p><button type="button" class="btn primary big" data-rip="${s.qid}">Rip the pack</button>`; return; }
  if (mineSub && !S.redo) {
    const ok = mineSub.status === "approved";
    el.innerHTML = ok ? `<div class="panel-h"><h2>It counts</h2><span class="chip ${mineSub.locked ? "ok" : "wait"}">${mineSub.locked ? "Locked in" : `Locks in ${esc(fmtMs(mineSub.at + E.JUDGE_MS - C.now))}`}</span></div>
      <div class="bigline">${ord(mineSub.place)} place, <span class="plus">+</span>${mineSub.points}</div>
      <div class="parts"><span>${E.LEVELS[mineSub.lv].label} <b>${mineSub.parts.base}</b></span>${mineSub.parts.speed ? `<span>Speed <b>+${mineSub.parts.speed}</b></span>` : ""}${mineSub.parts.streak ? `<span>${mineSub.streak}-day streak <b>+${mineSub.parts.streak}</b></span>` : ""}</div>
      <p class="muted small">Submitted ${esc(fmtTime(mineSub.at))}${mineSub.response !== null ? `, ${esc(fmtMs(mineSub.response))} after the drop` : ""}. ${mineSub.locked ? "" : "It counts unless someone says it doesn't."}</p>
      <div class="row"><button type="button" class="btn" data-watch="${esc(mineSub.key)}">Watch it back${mineSub.reacts.length ? ` (${mineSub.reacts.length} reactions)` : ""}</button></div>`
      : `<div class="panel-h"><h2>No rep</h2><span class="chip no">Doesn't count</span></div><p>${mineSub.no.map(n => `<b>${esc(nameOf(n.uid))}</b>: ${esc(n.why || "doesn't count")}`).join("<br>")}</p>
      <p class="muted small">${s.state === "open" ? "You can film it again until it closes. Your new time counts for the speed bonus." : "The quest has closed. Come back for the next drop."}</p>
      <div class="row">${s.state === "open" ? `<button type="button" class="btn primary" data-redo>Film it again</button>` : ""}<button type="button" class="btn" data-watch="${esc(mineSub.key)}">Watch it back</button></div>`;
    return;
  }
  if (s.state === "closed") { el.innerHTML = `<h2>Closed</h2><p class="muted">Submissions shut at ${esc(fmtTime(s.drop.close))}. ${s.slot === "a" || C.slots.some(x => x.state === "waiting") ? "There may still be another pack today." : "Two new packs drop tomorrow."}</p>`; return; }
  el.innerHTML = `<div class="panel-h"><h2>Your run</h2>${s.quest.power ? `<span class="chip wait">${s.quest.power.kind === "pick" ? "Picked" : "Rerolled"} by ${esc(nameOf(s.quest.power.uid))}</span>` : s.quest.custom ? `<span class="chip">Set by the owner</span>` : ""}</div>
    <div class="levels" role="group" aria-label="Difficulty">${Object.entries(E.LEVELS).map(([k, L]) => { const b = cardBits(s.quest, k); return `<button type="button" data-lv="${k}" aria-pressed="${S.lv === k}"><span>${L.label}</span><b>${esc(b.numeric ? b.x.n : "×" + L.reps)}</b><span>${b.pts[0]} pts</span></button>`; }).join("")}</div>
    <p>${esc(s.quest.r)}</p><p class="muted small">${esc(E.PROOF[s.quest.k])}</p>
    <form id="sub-form" class="field" style="gap:14px" data-q="${s.qid}">${uploadFields("f")}<button class="btn primary big" type="submit" id="f-btn">Submit my run</button></form>
    <div class="row">${S.isOwner ? `<button type="button" class="btn ghost mini" id="custom-btn">Set a custom quest</button>` : ""}<button type="button" class="btn ghost mini" data-replay="${s.qid}">Replay the rip</button></div>`;
}
function renderFinishers(C) {
  const el = $("#finishers"), s = C.slots.find(x => x.qid === S.slot);
  if (!s || s.state === "waiting" || s.state === "none") { const l = C.slots.filter(x => x.drop).pop(); if (!l) { if (keyed(el, "none" + C.today)) el.innerHTML = `<h2>Finishers</h2><p class="muted">Nothing has dropped yet today. Warm up now: arm circles, leg swings and 10 slow squats.</p>`; return; } }
  const list = s.list;
  if (!keyed(el, [s.qid, s.state, list.map(x => [x.key, x.status, x.place, x.points, x.lv]), C.memberIds.map(nameOf)])) return;
  el.innerHTML = `<div class="panel-h"><h2>Finishers</h2><span class="sub">${list.filter(x => x.status === "approved").length} of ${C.memberIds.length}</span></div>${list.length ? `<ol class="fin">${list.map(x => `<li><span class="pl p${x.place || 0}">${x.place ? ord(x.place) : "–"}</span>${avatar(x.uid)}<span class="who"><b>${nameBtn(x.uid)}</b><span>${x.response !== null && x.response >= 0 ? esc(fmtMs(x.response)) + " after the drop" : esc(fmtTime(x.at))} · <button type="button" class="linkish" data-watch="${esc(x.key)}">watch</button></span></span><span class="right">${x.status === "approved" ? `<span class="pts"><span class="plus">+</span>${x.points}</span><span class="chip ${x.lv}">${E.LEVELS[x.lv].label}</span>` : `<span class="chip no">No rep</span>`}</span></li>`).join("")}</ol>` : `<p class="muted">${s.state === "closed" ? "Nobody finished this one." : s.drop ? "Nobody has finished yet. First one takes +50%." : "This pack hasn't dropped yet."}</p>`}`;
}
const PEN = { owed: ["wait", "Owed"], redo: ["no", "Thrown out, redo it"], cleared: ["ok", "Cleared"], failed: ["no", `Failed, −${E.PENALTY}`] };
function renderPenance(C) {
  const el = $("#penance"), p = S.uid ? C.pens.find(x => x.uid === S.uid && (x.state === "owed" || x.state === "redo")) : null;
  el.hidden = !p; if (!p) { el.dataset.k = ""; el.innerHTML = ""; return; }
  if (S.busy || !keyed(el, [p.wk, p.state, p.task])) return;
  el.innerHTML = `<div class="panel-h"><h2>You owe the crew</h2><span class="chip ${PEN[p.state][0]}">${PEN[p.state][1]}</span></div><p class="small">Last place for the week of ${esc(fmtDay(p.wk))} with ${p.pts} points. Clear it by the end of ${esc(fmtDay(p.due))} or lose ${E.PENALTY} points.</p><div class="pen-task">${esc(p.task.t)}</div><p>${esc(p.task.r)}</p><p class="muted small">${p.task.by ? `Voted in by the crew, pitched by ${esc(nameOf(p.task.by))}` : "Nobody pitched an idea that week, so this one was drawn at random."}</p>
    <form id="pen-form" class="field" style="gap:14px" data-wk="${esc(p.wk)}">${uploadFields("p")}<button class="btn primary big" type="submit" id="p-btn">Submit my punishment</button></form>`;
}
function renderPower(C) {
  const el = $("#power"), h = C.powerHolder; el.hidden = !h; if (!h) return;
  const me = h === S.uid, used = C.powerUsed;
  const slots = []; for (let d = C.today; E.weekOf(d) === C.wk; d = E.shiftKey(d, 1)) for (const q of E.slotsOf(S, d)) if (E.slotOfQ(q) && !E.dropOf(S, q) && C.now < E.tsOf(d, E.CFG.lastDrop)) slots.push(q);
  const veto = C.slots.filter(s => s.state === "open" && s.slot && !s.list.length && s.quest && !s.quest.custom);
  if (document.activeElement && el.contains(document.activeElement) && document.activeElement.matches("select")) return;
  if (!keyed(el, [h, me, used, slots, veto.map(v => v.qid), nameOf(h)])) return;
  const lab = q => `${q.slice(0, 10) === C.today ? "Today" : fmtDay(q.slice(0, 10), { weekday: "long" })}, drop ${E.slotOfQ(q) === "a" ? 1 : 2}`;
  el.innerHTML = `<div class="row" style="flex-wrap:nowrap">${pin(4)}<div><h2>Winner's power</h2><p class="muted small">${me ? "You won last week, so you run this one." : `${esc(nameOf(h))} won last week.`}</p></div></div>
    ${used ? `<p>${used.kind === "veto" ? `${esc(nameOf(h))} vetoed a quest on ${esc(fmtDay(used.qid.slice(0, 10)))}.` : `${me ? "You have" : esc(nameOf(h)) + " has"} secretly picked one move${me ? `: ${esc(used.move)}, ${esc(lab(used.qid))}` : " this week"}.`}</p>`
    : me ? `<form id="pick-form" class="grid2"><div class="field"><label for="pw-m">Pick a move</label><select id="pw-m">${E.pickable().map(u => `<option>${esc(u)}</option>`).join("")}</select></div><div class="field"><label for="pw-q">For</label><select id="pw-q">${slots.map(q => `<option value="${q}">${esc(lab(q))}</option>`).join("")}</select></div><button class="btn primary" type="submit" ${slots.length ? "" : "disabled"}>Lock in my pick</button></form>${veto.map(v => `<button type="button" class="btn danger" data-veto="${v.qid}">Veto ${esc(E.questTitle(v.quest))} for everyone</button>`).join("")}<p class="muted small">One power a week: choose a future move in secret, or veto a live quest before anyone submits.</p>` : `<p class="muted">They can pick one future move in secret, or veto a live quest before anyone submits.</p>`}`;
}

/* ---------- the tape: videos, reactions, comments, "doesn't count" ---------- */
const REACTS = ["On fire", "Strong", "GOAT", "Dead", "Laughing", "Suspicious"];
function vcNode(s) {
  const n = document.createElement("article"); n.className = "vc"; n.dataset.key = s.key;
  const r = s.kind === "quest" ? s.quest.rarity : s.kind === "pen" ? "epic" : "rare";
  const gone = clipGone(s), media = s.video && !gone ? videoTag(s.video, 'controls playsinline preload="metadata"') : s.link ? `<a class="btn chalk" href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">Open video link</a>` : gone ? `<div class="gone">Clip deleted<span>Videos are kept for two days. The result stays.</span></div>` : `<span class="muted">No video attached</span>`;
  n.innerHTML = `<div class="vc-media ${s.video && !gone ? "" : "linkonly"}" style="--art:url(img/card-${r}.webp)">${media}<div data-p="stick"></div><div data-p="norep"></div></div>
    <div class="vc-body"><div class="vc-top">${avatar(s.uid, "lg")}<span class="who"><b>${nameBtn(s.uid)}</b><span>${esc(s.label)}, ${esc(fmtDay(E.keyAt(s.at), { weekday: "short" }))} ${esc(fmtTime(s.at))}</span></span>${s.kind === "quest" ? `<span class="chip ${s.lv}">${E.LEVELS[s.lv].label}</span>` : ""}</div>
    ${s.note ? `<p class="vc-note">${esc(s.note)}</p>` : ""}<div data-p="react"></div><div data-p="cm" class="cmts"></div>
    <form class="cmt-form" data-cmt="${esc(s.key)}"><input type="text" maxlength="200" placeholder="Say something" aria-label="Comment"><button class="btn mini" type="submit">Send</button></form><div data-p="foot"></div><div data-p="why"></div></div>`;
  return n;
}
function vcUpdate(n, s, C) {
  const P = k => n.querySelector(`[data-p="${k}"]`), meOk = isMember(), own = s.uid === S.uid;
  const st = P("stick");
  if (keyed(st, s.reacts.map(r => r.uid + r.i))) {
    const had = new Set([...st.children].map(c => c.dataset.u)), init = !st.dataset.init; st.dataset.init = "1";
    st.innerHTML = s.reacts.map(r => { const g = E.rngFor(s.key + r.uid), x = 4 + g() * 68, y = 6 + g() * 58, a = -26 + g() * 52, sz = 64 + g() * 26; return `<span class="stuck ${!init && !had.has(r.uid + r.i) ? "slap" : ""}" data-u="${esc(r.uid + r.i)}" style="left:${x}%;top:${y}%;--r:${a}deg;transform:rotate(${a}deg)">${stk(r.i, `--ss:${sz}px`)}</span>`; }).join("");
  }
  const rj = s.no, myNo = rj.find(x => x.uid === S.uid);
  if (keyed(P("norep"), rj.map(x => x.uid + x.why))) P("norep").innerHTML = rj.length ? `<div class="norep"><b>NO REP</b><span>${rj.map(x => `${esc(nameOf(x.uid))}: ${esc(x.why || "doesn't count")}`).join("<br>")}</span></div>` : "";
  const myR = (s.reacts.find(r => r.uid === S.uid) || {}).i;
  if (keyed(P("react"), [myR, s.reacts.map(r => r.i), meOk])) P("react").innerHTML = `<div class="react-bar">${REACTS.map((l, i) => { const c = s.reacts.filter(r => r.i === i).length; return `<button type="button" data-react="${esc(s.key)}" data-i="${i}" aria-pressed="${myR === i}" aria-label="${l}" ${meOk ? "" : "disabled"}>${stk(i)}${c || ""}</button>`; }).join("")}</div>`;
  if (keyed(P("cm"), s.comments.map(c => [c.uid, c.at, c.t, nameOf(c.uid)]))) P("cm").innerHTML = s.comments.slice(-6).map(c => `<div class="cmt">${avatar(c.uid, "sm")}<p><b>${esc(nameOf(c.uid))}</b>${esc(c.t)}${c.uid === S.uid ? ` <button type="button" class="linkish" data-delcmt="${esc(s.key)}" data-at="${c.at}">delete</button>` : ""}</p></div>`).join("");
  n.querySelector(".cmt-form").hidden = !meOk;
  const left = s.at + E.JUDGE_MS - C.now;
  if (keyed(P("foot"), [s.status, s.locked, !!myNo, own, meOk, Math.floor(left / 36e5), S.whyOpen === s.key])) P("foot").innerHTML = `<div class="vc-foot"><span class="chip ${s.status === "approved" ? "ok" : "no"}">${s.status === "approved" ? (s.locked ? "Counted" : `Counts, locks in ${esc(fmtMs(left))}`) : "Doesn't count"}</span>${!s.locked && meOk && !own ? (myNo ? `<button type="button" class="btn mini" data-takeback="${esc(s.key)}">Take it back</button>` : `<button type="button" class="btn mini danger" data-nocount="${esc(s.key)}" aria-expanded="${S.whyOpen === s.key}">Doesn't count</button>`) : ""}</div>`;
  if (keyed(P("why"), S.whyOpen === s.key && !s.locked ? "open" : "")) P("why").innerHTML = S.whyOpen === s.key && !s.locked ? `<div class="field"><span class="lab">What's wrong with it? One vote throws it out.</span><div class="reasons">${E.REASONS.map(r => `<button type="button" class="btn mini danger" data-why="${esc(s.key)}" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div></div>` : "";
}
function renderQueue(C) {
  const wrap = $("#queue"), list = C.subs.filter(s => !s.locked).sort((a, b) => b.at - a.at);
  $("#queue-sub").textContent = list.length ? "Videos count on their own unless someone says otherwise within 24 hours" : "";
  if (!list.length) { wrap.innerHTML = `<p class="muted">No videos in the last 24 hours. The next one shows up here.</p>`; return; }
  const e = wrap.querySelector(":scope > p"); if (e) e.remove();
  const keep = new Set();
  list.forEach((s, i) => {
    keep.add(s.key); let n = wrap.querySelector(`:scope > [data-key="${CSS.escape(s.key)}"]`);
    if (!n) n = vcNode(s);
    vcUpdate(n, s, C);
    if (wrap.children[i] !== n) wrap.insertBefore(n, wrap.children[i] || null);
  });
  [...wrap.children].forEach(c => { if (!keep.has(c.dataset.key)) c.remove(); });
}
function watch(key) {
  const s = S.C.subByKey[key]; if (!s) return;
  openModal(`<div class="row" style="justify-content:space-between"><h2>${esc(nameOf(s.uid))}</h2><button type="button" class="btn mini" data-close>Close</button></div><div id="modal-vc"></div>`);
  const n = vcNode(s); $("#modal-vc").appendChild(n); vcUpdate(n, s, S.C); hydrateMedia();
}
function updateModalVC(C) { const n = $("#modal-vc > .vc"); if (n) { const s = C.subByKey[n.dataset.key]; if (s) vcUpdate(n, s, C); } }
function renderCoach(C) {
  const el = $("#coach"), s = C.slots.find(x => x.qid === S.slot), open = s && s.quest && (seen(s.qid) || s.state === "closed");
  const keys = open ? E.keysFor(s.quest.u + " · " + s.quest.n) : [];
  el.hidden = !keys.length; if (!keys.length || !keyed(el, keys)) return;
  el.innerHTML = `<div class="panel-h"><h2>Form coach</h2><span class="sub">Drag the athlete to look around</span></div><div class="coach-items">${keys.map(k => coachHTML(k, RCOL[s.quest.rarity])).join("")}</div>`;
}
function coachHTML(k, tint = RCOL.signal) {
  const F = FORM[k];
  return `<div class="coach-item"><div class="coach-fig">${athCanvas(k, { tint, hero: true })}</div><div class="stack" style="gap:8px"><h3>${esc(F.name)}</h3><div class="tags">${F.muscles.map(m => `<span class="tag">${esc(m)}</span>`).join("")}</div><div class="cue-h">Do it like this</div><ul class="cues">${F.cues.map(c => `<li>${esc(c)}</li>`).join("")}</ul><div class="cue-h">Doesn't count if</div><ul class="cues bad">${F.mistakes.map(c => `<li>${esc(c)}</li>`).join("")}</ul>${F.breath ? `<p class="muted small"><b>Breathing:</b> ${esc(F.breath)}</p>` : ""}</div></div>`;
}

/* ---------- leaderboard ---------- */
function rangeRows(C) {
  const r = S.range, f = { week: ["week", "countWeek", "firstsWeek"], season: ["season", "countSeason", "firstsSeason"], all: ["all", "countAll", "firstsAll"] }[r];
  return Object.values(C.stats).map(s => ({ ...s, pts: s[f[0]], n: s[f[1]], f: s[f[2]] })).sort((a, b) => b.pts - a.pts || b.f - a.f || b.n - a.n || nameOf(a.id).localeCompare(nameOf(b.id)));
}
function renderBoard(C) {
  $$("[data-range]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.range === S.range)));
  const rows = rangeRows(C);
  if (!keyed($("#board-table"), [S.range, rows.map(r => [r.id, nameOf(r.id), r.pts, r.n, r.f, r.cur, r.best, r.season])])) return;
  $("#range-note").textContent = S.range === "week" ? "Resets Monday. Last place gets the red card." : S.range === "season" ? `${monthName(C.season)}. Resets on the 1st.` : "Everything since day one.";
  if (!rows.length) { $("#podium").innerHTML = ""; $("#board-table").innerHTML = `<tbody><tr><td class="muted" style="white-space:normal">${S.mode === "live" ? "No one has joined yet." : "Sign in on the Drops tab to see the board."}</td></tr></tbody>`; return; }
  const top = rows.slice(0, 3);
  $("#podium").innerHTML = [top[1], top[0], top[2]].map(r => { if (!r) return `<div></div>`; const i = top.indexOf(r); return `<button type="button" class="pcard holo p${i + 1}" data-amp=".7" data-prof="${esc(r.id)}"><span class="po">${ord(i + 1)}</span>${rankEm(E.tierOf(r.season).i)}${avatar(r.id, "lg")}<span class="nm">${esc(nameOf(r.id))}</span><span class="pp">${r.pts}</span><span class="qc-frame"></span></button>`; }).join("");
  $("#board-table").innerHTML = `<thead><tr><th>#</th><th>Athlete</th><th class="r">Points</th><th class="r">Quests</th><th class="r">Firsts</th><th class="r">Streak</th><th class="r">Duels</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.id === S.uid ? "isme" : ""}"><td>${i + 1}</td><td><span class="nmcell">${avatar(r.id)}${nameBtn(r.id)}</span></td><td class="r"><span class="bigpts">${r.pts}</span></td><td class="r">${r.n}</td><td class="r">${r.f}</td><td class="r">${r.cur ? r.cur + "d" : "–"}</td><td class="r">${r.duelW}–${r.duelL}</td></tr>`).join("")}</tbody>`;
}
function renderRace(C) {
  const el = $("#race"), idx = E.dowOf(C.today);
  const series = C.memberIds.map(id => { let run = 0; const pts = []; for (let i = 0; i <= idx; i++) { run += C.dayPts[id + E.shiftKey(C.wk, i)] || 0; pts.push(run); } return { id, pts, last: run }; }).sort((a, b) => b.last - a.last);
  if (!keyed(el, [el.clientWidth, series.map(s => [s.id, s.pts, nameOf(s.id)])])) return;
  const lanes = $("#lanes");
  if (!series.some(s => s.last > 0)) { el.innerHTML = `<p class="muted">The race starts with the first finish of the week.</p>`; lanes.innerHTML = ""; return; }
  const mx = Math.max(100, ...series.map(s => s.last));
  lanes.innerHTML = series.slice(0, 8).map((s, i) => { const f = Math.max(0, s.last) / mx; return `<div class="lane ${f > .55 ? "far" : ""}" style="--x:6%;--lc:${colorOf(s.id)}" data-x="${(6 + f * 80).toFixed(1)}"><span class="ln-n">${i + 1}</span><span class="trail"></span><span class="run">${avatar(s.id)}<span>${esc(nameOf(s.id))} ${s.last}</span></span></div>`; }).join("");
  requestAnimationFrame(() => requestAnimationFrame(() => lanes.querySelectorAll(".lane").forEach(l => l.style.setProperty("--x", l.dataset.x + "%"))));
  const W = Math.max(320, el.clientWidth || 640), H = W < 480 ? 210 : 220, L = 40, R = W < 480 ? 92 : 118, T = 14, B = 28, lo = Math.min(0, ...series.flatMap(s => s.pts)), nice = Math.ceil(mx / 100) * 100;
  const x = i => L + i / 6 * (W - L - R), y = v => T + (1 - (v - lo) / (nice - lo)) * (H - T - B);
  let prev = -99; const ly = {}; for (const s of series) { let v = y(s.last) + 4; if (v - prev < 15) v = prev + 15; ly[s.id] = v; prev = v; }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Points this week per person">${[0, .5, 1].map(f => `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(nice * f)}" y2="${y(nice * f)}"/><text x="${L - 8}" y="${y(nice * f) + 4}" text-anchor="end">${Math.round(nice * f)}</text>`).join("")}${Array.from({ length: 7 }, (_, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(fmtDay(E.shiftKey(C.wk, i), { weekday: "short" }))}</text>`).join("")}${series.map(s => { const d = s.pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" "); let len = 2; for (let i = 1; i < s.pts.length; i++) len += Math.hypot(x(i) - x(i - 1), y(s.pts[i]) - y(s.pts[i - 1])); const ex = x(s.pts.length - 1), c = colorOf(s.id); return `<path class="ln" d="${d}" stroke="${c}" style="--len:${Math.ceil(len)}"/><circle cx="${ex}" cy="${y(s.last)}" r="5" fill="${c}"/><text class="lbl" x="${ex + 11}" y="${ly[s.id]}">${esc(nameOf(s.id))}</text>`; }).join("")}</svg>`;
}
function renderSeason(C) {
  const me = S.uid && C.stats[S.uid], el = $("#season"), end = E.seasonOf(E.shiftKey(C.season + "-28", 5)) + "-01", left = Math.max(1, Math.ceil((E.tsOf(end) - C.now) / 864e5));
  if (keyed(el, [C.season, left, me && me.season])) {
    const t = E.tierOf(me ? me.season : 0);
    el.innerHTML = `<div class="panel-h"><h2>${esc(monthName(C.season))}</h2><span class="sub">${left} day${left === 1 ? "" : "s"} left</span></div>${me ? `<div class="season-bar">${rankEm(t.i)}<div class="stack" style="gap:7px"><b style="font:900 1.3rem/1 var(--display)">${t.label}</b><div class="meter"><i style="--v:${t.frac}"></i></div><span class="muted small">${t.next ? `${t.next.min - me.season} points to ${t.next.label}` : "Top rank reached"}</span></div></div>` : ""}<div class="row" style="gap:2px;justify-content:space-between">${E.TIERS.map((x, i) => `<span class="center small" style="opacity:${i <= t.i ? 1 : .4}">${rankEm(i, "--rs:50px")}<br>${x.label}</span>`).join("")}</div>`;
  }
  if (keyed($("#hall"), C.hall.map(h => [h, nameOf(h.id)]))) $("#hall").innerHTML = C.hall.length ? `<div class="hall">${[...C.hall].reverse().map(h => `<div><img src="img/trophy.webp" alt=""><b>${esc(nameOf(h.id))}</b><span class="muted small">${esc(monthName(h.season))}, ${h.pts} points</span></div>`).join("")}</div>` : `<p class="muted">The first season champion is crowned when ${esc(monthName(C.season))} ends.</p>`;
}
function renderCeremonyBanner(C) {
  const w = E.ceremonyWeek(S, C), el = $("#ceremony-banner"); el.hidden = !w; if (!w || !keyed(el, [w, C.weekWinner[w]])) return;
  el.innerHTML = `<h2>The Sunday Ceremony</h2><p>${esc(nameOf(C.weekWinner[w]))} won the week of ${esc(fmtDay(w, { day: "numeric", month: "long" }))}.</p><button type="button" class="btn chalk" id="open-cer">Watch the ceremony</button>`;
}
const cerOpts = (d, w) => ({ name: nameOf, avatar: id => avatar(id, "lg"), punishment: d.last.length ? E.punishmentFor(S, w, d.last[0]).t : "", wkLabel: `Week of ${fmtDay(w, { day: "numeric", month: "long" })}`, fmtMs, onClose: () => { store.set("sg-cer-" + w, "1"); scheduleRender(); } });
function openCeremony() {
  const w = E.ceremonyWeek(S, S.C); if (!w) return;
  const d = E.ceremonyData(S, S.C, w), o = cerOpts(d, w); store.set("sg-cer-" + w, "1");
  o.onShare = async () => {
    const blob = await SHOW.recapPoster(d, o), file = new File([blob], `side-gains-${w}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: "Side Gains" }); return; } catch (e) { if (e.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast("Recap image saved");
  };
  SHOW.ceremony(d, o);
}

/* ---------- arena ---------- */
const DTYPE = { race: ["Next drop race", "Fastest counted finish of the next drop"], week: ["Points battle", "Most quest points by Sunday night"], max: ["60-second max", "Most reps in 60 seconds, on video"] };
function renderDuels(C) {
  const el = $("#duels"), list = C.duels.filter(d => d.state !== "expired" && !(d.state === "declined" && C.now > d.at + 864e5)).filter(d => !d.over || C.now < E.tsOf(E.shiftKey(d.resolved, 7))).slice(0, 12);
  if (!keyed(el, [list.map(d => [d.id, d.state, d.over, d.winner, d.score, d.times, d.qid, Math.floor(((d.ends || 0) - C.now) / 6e4)]), S.uid, C.memberIds.map(nameOf)])) return;
  if (!list.length) { el.innerHTML = `<div class="banner" style="--b:url(img/versus.webp);min-height:220px"><h2>Nobody is fighting</h2><p>Challenge a friend: race to the next drop, battle for points until Sunday, or go max reps in 60 seconds. The winner takes the loser's points.</p></div>`; return; }
  el.innerHTML = list.map(d => {
    const me = d.a === S.uid || d.b === S.uid, side = id => { const w = d.over && d.winner === id; const v = d.type === "race" ? (d.times && d.times[id] != null ? fmtMs(d.times[id]) : "–") : d.score[id]; return `<div class="${w ? "win" : ""}">${avatar(id, "lg")}<b>${esc(nameOf(id))}</b><span class="sc" ${d.type === "race" ? 'style="font-size:1.4rem"' : ""}>${d.state === "on" ? esc(v) : ""}</span></div>`; };
    const st = d.state === "open" ? (d.b === S.uid ? `${nameOf(d.a)} wants to fight you` : "Waiting for an answer") : d.state === "declined" ? `${nameOf(d.b)} backed out` : d.over ? (d.winner ? `${nameOf(d.winner)} takes ${d.stake}` : "Draw, nobody pays") : d.ends ? `${fmtMs(d.ends - C.now)} left` : "Waiting for the next drop";
    const act = d.state === "open" && d.b === S.uid ? `<button type="button" class="btn primary mini" data-duel-yes="${esc(d.id)}">Accept</button><button type="button" class="btn mini" data-duel-no="${esc(d.id)}">Back out</button>` : d.state === "open" && d.a === S.uid ? `<button type="button" class="btn mini" data-duel-cancel="${esc(d.id)}">Cancel</button>` : d.state === "on" && d.type === "max" && me && !d.over && !d.entry[S.uid] ? `<button type="button" class="btn primary mini" data-duel-max="${esc(d.id)}">Submit my max</button>` : d.type === "max" && d.entry ? [d.a, d.b].filter(id => d.entry[id]).map(id => `<button type="button" class="btn mini" data-watch="${esc(d.entry[id].key)}">Watch ${esc(nameOf(id))}</button>`).join("") : "";
    return `<article class="duel ${d.over ? "over" : ""}">${d.state === "on" && !d.over ? `<canvas data-fx="bolt"></canvas>` : ""}<div class="sides">${side(d.a)}<span class="vsx">VS</span>${side(d.b)}</div><div class="meta"><span>${esc(DTYPE[d.type][0])}${d.type === "max" ? `, ${esc(E.MOVES[d.move][0].toLowerCase())}s` : ""} · ${d.stake} points<br><span class="muted">${esc(st)}</span></span><span class="row">${act}</span></div></article>`;
  }).join("");
}
function duelDialog() {
  if (!isMember()) return toast("Join the crew first.");
  const others = S.C.memberIds.filter(id => id !== S.uid); if (!others.length) return toast("You need at least one other person in the crew.");
  const active = S.C.duels.filter(d => (d.a === S.uid || d.b === S.uid) && !d.over && (d.state === "on" || d.state === "open")).length;
  if (active >= E.DUEL_ACTIVE_MAX) return toast(`Finish a duel first. ${E.DUEL_ACTIVE_MAX} at a time is the limit.`);
  openModal(`<h2>Challenge</h2><form id="duel-form" class="field" style="gap:16px"><div class="field"><span class="lab">Who</span><div class="pick">${others.map((id, i) => `<label><input type="radio" name="who" value="${esc(id)}" ${i ? "" : "checked"}>${avatar(id, "lg")}${esc(nameOf(id))}</label>`).join("")}</div></div>
    <div class="field"><span class="lab">Fight</span><div class="pick" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${Object.entries(DTYPE).map(([k, v], i) => `<label><input type="radio" name="type" value="${k}" ${i ? "" : "checked"}>${v[0]}<small>${v[1]}</small></label>`).join("")}</div></div>
    <div class="field" id="dl-move" hidden><label for="dl-m">Move</label><select id="dl-m">${["pushup", "squat", "burpee", "situp", "lunge", "climber", "dip"].map(k => `<option value="${k}">${E.MOVES[k][0]}s</option>`).join("")}</select></div>
    <div class="field"><span class="lab">Points at stake</span><div class="pick">${E.STAKES.map((s, i) => `<label><input type="radio" name="stake" value="${s}" ${i === 1 ? "checked" : ""}><b style="font:900 1.5rem/1 var(--display)">${s}</b></label>`).join("")}</div></div>
    <div class="row end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Send challenge</button></div></form>`);
}
function maxDialog(id) { const d = S.C.duels.find(x => x.id === id); if (!d) return; openModal(`<h2>60 seconds of ${esc(E.MOVES[d.move][0].toLowerCase())}s</h2><p class="muted">Film one continuous 60 seconds with a timer showing. Your video counts unless someone says it doesn't.</p><form id="max-form" class="field" style="gap:14px" data-id="${esc(id)}"><div class="field"><label for="mx-n">How many reps?</label><input type="number" id="mx-n" min="1" max="300" required inputmode="numeric"></div>${uploadFields("m")}<button class="btn primary big" type="submit" id="m-btn">Submit my max</button></form>`); }
function renderGoal(C) {
  const g = C.goals[C.wk], el = $("#goal"), by = Object.entries(g.by).sort((a, b) => b[1] - a[1]);
  if (!keyed(el, [g.total, g.target, by, g.hitOn])) return;
  el.innerHTML = `<div class="panel-h"><h2>Crew shaker</h2><span class="sub">This week, together</span></div><div class="shaker"><div class="stack" style="gap:8px"><div class="huge">${g.total}</div><p class="muted">of ${g.target} reps. ${g.hitOn ? `Filled! Everyone who helped got +${E.GOAL_BONUS}.` : `Fill it by Sunday and everyone who helped gets +${E.GOAL_BONUS}.`}</p></div><canvas data-fx="shaker" data-v="${Math.min(1, g.total / g.target).toFixed(3)}" data-tint="${g.hitOn ? "#3fdc8b" : "#ff5c1a"}" role="img" aria-label="Shaker ${Math.round(g.total / g.target * 100)} percent full"></canvas></div>${by.length ? `<div class="contrib">${by.map(([id, v]) => `<div>${avatar(id, "sm")}<span>${esc(nameOf(id))}</span><b class="num">${v}</b></div>`).join("")}</div>` : ""}<p class="muted small">Two seconds of a hold count as one rep.</p>`;
}
function renderSquads(C) {
  const el = $("#squads"), list = C.squads[C.wk] || [];
  if (!keyed(el, [list, C.memberIds.map(nameOf)])) return;
  el.innerHTML = `<div class="panel-h"><h2>Squads</h2><span class="sub">Shuffled every Monday</span></div>${list.length ? `<div class="squads">${list.map((q, i) => `<div class="squad ${i === 0 && q.avg ? "lead" : ""} ${q.ids.includes(S.uid) ? "mine" : ""}"><span class="avs">${q.ids.map(id => avatar(id)).join("")}</span><span class="who"><b>${esc(q.name)}</b><span>${q.ids.map(id => esc(nameOf(id))).join(" & ")}</span></span><span class="pts">${q.avg}</span></div>`).join("")}</div><p class="muted small">Average points per person. The top squad gets +${E.SQUAD_BONUS} each on Sunday.</p>` : `<p class="muted">Squads unlock when four people are in the crew at the start of a week. You have ${C.memberIds.length}.</p>`}`;
}

/* ---------- punishment ---------- */
function renderRed(C) {
  const el = $("#redhero"); if (!keyed(el, [C.danger, C.wk, C.danger.map(nameOf)])) return;
  el.innerHTML = C.danger.length ? `<p class="names">Headed for a red card</p><h1>${C.danger.map(id => esc(nameOf(id))).join(" & ")}</h1><p>${C.danger.includes(S.uid) ? "That's you. Climb out before Sunday midnight." : "Last place right now. They have until Sunday midnight to climb out."}</p>` : `<h1>Last place gets the red card</h1><p>Whoever has the fewest points on Sunday at midnight films the punishment the crew voted for.</p>`;
}
function renderIdeas(C) {
  const list = E.ideasFor(S, C.wk), el = $("#ideas-list"), my = (S.uid && S.ivotes[S.uid] && S.ivotes[S.uid].w && S.ivotes[S.uid].w[C.wk]) || null;
  if (!keyed(el, [list, my, isMember()])) return;
  el.innerHTML = list.length ? `<ol class="ideas">${list.map((i, n) => { const own = i.uid === S.uid, v = my === i.uid; return `<li class="${n === 0 ? "lead" : ""}"><span class="votes"><b class="num">${i.votes.length}</b>vote${i.votes.length === 1 ? "" : "s"}</span><span class="who"><b class="it">${esc(i.t)}</b>${i.r ? `<span>${esc(i.r)}</span>` : ""}<span>Pitched by ${esc(nameOf(i.uid))}${own ? " (you)" : ""}${n === 0 ? ", leading" : ""}</span></span>${own ? `<span class="tag">Yours</span>` : `<button type="button" class="btn mini ${v ? "chalk" : ""}" data-ivote="${esc(i.uid)}" aria-pressed="${v}" ${isMember() ? "" : "disabled"}>${v ? "Voted" : "Vote"}</button>`}</li>`; }).join("")}</ol>` : `<p class="muted">No ideas yet this week. Pitch the first one. If nobody does, last place gets a random punishment.</p>`;
}
function renderMyIdea() {
  const el = $("#my-idea"), wk = S.C.wk;
  if (!isMember()) { if (keyed(el, "x")) el.innerHTML = `<h2>Your idea</h2><p class="muted">Join the crew on the Drops tab to pitch and vote.</p>`; return; }
  const m = S.ideas[S.uid] && S.ideas[S.uid].w && S.ideas[S.uid].w[wk];
  if (el.contains(document.activeElement) && document.activeElement.matches("input,textarea")) return;
  if (!keyed(el, wk + (m ? m.at : "none"))) return;
  el.innerHTML = `<div class="panel-h"><h2>Your idea</h2>${m ? `<span class="chip ok">Pitched</span>` : ""}</div><form id="idea-form" class="field" style="gap:12px"><div class="field"><label for="i-t">Punishment</label><input type="text" id="i-t" maxlength="60" required placeholder="e.g. 50 squats holding a full laundry basket"></div><div class="field"><label for="i-r">Rules (optional)</label><textarea id="i-r" maxlength="200" placeholder="How it has to be done and filmed"></textarea></div><p class="muted small">Keep it safe and doable at home. One idea each per week; saving again replaces yours.</p><button class="btn primary" type="submit">${m ? "Update my idea" : "Pitch it"}</button></form>`;
  if (m) { $("#i-t").value = m.t || ""; $("#i-r").value = m.r || ""; }
}
function renderPenBox(C) {
  const el = $("#pen-list"), rows = C.pens.filter(p => p.wk >= E.shiftKey(C.wk, -28)).sort((a, b) => b.wk.localeCompare(a.wk));
  if (!keyed(el, rows.map(p => [p.wk, p.uid, p.state, p.task.t, p.proof && p.proof.key, nameOf(p.uid)]))) return;
  el.innerHTML = rows.length ? `<ol class="fin">${rows.map(p => `<li style="grid-template-columns:32px minmax(0,1fr) auto">${avatar(p.uid)}<span class="who"><b>${nameBtn(p.uid)}</b><span>${esc(p.task.t)}, week of ${esc(fmtDay(p.wk, { day: "numeric", month: "short" }))}</span></span><span class="right"><span class="chip ${PEN[p.state][0]}">${PEN[p.state][1]}</span>${p.proof ? `<button type="button" class="linkish" data-watch="${esc(p.proof.key)}">watch</button>` : ""}</span></li>`).join("")}</ol>` : `<p class="muted">No punishments handed out yet. The first ones land when a week closes.</p>`;
}

/* ---------- train: form library + life ---------- */
const GROUPCOL = { arms: "#ff5c1a", legs: "#2f9bff", core: "#ffc02e", full: "#e84bff" };
const LIB = ["pushup", "diamond", "pike", "squat", "lunge", "pistol", "burpee", "climber", "plank", "wallsit", "situp", "bridge", "dip", "calf", "superman", "handstand"];
function renderTrain() {
  $$("[data-train]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.train === S.train)));
  $("#train-form").hidden = S.train !== "form"; $("#train-life").hidden = S.train !== "life";
  if (S.train === "form" && keyed($("#lib"), "lib")) $("#lib").innerHTML = LIB.map(k => `<button type="button" class="lib-card" data-ex="${k}" style="--lc:${GROUPCOL[E.MOVES[k][1]]}"><div class="lib-fig">${athCanvas(k, { tint: GROUPCOL[E.MOVES[k][1]] })}</div><h3>${esc(FORM[k].name)}</h3><div class="tags">${FORM[k].muscles.slice(0, 2).map(m => `<span class="tag">${esc(m)}</span>`).join("")}</div></button>`).join("");
  if (S.train === "life") { if (keyed($("#posture-fig"), "p")) $("#posture-fig").innerHTML = athCanvas("posture", { tint: "#3fdc8b", hero: true }); renderLife(); }
}
const habitDay = (uid, d) => (S.habits[uid] && S.habits[uid].d && S.habits[uid].d[d]) || {};
const habitScore = h => (HABITS.filter(x => h[x.id]).length + Math.min(1, (h.water || 0) / WATER_GOAL)) / (HABITS.length + 1);
async function writeHabit(mut) {
  if (!S.db || !isMember()) return toast("Join the crew on the Drops tab to track habits.");
  const t = today(), cut = E.shiftKey(t, -60);
  try { await mine("habits", cur => { const d = cur.d || {}; for (const k of Object.keys(d)) if (k < cut) delete d[k]; d[t] = mut({ ...(d[t] || {}) }); return { d }; }); } catch (err) { toast(dbErr(err)); }
}
function renderLife() {
  const t = today(), me = isMember() ? S.uid : null, el = $("#habits-panel");
  if (!keyed(el, [t, me, S.habits, Object.keys(S.members).map(nameOf)])) return;
  const h = me ? habitDay(me, t) : {}, sc = habitScore(h), c = 2 * Math.PI * 27, w = h.water || 0;
  el.innerHTML = `<div class="panel-h"><h2>Today's habits</h2><span class="sub">${me ? "Tap to check off" : "Join the crew to track"}</span></div><div class="score-ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="rb" cx="32" cy="32" r="27"/><circle class="rf" cx="32" cy="32" r="27" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - sc)).toFixed(1)}"/></svg><div><b class="num">${Math.round(sc * 100)}%</b><div class="muted small">of today's healthy habits</div></div></div>
    <div class="habits">${HABITS.map(x => `<button type="button" class="habit" data-habit="${x.id}" aria-pressed="${!!h[x.id]}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[x.id]}</svg><span class="hn">${esc(x.n)}</span><span class="hs">${esc(x.s)}</span></button>`).join("")}</div>
    <div class="field"><span class="lab">Water, ${w} of ${WATER_GOAL} glasses</span><div class="water">${Array.from({ length: WATER_GOAL }, (_, i) => `<button type="button" class="glass ${i < w ? "on" : ""}" data-water="${i + 1}" aria-label="${i + 1} glass${i ? "es" : ""}"><svg viewBox="0 0 32 42"><path class="g-in" d="M8.6 14h14.8l-1.7 23.2a2 2 0 0 1-2 1.8h-7.4a2 2 0 0 1-2-1.8z"/><path class="g-out" d="M5 4h22l-2.6 33.3a3 3 0 0 1-3 2.7H10.6a3 3 0 0 1-3-2.7z"/></svg></button>`).join("")}</div></div>`;
  const ids = Object.keys(S.members), days = Array.from({ length: 7 }, (_, i) => E.shiftKey(t, i - 6));
  $("#crew-habits").innerHTML = ids.length ? `<div class="hgrid"><div class="hrow"><span></span>${days.map(d => `<span class="hhead">${esc(fmtDay(d, { weekday: "narrow" }))}</span>`).join("")}</div>${ids.map(id => `<div class="hrow"><span class="who"><b>${esc(nameOf(id))}</b></span>${days.map(d => { const p = Math.round(habitScore(habitDay(id, d)) * 100); return `<span class="hcell" title="${p}%" style="background:color-mix(in srgb,var(--good) ${p}%,var(--mat-2))"></span>`; }).join("")}</div>`).join("")}</div>` : `<p class="muted">Once people join, their habits show up here.</p>`;
  const [a, b] = TIPS[Math.floor(Date.parse(t) / 864e5) % TIPS.length]; $("#tip").innerHTML = `<p class="muted small">Tip of the day</p><div class="tip-t">${esc(a)}</div><p class="muted">${esc(b)}</p>`;
}
let breathT = null;
function stopBreath(done) { clearInterval(breathT); breathT = null; $("#bcircle").classList.remove("big"); $("#bphase").textContent = done ? "Nice work" : "Ready"; $("#bcount").textContent = done ? "✓" : "4"; $("#bbtn").textContent = "Start 2-minute session"; }
function startBreath() { const ph = [["Breathe in", true], ["Hold", true], ["Breathe out", false], ["Hold", false]]; let s = 0; const step = () => { const p = ph[Math.floor(s / 4) % 4]; $("#bphase").textContent = p[0]; $("#bcount").textContent = 4 - s % 4; $("#bcircle").classList.toggle("big", p[1]); if (++s > 120) stopBreath(true); }; step(); breathT = setInterval(step, 1000); $("#bbtn").textContent = "Stop"; }

/* ---------- me / profiles ---------- */
const TIERART = ["common", "common", "common", "legendary", "rare", "epic"], TIERCOL = ["#b5a595", "#e08a52", "#d5dae3", "#ffc02e", "#7fd4ff", "#ff9df0"];
function renderMe(C) {
  const el = $("#v-me"), id = S.profile || S.uid, st = id && C.stats[id];
  if (!st) { if (keyed(el, "none" + S.mode)) el.innerHTML = `<div class="panel"><h2>Your player card</h2><p class="muted">Join the crew on the Drops tab and your card appears here.</p></div>` + rulesHTML(); return; }
  const own = id === S.uid, subs = C.subs.filter(s => s.uid === id).sort((a, b) => b.at - a.at);
  if (!keyed(el, [id, S.allCards, nameOf(id), st, C.today, subs.map(s => [s.key, s.status, s.points, s.reacts.length]), own && S.isOwner])) return;
  const t = E.tierOf(st.season), L = E.levelOf(st.all), good = subs.filter(s => s.kind === "quest" && s.status === "approved");
  const week = Array.from({ length: 7 }, (_, i) => E.shiftKey(C.wk, i)), hit = new Set(good.map(s => s.date));
  const G = ["arms", "legs", "full", "core"], gm = Math.max(60, ...G.map(g => st.groups[g])), pt = (i, f) => { const a = -Math.PI / 2 + i * Math.PI / 2; return [130 + Math.cos(a) * 92 * f, 118 + Math.sin(a) * 92 * f]; };
  const poly = G.map((g, i) => pt(i, .08 + .92 * Math.sqrt(st.groups[g] / gm)).map(v => v.toFixed(1)).join(",")).join(" ");
  const pbs = Object.entries(st.moves).sort((a, b) => b[1].total - a[1].total).slice(0, 6), val = (v, hold) => (hold ? `${Math.floor(v / 60)}:${pad(v % 60)}` : v);
  const start = E.shiftKey(C.wk, -77), cells = []; for (let i = 0; i < 84; i++) { const d = E.shiftKey(start, i); if (d > C.today) { cells.push(`<i style="visibility:hidden"></i>`); continue; } const n = good.filter(s => s.date === d).length, ice = st.frozen.includes(d); cells.push(`<i class="${d === C.today ? "today" : ""}" title="${esc(fmtDay(d))}: ${ice ? "frozen" : n + " finished"}" style="${ice ? "background:#8fdcff" : n ? `background:color-mix(in srgb,var(--signal) ${n > 1 ? 100 : 55}%,var(--mat-2))` : ""}"></i>`); }
  el.innerHTML = `
    ${own ? "" : `<button type="button" class="btn mini" style="justify-self:start" data-back>Back</button>`}
    <div class="player holo" data-amp="${innerWidth > 700 ? .15 : .5}" style="--pa:url(img/card-${TIERART[t.i]}.webp);--c:${TIERCOL[t.i]}">${rankEm(t.i)}<div class="sig">${esc(nameOf(id))}</div><div class="lv">${t.label}, level ${L.level}</div><div class="meter" title="${st.all} of ${L.to}"><i style="--v:${L.frac}"></i></div><div class="facts"><span>Points<b>${st.all}</b></span><span>Quests<b>${st.countAll}</b></span><span>Firsts<b>${st.firstsAll}</b></span><span>Duels<b>${st.duelW}–${st.duelL}</b></span></div><span class="qc-glare"></span></div>
    <div class="cols"><div class="stack">
      <div class="panel"><div class="flamebox"><canvas data-fx="flame" data-v="${st.cur ? Math.min(1, .3 + st.cur / 14).toFixed(2) : 0}"></canvas><div><div class="huge">${st.cur}</div><p class="muted">day streak, best ${st.best}. ${st.freezes < E.FREEZE_MAX ? `Next freeze in ${st.toFreeze} day${st.toFreeze === 1 ? "" : "s"}.` : "Freezes full."}</p><div class="ices">${Array.from({ length: E.FREEZE_MAX }, (_, i) => pin(3).replace('class="pin"', `class="pin ${i < st.freezes ? "" : "off"}"`)).join("")}</div></div></div><div class="weekdots">${week.map(d => `<i class="${hit.has(d) ? "hit" : st.frozen.includes(d) ? "ice" : ""} ${d === C.today ? "now" : ""}">${esc(fmtDay(d, { weekday: "narrow" }))}</i>`).join("")}</div><p class="muted small">One quest a day keeps it alive. Every 7 days earns a freeze that saves a missed day by itself.</p></div>
      <div class="panel"><div class="panel-h"><h2>Pins</h2><span class="sub">${E.BADGES.filter(b => b.v(st) >= b.goal).length} of ${E.BADGES.length}</span></div><div class="pinboard">${E.BADGES.map((b, i) => { const v = b.v(st), got = v >= b.goal; return `<button type="button" class="pinb ${got ? "" : "off"}" data-pin="${i}" data-of="${esc(id)}">${pin(i)}${esc(b.n)}${got ? "" : `<span class="mt"><i style="width:${Math.min(100, v / b.goal * 100)}%"></i></span>`}</button>`; }).join("")}</div></div>
      <div class="panel"><div class="panel-h"><h2>Card binder</h2><span class="sub">${good.length} collected</span></div>${good.length ? `<div class="binder">${good.slice(0, S.allCards === id ? 400 : 12).map(s => cardHTML(s.quest, { qid: s.qid, lv: s.lv, mini: true, tag: "button", attrs: `type="button" data-watch="${esc(s.key)}"` })).join("")}</div>` : `<p class="muted">Every quest you finish becomes a card here.</p>`}</div>
    </div><div class="stack">
      <div class="panel"><h2>Where the work goes</h2><div class="radarc"><svg viewBox="0 0 260 236" role="img" aria-label="Reps by muscle group">${[1, .66, .33].map(f => `<polygon points="${G.map((g, i) => pt(i, f).join(",")).join(" ")}" fill="none" stroke="#33363f" stroke-width="2"/>`).join("")}<polygon points="${poly}" fill="${TIERCOL[t.i]}" fill-opacity=".35" stroke="${TIERCOL[t.i]}" stroke-width="3" stroke-linejoin="round"/>${[["Arms", 130, 16, "middle"], ["Legs", 228, 122, "start"], ["Full body", 130, 232, "middle"], ["Core", 32, 122, "end"]].map(([l, x, y, a]) => `<text x="${x}" y="${y}" text-anchor="${a}">${l}</text>`).join("")}</svg></div><div class="parts"><span>Reps <b>${st.reps}</b></span><span>Held <b>${val(st.secs, 1)}</b></span><span>Fastest finish <b>${st.fastest !== null ? esc(fmtMs(st.fastest)) : "–"}</b></span><span>Best week <b>${st.bestWeek}</b></span><span>Reactions <b>${st.received}</b></span></div></div>
      <div class="panel"><h2>Personal bests</h2>${pbs.length ? `<div class="pbs">${pbs.map(([k, m]) => `<div>${athCanvas(k, { tint: GROUPCOL[E.MOVES[k][1]] })}<span><b>${esc(FORM[k].name)}</b><br><small>${val(m.total, m.hold)} lifetime</small></span><b class="v">${val(m.best || m.total, m.hold)}</b></div>`).join("")}</div>` : `<p class="muted">Finish a quest to set your first record.</p>`}</div>
      <div class="panel"><div class="panel-h"><h2>Videos</h2><span class="sub">Kept for two days</span></div>${subs.some(s => C.now < s.at + E.KEEP_MS) ? `<div class="vids">${subs.filter(s => C.now < s.at + E.KEEP_MS).slice(0, 12).map(s => `<button type="button" class="vid" data-watch="${esc(s.key)}" style="background:#111 url(img/card-${s.kind === "quest" ? s.quest.rarity : "epic"}.webp) center/cover">${s.video && !s.video.startsWith("sbp:") ? videoTag(s.video, 'muted playsinline preload="metadata"') : ""}<span>${esc(s.label)}${s.status === "rejected" ? " (no rep)" : ""}</span></button>`).join("")}</div>` : `<p class="muted">No videos from the last two days.</p>`}</div>
      <div class="panel"><h2>Last 12 weeks</h2><div class="heat"><div class="heat-wrap"><div class="heat-days">${["Mon", "", "Wed", "", "Fri", "", "Sun"].map(x => `<span>${x}</span>`).join("")}</div><div class="heat-grid">${cells.join("")}</div></div></div></div>
      ${own ? `<div class="panel"><h2>Settings</h2><div class="row"><button type="button" class="btn" id="rename-btn">Change name</button><button type="button" class="btn" data-notif>Notifications</button>${S.sb ? `<button type="button" class="btn ghost" id="signout-btn">Sign out</button>` : ""}</div></div>` : ""}
    </div></div>
    ${own ? logHTML(C) + rulesHTML() : ""}`;
}
function logHTML(C) {
  const out = [];
  for (let i = 0; i < 14; i++) {
    const k = E.shiftKey(C.today, -i);
    const qs = E.slotsOf(S, k).map(q => { const d = E.dropOf(S, q), list = C.byQ[q] || []; const sec = i === 0 && (!d || !seen(q)); if (!d && !list.length) return i === 0 ? `<div class="dq"><h3>Sealed<small>not dropped yet</small></h3></div>` : ""; const x = E.questFor(S, q); return `<div class="dq" style="--c:${RCOL[x.rarity]}"><h3>${sec ? "Unopened pack" : esc(E.questTitle(x))}<small>${sec ? "" : E.RARITY[x.rarity].label}${d ? (sec ? "" : ", ") + esc(fmtTime(d.at)) : ""}</small></h3>${list.length ? `<div class="fins">${list.map(s => `<button type="button" class="fchip ${s.status}" data-watch="${esc(s.key)}">${avatar(s.uid, "sm")}${s.place ? ord(s.place) + " " : ""}${esc(nameOf(s.uid))}${s.points ? " +" + s.points : ""}</button>`).join("")}</div>` : ""}</div>`; }).join("");
    if (qs) out.push(`<div class="day"><div class="d">${esc(fmtDay(k, { weekday: "short" }))}<b>${Number(k.slice(8))}</b>${esc(fmtDay(k, { month: "short" }))}</div><div>${qs}</div></div>`);
  }
  return `<div class="panel"><h2>Crew history</h2><div class="days">${out.join("")}</div></div>`;
}
const rulesHTML = () => `<div class="panel"><h2>How it works</h2><ul class="rules-list">
  <li><b>Drops:</b> two packs a day at random times between ${E.hourLabel(E.CFG.firstDrop)} and ${E.hourLabel(E.CFG.lastDrop)}, at least ${E.CFG.gap / 60} hours apart. Both close at ${E.hourLabel(E.CFG.close)}.</li>
  <li><b>Counting:</b> your video counts the moment you submit. If someone says it doesn't within 24 hours, it's out, and you can film it again while the quest is open.</li>
  <li><b>Points:</b> Common 100, Rare 200, Epic 400, Legendary 800. Easy is 60% of the reps and points, Hard is 160% of the reps for 150% of the points.</li>
  <li><b>Speed:</b> first finisher +50%, second +25%, third +10%.</li>
  <li><b>Streak:</b> +10 per day in a row, up to +50, once a day. Every 7 days earns a freeze (two at most) that covers a missed day.</li>
  <li><b>Crew:</b> fill the shaker for +${E.GOAL_BONUS} each. The top squad gets +${E.SQUAD_BONUS} each. Duels move ${E.STAKES.join(", ")} points from loser to winner.</li>
  <li><b>Sunday:</b> the ceremony opens at ${E.hourLabel(E.CFG.close)}. The winner gets a power for the next week. Last place films the punishment by the end of the next week or loses ${E.PENALTY} points.</li>
  <li><b>Videos:</b> up to ${maxMB()} MB each, deleted after two days. Results and cards stay forever.</li>
  <li><b>Seasons:</b> each month is a season with its own rank and champion.</li></ul></div>`;

/* ---------- after each render: celebrations and alerts ---------- */
function afterRender(C) {
  if (!fresh()) return;
  const all = C.subs;
  if (!S.seeded) { if (S.mode === "live") { all.forEach(s => S.seenSubs.add(s.key)); S.seeded = true; } }
  else for (const s of all) if (!S.seenSubs.has(s.key)) { S.seenSubs.add(s.key); if (s.uid !== S.uid && prefs().videos) { sfx.notify(); toast(`${nameOf(s.uid)} just posted ${s.label}.`); } }
  if (S.uid) {
    const my = all.filter(s => s.uid === S.uid && !s.locked), rej = new Set(my.filter(s => s.status === "rejected").map(s => s.key));
    if (S.lastRej) for (const k of rej) if (!S.lastRej.has(k)) { const n = C.subByKey[k].no[0]; sfx.no(); toast(`${nameOf(n.uid)} says your run doesn't count: ${n.why || "no reason given"}`); }
    S.lastRej = rej;
    const got = C.stats[S.uid] ? E.BADGES.filter(b => b.v(C.stats[S.uid]) >= b.goal).map(b => b.id) : null;
    if (got) { const old = store.get("sg-pins-" + S.uid); if (old !== null) { const o = old.split(","), nw = got.filter(g => !o.includes(g)); if (nw.length) newPin(nw[0]); } if (old !== got.join(",")) store.set("sg-pins-" + S.uid, got.join(",")); }
    const g = C.goals[C.wk]; if (S.lastGoal === false && g.hitOn) { toast(`The crew shaker is full! +${E.GOAL_BONUS} each.`); sfx.fanfare(); FX.confetti({ n: 240, cols: PAL.signal }); } S.lastGoal = !!g.hitOn;
  }
  /* a pack just dropped, or one is waiting unopened */
  const st = C.slots.map(s => s.qid + s.state).join();
  const busyUI = document.querySelector(".stage") || !$("#modal").hidden;
  if (S.mode === "live" && isMember() && !busyUI && !S.busy) {
    const live = C.slots.filter(s => s.state === "open" && !seen(s.qid) && !S.offered.has(s.qid));
    const incoming = S.slotState && live.find(s => S.slotState.includes(s.qid + "waiting"));
    const s = incoming || live[live.length - 1];
    if (s) { S.offered.add(s.qid); S.slot = s.qid; setTimeout(() => rip(s.qid, !!incoming), incoming ? 50 : 500); }
    else { const cw = E.ceremonyWeek(S, C); if (cw && C.now < E.tsOf(E.shiftKey(cw, 8)) && !store.get("sg-cer-" + cw) && !S.cerOffered) { S.cerOffered = true; setTimeout(() => { if (!document.querySelector(".stage")) openCeremony(); }, 700); } }
  }
  S.slotState = st;
}
function newPin(id) { const i = E.BADGES.findIndex(b => b.id === id), b = E.BADGES[i]; setTimeout(() => { if (document.querySelector(".stage") || !$("#modal").hidden) return; openModal(`<div class="center stack" style="justify-items:center;gap:8px">${pin(i, "--ps:170px;animation:stamp2 .6s cubic-bezier(.2,1.8,.4,1) both")}<p class="muted">New pin</p><h2 style="font-size:2rem">${esc(b.n)}</h2><p>${esc(b.d)}</p><button type="button" class="btn primary" data-close>Pin it</button></div>`); sfx.fanfare(); FX.confetti({ cols: PAL.legendary, n: 180 }); }, 900); }
function rip(qid, incoming = false) {
  const s = S.C.slots.find(x => x.qid === qid); if (!s || !s.quest) return;
  FX.pulse(1);
  SHOW.ripPack({ quest: s.quest, incoming, label: s.slot === "b" ? "Drop 2" : s.slot === "a" ? "Drop 1" : "Daily quest", sub: incoming ? "Incoming" : fmtDay(qid.slice(0, 10)), cardHTML: cardHTML(s.quest, { qid, lv: S.lv }), onSeen: () => markSeen(qid), onClose: () => { const d = $("#deck"); [...d.children].forEach(c => (c.dataset.k = "")); $("#action").dataset.k = ""; scheduleRender(); requestAnimationFrame(() => scrollToSlot(false)); } });
}

/* ---------- ticking ---------- */
let pollN = 0;
function tick() {
  const n = E.now();
  $$("[data-until]").forEach(e => (e.textContent = hms(Number(e.dataset.until) - n)));
  const wEl = $("#week-countdown"); if (wEl) { const ws = Math.max(0, E.tsOf(E.shiftKey(E.weekOf(E.keyAt(n)), 7)) - n) / 1000; wEl.textContent = `${Math.floor(ws / 86400)}d ${Math.floor(ws / 3600) % 24}h ${pad(Math.floor(ws / 60) % 60)}m left`; }
  const day = E.keyAt(n); S.now = n;
  const sig = day + E.slotsOf(S, day).map(q => { const d = E.dropOf(S, q); return d ? (n >= d.close ? "c" : "o") : "w"; }).join("") + Math.floor(n / 6e4);
  if (sig !== S.sig) { S.sig = sig; scheduleRender(); }
  if (S.db && S.db.refresh && ++pollN % 40 === 0 && !document.hidden && sig.includes("w")) S.db.refresh("drops");
}
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.db && S.db.refresh) S.db.refresh("drops"); });
addEventListener("resize", () => { if (S.view === "today") scheduleRender(); });

/* ---------- modal ---------- */
function openModal(html) { $("#modal-box").innerHTML = html; $("#modal").hidden = false; hydrateMedia(); const f = $("#modal-box").querySelector("input:not([type=file]):not([type=radio]),select,button"); if (f && !matchMedia("(pointer: coarse)").matches) f.focus(); }
function closeModal() { $("#modal").hidden = true; $("#modal-box").innerHTML = ""; }
$("#modal").addEventListener("click", e => { if (e.target.id === "modal" || e.target.closest("[data-close]")) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
function renameDialog() { openModal(`<h2>Your name</h2><form id="rename-form" class="field" style="gap:14px"><label for="r-name">Shown on the leaderboard and your card</label><input type="text" id="r-name" maxlength="24" required><div class="row end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`); $("#r-name").value = nameOf(S.uid); }
function customDialog() {
  const s = S.C.slots.find(x => x.qid === S.slot); if (!s || !s.quest) return; const q = E.baseQuest(S, s.qid);
  openModal(`<h2>Custom quest</h2><p class="muted small">Replaces ${esc(s.slot === "b" ? "drop 2" : s.slot === "a" ? "drop 1" : "the quest")} for everyone.</p><form id="custom-form" class="field" style="gap:14px" data-q="${s.qid}"><div class="grid2"><div class="field"><label for="c-n">Headline</label><input type="text" id="c-n" maxlength="24" required placeholder="50 or Chipper"></div><div class="field"><label for="c-u">Exercise</label><input type="text" id="c-u" maxlength="90" required placeholder="Push-ups"></div><div class="field"><label for="c-r">Rarity</label><select id="c-r">${Object.entries(E.RARITY).map(([k, v]) => `<option value="${k}">${v.label} (${v.base} pts)</option>`).join("")}</select></div><div class="field"><label for="c-k">Type</label><select id="c-k"><option value="strength">Strength</option><option value="skill">Skill hold</option></select></div></div><div class="field"><label for="c-rules">Standards</label><textarea id="c-rules" maxlength="300"></textarea></div><div class="row end">${q.custom ? `<button type="button" class="btn ghost" id="c-reset">Undo custom quest</button>` : ""}<button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Set quest</button></div></form>`);
  $("#c-n").value = q.n; $("#c-u").value = q.u; $("#c-r").value = q.rarity; $("#c-k").value = q.k; $("#c-rules").value = q.r;
}

/* ---------- notifications ---------- */
const NP = [["quest", "Pack drops", "The moment a pack lands"], ["closing", "Closing soon", "An hour before closing, and when your streak is at risk"], ["videos", "New videos", "When someone in the crew submits"], ["verdict", "My run was thrown out", "When someone says your video doesn't count"], ["social", "Reactions and comments", "On your videos"], ["duels", "Duels", "Challenges and answers"], ["punish", "Punishment due", "Before your deadline"], ["ceremony", "Sunday ceremony", "When the week's winner is crowned"]];
function prefs() {
  const own = S.push && S.uid && S.push[S.uid] && S.push[S.uid].prefs; let loc = {};
  try { loc = JSON.parse(store.get("sg-notif-prefs") || "{}"); } catch (e) {}
  return Object.fromEntries(NP.map(([k]) => [k, own && typeof own[k] === "boolean" ? own[k] : typeof loc[k] === "boolean" ? loc[k] : true]));
}
const pushCapable = () => !!(S.sb && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const subHash = ep => { let h = 0; for (const c of ep) h = (h * 31 + c.charCodeAt(0)) >>> 0; return "d" + h.toString(36); };
function b64ToU8(b64) { const p = "=".repeat((4 - b64.length % 4) % 4), raw = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
const savePush = mut => mine("push", cur => { const n = mut(cur) || cur; n.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; delete n.openHour; delete n.closeHour; return n; });
async function currentSub() { if (!pushCapable()) return null; try { const reg = await navigator.serviceWorker.getRegistration("sw.js"); return reg ? await reg.pushManager.getSubscription() : null; } catch (e) { return null; } }
async function enablePush() {
  if (!pushCapable()) throw new Error("unsupported");
  if (isIOS() && !isStandalone()) throw new Error("ios-home");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("denied");
  const reg = await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready;
  const { data, error } = await S.sb.functions.invoke("notify", { body: { action: "key" } });
  if (error || !data || !data.publicKey) throw new Error("server");
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(data.publicKey) }));
  const json = sub.toJSON(), p = prefs(); await savePush(d => { d.subs = d.subs || {}; d.subs[subHash(json.endpoint)] = json; d.prefs = p; });
}
async function disablePush() { const sub = await currentSub(); if (sub) { const h = subHash(sub.endpoint); try { await sub.unsubscribe(); } catch (e) {} await savePush(d => { if (d.subs) delete d.subs[h]; }); } }
async function setPref(k, v) { const p = prefs(); p[k] = v; store.set("sg-notif-prefs", JSON.stringify(p)); if (S.push && S.uid && S.push[S.uid]) { try { await savePush(d => { d.prefs = p; }); } catch (e) { toast(dbErr(e)); } } }
async function notifStatus() {
  const el = $("#np-status"); if (!el) return; let msg = "", on = false;
  if (!S.sb) msg = "Phone notifications work on the live site. Here you still get sounds and pop-ups while the page is open.";
  else if (!pushCapable()) msg = "This browser can't receive notifications. Try Chrome, or on iPhone add the site to your Home Screen first.";
  else if (isIOS() && !isStandalone()) msg = "On iPhone: tap Share, then Add to Home Screen. Open Side Gains from there and turn notifications on.";
  else if (Notification.permission === "denied") msg = "Notifications are blocked for this site. Allow them in your browser's site settings, then come back.";
  else { on = !!(await currentSub()); msg = on ? "Notifications are on for this device." : "Notifications are off for this device."; }
  el.textContent = msg; el.dataset.on = String(on);
  const b = $("#np-enable"); b.hidden = !(pushCapable() && !(isIOS() && !isStandalone()) && Notification.permission !== "denied"); b.textContent = on ? "Turn off on this device" : "Turn on for this device"; b.dataset.on = String(on); $("#np-test").hidden = !on;
}
function notifDialog() { const p = prefs(); openModal(`<h2>Notifications</h2><p class="np-status" id="np-status">Checking this device…</p><div>${NP.map(([k, t, d]) => `<label class="switch-row"><input type="checkbox" data-np="${k}" ${p[k] ? "checked" : ""}><span class="sw" aria-hidden="true"></span><span><b>${t}</b><small>${d}</small></span></label>`).join("")}</div><div class="row end"><button type="button" class="btn ghost" id="np-test" hidden>Send a test</button><button type="button" class="btn" data-close>Close</button><button type="button" class="btn primary" id="np-enable" hidden>Turn on for this device</button></div>`); notifStatus(); }

/* ---------- clicks ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("button, a, [role=button]"); if (!t || t.disabled) return;
  if (t.matches(".btn.primary, .btn.chalk")) FX.chalk(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2, 9, .8);
  if (t.matches("[data-react]")) return; if (t.matches("[data-why]")) return sfx.no(); if (t.matches("[data-ivote],[data-duel-yes]")) return sfx.yes();
  if (t.matches("[data-habit]")) return t.getAttribute("aria-pressed") === "true" ? sfx.off() : sfx.on(); if (t.matches("[data-water]")) return sfx.water();
  if (t.matches(".dock a")) return sfx.tab(); if (t.matches("#sound-btn")) return; sfx.tap();
}, true);
async function safe(f, ok) { try { await f(); if (ok) toast(ok); return true; } catch (err) { if (err && err.message !== "no user") toast(err instanceof Error && !err.code ? err.message : dbErr(err)); return false; } }
document.addEventListener("click", async e => {
  const at = s => e.target.closest(s); let t;
  if ((t = at("[data-rip]"))) return rip(t.dataset.rip);
  if ((t = at("[data-replay]"))) return rip(t.dataset.replay);
  if ((t = at(".slot")) && !at("button") && t.dataset.slot !== S.slot) { S.slot = t.dataset.slot; scheduleRender(); scrollToSlot(); return; }
  if ((t = at("[data-goslot]"))) { S.slot = t.dataset.goslot; scheduleRender(); requestAnimationFrame(() => scrollToSlot()); return; }
  if ((t = at("[data-lv]"))) return setLevel(t.dataset.lv);
  if (at("[data-redo]")) { S.redo = S.slot; scheduleRender(); return; }
  if ((t = at("[data-watch]"))) return watch(t.dataset.watch);
  if ((t = at("[data-loadparts]"))) return loadParts(t.dataset.loadparts, t);
  if ((t = at("[data-prof]"))) { closeModal(); location.hash = t.dataset.prof === S.uid ? "#me" : "#p/" + encodeURIComponent(t.dataset.prof); return; }
  if ((t = at("[data-allcards]"))) { S.allCards = t.dataset.allcards; scheduleRender(); return; }
  if (at("[data-back]")) return history.length > 1 ? history.back() : (location.hash = "#board");
  if ((t = at("[data-ex]"))) return openModal(`${coachHTML(t.dataset.ex, GROUPCOL[E.MOVES[t.dataset.ex][1]])}<div class="row end"><button type="button" class="btn" data-close>Close</button></div>`);
  if ((t = at("[data-pin]"))) { const b = E.BADGES[t.dataset.pin], v = b.v(S.C.stats[t.dataset.of]); return openModal(`<div class="center stack" style="justify-items:center;gap:8px">${pin(Number(t.dataset.pin), "--ps:150px")}<h2 style="font-size:1.8rem">${esc(b.n)}</h2><p>${esc(b.d)}</p><p class="muted">${v >= b.goal ? "Earned" : `${v} of ${b.goal}`}</p><button type="button" class="btn" data-close>Close</button></div>`); }
  if ((t = at("[data-habit]"))) return writeHabit(h => { const id = t.dataset.habit; if (h[id]) delete h[id]; else h[id] = 1; return h; });
  if ((t = at("[data-water]"))) return writeHabit(h => { const n = Number(t.dataset.water); h.water = (h.water || 0) === n ? n - 1 : n; return h; });
  if (at("#bbtn")) return breathT ? stopBreath(false) : startBreath();
  if ((t = at("[data-train]"))) { S.train = t.dataset.train; scheduleRender(); return; }
  if ((t = at("[data-range]"))) { S.range = t.dataset.range; store.set("sg-range2", S.range); scheduleRender(); return; }
  if (at("#open-cer")) return openCeremony();
  if ((t = at("[data-react]"))) {
    const k = t.dataset.react, i = Number(t.dataset.i), cur = S.reacts[S.uid] && S.reacts[S.uid].r && S.reacts[S.uid].r[k];
    if (cur !== i) { sfx.sticker(); FX.buzz(18); const r = t.getBoundingClientRect(); FX.sparks(r.left + r.width / 2, r.top, ["#fff", "#ff5c1a", "#ffc02e"], 10, .7); } else sfx.off();
    await safe(() => mine("reacts", c => { c.r = c.r || {}; if (c.r[k] === i) delete c.r[k]; else c.r[k] = i; })); if (cur === undefined) notify({ action: "social", kind: "react", key: k }); return;
  }
  if ((t = at("[data-nocount]"))) { S.whyOpen = S.whyOpen === t.dataset.nocount ? null : t.dataset.nocount; scheduleRender(); return; }
  if ((t = at("[data-why]"))) { const k = t.dataset.why; S.whyOpen = null; FX.buzz([60, 30, 60]); if (await safe(() => mine("votes", c => { c.v = c.v || {}; c.why = c.why || {}; c.v[k] = -1; c.why[k] = { r: t.dataset.r, at: E.now() }; }))) notify({ action: "reject", key: k }); return; }
  if ((t = at("[data-takeback]"))) { const k = t.dataset.takeback; await safe(() => mine("votes", c => { if (c.v) delete c.v[k]; if (c.why) delete c.why[k]; }), "Taken back. It counts again."); return; }
  if ((t = at("[data-delcmt]"))) { const k = t.dataset.delcmt, a = Number(t.dataset.at); return safe(() => mine("comments", c => { if (c.c && c.c[k]) { c.c[k] = c.c[k].filter(x => x.at !== a); if (!c.c[k].length) delete c.c[k]; } })); }
  if ((t = at("[data-ivote]"))) return isMember() && safe(() => mine("ivotes", c => { const w = S.C.wk; c.w = c.w || {}; if (c.w[w] === t.dataset.ivote) delete c.w[w]; else c.w[w] = t.dataset.ivote; }));
  if (at("#new-duel")) return duelDialog();
  if ((t = at("[data-duel-yes]"))) { const d = S.C.duels.find(x => x.id === t.dataset.duelYes); if (d && await safe(() => mine("duels", c => { c.r = c.r || {}; c.r[d.id] = { v: 1, at: E.now() }; }))) { notify({ action: "duel", id: d.id, kind: "yes" }); SHOW.duelIntro({ a: nameOf(d.a), b: nameOf(d.b), label: DTYPE[d.type][0], stake: d.stake }); } return; }
  if ((t = at("[data-duel-no]"))) { const id = t.dataset.duelNo; await safe(() => mine("duels", c => { c.r = c.r || {}; c.r[id] = { v: -1, at: E.now() }; }), "You backed out"); notify({ action: "duel", id, kind: "no" }); return; }
  if ((t = at("[data-duel-cancel]"))) return safe(() => mine("duels", c => { if (c.d) delete c.d[t.dataset.duelCancel]; }), "Challenge cancelled");
  if ((t = at("[data-duel-max]"))) return maxDialog(t.dataset.duelMax);
  if ((t = at("[data-veto]"))) { const q = t.dataset.veto; return safe(() => mine("powers", c => { c.p = c.p || {}; c.p[S.C.wk] = { kind: "veto", qid: q, at: E.now() }; }), "Vetoed. Everyone gets a new move."); }
  if ((t = at("[data-auth]"))) { S.authMode = t.dataset.auth; scheduleRender(); return; }
  if (at("[data-notif]") || at("#notif-btn")) return notifDialog();
  if (at("#sound-btn")) { FX.setSound(!FX.SOUND.on); $("#sound-btn").setAttribute("aria-pressed", String(FX.SOUND.on)); return; }
  if (at("#rename-btn")) return renameDialog();
  if (at("#signout-btn")) { await S.sb.auth.signOut(); location.replace(location.origin + location.pathname); return; }
  if (at("#custom-btn")) return customDialog();
  if (at("#c-reset")) return safe(() => S.db.doc("quests/" + S.slot).delete(), "Back to the dropped quest").then(closeModal);
  if ((t = at("#np-enable"))) {
    t.disabled = true;
    try { if (t.dataset.on === "true") { await disablePush(); toast("Notifications turned off on this device"); } else { await enablePush(); sfx.success(); toast("Notifications are on"); } }
    catch (err) { sfx.error(); const m = err && err.message; toast(m === "denied" ? "Permission wasn't granted, so notifications stay off." : m === "ios-home" ? "Add Side Gains to your Home Screen first, then try again from there." : m === "server" ? "Couldn't reach the notification service. Try again in a minute." : "Couldn't turn on notifications on this device."); }
    t.disabled = false; return notifStatus();
  }
  if (at("#np-test")) { try { const { data } = await S.sb.functions.invoke("notify", { body: { action: "test" } }); toast(data && data.sent ? "Test sent. Check your notifications." : "No device to send to yet."); } catch (err) { toast("Couldn't send a test right now."); } }
});
function setLevel(lv) {
  if (lv === S.lv) return; S.lv = lv; store.set("sg-lv", lv); sfx.flip();
  $$("[data-lv]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lv === lv)));
  const s = S.C.slots.find(x => x.qid === S.slot), card = $(`.slot[data-slot="${S.slot}"] .qcard`); if (!s || !card || !s.quest) return;
  const b = cardBits(s.quest, lv), n = card.querySelector(".qc-n"); n.textContent = b.x.n; n.className = "qc-n " + b.nCls; void n.offsetWidth; n.classList.add("bump"); card.querySelector(".qc-u").textContent = b.x.u;
  card.querySelectorAll(".qc-strip b").forEach((x, i) => (x.textContent = b.pts[i])); const a = card.querySelector(".ath"); if (a) a.dataset.speed = lv === "hard" ? 1.3 : lv === "easy" ? .85 : 1;
  const r = card.getBoundingClientRect(); FX.chalk(r.left + r.width * .3, r.bottom - r.height * .3, 14, 1);
}
document.addEventListener("change", e => {
  if (e.target.type === "file") e.target.closest(".drop").classList.toggle("has", !!e.target.files.length);
  if (e.target.dataset.np) { setPref(e.target.dataset.np, e.target.checked); e.target.checked ? sfx.on() : sfx.off(); }
  if (e.target.name === "type") { const m = $("#dl-move"); if (m) m.hidden = e.target.value !== "max"; }
});
document.addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target, id = f.id;
  if (f.dataset.cmt) { const inp = f.querySelector("input"), t = inp.value.trim().slice(0, 200), k = f.dataset.cmt; if (!t) return; inp.value = ""; if (await safe(() => mine("comments", c => { c.c = c.c || {}; (c.c[k] = c.c[k] || []).push({ t, at: E.now() }); if (c.c[k].length > 30) c.c[k].shift(); }))) { sfx.tab(); notify({ action: "social", kind: "comment", key: k }); } else inp.value = t; return; }
  if (id === "join-form") { const name = $("#j-name").value.trim().slice(0, 24); if (name) await safe(() => S.db.doc("members/" + S.uid).set({ name, joined: Date.now() }), `Welcome, ${name}`); }
  if (id === "rename-form") { const name = $("#r-name").value.trim().slice(0, 24); if (name && await safe(() => S.db.doc("members/" + S.uid).set({ ...(S.members[S.uid] || {}), name }), "Name updated")) closeModal(); }
  if (id === "custom-form") { const d = { n: $("#c-n").value.trim(), u: $("#c-u").value.trim(), rarity: $("#c-r").value, k: $("#c-k").value, r: $("#c-rules").value.trim(), setAt: Date.now() }; if (d.n && d.u && await safe(() => S.db.doc("quests/" + f.dataset.q).set(d), "Quest updated")) closeModal(); }
  if (id === "pick-form") { const q = $("#pw-q").value, m = $("#pw-m").value; if (q) await safe(() => mine("powers", c => { c.p = c.p || {}; c.p[S.C.wk] = { kind: "pick", qid: q, move: m, at: E.now() }; }), "Locked in. Nobody sees it until it drops."); }
  if (id === "duel-form") {
    const g = n => (f.querySelector(`[name=${n}]:checked`) || {}).value, did = Math.random().toString(36).slice(2, 9) + Date.now().toString(36), to = g("who");
    if (await safe(() => mine("duels", c => { c.d = c.d || {}; c.d[did] = { to, type: g("type"), stake: Number(g("stake")), move: $("#dl-m").value, at: E.now() }; }), `Challenge sent to ${nameOf(to)}`)) { closeModal(); sfx.thunder(); notify({ action: "duel", id: did, kind: "new" }); }
  }
  if (id === "idea-form") { const t = $("#i-t").value.trim().slice(0, 60), r = $("#i-r").value.trim().slice(0, 200); if (t) { document.activeElement && document.activeElement.blur(); await safe(() => mine("ideas", c => { c.w = c.w || {}; c.w[S.C.wk] = { t, r, at: Date.now() }; }), "Idea saved. Now get the crew to vote for it."); } }
  if (id === "sub-form") await submitVideo("f", entry => mine("subs", c => { c.e = c.e || {}; const q = f.dataset.q, old = c.e[q]; if (old && S.redo !== q) return c; c.e[q] = { ...entry, lv: S.lv, ...(old ? { n: (old.n || 0) + 1 } : {}) }; }), f.dataset.q);
  if (id === "pen-form") await submitVideo("p", entry => mine("pens", c => { c.e = c.e || {}; c.e[f.dataset.wk] = entry; }));
  if (id === "max-form") { const n = Math.round(Number($("#mx-n").value)); if (await submitVideo("m", entry => mine("duels", c => { c.m = c.m || {}; c.m[f.dataset.id] = { ...entry, n }; }))) closeModal(); }
  if (id === "signin-form") await signIn(f);
});
async function submitVideo(p, save, qid) {
  const errEl = $(`#${p}-err`), btn = $(`#${p}-btn`), label = btn.textContent, fail = m => { errEl.textContent = m; errEl.hidden = false; sfx.error(); return false; };
  errEl.hidden = true;
  const file = ($(`#${p}-video`) || {}).files && $(`#${p}-video`).files[0], link = $(`#${p}-link`).value.trim(), note = $(`#${p}-note`).value.trim().slice(0, 280);
  if (!file && !link) return fail("Add a video file or paste a link to your video.");
  if (link && !safeLink(link)) return fail("Links need to start with https://");
  if (file && file.size > maxMB() * 1048576) return fail(`That file is ${(file.size / 1048576).toFixed(0)} MB and the limit is ${maxMB()} MB. Trim it or paste a link instead.`);
  if (qid) { S.now = E.now(); const d = E.dropOf(S, qid); if (!d || S.now >= d.close) return fail("This quest has closed. Catch the next drop."); }
  const pressed = E.now(); /* the clock stops when you press submit, not when the upload ends */
  S.busy = true; btn.disabled = true; btn.textContent = file ? "Uploading…" : "Submitting…";
  try {
    let video = null;
    if (file) {
      const type = file.type === "video/webm" ? "video/webm" : "video/mp4";
      try { video = (await S.assets.upload(file, { type, onStage: m => (btn.textContent = m) })).id; }
      catch (err) { const c = err && err.code; throw new Error(c === "too_large" ? `That video is over the ${maxMB()} MB limit. Paste a link instead.` : c === "unsupported_type" ? "That video format isn't supported. Export it as MP4, or paste a link instead." : c === "quota_or_state" ? "The crew's video storage is full. Paste a link instead." : c === "rate_limited" ? "Too many uploads in a row. Wait a minute and try again." : "The upload failed. Try again, or paste a link instead."); }
    }
    await save({ at: pressed, video, link: link || null, note });
    S.busy = false; S.redo = null; toast("It counts! Unless someone says it doesn't."); sfx.success(); FX.buzz([40, 30, 90]); FX.pulse(1.2); FX.confetti({ n: 170 }); FX.chalk(innerWidth / 2, innerHeight * .6, 40, 2.4);
    if (qid) notify({ action: "video" });
    $("#action").dataset.k = ""; $("#penance").dataset.k = ""; scheduleRender(); return true;
  } catch (err) { S.busy = false; btn.disabled = false; btn.textContent = label; return fail(err instanceof Error && !err.code ? err.message : dbErr(err)); }
}
async function signIn(f) {
  const signup = f.dataset.mode === "signup", raw = $("#si-user").value.trim(), pass = $("#si-pass").value, errEl = $("#si-err"), btn = $("#si-btn");
  const fail = m => { errEl.textContent = m; errEl.hidden = false; sfx.error(); btn.disabled = false; btn.textContent = signup ? "Create account" : "Log in"; };
  errEl.hidden = true; const isEmail = raw.includes("@"), user = raw.toLowerCase();
  if (!isEmail && !/^[a-z0-9_.-]{3,20}$/.test(user)) return fail("Usernames are 3–20 characters: letters, numbers, dots, dashes or underscores.");
  if (pass.length < 6) return fail("Passwords need at least 6 characters.");
  const email = isEmail ? user : `${user}@${USER_DOMAIN}`; btn.disabled = true; btn.textContent = signup ? "Creating…" : "Logging in…";
  if (signup) {
    if (isEmail) return fail("Pick a username without an @ sign.");
    const { data, error } = await S.sb.auth.signUp({ email, password: pass, options: { data: { username: user } } });
    if (error) return fail(/already|registered|exists/i.test(error.message) ? "That username is taken. Try another one." : /signups? not allowed|disabled/i.test(error.message) ? "Sign-ups are closed right now. Ask the crew owner." : /password/i.test(error.message) ? "That password is too weak. Use at least 6 characters." : "Couldn't create the account. Try again.");
    if (!data.session) return fail("Account created, but it needs confirming. Ask the crew owner to turn off email confirmation.");
  } else { const { error } = await S.sb.auth.signInWithPassword({ email, password: pass }); if (error) return fail(/invalid|credentials/i.test(error.message) ? "Wrong username or password." : /confirm/i.test(error.message) ? "This account isn't confirmed yet. Ask the crew owner." : "Couldn't log in. Try again."); }
  sfx.success(); location.replace(location.origin + location.pathname);
}

/* ---------- routing ---------- */
const VIEWS = ["today", "board", "arena", "punish", "train", "me"], ALIAS = { form: "train", life: "train", log: "me" };
function route() {
  let h = location.hash.slice(1), v; S.profile = null;
  if (h.startsWith("p/")) { S.profile = decodeURIComponent(h.slice(2)); v = "me"; }
  else { if (h === "form" || h === "life") S.train = h; v = ALIAS[h] || (VIEWS.includes(h) ? h : "today"); }
  const go = () => { S.view = v; $$("main > [data-view]").forEach(el => (el.hidden = el.dataset.view !== v)); $$(".dock a").forEach(a => a.setAttribute("aria-current", a.dataset.view === v ? "page" : "false")); $(".dock").style.setProperty("--dock", VIEWS.indexOf(v)); if (S.C) { cancelAnimationFrame(rafId); rafId = 0; render(); } scrollTo(0, 0); if (v === "today") requestAnimationFrame(() => scrollToSlot(false)); };
  if (S.C && !RM && document.startViewTransition && S.view !== v) document.startViewTransition(go); else go();
}
addEventListener("hashchange", route);

/* ---------- storage backends: claude.ai artifact runtime, or Supabase ---------- */
const USER_DOMAIN = "safi230r.github.io";
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
function maxMB() { return S.sb || S.demo ? VID.MAX_MB : 20; }
const urlCache = {};
function mediaUrl(id) {
  if (!id) return ""; if (String(id).startsWith("sbp:")) return (urlCache[id] && urlCache[id].url) || ""; if (String(id).startsWith("demo:")) return (S.demoUrls || {})[id] || "";
  if (!String(id).startsWith("sb:")) return "/_blob/" + id;
  const c = urlCache[id]; if (c && c.url && c.exp > Date.now()) return c.url;
  if (S.sb && !(c && c.pending)) { urlCache[id] = { pending: true, url: (c && c.url) || "", exp: 0 }; S.sb.storage.from("videos").createSignedUrl(id.slice(3), 6 * 3600).then(({ data }) => { urlCache[id] = data ? { url: data.signedUrl, exp: Date.now() + 5 * 3600e3 } : { url: "", exp: Date.now() + 60e3 }; hydrateMedia(); }); }
  return (urlCache[id] && urlCache[id].url) || "";
}
const clipGone = s => !!s.video && S.now > s.at + E.KEEP_MS;
function videoTag(id, attrs) { const u = mediaUrl(id); if (String(id).startsWith("sbp:") && !u) return `<button type="button" class="btn chalk" data-loadparts="${esc(id)}">Load video (${VID.parts(id).mb} MB)</button>`; return `<video data-asset="${esc(id)}" ${u ? `src="${esc(u)}"` : ""} ${attrs}></video>`; }
function hydrateMedia() { $$("video[data-asset]").forEach(v => { const u = mediaUrl(v.dataset.asset); if (u && v.getAttribute("src") !== u) v.setAttribute("src", u); }); }
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
function supabaseDb(sb) {
  const L = {}, fail = error => ({ code: error && (error.code === "42501" || /row-level security/i.test(error.message || "")) ? "invalid_argument" : "unavailable", message: error && error.message });
  const local = (coll, id, data) => { const l = L[coll]; if (!l) return; if (data === null) l.rows.delete(id); else l.rows.set(id, data); l.emit(); };
  /* the server hands out 1,000 rows at a time; drops pass that after a year or so */
  const fetchAll = async coll => { const all = []; for (let i = 0; ; i++) { const { data, error } = await sb.from("docs").select("id,data").eq("coll", coll).order("id").range(i * 1000, i * 1000 + 999); if (error) return { error }; all.push(...data); if (data.length < 1000) return { data: all }; } };
  return {
    doc(path) { const [coll, id] = path.split("/"); return {
      async set(data) { const { error } = await sb.from("docs").upsert({ coll, id, data, updated_at: new Date().toISOString() }); if (error) throw fail(error); local(coll, id, data); },
      async delete() { const { error } = await sb.from("docs").delete().eq("coll", coll).eq("id", id); if (error) throw fail(error); local(coll, id, null); } }; },
    async refresh(coll) { const l = L[coll]; if (!l) return; const { data, error } = await fetchAll(coll); if (error) return; let ch = false; for (const r of data) { if (JSON.stringify(l.rows.get(r.id)) !== JSON.stringify(r.data)) { l.rows.set(r.id, r.data); ch = true; } } if (ch) l.emit(); },
    collection(coll) { return { onSnapshot(next, onErr) {
      const rows = new Map(), emit = () => next({ docs: [...rows].map(([id, d]) => ({ id, exists: true, data: () => d })), metadata: { fromCache: false } });
      L[coll] = { rows, emit };
      sb.channel("docs-" + coll).on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: `coll=eq.${coll}` }, p => { if (p.eventType === "DELETE") rows.delete(p.old.id); else rows.set(p.new.id, p.new.data); emit(); }).subscribe();
      fetchAll(coll).then(({ data, error }) => { if (error) { if (onErr) onErr(fail(error)); return; } for (const r of data) rows.set(r.id, r.data); emit(); });
    } }; },
  };
}
function supabaseAssets(sb) {
  const bad = error => ({ code: /exceed|too large|413|maximum/i.test(error.message) ? "too_large" : /mime|type/i.test(error.message) ? "unsupported_type" : /quota|limit/i.test(error.message) ? "quota_or_state" : "upstream_error", message: error.message });
  return { async upload(file, { type, onStage = () => {} }) {
    const base = `${S.uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const id = await VID.send(file, type, { base, onStage, upload: async (path, blob, t) => {
      for (let tries = 0; ; tries++) {
        const { error } = await sb.storage.from("videos").upload(path, blob, { contentType: t, upsert: false });
        if (!error || (tries && /exists|duplicate/i.test(error.message))) return;
        const b = bad(error); if (b.code !== "upstream_error" || tries >= 2) throw b;
        await FX.sleep(1500 * (tries + 1));
      }
    } });
    return { id };
  } };
}
async function loadParts(id, btn) {
  btn.disabled = true;
  try {
    const url = await VID.join(id, async p => { const { data } = await S.sb.storage.from("videos").createSignedUrl(p, 3600); return data.signedUrl; }, f => (btn.textContent = `Loading ${Math.round(f * 100)}%`));
    urlCache[id] = { url, exp: Infinity };
    $$(`[data-loadparts="${CSS.escape(id)}"]`).forEach(b => { b.outerHTML = videoTag(id, "controls playsinline autoplay"); });
  } catch (e) { btn.disabled = false; btn.textContent = "Couldn't load it. Try again"; }
}
async function bootSupabase() {
  if (!window.supabase) { try { await loadScript(SUPABASE_JS); } catch (e) { S.mode = "offline"; S.loadFail = true; render(); return null; } }
  const sb = window.supabase.createClient(CONF.supabaseUrl, CONF.supabaseAnonKey); S.sb = sb;
  const { data: { session } } = await sb.auth.getSession();
  sb.auth.onAuthStateChange((ev, sess) => { if (ev === "SIGNED_IN" && S.mode === "signin" && sess) location.replace(location.origin + location.pathname); });
  if (!session) { S.mode = "signin"; render(); return null; }
  S.uid = session.user.id; S.autoName = (session.user.user_metadata && session.user.user_metadata.username) || "";
  const { data: adm } = await sb.from("admins").select("uid").eq("uid", S.uid).maybeSingle();
  S.isOwner = !!adm; S.canWrite = true; S.assets = supabaseAssets(sb);
  return supabaseDb(sb);
}

/* ---------- boot ---------- */
$("#sound-btn").setAttribute("aria-pressed", String(FX.SOUND.on));
FX.startFx();
if (Q.has("demo") && Q.has("now")) E.clock.offset = Date.parse(Q.get("now")) - Date.now();
render(); route();
(async function boot() {
  let db = null;
  if (Q.has("demo")) { const { demo } = await import("./demo.js"); db = demo(S); S.demo = true; }
  else if (window.claude && typeof window.claude.use === "function") {
    const [cdb, user, assets] = await Promise.all([claude.use("db"), claude.use("user"), claude.use("assets")]); db = cdb;
    if (db) { S.user = user; S.assets = assets; if (user) { const [id, own, can] = await Promise.all([user.id(), user.isOwner(), user.can("data.write")]); S.uid = id; S.isOwner = own; S.canWrite = can; } }
  } else if (CONF.supabaseUrl && CONF.supabaseAnonKey) {
    for (const [rel, href] of [["manifest", "manifest.webmanifest"], ["apple-touch-icon", "icon-192.png"]]) { const l = document.createElement("link"); l.rel = rel; l.href = href; document.head.appendChild(l); }
    for (const [name, content] of [["apple-mobile-web-app-capable", "yes"], ["apple-mobile-web-app-title", "Side Gains"], ["apple-mobile-web-app-status-bar-style", "black-translucent"]]) { const m = document.createElement("meta"); m.name = name; m.content = content; document.head.appendChild(m); }
    db = await bootSupabase(); if (!db) return;
  }
  if (!db) { S.mode = "offline"; render(); return; }
  S.db = db; S.mode = "live";
  const timer = setTimeout(() => { if (COLLS.some(n => !S.confirmed[n])) { S.slow = true; scheduleRender(); } }, 10000);
  for (const name of COLLS) db.collection(name).onSnapshot(snap => {
    const o = {}; snap.docs.forEach(d => { if (d.exists) o[d.id] = d.data(); }); S[name] = o;
    if (!snap.metadata.fromCache) S.confirmed[name] = true;
    if (COLLS.every(n => S.confirmed[n])) { clearTimeout(timer); S.slow = false; }
    scheduleRender();
  }, err => { S.err = err.code || "error"; clearTimeout(timer); scheduleRender(); });
  render();
})();
if (Q.has("demo")) window.SG = { S, E, FX, SHOW, rip, openCeremony, render };
