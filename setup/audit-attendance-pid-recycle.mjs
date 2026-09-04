/** Audit attendance pid recycle issues */
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
function nameMatches(a, b) {
  if (!a || !b) return true;
  const x = scorerBaseName(a);
  const y = scorerBaseName(b);
  return x === y || x === b || y === a;
}

function matchParticipantPidsOld(m) {
  const pids = new Set();
  (m.lineup || []).forEach(l => { if (l.pid != null) pids.add(l.pid); });
  (m.subs || []).forEach(s => { if (s.pid != null) pids.add(s.pid); });
  return pids;
}

const mismatches = [];
for (const m of matches) {
  const rows = [...(m.lineup || []), ...(m.subs || [])];
  for (const row of rows) {
    if (row.pid == null) continue;
    const byPid = players.find(p => p.id === row.pid);
    if (byPid && !nameMatches(row.name, byPid.name)) {
      mismatches.push({
        date: m.date,
        opp: m.oppTeam,
        pid: row.pid,
        storedName: row.name,
        currentName: byPid.name,
      });
    }
  }
}

console.log('Lineup/subs pid-name mismatches:', mismatches.length);
console.log(mismatches);

// Show impact on recycled pids 26-29
for (const pid of [26, 27, 28, 29]) {
  const p = players.find(x => x.id === pid);
  const oldCount = matches.filter(m => matchParticipantPidsOld(m).has(pid)).length;
  console.log(`\n${p?.name} (pid ${pid}): old attendance count = ${oldCount}`);
  const bad = mismatches.filter(x => x.pid === pid);
  if (bad.length) console.log('  mismatched entries:', bad);
}
