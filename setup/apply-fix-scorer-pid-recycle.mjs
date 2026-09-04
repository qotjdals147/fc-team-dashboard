/**
 * setup/fix-scorer-pid-recycle.sql 적용 (로컬 .env.local FC_ZERO_* 사용)
 * node setup/apply-fix-scorer-pid-recycle.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '..', '.env.local');

function loadEnv() {
  const out = {};
  try {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {
    console.error('Missing .env.local at', envPath);
    process.exit(1);
  }
  return out;
}

const env = loadEnv();
const url = env.FC_ZERO_SUPABASE_URL;
const key = env.FC_ZERO_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('FC_ZERO_SUPABASE_URL / FC_ZERO_SUPABASE_SERVICE_ROLE_KEY required in .env.local');
  process.exit(1);
}

const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

const before = await fetch(`${url}/rest/v1/matches?id=eq.1783869924827&select=id,date,scorers`, { headers: h }).then(r => r.json());
console.log('Before:', JSON.stringify(before, null, 2));

const scorers = (before[0]?.scorers || []).map(s => {
  if (s.pid === 29 && s.name === '용민(용)') return { ...s, pid: 11, name: '용민' };
  return s;
});

const patch = await fetch(`${url}/rest/v1/matches?id=eq.1783869924827`, {
  method: 'PATCH',
  headers: h,
  body: JSON.stringify({ scorers }),
});
console.log('PATCH status', patch.status, await patch.text());

const after = await fetch(`${url}/rest/v1/matches?id=eq.1783869924827&select=scorers`, { headers: h }).then(r => r.json());
console.log('After:', JSON.stringify(after, null, 2));
