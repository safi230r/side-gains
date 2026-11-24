/* ---------- notification handler ---------- */
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SITE = "https://safi230r.github.io/side-gains/side-gains.html";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const MIN = 60e3;

async function vapid() {
  let { data } = await sb.from("push_keys").select("public_key, private_key").eq("id", 1).maybeSingle();
  if (!data) {
    const k = webpush.generateVAPIDKeys();
    await sb.from("push_keys").upsert({ id: 1, public_key: k.publicKey, private_key: k.privateKey }, { onConflict: "id", ignoreDuplicates: true });
    ({ data } = await sb.from("push_keys").select("public_key, private_key").eq("id", 1).single());
  }
  webpush.setVapidDetails(SITE, data!.public_key, data!.private_key);
  return data!;
}
type Row = { id: string; data: any };
async function pushRows(): Promise<Row[]> { const { data } = await sb.from("docs").select("id, data").eq("coll", "push"); return (data ?? []) as Row[]; }
async function sendTo(row: Row, payload: Record<string, unknown>) {
  const subs = { ...(row.data?.subs ?? {}) };
  let sent = 0, changed = false;
  for (const [h, s] of Object.entries(subs)) {
    try { await webpush.sendNotification(s as any, JSON.stringify(payload), { TTL: 3600, urgency: "high" }); sent++; }
    catch (e) { const code = (e as any)?.statusCode; if (code === 404 || code === 410) { delete subs[h]; changed = true; } }
  }
  if (changed) await sb.from("docs").update({ data: { ...row.data, subs } }).eq("coll", "push").eq("id", row.id);
  return sent;
}
const wants = (row: Row, pref: string) => row.data?.prefs?.[pref] !== false;
async function toAll(pref: string, payload: any, skip?: string) { let n = 0; for (const r of await pushRows()) if (r.id !== skip && wants(r, pref)) n += await sendTo(r, payload); return n; }
async function toOne(uid: string, pref: string, payload: any) { const r = (await pushRows()).find((x) => x.id === uid); return r && wants(r, pref) ? await sendTo(r, payload) : 0; }
/* true only the first time a key is claimed, so nothing is sent twice */
async function claim(key: string) { const { error } = await sb.from("sg_sent").insert({ key }); return !error; }

