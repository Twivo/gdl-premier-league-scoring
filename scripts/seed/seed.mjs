// Seed MorgesDartsConnect: teams + players + 10 coherent ~50-avg 501 matches.
// Uses service_role (server-side admin) — never shipped to the client.
import { randomUUID } from 'node:crypto';

const SB = process.env.SB_URL;
const KEY = process.env.SB_SERVICE_KEY;
const SEASON_ID = process.env.SEASON_ID;
if (!SB || !KEY || !SEASON_ID) { console.error('missing env'); process.exit(1); }

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function post(table, rows) {
  const r = await fetch(`${SB}/rest/v1/${table}`, {
    method: 'POST', headers: H, body: JSON.stringify(rows),
  });
  if (!r.ok) { throw new Error(`${table} ${r.status}: ${await r.text()}`); }
  return r.json();
}

// ---------------------------------------------------------------------------
// Roster & teams (license numbers ignored on purpose)
// ---------------------------------------------------------------------------
const TEAMS = {
  'DC MORGES': ['Michel Roy','Laurent Flaction','Ludovic Marguet','Yannick Cainzos','Neil Poulton','Arno Roy','Patrick Roy','Amandine Marchand'],
  'SNIPERS DARTS': ['Elan Ganesalingam','James Oliver','Julien Tanguy','Joao Ferreira','Younes Abbadi','Simon Picthall','Chris Roberts'],
  'GALWAY DARTS': ['Christophe Chamard','Dermot Simpson','Nathalie Finger','George Rooney','Mickaël Schneider','Thomas Donkin','Hélène Pfäuti','Didier André'],
  'LAUSANNE SOCIAL DARTS': ['Benjamin Schaub','Antoine Padioleau','Gabriel Bernasconi','Stefan Rihs','Marc Zendrini','Anthony Colney','Lionel Zünd'],
  'LES FREESTYLERS': ['Stefan Dudolenski','Fouad Beram','Selim Forster','Julien Francfort','Lucien Moser','Etienne Martin','Nicolas Hall','Nethanel Brys','Dan Forster','Fred Paschoud'],
};

// ---------------------------------------------------------------------------
// Coherent match generation (faithful reimplementation of the engine rules)
// ---------------------------------------------------------------------------
let seed = 20252026;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const POOL = [26,30,36,38,40,41,43,44,45,50,55,57,58,60,61,66,81,85];
const FINISHES = [40,32,36,50,60]; // conventional double-out finishes

// Build k visit scores summing exactly to `target`, each within [20,110].
function sumVisits(k, target) {
  for (let tries = 0; tries < 5000; tries++) {
    const v = [];
    for (let i = 0; i < k - 1; i++) v.push(pick(POOL));
    const last = target - v.reduce((a, b) => a + b, 0);
    if (last >= 20 && last <= 110) return [...v, last];
  }
  throw new Error('sumVisits failed');
}

// resolveVisit — identical semantics to src/domain/rules/bust.ts
function resolveVisit(rem, scored) {
  const nr = rem - scored;
  if (nr < 0 || nr === 1) return { isBust: true, isCheckout: false, rem };
  return { isBust: false, isCheckout: nr === 0, rem: nr };
}

