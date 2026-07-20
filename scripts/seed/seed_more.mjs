// Add 15 more distinct single matches (varied pairings / variants / averages).
import { randomUUID } from 'node:crypto';
const SB = process.env.SB_URL, KEY = process.env.SB_SERVICE_KEY, SEASON_ID = process.env.SEASON_ID;
if (!SB || !KEY || !SEASON_ID) { console.error('missing env'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
async function post(t, rows) {
  const r = await fetch(`${SB}/rest/v1/${t}`, { method: 'POST', headers: H, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(`${t} ${r.status}: ${await r.text()}`);
  return r.json();
}
async function get(t, qs) {
  const r = await fetch(`${SB}/rest/v1/${t}?${qs}`, { headers: H });
  if (!r.ok) throw new Error(`${t} ${r.status}: ${await r.text()}`);
  return r.json();
}
let seed = 90909;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const POOL = [26,30,36,38,40,41,43,44,45,50,55,57,58,60,61,66,81,85,100,140];
const FINISHES = [40,32,36,50,60,56,64,80];
function sumVisits(k, target) {
  for (let t = 0; t < 8000; t++) {
    const v = []; for (let i = 0; i < k - 1; i++) v.push(pick(POOL));
    const last = target - v.reduce((a,b)=>a+b,0);
    if (last >= 20 && last <= 120) return [...v, last];
  }
  throw new Error('sumVisits failed');
}
function resolveVisit(rem, scored) {
  const nr = rem - scored;
  if (nr < 0 || nr === 1) return { isBust: true, isCheckout: false, rem };
  return { isBust: false, isCheckout: nr === 0, rem: nr };
}
// Single-leg match, A (starter) wins. k = winner scoring visits (controls average).
function makeMatch(variant, k) {
  const finish = pick(FINISHES);
  const winV = [...sumVisits(k, variant - finish), finish];
  const loseV = sumVisits(k, Math.round((variant - finish) * (0.9 + rnd() * 0.06)));
  const scores = [];
  for (let i = 0; i < winV.length; i++) {
    scores.push({ side: 'A', scored: winV[i] });
    if (i < loseV.length) scores.push({ side: 'B', scored: loseV[i] });
  }
  const rem = { A: variant, B: variant }; const totals = { A: { s: 0, d: 0 }, B: { s: 0, d: 0 } };
  let over = false, winner = null;
  scores.forEach((ev, idx) => {
    const side = idx % 2 === 0 ? 'A' : 'B';
    if (side !== ev.side) throw new Error('turn-order mismatch');
    if (over) throw new Error('event after over');
    const out = resolveVisit(rem[side], ev.scored); rem[side] = out.rem;
    totals[side].s += out.isBust ? 0 : ev.scored; totals[side].d += 3;
    if (out.isCheckout) { over = true; winner = side; }
  });
  if (!over || winner !== 'A') throw new Error('no A win');
  const avg = (t) => +((t.s / t.d) * 3).toFixed(1);
  return { scores, avgA: avg(totals.A), avgB: avg(totals.B) };
}

const players = await get('players', 'select=id,name&limit=1000');
const idByName = Object.fromEntries(players.map((p) => [p.name, p.id]));

const PAIRINGS = [
  ['Michel Roy','Younes Abbadi'], ['Patrick Roy','Simon Picthall'], ['Amandine Marchand','Nathalie Finger'],
  ['Neil Poulton','James Oliver'], ['Yannick Cainzos','Stefan Rihs'], ['Laurent Flaction','Joao Ferreira'],
  ['Ludovic Marguet','Marc Zendrini'], ['Arno Roy','Anthony Colney'], ['Elan Ganesalingam','Christophe Chamard'],
  ['Julien Tanguy','George Rooney'], ['Dermot Simpson','Etienne Martin'], ['Hélène Pfäuti','Lionel Zünd'],
  ['Didier André','Fouad Beram'], ['Mickaël Schneider','Dan Forster'], ['Benjamin Schaub','Nicolas Hall'],
];
const VARIANTS = [501, 601];
const KS = [8, 9, 10]; // controls average spread (~45–56)

console.log(`Adding ${PAIRINGS.length} matches...`);
let mi = 0;
for (const [nameA, nameB] of PAIRINGS) {
  const variant = pick(VARIANTS);
  const k = variant === 601 ? pick([10, 11, 12]) : pick(KS);
  const m = makeMatch(variant, k);
  const pA = idByName[nameA], pB = idByName[nameB];
  if (!pA || !pB) throw new Error(`unknown player ${nameA}/${nameB}`);
  const now = Date.now() - (PAIRINGS.length - mi) * 43200000;
  const config = {
    id: randomUUID(), createdAt: now, variant, outRule: 'DOUBLE', mode: 'SINGLE', legsToWin: 1,
    participants: [
      { id: 'A', label: nameA, playerIds: [pA] },
      { id: 'B', label: nameB, playerIds: [pB] },
    ],
    players: [{ id: pA, name: nameA }, { id: pB, name: nameB }],
    startingPolicy: 'MANUAL', alternateStarter: false, firstStarterId: 'A',
  };
  const events = m.scores.map((s, i) => ({
    id: randomUUID(), ts: now + i * 25000, type: 'VISIT',
    participantId: i % 2 === 0 ? 'A' : 'B', playerId: i % 2 === 0 ? pA : pB, scored: s.scored, darts: 3,
  }));
  const [match] = await post('matches', [{
    season_id: SEASON_ID, config, events, mode: 'SINGLE', variant,
    status: 'GAME_OVER', winner_participant: 'A',
    finished_at: new Date(now + events.length * 25000).toISOString(),
  }]);
  await post('match_players', [
    { match_id: match.id, player_id: pA, participant_id: 'A' },
    { match_id: match.id, player_id: pB, participant_id: 'B' },
  ]);
  console.log(`  #${++mi} ${nameA} def. ${nameB}  ${variant} | avg A=${m.avgA} B=${m.avgB}`);
}
console.log('DONE.');
