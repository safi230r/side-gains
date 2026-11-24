/* Side Gains rules engine: quests, random drop times, scoring, streaks, seasons, duels, squads, badges.
   Pure functions, no page access, so the site and the notification service share exactly the same rules. */

/* ---------- settings ---------- */
export const CFG = {
  level: "starter",
  tz: "Europe/London",
  firstDrop: 8 * 60,        /* earliest reveal, minutes after midnight */
  lastDrop: 20 * 60 + 30,   /* latest reveal */
  gap: 150,                 /* minimum minutes between the two reveals */
  close: 22 * 60,           /* both quests close */
  since: "2026-11-25",      /* first day with two quests; the database can override it */
  rejects: 1,               /* how many "doesn't count" votes throw a video out */
};
export function configure(c = {}) { for (const k of Object.keys(CFG)) if (c[k] !== undefined) CFG[k] = c[k]; offCache.clear(); }
export const clock = { offset: 0 };
export const now = () => Date.now() + clock.offset;

export const RARITY = {
  common: { label: "Common", base: 100, pips: 1 },
  rare: { label: "Rare", base: 200, pips: 2 },
  epic: { label: "Epic", base: 400, pips: 3 },
  legendary: { label: "Legendary", base: 800, pips: 4 },
};
export const RORDER = ["common", "rare", "epic", "legendary"];
export const PODIUM = [0.5, 0.25, 0.1];
export const LEVELS = {
  easy: { label: "Easy", reps: 0.6, pts: 0.6 },
  normal: { label: "Normal", reps: 1, pts: 1 },
  hard: { label: "Hard", reps: 1.6, pts: 1.5 },
};
export const STREAK_STEP = 10, STREAK_CAP = 50, PENALTY = 100;
export const JUDGE_MS = 24 * 3600e3;
export const KEEP_MS = 48 * 3600e3; /* uploaded videos are deleted after two days */
export const GOAL_BONUS = 50, SQUAD_BONUS = 40;
export const FREEZE_EVERY = 7, FREEZE_MAX = 2;
export const STAKES = [25, 50, 100];
export const DUEL_ACCEPT_MS = 24 * 3600e3, DUEL_MAX_MS = 24 * 3600e3, DUEL_ACTIVE_MAX = 3;
export const REASONS = ["Half reps", "Not the full count", "Wrong move", "Can't see it", "Form broke down", "Wrong or old video"];
export const PROOF = {
  strength: "Film every rep. Cuts between sets are fine; keep your whole body in frame.",
  skill: "Film the full hold with a visible timer or stopwatch in frame.",
};
export const TIERS = [
  { id: "iron", label: "Iron", min: 0 },
  { id: "bronze", label: "Bronze", min: 800 },
  { id: "silver", label: "Silver", min: 2500 },
  { id: "gold", label: "Gold", min: 5000 },
  { id: "diamond", label: "Diamond", min: 8000 },
  { id: "holo", label: "Holo", min: 12000 },
];
export function tierOf(pts) { let i = 0; while (i + 1 < TIERS.length && pts >= TIERS[i + 1].min) i++; const t = TIERS[i], n = TIERS[i + 1] || null; return { ...t, i, next: n, frac: n ? Math.max(0, (pts - t.min) / (n.min - t.min)) : 1 }; }
export function levelOf(xp) {
  const x = Math.max(0, xp), l = Math.floor((Math.sqrt(1 + 8 * x / 250) - 1) / 2) + 1;
  const at = n => 250 * (n - 1) * n / 2;
  return { level: l, from: at(l), to: at(l + 1), frac: (x - at(l)) / (at(l + 1) - at(l)) };
}

