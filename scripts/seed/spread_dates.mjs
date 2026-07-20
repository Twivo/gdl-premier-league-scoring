// Spread match/encounter dates realistically across the 2026/2027 season and
// align created_at with finished_at so app and any other reader agree.
// Fixtures of an encounter share that encounter's evening. Narrow per-row/PATCH
// updates only (id=eq / encounter_id=eq).
const SB = process.env.SB_URL, KEY = process.env.SB_SERVICE_KEY;
if (!SB || !KEY) { console.error('missing env'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
async function patch(t, filter, body) {
  const r = await fetch(`${SB}/rest/v1/${t}?${filter}`, { method: 'PATCH', headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`PATCH ${t} ${filter} -> ${r.status}: ${await r.text()}`);
}
async function get(t, qs) {
  const r = await fetch(`${SB}/rest/v1/${t}?${qs}`, { headers: H });
  if (!r.ok) throw new Error(`${t} ${r.status}: ${await r.text()}`);
  return r.json();
}
const DAY = 86400000;
// Season start (first tie ~11 days later). Override with SEASON_START=YYYY-MM-DD.
const seasonStart = Date.parse(`${process.env.SEASON_START || '2026-09-01'}T00:00:00Z`);
const at = (baseDay, h, m) => new Date(baseDay + h * 3600000 + m * 60000).toISOString();

// --- encounters: one tie every 14 days, evening 19:30–21:15 ------------------
const encs = (await get('encounters', 'select=id&order=id')).map((e) => e.id);
console.log(`Spreading ${encs.length} encounters + their fixtures...`);
// Distribute ties evenly across the season window (start+7 .. start+350 days),
// so it fits whatever the encounter count is.
const SPAN = 343; // days of playable window
const step = encs.length > 1 ? SPAN / (encs.length - 1) : 0;
for (let i = 0; i < encs.length; i++) {
  const day = seasonStart + Math.round(7 + i * step) * DAY;
  const created = at(day, 19, 30), finished = at(day, 21, 15);
  await patch('encounters', `id=eq.${encs[i]}`, { created_at: created, finished_at: finished });
  await patch('matches', `encounter_id=eq.${encs[i]}`, { created_at: created, finished_at: finished });
  if ((i + 1) % 5 === 0) console.log(`  ...${i + 1}/${encs.length}`);
}

// --- regular (non-encounter) matches: spread ~every 25 days, 20:00 -----------
const regs = (await get('matches', 'select=id&encounter_id=is.null&order=id')).map((m) => m.id);
console.log(`Spreading ${regs.length} regular matches...`);
for (let i = 0; i < regs.length; i++) {
  const day = seasonStart + (10 + i * 25) * DAY;
  await patch('matches', `id=eq.${regs[i]}`, { created_at: at(day, 20, 0), finished_at: at(day, 20, 40) });
}

// --- report ------------------------------------------------------------------
const sample = await get('encounters', 'select=created_at&order=created_at.asc');
const days = [...new Set(sample.map((e) => e.created_at.slice(0, 10)))];
console.log(`DONE. Encounter dates span ${days[0]} → ${days[days.length - 1]} (${days.length} distinct days).`);