// Generate one coherent single-leg 501 double-out match, A (starter) wins.
function makeMatch(variant = 501) {
  const finish = pick(FINISHES);
  const winnerScoring = sumVisits(9, variant - finish); // 9 visits then checkout
  const winnerVisits = [...winnerScoring, finish];       // 10 visits total
  const loserTarget = 420 + Math.floor(rnd() * 40);      // ~420..459, never checks out
  const loserVisits = sumVisits(9, loserTarget);          // 9 visits

  // Interleave A,B,A,B,...,A (A starts and lands the final checkout).
  const scores = [];
  for (let i = 0; i < winnerVisits.length; i++) {
    scores.push({ side: 'A', scored: winnerVisits[i] });
    if (i < loserVisits.length) scores.push({ side: 'B', scored: loserVisits[i] });
  }

  // Validate by simulating exactly like the engine (turn order by position).
  const rem = { A: variant, B: variant };
  let over = false, winner = null;
  const totals = { A: { s: 0, d: 0 }, B: { s: 0, d: 0 } };
  scores.forEach((ev, idx) => {
    const side = idx % 2 === 0 ? 'A' : 'B'; // engine derives owner by position
    if (side !== ev.side) throw new Error('turn-order mismatch');
    if (over) throw new Error('event after game over');
    const out = resolveVisit(rem[side], ev.scored);
    rem[side] = out.rem;
    totals[side].s += out.isBust ? 0 : ev.scored;
    totals[side].d += 3;
    if (out.isCheckout) { over = true; winner = side; }
  });
  if (!over || winner !== 'A') throw new Error('match did not resolve to A win');
  const avg = (t) => +((t.s / t.d) * 3).toFixed(1);
  return { scores, winner, avgA: avg(totals.A), avgB: avg(totals.B), variant };
}

// 10 cross-team pairings (names resolved to ids after insert).
const PAIRINGS = [
  ['Michel Roy', 'James Oliver'],
  ['Yannick Cainzos', 'Christophe Chamard'],
  ['Neil Poulton', 'Benjamin Schaub'],
  ['Ludovic Marguet', 'Stefan Dudolenski'],
  ['Laurent Flaction', 'Julien Tanguy'],
  ['Arno Roy', 'George Rooney'],
  ['Simon Picthall', 'Gabriel Bernasconi'],
  ['Dermot Simpson', 'Lucien Moser'],
  ['Antoine Padioleau', 'Chris Roberts'],
  ['Thomas Donkin', 'Nicolas Hall'],
];

// ---------------------------------------------------------------------------
// Insert
// ---------------------------------------------------------------------------
const allNames = [...new Set(Object.values(TEAMS).flat())];
console.log(`Inserting ${allNames.length} players...`);
const playerRows = await post('players', allNames.map((name) => ({ name, active: true })));
const idByName = Object.fromEntries(playerRows.map((p) => [p.name, p.id]));

console.log('Inserting 5 teams + memberships...');
for (const [teamName, members] of Object.entries(TEAMS)) {
  const [team] = await post('teams', [{ name: teamName }]);
  await post('team_players', members.map((n) => ({ team_id: team.id, player_id: idByName[n] })));
}

console.log('Generating + inserting 10 matches...');
let mi = 0;
for (const [nameA, nameB] of PAIRINGS) {
  const m = makeMatch(501);
  const pA = idByName[nameA], pB = idByName[nameB];
  const now = Date.now() - (PAIRINGS.length - mi) * 86400000; // spread over days
  const config = {
    id: randomUUID(),
    createdAt: now,
    variant: m.variant,
    outRule: 'DOUBLE',
    mode: 'SINGLE',
    legsToWin: 1,
    participants: [
      { id: 'A', label: nameA, playerIds: [pA] },
      { id: 'B', label: nameB, playerIds: [pB] },
    ],
    players: [{ id: pA, name: nameA }, { id: pB, name: nameB }],
    startingPolicy: 'MANUAL',
    alternateStarter: false,
    firstStarterId: 'A',
  };
  const events = m.scores.map((s, i) => ({
    id: randomUUID(),
    ts: now + i * 25000,
    type: 'VISIT',
    participantId: i % 2 === 0 ? 'A' : 'B',
    playerId: i % 2 === 0 ? pA : pB,
    scored: s.scored,
    darts: 3,
  }));
  const [match] = await post('matches', [{
    season_id: SEASON_ID,
    config, events,
    mode: 'SINGLE', variant: m.variant,
    status: 'GAME_OVER', winner_participant: 'A',
    finished_at: new Date(now + events.length * 25000).toISOString(),
  }]);
  await post('match_players', [
    { match_id: match.id, player_id: pA, participant_id: 'A' },
    { match_id: match.id, player_id: pB, participant_id: 'B' },
  ]);
  console.log(`  #${++mi} ${nameA} def. ${nameB}  | avg A=${m.avgA} B=${m.avgB} | ${events.length} visits`);
}
console.log('DONE.');
