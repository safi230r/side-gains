/* Demo crew for trying the site without touching the real database: open side-gains.html?demo
   Optional: &now=2026-11-26T18:30:00Z pretends it's that moment. Everything lives in memory. */
import * as E from "./engine.js";

export function demo(S) {
  const solo = new URLSearchParams(location.search).has("few");
  const t = E.now(), today = E.keyAt(t), r = E.rngFor("demo-crew");
  E.configure({ since: E.shiftKey(today, -40) });
  const people = [["me", "GoonerMaister", .86], ["u2", "Jose", .8], ["u3", "Mikey", .66], ["u4", "Tariq", .72], ["u5", "Benji", .42]].slice(0, solo ? 2 : 5);
  const D = { members: {}, subs: {}, votes: {}, quests: {}, pens: {}, ideas: {}, ivotes: {}, habits: {}, push: {}, drops: {}, meta: {}, reacts: {}, comments: {}, duels: {}, powers: {} };
  const W = { ...D, now: t };
  for (const [id, name] of people) { D.members[id] = { name, joined: E.tsOf(E.shiftKey(today, -39)) }; D.subs[id] = { e: {} }; D.reacts[id] = { r: {} }; D.comments[id] = { c: {} }; D.votes[id] = { v: {}, why: {} }; }
  const lines = ["Clean. No notes.", "That last one was ugly but I'll allow it", "Who let you cook", "Form police are watching", "Ok that's actually fast", "My legs hurt watching this"];
  for (let i = 38; i >= 0; i--) {
    const d = E.shiftKey(today, -i);
    for (const q of E.slotsOf(W, d)) {
      const drop = E.dropOf(W, q); if (!drop) continue;
      for (const [id, , p] of people) {
        if (i === 0 && id === "me") continue;
        if (r() > p) continue;
        const at = drop.at + (4 + r() * r() * 240) * 6e4; if (at > Math.min(t, drop.close)) continue;
        D.subs[id].e[q] = { at, video: null, link: "https://example.com/video", note: r() < .25 ? "Did these between meetings" : "", lv: r() < .16 ? "easy" : r() > .78 ? "hard" : "normal" };
        const key = q + "_" + id;
        for (const [o] of people) if (o !== id && r() < .5) D.reacts[o].r[key] = Math.floor(r() * 6);
        for (const [o] of people) if (o !== id && r() < .16) (D.comments[o].c[key] ||= []).push({ t: lines[Math.floor(r() * lines.length)], at: at + 3e5 });
        if (id === "u5" && r() < .12) { D.votes.u2.v[key] = -1; D.votes.u2.why[key] = { r: "Half reps", at: at + 6e5 }; }
      }
    }
  }
  const wk = E.weekOf(today);
  D.ideas = { u2: { w: { [wk]: { t: "40 burpees in a suit and tie", r: "Jacket stays on.", at: 1 } } }, u3: { w: { [wk]: { t: "Cold shower while singing the anthem", r: "", at: 2 } } } };
  D.ivotes = { me: { w: { [wk]: "u2" } }, u4: { w: { [wk]: "u2" } }, u3: { w: { [wk]: "u2" } } };
  if (!solo) {
    D.duels = { u2: { d: { dx1: { to: "me", type: "week", stake: 50, at: t - 40 * 36e5 }, dx2: { to: "me", type: "max", move: "pushup", stake: 100, at: t - 2 * 36e5 } } }, me: { r: { dx1: { v: 1, at: t - 39 * 36e5 } } }, u4: { d: { dx3: { to: "u3", type: "race", stake: 25, at: t - 30 * 36e5 } } } };
    D.duels.u3 = { r: { dx3: { v: 1, at: t - 29 * 36e5 } } };
  }
  for (const [id] of people) { const d = {}; for (let i = 0; i < 7; i++) d[E.shiftKey(today, -i)] = { sleep: r() < .7, stretch: r() < .5, protein: r() < .6, steps: r() < .6, water: Math.floor(r() * 9) }; D.habits[id] = { d }; }
  S.uid = "me"; S.isOwner = true; S.canWrite = true; S.demoUrls = {};
  S.assets = { async upload(file) { const id = "demo:" + Math.random().toString(36).slice(2); S.demoUrls[id] = URL.createObjectURL(file); return { id }; } };
  const ls = {}, emit = c => ls[c] && ls[c]({ docs: Object.entries(D[c]).map(([id, v]) => ({ id, exists: true, data: () => v })), metadata: { fromCache: false } });
  return {
    doc(path) { const [c, id] = path.split("/"); return { async set(v) { D[c][id] = JSON.parse(JSON.stringify(v)); setTimeout(() => emit(c), 30); }, async delete() { delete D[c][id]; setTimeout(() => emit(c), 30); } }; },
    collection(c) { return { onSnapshot(next) { ls[c] = next; setTimeout(() => emit(c), 20); } }; },
    async refresh() {},
  };
}