/* ---------- moves ---------- */
export const MOVES = {
  pushup: ["Push-up", "arms"], diamond: ["Diamond push-up", "arms"], pike: ["Pike push-up", "arms"], squat: ["Squat", "legs"], lunge: ["Lunge", "legs"],
  pistol: ["Pistol squat", "legs"], burpee: ["Burpee", "full"], climber: ["Mountain climber", "core"], plank: ["Plank", "core"], wallsit: ["Wall sit", "legs"],
  situp: ["Sit-up", "core"], bridge: ["Glute bridge", "legs"], dip: ["Chair dip", "arms"], calf: ["Calf raise", "legs"], superman: ["Superman", "core"], handstand: ["Wall handstand", "arms"],
};
const KEYMAP = [[/pistol/i, "pistol"], [/diamond/i, "diamond"], [/pike/i, "pike"], [/push-?ups?/i, "pushup"], [/burpee/i, "burpee"], [/wall sit/i, "wallsit"], [/squat/i, "squat"], [/lunge/i, "lunge"], [/handstand/i, "handstand"], [/plank/i, "plank"], [/sit-?ups?/i, "situp"], [/bridge/i, "bridge"], [/dip/i, "dip"], [/climber/i, "climber"], [/calf/i, "calf"], [/superman/i, "superman"]];
export function keysFor(text) {
  const out = [];
  for (const part of String(text).split(/·|,|\+| and /)) {
    const hit = KEYMAP.find(([re]) => re.test(part));
    if (hit && !out.includes(hit[1])) out.push(hit[1]);
  }
  return out;
}
const POOL_STANDARD = {
  common: [
    { n: "50", u: "Push-ups", k: "strength", r: "Chest to fist height, full lockout at the top. Split into as many sets as you like." },
    { n: "80", u: "Squats", k: "strength", r: "Hip crease below the knee, stand all the way up." },
    { n: "30", u: "Burpees", k: "strength", r: "Chest touches the floor, jump with hands overhead at the top." },
    { n: "60", u: "Lunges", k: "strength", r: "Half per leg. Back knee kisses the floor." },
    { n: "2:00", u: "Plank total", k: "skill", r: "Accumulate the time in a forearm plank. Hips level the whole time." },
    { n: "60", u: "Sit-ups", k: "strength", r: "Shoulder blades off the floor, hands touch your knees." },
    { n: "30", u: "Pike push-ups", k: "strength", r: "Hips high, head touches the floor in front of your hands." },
    { n: "60", u: "Glute bridges", k: "strength", r: "Squeeze at the top for a second, shoulders stay on the floor." },
    { n: "40", u: "Chair dips", k: "strength", r: "Hands on a sturdy chair or the sofa edge. Elbows to 90 degrees." },
    { n: "1:30", u: "Wall sit total", k: "skill", r: "Thighs parallel to the floor, back flat on the wall. Timer in frame." },
    { n: "80", u: "Mountain climbers", k: "strength", r: "Count each knee drive. Hips stay low." },
    { n: "30", u: "Diamond push-ups", k: "strength", r: "Hands together under your chest, elbows tucked, full lockout." },
    { n: "60", u: "Calf raises", k: "strength", r: "On a step if you have one. Full stretch at the bottom, pause at the top." },
    { n: "40", u: "Superman holds", k: "strength", r: "Lift arms and legs off the floor, hold one second each rep." },
  ],
  rare: [
    { n: "90", u: "Push-ups", k: "strength", r: "Chest to fist height, full lockout. Any number of sets." },
    { n: "50", u: "Burpees", k: "strength", r: "Chest to floor, jump at the top." },
    { n: "20", u: "Pistol squats", k: "strength", r: "Half per leg. Holding a door frame for balance is allowed." },
    { n: "3:00", u: "Plank total", k: "skill", r: "Forearm plank, hips level. Accumulate the full time." },
    { n: "Chipper", u: "30 push-ups · 40 squats · 20 burpees", k: "strength", r: "Finish each movement before starting the next. Rest as needed." },
    { n: "1:00", u: "Wall handstand total", k: "skill", r: "Chest or back to the wall, arms locked. Accumulate the full time." },
  ],
  epic: [
    { n: "99", u: "Push-ups", k: "strength", r: "Clean reps, every one on camera." },
    { n: "75", u: "Burpees", k: "strength", r: "Chest to floor, jump at the top. Any number of sets." },
    { n: "Triple 33", u: "33 push-ups · 33 squats · 33 sit-ups", k: "strength", r: "In any order, any sets. Every rep on camera." },
    { n: "30", u: "Pistol squats", k: "strength", r: "Half per leg. Door frame for balance is allowed." },
  ],
  legendary: [
    { n: "99", u: "Burpees", k: "strength", r: "Chest to floor, jump at the top, every rep on camera." },
    { n: "4:00", u: "Plank, unbroken", k: "skill", r: "One continuous forearm plank. Drop once and the clock restarts." },
  ],
};
const POOL_STARTER = {
  common: [
    { n: "20", u: "Push-ups", k: "strength", r: "Chest to fist height, full lockout. Knees on the floor is fine to start." },
    { n: "30", u: "Squats", k: "strength", r: "Hip crease to knee height or lower, stand all the way up." },
    { n: "10", u: "Burpees", k: "strength", r: "Chest to the floor, small jump at the top. Take your time." },
    { n: "20", u: "Lunges", k: "strength", r: "Half per leg. Back knee close to the floor." },
    { n: "0:45", u: "Plank", k: "skill", r: "Forearm plank, hips level. Breaks allowed until you reach the total." },
    { n: "25", u: "Sit-ups", k: "strength", r: "Shoulder blades off the floor, hands touch your knees." },
    { n: "25", u: "Glute bridges", k: "strength", r: "Squeeze at the top for a second, shoulders stay on the floor." },
    { n: "15", u: "Chair dips", k: "strength", r: "Hands on a sturdy chair or sofa edge. Elbows to about 90 degrees." },
    { n: "0:45", u: "Wall sit", k: "skill", r: "Back flat on the wall, thighs as close to parallel as you can." },
    { n: "30", u: "Mountain climbers", k: "strength", r: "Count each knee drive. Steady pace is fine." },
    { n: "30", u: "Calf raises", k: "strength", r: "Rise high, pause, lower slowly." },
    { n: "15", u: "Superman holds", k: "strength", r: "Lift arms and legs, hold one second each rep." },
    { n: "10", u: "Pike push-ups", k: "strength", r: "Hips high, lower your head toward the floor in front of your hands." },
  ],
  rare: [
    { n: "35", u: "Push-ups", k: "strength", r: "Chest to fist height, full lockout. Any number of sets." },
    { n: "50", u: "Squats", k: "strength", r: "Hip crease to knee height or lower. Any number of sets." },
    { n: "15", u: "Burpees", k: "strength", r: "Chest to the floor, jump at the top." },
    { n: "1:15", u: "Plank", k: "skill", r: "Forearm plank. Breaks allowed until you hit the total." },
    { n: "1:00", u: "Wall sit", k: "skill", r: "Thighs parallel if you can. Breaks allowed until you hit the total." },
  ],
  epic: [
    { n: "50", u: "Push-ups", k: "strength", r: "Any number of sets across the day. Every rep on camera." },
    { n: "25", u: "Burpees", k: "strength", r: "Chest to the floor, jump at the top. Rest as needed." },
    { n: "75", u: "Squats", k: "strength", r: "Any number of sets. Every rep on camera." },
  ],
  legendary: [
    { n: "40", u: "Burpees", k: "strength", r: "Any number of sets. Chest to the floor every rep." },
    { n: "2:00", u: "Plank", k: "skill", r: "Forearm plank. Breaks allowed until you hit the full total." },
  ],
};
export const pool = () => (CFG.level === "standard" ? POOL_STANDARD : POOL_STARTER);

