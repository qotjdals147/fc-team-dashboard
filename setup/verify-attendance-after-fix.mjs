/** Verify attendance after resolveScorerPlayerId on lineup/subs */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const url = env.FC_ZERO_SUPABASE_URL;
const key = env.FC_ZERO_SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };

const [players, matches] = await Promise.all([
  fetch(`${url}/rest/v1/players?select=id,name,jersey&order=id`, { headers: h }).then(r => r.json()),
  fetch(`${url}/rest/v1/matches?select=id,date,oppTeam,lineup,subs&order=date`, { headers: h }).then(r => r.json()),
]);

function scorerBaseName(name) {
  return String(name).replace(/\(용\)\s*$/u, '').trim();
}
function scorerNameMatchesPlayer(a, b) {
  if (!a || !b) return true;
  const x = scorerBaseName(a);
  const y = scorerBaseName(b);
  return x === y || x === b || y === a;
}
function resolveScorerPlayerId(row, players) {
  if (!row || row.pid == null) return null;
  const byPid = players.find(p => p.id === row.pid);
  if (byPid && scorerNameMatchesPlayer(row.name, byPid.name)) return byPid.id;
  if (/\(용\)\s*$/u.test(String(row.name || ''))) return null;
  const base = scorerBaseName(row.name);
  if (!base) return null;
  const byName = players.find(p => p.name === base || scorerBaseName(p.name) === base);
  return byName ? byName.id : null;
}
function matchParticipantPids(m, players) {
  const pids = new Set();
  const add = row => {
    const pid = resolveScorerPlayerId(row, players);
    if (pid != null) pids.add(pid);
  };
  (m.lineup || []).forEach(add);
  (m.subs || []).forEach(add);
  return pids;
}
function attendanceCount(pid) {
  return matches.filter(m => matchParticipantPids(m, players).has(pid)).length;
}

for (const pid of [26, 27, 28, 29]) {
  const p = players.find(x => x.id === pid);
  console.log(`${p?.name} (pid ${pid}): attendance = ${attendanceCount(pid)}`);
}

console.log('\n근찬 real matches (name 근찬 in lineup):');
for (const m of matches) {
  const rows = [...(m.lineup || []), ...(m.subs || [])];
  if (rows.some(r => resolveScorerPlayerId(r, players) === 29)) {
    console.log(m.date, m.oppTeam);
  }
}
