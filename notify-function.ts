// Supabase Edge Function "notify" for Side Gains web push.
// Deploy with JWT verification OFF (the daily schedule calls it without a login).
// Actions:
//   key   -> returns the VAPID public key (created once and kept in the private push_keys table)
//   tick  -> called every 10 minutes by pg_cron; sends "quest dropped" once per day per device, at each person's local open hour
//   video -> called by the app after someone submits; notifies everyone else who opted in (requires a logged-in user)
//   test  -> sends a test notification to the caller's own devices (requires a logged-in user)
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SITE = "https://safi230r.github.io/side-gains/side-gains.html";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

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
async function pushRows(): Promise<Row[]> {
  const { data } = await sb.from("docs").select("id, data").eq("coll", "push");
  return (data ?? []) as Row[];
}

async function sendTo(row: Row, payload: Record<string, unknown>) {
  const subs = { ...(row.data?.subs ?? {}) };
  let sent = 0, changed = false;
  for (const [h, s] of Object.entries(subs)) {
    try { await webpush.sendNotification(s as any, JSON.stringify(payload), { TTL: 3600 }); sent++; }
    catch (e) { const code = (e as any)?.statusCode; if (code === 404 || code === 410) { delete subs[h]; changed = true; } }
  }
  if (changed) await sb.from("docs").update({ data: { ...row.data, subs } }).eq("coll", "push").eq("id", row.id);
  return sent;
}

function localNow(tz: string) {
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
    const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
  } catch { return localNow("UTC"); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  let body: any = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { body = {}; } }
  const action = url.searchParams.get("action") || body.action;
  try {
    const keys = await vapid();
    if (action === "key") return json({ publicKey: keys.public_key });

    if (action === "tick") {
      let sent = 0;
      for (const row of await pushRows()) {
        const d = row.data || {};
        if (d.prefs?.quest === false) continue;
        const { date, hour } = localNow(d.tz);
        const open = Number.isInteger(d.openHour) ? d.openHour : 12, close = Number.isInteger(d.closeHour) ? d.closeHour : 22;
        if (hour < open || hour >= close || d.lastQuest === date) continue;
        const next = { ...d, lastQuest: date };
        await sb.from("docs").update({ data: next }).eq("coll", "push").eq("id", row.id);
        sent += await sendTo({ id: row.id, data: next }, { title: "Today's quest just dropped", body: "The mystery is unlocked. First approved finisher gets +50%.", tag: "quest-" + date, url: SITE });
      }
      return json({ sent });
    }

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ error: "sign in required" }, 401);

    if (action === "test") {
      const { data: row } = await sb.from("docs").select("id, data").eq("coll", "push").eq("id", uid).maybeSingle();
      const sent = row ? await sendTo(row as Row, { title: "Side Gains", body: "Notifications are working. See you at the next drop.", tag: "test", url: SITE }) : 0;
      return json({ sent });
    }

    if (action === "video") {
      const { data: m } = await sb.from("docs").select("data").eq("coll", "members").eq("id", uid).maybeSingle();
      const name = String((m as any)?.data?.name || "Someone").slice(0, 24);
      let sent = 0;
      for (const row of await pushRows()) {
        if (row.id === uid || row.data?.prefs?.videos === false) continue;
        sent += await sendTo(row, { title: "New video to judge", body: `${name} just submitted today's quest. Does it count?`, tag: "video-" + uid, url: SITE + "#today" });
      }
      return json({ sent });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
