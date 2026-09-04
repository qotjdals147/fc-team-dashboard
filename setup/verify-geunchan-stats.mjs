/** node setup/verify-geunchan-stats.mjs */
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
  fetch(`${url}/rest/v1/matches?select=id,date,oppTeam,scorers&order=date`, { headers: h }).then(r => r.json()),
]);

function scorerBaseName(name) {
  return String(name).replace(/\(용\)\s*$/u, '').trim();
}
function scorerNameMatchesPlayer(scorerName, playerName) {
  if (!scorerName || !playerName) return true;
  const a = scorerBaseName(scorerName);
  const b = scorerBaseName(playerName);
  return a === b || a === playerName || b === scorerName;
}
function resolveScorerPlayerId(scorer, players) {
  if (!scorer || scorer.pid == null) return null;
  const byPid = players.find(p => p.id === scorer.pid);
  if (byPid && scorerNameMatchesPlayer(scorer.name, byPid.name)) return byPid.id;
  const base = scorerBaseName(scorer.name);
  if (!base) return null;
  const byName = players.find(p => p.name === base || scorerBaseName(p.name) === base);
  return byName ? byName.id : null;
}

const pid = 29;
const geunchan = players.find(p => p.id === pid);
console.log('Player:', geunchan);

let goals = 0, assists = 0;
const history = [];
for (const m of matches) {
  for (const s of m.scorers || []) {
    const resolved = resolveScorerPlayerId(s, players);
    if (resolved !== pid) continue;
    goals += s.goals || 0;
    assists += s.assists || 0;
    history.push({ date: m.date, opp: m.oppTeam, goals: s.goals, assists: s.assists, rawName: s.name, rawPid: s.pid });
  }
}
console.log('Stats (new logic):', { goals, assists });
console.log('Goal history:', history);

// Audit: any scorer where pid/name mismatch with current player
const mismatches = [];
for (const m of matches) {
  for (const s of m.scorers || []) {
    const byPid = players.find(p => p.id === s.pid);
    if (byPid && !scorerNameMatchesPlayer(s.name, byPid.name)) {
      const resolved = resolveScorerPlayerId(s, players);
      mismatches.push({ date: m.date, storedPid: s.pid, name: s.name, currentAtPid: byPid.name, resolvedTo: resolved });
    }
  }
}
console.log('\nPid/name mismatches (resolved by name or dropped):', mismatches.length);
console.log(mismatches);