async function world() {
  const W: any = { now: Date.now() };
  for (const c of ["members", "subs", "votes", "quests", "pens", "ideas", "ivotes", "drops", "meta", "reacts", "comments", "duels", "powers"]) W[c] = {};
  const from = shiftKey(keyAt(W.now), -60);
  for (let i = 0; ; i++) {
    const { data } = await sb.from("docs").select("coll, id, data").not("coll", "in", "(push,habits)").or(`coll.neq.drops,id.gte.${from}`).order("coll").order("id").range(i * 1000, i * 1000 + 999);
    for (const r of data ?? []) if (W[r.coll]) W[r.coll][r.id] = r.data;
    if (!data || data.length < 1000) break;
  }
  return { W, C: compute(W) };
}
const clip = (s: unknown, n = 40) => String(s ?? "").slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  let body: any = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { body = {}; } }
  const action = url.searchParams.get("action") || body.action;
  try {
    const keys = await vapid();
    if (action === "key") return json({ publicKey: keys.public_key });
    if (action === "tick") return json({ sent: 0 }); // old schedule, replaced by sg_tick

    /* ---- called by the database schedule; each checks the facts itself and can only fire once ---- */
    const t = Date.now(), today = keyAt(t), m = minutesAt(t);
    if (action === "cleanup") {
      const { data } = await sb.rpc("sg_old_videos");
      const names = ((data ?? []) as any[]).map((x) => (typeof x === "string" ? x : x.sg_old_videos)).filter(Boolean);
      let removed = 0;
      for (let i = 0; i < names.length; i += 100) { const { data: d } = await sb.storage.from("videos").remove(names.slice(i, i + 100)); removed += d?.length ?? 0; }
      return json({ removed });
    }
    if (action === "drop") {
      const id = String(body.id || "");
      const { data } = await sb.from("docs").select("data").eq("coll", "drops").eq("id", id).maybeSingle();
      const at = Number((data as any)?.data?.at);
      if (!at || at > t || t - at > 30 * MIN || !(await claim("drop:" + id))) return json({ sent: 0 });
      const first = slotOfQ(id) === "a";
      return json({ sent: await toAll("quest", { title: first ? "Drop 1 just landed" : "Drop 2 just landed", body: "Rip the pack. The first one to finish takes +50%.", tag: "drop-" + id, url: SITE + "#today" }) });
    }
    if (action === "closing") {
      if (m < CFG.close - 65 || m > CFG.close - 15 || !(await claim("closing:" + today))) return json({ sent: 0 });
      const { C } = await world(); let sent = 0;
      for (const row of await pushRows()) {
        const st = C.stats[row.id]; if (!st || !wants(row, "closing")) continue;
        const left = C.slots.filter((s: any) => s.state === "open" && !s.list.some((x: any) => x.uid === row.id));
        if (!left.length) continue;
        const risk = st.cur >= 2 && !st.doneToday;
        sent += await sendTo(row, risk ? { title: `Your ${st.cur}-day streak ends in an hour`, body: st.freezes ? "You have a freeze that would cover tonight, but why waste it?" : "One quest before 10 PM saves it.", tag: "closing", url: SITE + "#today" } : { title: left.length > 1 ? "Two packs close in an hour" : "A pack closes in an hour", body: "Submissions shut at 10 PM.", tag: "closing", url: SITE + "#today" });
      }
      return json({ sent });
    }
    if (action === "punish") {
      if (m < 1075 || m > 1120 || !(await claim("punish:" + today))) return json({ sent: 0 });
      const { C } = await world(); let sent = 0;
      for (const p of C.pens) if ((p.state === "owed" || p.state === "redo") && (p.due === today || p.due === shiftKey(today, 1))) sent += await toOne(p.uid, "punish", { title: p.due === today ? "Your punishment is due tonight" : "Your punishment is due tomorrow", body: `${clip(p.task.t, 60)}. Miss it and you lose ${PENALTY} points.`, tag: "punish", url: SITE + "#today" });
      return json({ sent });
    }
    if (action === "ceremony") {
      if (dowOf(today) !== 6 || m < CFG.close - 1 || !(await claim("ceremony:" + today))) return json({ sent: 0 });
      const { W, C } = await world(), w = ceremonyWeek(W, C), id = w && C.weekWinner[w];
      if (!id) return json({ sent: 0 });
      return json({ sent: await toAll("ceremony", { title: "The Sunday Ceremony is on", body: `${clip(W.members[id]?.name, 24)} took the week. See the podium, the awards and the red card.`, tag: "ceremony", url: SITE + "#board" }) });
    }

    /* ---- called by a signed-in person ---- */
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ error: "sign in required" }, 401);

    if (action === "test") {
      const { data: row } = await sb.from("docs").select("id, data").eq("coll", "push").eq("id", uid).maybeSingle();
      return json({ sent: row ? await sendTo(row as Row, { title: "Side Gains", body: "Notifications are working. See you at the next drop.", tag: "test", url: SITE }) : 0 });
    }
    const { data: mem } = await sb.from("docs").select("data").eq("coll", "members").eq("id", uid).maybeSingle();
    if (!mem) return json({ error: "not in the crew" }, 403);
    const name = clip((mem as any)?.data?.name || "Someone", 24);

    if (action === "video") {
      if (!(await claim(`video:${uid}:${Math.floor(t / (2 * MIN))}`))) return json({ sent: 0 });
      return json({ sent: await toAll("videos", { title: `${name} just finished`, body: "It counts unless someone says it doesn't. Take a look.", tag: "video-" + uid, url: SITE + "#today" }, uid) });
    }
    const key = clip(body.key, 120);
    if (action === "reject") {
      const { W, C } = await world(), s = C.subByKey[key], n = s && s.no.find((x: any) => x.uid === uid);
      if (!n || !(await claim(`reject:${key}:${uid}`))) return json({ sent: 0 });
      return json({ sent: await toOne(s.uid, "verdict", { title: "No rep", body: `${name} says your run doesn't count: ${clip(n.why || "no reason given")}.`, tag: "reject-" + key, url: SITE + "#today" }) });
    }
    if (action === "social") {
      const { C } = await world(), s = C.subByKey[key]; if (!s || s.uid === uid) return json({ sent: 0 });
      const isC = body.kind === "comment", mine = isC ? s.comments.filter((c: any) => c.uid === uid).pop() : s.reacts.find((r: any) => r.uid === uid);
      if (!mine || !(await claim(isC ? `comment:${key}:${uid}:${mine.at}` : `react:${key}:${uid}`))) return json({ sent: 0 });
      return json({ sent: await toOne(s.uid, "social", isC ? { title: `${name} commented`, body: clip(mine.t, 110), tag: "c-" + key, url: SITE + "#today" } : { title: `${name} slapped a sticker on your video`, body: clip(s.label, 60), tag: "r-" + key, url: SITE + "#today" }) });
    }
    if (action === "duel") {
      const { W, C } = await world(), d = C.duels.find((x: any) => x.id === String(body.id)); if (!d) return json({ sent: 0 });
      const what = d.type === "race" ? "Race to the next drop" : d.type === "week" ? "Points battle until Sunday" : "Max reps in 60 seconds";
      if (d.a === uid && d.state === "open" && (await claim("duel:" + d.id))) return json({ sent: await toOne(d.b, "duels", { title: `${name} challenged you`, body: `${what}, ${d.stake} points at stake. You have 24 hours to answer.`, tag: "duel-" + d.id, url: SITE + "#arena" }) });
      if (d.b === uid && (d.state === "on" || d.state === "declined") && (await claim("duelr:" + d.id))) return json({ sent: await toOne(d.a, "duels", { title: d.state === "on" ? `${name} accepted. Fight!` : `${name} backed out`, body: what + ".", tag: "duel-" + d.id, url: SITE + "#arena" }) });
      return json({ sent: 0 });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