/* ---------- random ---------- */
export function rngFor(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

/* ---------- time, always in the crew's time zone so a drop hits everyone at once ---------- */
const fmtCache = {};
function tzParts(ts) {
  const f = fmtCache[CFG.tz] ||= new Intl.DateTimeFormat("en-CA", { timeZone: CFG.tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const o = {}; for (const p of f.formatToParts(ts)) o[p.type] = Number(p.value); return o;
}
const offCache = new Map();
function tzOffset(ts) {
  const b = Math.floor(ts / 9e5);
  let v = offCache.get(b);
  if (v === undefined) { const p = tzParts(b * 9e5); v = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - b * 9e5; offCache.set(b, v); }
  return v;
}
export const keyAt = ts => new Date(ts + tzOffset(ts)).toISOString().slice(0, 10);
export const minutesAt = ts => { const d = new Date(ts + tzOffset(ts)); return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60; };
export function tsOf(key, min = 0) { const g = Date.parse(key + "T00:00:00Z") + min * 6e4; return g - tzOffset(g - tzOffset(g)); }
export const shiftKey = (k, n) => new Date(Date.parse(k + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
export const dowOf = k => (new Date(k + "T00:00:00Z").getUTCDay() + 6) % 7;
export const weekOf = k => shiftKey(k, -dowOf(k));
export const seasonOf = k => k.slice(0, 7);
export const hourLabel = m => { const h = Math.floor(m / 60) % 24, mm = Math.round(m % 60); return `${h % 12 || 12}${mm ? ":" + String(mm).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`; };

/* ---------- drops ---------- */
/* qid: "2026-11-25a" / "2026-11-25b"; days before `since` have one quest whose qid is just the date */
export const dateOfQ = q => q.slice(0, 10);
export const slotOfQ = q => q.slice(10);
export const sinceOf = W => (W.meta && W.meta.engine && W.meta.engine.since) || CFG.since;
export const serverDrops = W => !!(W.meta && W.meta.engine && W.meta.engine.drops);
export const slotsOf = (W, date) => (date < sinceOf(W) ? [date] : [date + "a", date + "b"]);
/* two random minutes between firstDrop and lastDrop, at least `gap` apart */
export function planMinutes(r) {
  const span = CFG.lastDrop - CFG.firstDrop - CFG.gap, u = r() * span, v = r() * span;
  return [Math.floor(CFG.firstDrop + Math.min(u, v)), Math.floor(CFG.firstDrop + Math.max(u, v) + CFG.gap)];
}
/* the raw drop, or null when it hasn't happened (or its time is still secret) */
export function dropOf(W, qid) {
  const date = dateOfQ(qid), slot = slotOfQ(qid);
  if (!slot) { const at = tsOf(date, 12 * 60); return W.now >= at ? { at, close: tsOf(date, 22 * 60), seed: "sidegains:" + date } : null; }
  const row = W.drops && W.drops[qid];
  if (row && Number(row.at)) return W.now >= Number(row.at) ? { at: Number(row.at), close: Number(row.close) || tsOf(date, CFG.close), seed: String(row.seed || qid) } : null;
  if (serverDrops(W) && date >= sinceOf(W)) return null;
  const at = tsOf(date, planMinutes(rngFor("drop:" + date))[slot === "a" ? 0 : 1]);
  return W.now >= at ? { at, close: tsOf(date, CFG.close), seed: "local:" + qid } : null;
}
function roll(seed, avoid) {
  const rnd = rngFor(seed), x = rnd();
  const rarity = x < 0.012 ? "legendary" : x < 0.06 ? "epic" : x < 0.22 ? "rare" : "common";
  const list = pool()[rarity];
  let i = Math.floor(rnd() * list.length);
  if (avoid && list.length > 1 && list[i].u === avoid) i = (i + 1) % list.length;
  return { ...list[i], rarity, custom: false };
}
const FACTOR = { common: 1, rare: 1.7, epic: 2.5, legendary: 3.5 };
function moveQuest(u, rarity) {
  const P = pool(), exact = P[rarity].find(x => x.u === u);
  if (exact) return { ...exact, rarity, custom: false };
  for (const r of RORDER) { const hit = P[r].find(x => x.u === u); if (hit) return { ...hit, n: scaleText(hit.n, FACTOR[rarity] / FACTOR[r]), rarity, custom: false }; }
  return null;
}
export const pickable = () => [...new Set(Object.values(pool()).flat().filter(x => /^[\d:]+$/.test(x.n)).map(x => x.u))];
/* base quest: before any winner's power. Powers never change rarity, so scores don't depend on them. */
export function baseQuest(W, qid) {
  const o = W.quests && W.quests[qid];
  if (o && o.n && RARITY[o.rarity]) return { n: String(o.n), u: String(o.u || ""), k: PROOF[o.k] ? o.k : "strength", r: String(o.r || ""), rarity: o.rarity, custom: true };
  const d = dropOf(W, qid);
  const seed = d ? d.seed : "local:" + qid;
  let avoid = null;
  if (slotOfQ(qid) === "b") { const a = dropOf(W, dateOfQ(qid) + "a"); if (a) avoid = roll(a.seed).u; }
  return roll(seed, avoid);
}
export function questFor(W, qid) {
  const b = baseQuest(W, qid), p = W.powers_ && W.powers_[qid];
  if (!p || b.custom) return b;
  if (p.kind === "pick") { const m = moveQuest(p.move, b.rarity); return m ? { ...m, power: p } : b; }
  const d = dropOf(W, qid); if (!d) return b;
  const list = pool()[b.rarity].filter(x => x.u !== b.u), rnd = rngFor(d.seed + ":veto");
  return list.length ? { ...list[Math.floor(rnd() * list.length)], rarity: b.rarity, custom: false, power: p } : b;
}

/* ---------- difficulty levels ---------- */
function niceRound(v) { return v >= 15 ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v)); }
export function scaleText(s, k) {
  s = String(s);
  if (k === 1) return s;
  const t = /^(\d+):(\d\d)$/.exec(s);
  if (t) { const v = Math.max(10, Math.round((+t[1] * 60 + +t[2]) * k / 5) * 5); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`; }
  if (/^\d+$/.test(s)) return String(niceRound(+s * k));
  return s.replace(/\d+/g, m => String(niceRound(+m * k)));
}
export function atLevel(q, lv) {
  const L = LEVELS[lv] || LEVELS.normal;
  if (L.reps === 1) return q;
  const named = !/^[\d:]+$/.test(q.n);
  return { ...q, n: named && !/\d/.test(q.n) ? q.n : scaleText(q.n, L.reps), u: named ? scaleText(q.u, L.reps) : q.u };
}
/* how much work a quest is: reps, or seconds for holds (2 seconds count as one rep in crew totals) */
export function workOf(q, lv) {
  const x = atLevel(q, lv), t = /^(\d+):(\d\d)$/.exec(x.n);
  if (t) { const v = +t[1] * 60 + +t[2]; return { hold: true, v, reps: Math.round(v / 2) }; }
  if (/^\d+$/.test(x.n)) return { hold: false, v: +x.n, reps: +x.n };
  const sum = (String(x.u).match(/\d+/g) || []).reduce((a, b) => a + +b, 0);
  return { hold: false, v: sum, reps: sum };
}
export const questTitle = q => (/^[\d.,:]/.test(q.n) ? `${q.n} ${q.u}` : q.n);

/* ---------- punishments ---------- */
const PUNISH = {
  standard: [["75 burpees, one session", "No breaks longer than a minute. One continuous video."], ["2-minute cold shower", "Fully cold, head under. Timer visible on camera."], ["60 push-ups with a loaded backpack", "Books or water bottles in the bag. Show it before you start."], ["3-minute wall sit", "Thighs parallel to the floor. Timer in frame."], ["3-minute plank, unbroken", "Forearm plank. Drop once and the clock restarts."], ["80 jump squats", "Feet leave the floor every rep. All on camera."], ["50 push-ups while singing", "Sing between every set of 10. Loud enough to hear."]],
  starter: [["30 burpees, one session", "No breaks longer than a minute. One continuous video."], ["1-minute cold shower", "Fully cold, head under. Timer visible on camera."], ["2-minute wall sit", "Thighs as close to parallel as you can. Timer in frame."], ["2-minute plank", "Forearm plank. Breaks allowed, timer in frame."], ["40 jump squats", "Feet leave the floor every rep."], ["30 push-ups while singing", "Sing between every set of 10. Loud enough to hear."]],
};
const fallbackPunishment = (wk, uid) => { const l = PUNISH[CFG.level === "standard" ? "standard" : "starter"], p = l[Math.floor(rngFor("pen:" + wk + ":" + uid)() * l.length)]; return { t: p[0], r: p[1] }; };
export function ideasFor(W, wk) {
  const list = [];
  for (const [uid, doc] of Object.entries(W.ideas || {})) {
    const x = W.members[uid] && doc && doc.w && doc.w[wk];
    if (x && x.t) list.push({ uid, t: String(x.t), r: String(x.r || ""), at: Number(x.at) || 0, votes: [] });
  }
  for (const [voter, doc] of Object.entries(W.ivotes || {})) {
    const target = W.members[voter] && doc && doc.w && doc.w[wk];
    const idea = target && target !== voter && list.find(i => i.uid === target);
    if (idea) idea.votes.push(voter);
  }
  return list.sort((a, b) => b.votes.length - a.votes.length || a.at - b.at);
}
export function punishmentFor(W, wk, uid) { const c = ideasFor(W, wk)[0]; return c ? { t: c.t, r: c.r, by: c.uid } : fallbackPunishment(wk, uid); }

/* ---------- squads ---------- */
const SQ_A = ["Iron", "Savage", "Chalk", "Midnight", "Turbo", "Feral", "Golden", "Rogue", "Heavy", "Electric", "Granite", "Wild"];
const SQ_B = ["Goats", "Wolves", "Kettlebells", "Gorillas", "Engines", "Hammers", "Cobras", "Bulls", "Rockets", "Yetis", "Rhinos", "Panthers"];
export function squadsFor(W, wk) {
  const cutoff = tsOf(shiftKey(wk, 1));
  const ids = Object.keys(W.members).filter(id => (Number(W.members[id].joined) || 0) < cutoff).sort();
  if (ids.length < 4) return [];
  const r = rngFor("squads:" + wk);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const n = Math.floor(ids.length / 2), out = [], used = new Set();
  for (let i = 0; i < n; i++) {
    let name; do { name = SQ_A[Math.floor(r() * SQ_A.length)] + " " + SQ_B[Math.floor(r() * SQ_B.length)]; } while (used.has(name));
    used.add(name);
    out.push({ name, ids: i === n - 1 ? ids.slice(i * 2) : ids.slice(i * 2, i * 2 + 2) });
  }
  return out;
}

/* ---------- badges (order matches the enamel pin artwork) ---------- */
export const BADGES = [
  { id: "fire", n: "On fire", d: "Hold a 7-day streak", goal: 7, v: s => s.best },
  { id: "bolt", n: "Lightning", d: "Finish within 15 minutes of a drop", goal: 1, v: s => s.quick },
  { id: "chalk", n: "Chalked up", d: "Get your first quest counted", goal: 1, v: s => s.countAll },
  { id: "ice", n: "Ice cold", d: "Have a freeze save your streak", goal: 1, v: s => s.frozen.length },
  { id: "crown", n: "Week winner", d: "Win a weekly board", goal: 1, v: s => s.weeksWon },
  { id: "kettle", n: "No mercy", d: "Finish 10 Hard versions", goal: 10, v: s => s.hard },
  { id: "watch", n: "First blood", d: "Finish first 10 times", goal: 10, v: s => s.firstsAll },
  { id: "swords", n: "Duelist", d: "Win 3 duels", goal: 3, v: s => s.duelW },
  { id: "arms", n: "Push machine", d: "500 arm reps", goal: 500, v: s => s.groups.arms },
  { id: "legs", n: "Leg day", d: "500 leg reps", goal: 500, v: s => s.groups.legs },
  { id: "core", n: "Core memory", d: "500 core reps or 1,000 seconds held", goal: 500, v: s => s.groups.core },
  { id: "trophy", n: "Champion", d: "Win a monthly season", goal: 1, v: s => s.seasonsWon },
  { id: "red", n: "Debt paid", d: "Clear a punishment", goal: 1, v: s => s.pensCleared },
  { id: "shaker", n: "Team shake", d: "Help fill the crew shaker 3 times", goal: 3, v: s => s.goalsHit },
  { id: "hype", n: "Hype crew", d: "Give 25 reactions", goal: 25, v: s => s.given },
  { id: "gem", n: "Mythic", d: "Finish a Legendary quest", goal: 1, v: s => s.byRarity.legendary },
];

/* ---------- the whole scoreboard ---------- */
export function compute(W) {
  const t = W.now, today = keyAt(t), wk = weekOf(today), season = seasonOf(today);
  const memberIds = Object.keys(W.members || {});
  const M = W.members || {};
  W.powers_ = {};

  /* 1. collect every video */
  const subs = [];
  const push = (o, x) => subs.push({ ...o, at: Number(x.at) || 0, video: x.video || null, link: /^https:\/\/[^\s"'<>]+$/i.test(x.link || "") ? x.link : null, note: x.note ? String(x.note) : "" });
  for (const [uid, doc] of Object.entries(W.subs || {})) {
    if (!M[uid]) continue;
    for (const [qid, x] of Object.entries((doc && doc.e) || {})) {
      if (!x || typeof x !== "object") continue;
      const tries = Number(x.n) || 0;
      push({ kind: "quest", key: qid + "_" + uid + (tries ? "_" + tries : ""), uid, qid, date: dateOfQ(qid), lv: LEVELS[x.lv] ? x.lv : "normal", tries }, x);
    }
  }
  for (const [uid, doc] of Object.entries(W.pens || {})) {
    if (!M[uid]) continue;
    for (const [w, x] of Object.entries((doc && doc.e) || {})) {
      if (!x || typeof x !== "object") continue;
      push({ kind: "pen", key: `pen-${w}_${uid}_${Number(x.at) || 0}`, uid, date: w, label: "Punishment: " + punishmentFor(W, w, uid).t }, x);
    }
  }

  /* 2. duels: who challenged whom, and any max-rep attempts */
  const duels = [];
  for (const [uid, doc] of Object.entries(W.duels || {})) {
    if (!M[uid]) continue;
    for (const [id, x] of Object.entries((doc && doc.d) || {})) {
      if (!x || !M[x.to] || x.to === uid) continue;
      const rdoc = (W.duels[x.to] && W.duels[x.to].r && W.duels[x.to].r[id]) || null;
      const d = { id, a: uid, b: x.to, type: ["race", "week", "max"].includes(x.type) ? x.type : "race", stake: STAKES.includes(Number(x.stake)) ? Number(x.stake) : 25, move: MOVES[x.move] ? x.move : "pushup", at: Number(x.at) || 0 };
      d.state = rdoc ? (rdoc.v > 0 ? "on" : "declined") : t > d.at + DUEL_ACCEPT_MS ? "expired" : "open";
      d.onAt = rdoc && rdoc.v > 0 ? Number(rdoc.at) || d.at : 0;
      if (d.state === "on" && d.type === "max") {
        d.ends = d.onAt + DUEL_MAX_MS;
        for (const who of [d.a, d.b]) {
          const e = W.duels[who] && W.duels[who].m && W.duels[who].m[id];
          if (e && Number(e.at) <= d.ends) { push({ kind: "duel", key: `duel-${id}_${who}`, uid: who, date: keyAt(Number(e.at) || d.onAt), duel: id, reps: Math.max(0, Math.round(Number(e.n) || 0)), label: `Duel: ${Math.round(Number(e.n) || 0)} ${MOVES[d.move][0].toLowerCase()}s in 60 s` }, e); }
        }
      }
      duels.push(d);
    }
  }

  /* 3. judging: a video counts unless someone says it doesn't, within 24 hours */
  const noes = {};
  for (const [voter, doc] of Object.entries(W.votes || {})) {
    if (!M[voter]) continue;
    for (const [k, val] of Object.entries((doc && doc.v) || {})) if (val < 0) { const w = (doc.why && doc.why[k]) || {}; (noes[k] ||= []).push({ uid: voter, why: w.r || "", at: Number(w.at) || 0 }); }
  }
  const subByKey = {};
  for (const s of subs) {
    s.no = (noes[s.key] || []).filter(n => n.uid !== s.uid && (!n.at || n.at <= s.at + JUDGE_MS));
    s.status = s.no.length >= CFG.rejects ? "rejected" : "approved";
    s.locked = t > s.at + JUDGE_MS;
    if (s.kind === "quest") { s.quest = baseQuest(W, s.qid); s.drop = dropOf(W, s.qid); }
    subByKey[s.key] = s;
  }

  /* 4. reactions and comments */
  const cutReact = {};
  for (const s of subs) { s.reacts = []; s.comments = []; }
  for (const [uid, doc] of Object.entries(W.reacts || {})) {
    if (!M[uid]) continue;
    for (const [k, i] of Object.entries((doc && doc.r) || {})) if (subByKey[k]) { subByKey[k].reacts.push({ uid, i: Number(i) || 0 }); cutReact[uid] = (cutReact[uid] || 0) + (subByKey[k].uid !== uid ? 1 : 0); }
  }
  for (const [uid, doc] of Object.entries(W.comments || {})) {
    if (!M[uid]) continue;
    for (const [k, list] of Object.entries((doc && doc.c) || {})) if (subByKey[k] && Array.isArray(list)) for (const c of list) subByKey[k].comments.push({ uid, t: String(c.t || "").slice(0, 200), at: Number(c.at) || 0 });
  }
  for (const s of subs) s.comments.sort((a, b) => a.at - b.at);

  /* 5. places and daily streaks (with freezes) */
  const byQ = {}, days = {};
  for (const s of subs) if (s.kind === "quest") (byQ[s.qid] ||= []).push(s);
  for (const list of Object.values(byQ)) { list.sort((a, b) => a.at - b.at); list.filter(s => s.status === "approved").forEach((s, i) => { s.place = i + 1; (days[s.uid] ||= new Set()).add(s.date); }); }
  const streaks = {};
  for (const id of memberIds) {
    const set = days[id], out = { cur: 0, best: 0, freezes: 0, frozen: [], at: {}, toFreeze: FREEZE_EVERY };
    if (set && set.size) {
      let s = 0, fr = 0;
      for (let d = [...set].sort()[0]; d <= today; d = shiftKey(d, 1)) {
        if (set.has(d)) { s++; if (s % FREEZE_EVERY === 0 && fr < FREEZE_MAX) fr++; }
        else if (d === today) { /* still time */ }
        else if (s > 0 && fr > 0) { fr--; out.frozen.push(d); }
        else s = 0;
        out.at[d] = s; out.best = Math.max(out.best, s);
      }
      out.cur = s; out.freezes = fr; out.toFreeze = FREEZE_EVERY - (s % FREEZE_EVERY); out.doneToday = set.has(today);
    }
    streaks[id] = out;
  }

  /* 6. points */
  const weekPts = {}, seasonPts = {}, weekQuest = {}, dayPts = {};
  const blank = id => ({ id, all: 0, week: 0, season: 0, countAll: 0, countWeek: 0, countSeason: 0, firstsAll: 0, firstsWeek: 0, firstsSeason: 0, best: streaks[id].best, cur: streaks[id].cur, freezes: streaks[id].freezes, frozen: streaks[id].frozen, toFreeze: streaks[id].toFreeze, doneToday: !!streaks[id].doneToday, fails: 0, quick: 0, fastest: null, hard: 0, rejected: 0, byRarity: { common: 0, rare: 0, epic: 0, legendary: 0 }, groups: { arms: 0, legs: 0, core: 0, full: 0 }, moves: {}, reps: 0, secs: 0, bestDay: 0, bestWeek: 0, duelW: 0, duelL: 0, duelPts: 0, weeksWon: 0, seasonsWon: 0, goalsHit: 0, pensCleared: 0, given: cutReact[id] || 0, received: 0 });
  const stats = {}; for (const id of memberIds) stats[id] = blank(id);
  const add = (uid, date, pts) => {
    const st = stats[uid]; if (!st) return;
    const w = weekOf(date), se = seasonOf(date);
    st.all += pts; if (w === wk) st.week += pts; if (se === season) st.season += pts;
    (weekPts[w] ||= {})[uid] = (weekPts[w][uid] || 0) + pts;
    (seasonPts[se] ||= {})[uid] = (seasonPts[se][uid] || 0) + pts;
    const dk = uid + date; dayPts[dk] = (dayPts[dk] || 0) + pts; st.bestDay = Math.max(st.bestDay, dayPts[dk]);
  };
  const ordered = subs.filter(s => s.kind === "quest").sort((a, b) => a.at - b.at), bonusDone = new Set();
  for (const s of ordered) {
    const st = stats[s.uid]; if (!st) continue;
    if (s.status !== "approved") { st.rejected++; continue; }
    const base = RARITY[s.quest.rarity].base * LEVELS[s.lv].pts, streak = streaks[s.uid].at[s.date] || 1;
    const dk = s.uid + s.date, firstOfDay = !bonusDone.has(dk); bonusDone.add(dk);
    s.streak = streak;
    s.parts = { base: Math.round(base), speed: Math.round(base * (PODIUM[s.place - 1] || 0)), streak: firstOfDay ? Math.min((streak - 1) * STREAK_STEP, STREAK_CAP) : 0 };
    s.points = s.parts.base + s.parts.speed + s.parts.streak;
    s.work = workOf(s.quest, s.lv);
    s.response = s.drop ? s.at - s.drop.at : null;
    add(s.uid, s.date, s.points);
    const w = weekOf(s.date); (weekQuest[w] ||= {})[s.uid] = (weekQuest[w][s.uid] || 0) + s.points;
    st.countAll++; if (w === wk) st.countWeek++; if (seasonOf(s.date) === season) st.countSeason++;
    if (s.place === 1) { st.firstsAll++; if (w === wk) st.firstsWeek++; if (seasonOf(s.date) === season) st.firstsSeason++; }
    if (s.lv === "hard") st.hard++;
    st.byRarity[s.quest.rarity]++;
    if (s.response !== null && s.response >= 0) { if (s.response <= 15 * 6e4) st.quick++; if (st.fastest === null || s.response < st.fastest) st.fastest = s.response; }
    st.reps += s.work.hold ? 0 : s.work.v; st.secs += s.work.hold ? s.work.v : 0;
    const keys = keysFor(s.quest.u + " · " + s.quest.n);
    for (const k of keys) { st.groups[MOVES[k][1]] += Math.round(s.work.reps / keys.length); const m = (st.moves[k] ||= { best: 0, total: 0, hold: s.work.hold, n: 0 }); m.n++; m.total += s.work.v; if (keys.length === 1) m.best = Math.max(m.best, s.work.v); }
  }
  for (const s of subs) if (stats[s.uid]) stats[s.uid].received += s.reacts.filter(r => r.uid !== s.uid).length;

  /* 7. crew shaker: weekly total reps together */
  const weeksSeen = [...new Set([...Object.keys(weekQuest), wk])].sort();
  const goals = {};
  for (const w of weeksSeen) {
    const end = tsOf(shiftKey(w, 7)), n = memberIds.filter(id => (Number(M[id].joined) || 0) < end).length;
    const g = { wk: w, target: Math.max(100, Math.round(n * 14 * 22 * .5 / 50) * 50), total: 0, by: {}, hitOn: null };
    for (const s of ordered) if (s.status === "approved" && weekOf(s.date) === w) { g.total += s.work.reps; g.by[s.uid] = (g.by[s.uid] || 0) + s.work.reps; if (!g.hitOn && g.total >= g.target) g.hitOn = s.date; }
    if (g.hitOn) for (const id of Object.keys(g.by)) { add(id, g.hitOn, GOAL_BONUS); stats[id].goalsHit++; }
    goals[w] = g;
  }

  /* 8. squads */
  const squads = {};
  for (const w of weeksSeen) {
    const list = squadsFor(W, w).map(q => ({ ...q, pts: q.ids.reduce((n, id) => n + ((weekQuest[w] && weekQuest[w][id]) || 0), 0) })).map(q => ({ ...q, avg: Math.round(q.pts / q.ids.length) })).sort((a, b) => b.avg - a.avg);
    squads[w] = list;
    if (w < wk && list.length > 1 && list[0].avg > 0 && list[0].avg > list[1].avg) { list[0].won = true; for (const id of list[0].ids) add(id, shiftKey(w, 6), SQUAD_BONUS); }
  }

  /* 9. duels: settle */
  const knownDrops = [...new Set([...Object.keys(W.drops || {}), ...Array.from({ length: 10 }, (_, i) => slotsOf(W, shiftKey(today, -i))).flat()])].map(q => ({ q, d: dropOf(W, q) })).filter(x => x.d).sort((a, b) => a.d.at - b.d.at);
  for (const d of duels) {
    d.score = { [d.a]: 0, [d.b]: 0 }; d.winner = null; d.over = false;
    if (d.state !== "on") continue;
    if (d.type === "race") {
      const nx = knownDrops.find(x => x.d.at > d.onAt);
      if (nx) {
        d.qid = nx.q; d.ends = nx.d.close;
        const f = id => (byQ[nx.q] || []).find(s => s.uid === id && s.status === "approved"), sa = f(d.a), sb = f(d.b);
        d.times = { [d.a]: sa ? sa.response : null, [d.b]: sb ? sb.response : null };
        if (sa && sb) { d.over = true; d.winner = sa.at <= sb.at ? d.a : d.b; }
        else if (t >= d.ends) { d.over = true; d.winner = sa ? d.a : sb ? d.b : null; }
        d.resolved = dateOfQ(nx.q);
      }
    } else if (d.type === "week") {
      const w = weekOf(keyAt(d.onAt)), end = tsOf(shiftKey(w, 7)); d.ends = end;
      for (const s of ordered) if (s.status === "approved" && (s.uid === d.a || s.uid === d.b) && s.at >= d.onAt && s.at < end) d.score[s.uid] += s.points;
      if (t >= end) { d.over = true; d.winner = d.score[d.a] === d.score[d.b] ? null : d.score[d.a] > d.score[d.b] ? d.a : d.b; }
      d.resolved = shiftKey(w, 6);
    } else {
      const f = id => subs.find(s => s.kind === "duel" && s.duel === d.id && s.uid === id), sa = f(d.a), sb = f(d.b);
      const v = s => (s && s.status === "approved" ? s.reps : 0);
      d.score = { [d.a]: v(sa), [d.b]: v(sb) }; d.entry = { [d.a]: sa || null, [d.b]: sb || null };
      if ((sa && sb) || t >= d.ends) { d.over = true; d.winner = d.score[d.a] === d.score[d.b] ? null : d.score[d.a] > d.score[d.b] ? d.a : d.b; }
      d.resolved = keyAt(Math.min(t, d.ends));
    }
    if (d.over && d.winner) {
      const l = d.winner === d.a ? d.b : d.a;
      add(d.winner, d.resolved, d.stake); add(l, d.resolved, -d.stake);
      stats[d.winner].duelW++; stats[d.winner].duelPts += d.stake; stats[l].duelL++; stats[l].duelPts -= d.stake;
    }
  }
  duels.sort((a, b) => b.at - a.at);

  /* 10. last place owes a punishment, due by the end of the following week */
  const bottomOf = w => {
    const cutoff = tsOf(shiftKey(w, 3));
    const elig = memberIds.filter(id => (Number(M[id].joined) || 0) < cutoff);
    if (elig.length < 2) return [];
    const pts = elig.map(id => (weekPts[w] && weekPts[w][id]) || 0), min = Math.min(...pts);
    if (min === Math.max(...pts)) return [];
    return elig.filter((id, i) => pts[i] === min).map(id => ({ id, pts: min }));
  };
  const pens = [];
  for (const w of Object.keys(weekPts).filter(w => w < wk).sort()) for (const b of bottomOf(w)) {
    const due = shiftKey(w, 13);
    const proofs = subs.filter(s => s.kind === "pen" && s.uid === b.id && s.date === w).sort((a, c) => c.at - a.at), proof = proofs[0] || null;
    let state = proof ? (proof.status === "approved" ? "cleared" : "redo") : "owed";
    if (state !== "cleared" && today > due) { state = "failed"; add(b.id, shiftKey(due, 1), -PENALTY); stats[b.id].fails++; }
    if (state === "cleared") stats[b.id].pensCleared++;
    pens.push({ wk: w, uid: b.id, pts: b.pts, due, proof, state, task: punishmentFor(W, w, b.id) });
  }

  /* 11. winners */
  const firstsIn = (w, id) => ordered.filter(s => s.uid === id && s.place === 1 && weekOf(s.date) === w).length;
  const rankWeek = w => memberIds.map(id => ({ id, pts: (weekPts[w] && weekPts[w][id]) || 0, f: firstsIn(w, id) })).sort((a, b) => b.pts - a.pts || b.f - a.f || String(M[a.id].name).localeCompare(String(M[b.id].name)));
  const weekWinner = {};
  for (const w of Object.keys(weekPts)) { const r = rankWeek(w)[0]; if (r && r.pts > 0) { weekWinner[w] = r.id; if (w < wk) stats[r.id].weeksWon++; } for (const id of memberIds) stats[id].bestWeek = Math.max(stats[id].bestWeek, (weekPts[w][id]) || 0); }
  const hall = [];
  for (const se of Object.keys(seasonPts).filter(x => x < season).sort()) { const r = Object.entries(seasonPts[se]).filter(([id]) => stats[id]).sort((a, b) => b[1] - a[1])[0]; if (r && r[1] > 0) { hall.push({ season: se, id: r[0], pts: r[1] }); stats[r[0]].seasonsWon++; } }

  /* 12. winner's power: last week's winner may pick one upcoming move or veto one live quest */
  const powerLog = {};
  for (const [uid, doc] of Object.entries(W.powers || {})) for (const [w, p] of Object.entries((doc && doc.p) || {})) {
    if (!p || weekWinner[shiftKey(w, -7)] !== uid || !p.qid || weekOf(dateOfQ(p.qid)) !== w) continue;
    const d = dropOf(W, p.qid);
    if (p.kind === "pick" && d && d.at < p.at) continue;
    if (p.kind === "veto" && (!d || d.at > p.at || (byQ[p.qid] || []).some(s => s.at < p.at))) continue;
    powerLog[w] = { uid, kind: p.kind, qid: p.qid, move: p.move, at: p.at };
    W.powers_[p.qid] = powerLog[w];
  }
  for (const s of subs) if (s.kind === "quest") { s.quest = questFor(W, s.qid); s.shown = atLevel(s.quest, s.lv); s.label = questTitle(s.shown); }
  const powerHolder = weekWinner[shiftKey(wk, -7)] || null;

  /* 13. today's two slots */
  const slots = slotsOf(W, today).map(qid => {
    const drop = dropOf(W, qid), quest = drop ? questFor(W, qid) : null;
    return { qid, slot: slotOfQ(qid), drop, quest, state: !drop ? (t >= tsOf(today, CFG.close) ? "none" : "waiting") : t >= drop.close ? "closed" : "open", list: byQ[qid] || [] };
  });

  return { now: t, today, wk, season, memberIds, subs, subByKey, byQ, stats, streaks, weekPts, seasonPts, dayPts, weekQuest, goals, squads, duels, pens, danger: bottomOf(wk).map(b => b.id), rankWeek, weekWinner, hall, powerLog, powerHolder, powerUsed: powerLog[wk] || null, slots };
}

/* which week the Sunday ceremony celebrates right now, or null */
export function ceremonyWeek(W, C) {
  const sunClose = tsOf(shiftKey(C.wk, 6), CFG.close);
  const w = C.now >= sunClose ? C.wk : shiftKey(C.wk, -7);
  return C.weekPts[w] && Object.values(C.weekPts[w]).some(v => v > 0) ? w : null;
}
export function ceremonyData(W, C, w) {
  const rank = C.rankWeek(w), week = C.subs.filter(s => s.kind === "quest" && s.status === "approved" && weekOf(s.date) === w);
  const top = f => { const m = {}; for (const s of week) { const v = f(s); if (v) m[s.uid] = (m[s.uid] || 0) + v; } const e = Object.entries(m).sort((a, b) => b[1] - a[1])[0]; return e ? { id: e[0], v: e[1] } : null; };
  const quick = week.filter(s => s.response !== null && s.response >= 0).sort((a, b) => a.response - b.response)[0];
  const last = rank.filter(r => r.pts === rank[rank.length - 1].pts);
  const isFinished = w < C.wk || C.now >= tsOf(shiftKey(w, 6), CFG.close);
  return { wk: w, rank, week, total: week.reduce((n, s) => n + s.work.reps, 0), goal: C.goals[w], squads: C.squads[w] || [], isFinished,
    awards: { reps: top(s => s.work.reps), firsts: top(s => (s.place === 1 ? 1 : 0)), loved: top(s => s.reacts.filter(r => r.uid !== s.uid).length), hard: top(s => (s.lv === "hard" ? 1 : 0)), quick: quick ? { id: quick.uid, v: quick.response } : null },
    last: rank.length > 1 && rank[0].pts !== rank[rank.length - 1].pts ? last.map(r => r.id) : [] };
}
