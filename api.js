// ── Supabase 설정 ──
const SUPABASE_URL = 'https://ajcidqsjpkzupxeizbyp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqY2lkcXNqcGt6dXB4ZWl6YnlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzAwNTIsImV4cCI6MjA5NjkwNjA1Mn0.f7ZGPW0O4kiSAgPhvb9Zy9_PGbLKVU6vlMgTWX4JpEE';

const SB = {
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  },
  url: (table, query = '') => `${SUPABASE_URL}/rest/v1/${table}${query}`,
};

const META_PRESERVE_IF_EMPTY = new Set(['myTeam', 'teamPhotoUrl', 'teamPhotoUrls']);

let _syncHandler = null;
function setSyncHandler(fn) { _syncHandler = fn; }
function syncUI(state, msg) { if (_syncHandler) _syncHandler(state, msg); }

function metaValueString(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

async function sbLoadSafe(label, loader, fallback) {
  try { return await loader(); }
  catch (e) {
    console.warn(`[Supabase] ${label} 로드 실패:`, e);
    return fallback;
  }
}

// ── 단일 테이블 읽기 ──
async function sbSelect(table) {
  const res = await fetch(SB.url(table, '?select=*'), { headers: SB.headers });
  if (!res.ok) throw new Error(`${table} 읽기 실패: ${res.status}`);
  return res.json();
}

// ── 테이블 전체 교체 (POST 선행 — 실패 시 기존 행 유지) ──
async function sbUpsert(table, rows) {
  const safeRows = rows || [];
  if (!safeRows.length) {
    const res = await fetch(SB.url(table, '?id=gte.0'), { method: 'DELETE', headers: SB.headers });
    if (!res.ok) throw new Error(`${table} 삭제 실패: ${res.status} ${await res.text()}`);
    return;
  }
  const res = await fetch(SB.url(table), {
    method: 'POST',
    headers: { ...SB.headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(safeRows),
  });
  if (!res.ok) throw new Error(`${table} 저장 실패: ${await res.text()}`);
  const ids = safeRows.map(r => r.id).filter(id => id != null && id !== '');
  if (!ids.length) return;
  const delRes = await fetch(SB.url(table, `?id=not.in.(${ids.join(',')})`), {
    method: 'DELETE',
    headers: SB.headers,
  });
  if (!delRes.ok) throw new Error(`${table} 정리 실패: ${delRes.status} ${await delRes.text()}`);
}

let _saveChain = Promise.resolve();
function enqueueSave(fn) {
  const run = _saveChain.then(fn, fn);
  _saveChain = run.catch(() => {});
  return run;
}

// ── meta (key/value) ──
async function sbSelectMeta() {
  const rows = await sbSelect('meta');
  const meta = {};
  rows.forEach(r => { if (r.key) meta[r.key] = r.value; });
  return meta;
}

async function sbUpsertMeta(meta) {
  if (!meta) return;
  const existing = await sbSelectMeta();
  const merged = { ...existing };
  for (const [k, v] of Object.entries(meta)) {
    const s = metaValueString(v);
    // 발표 스케일 등 부분 저장 시 빈 팀명·사진으로 덮어쓰기 방지
    if (META_PRESERVE_IF_EMPTY.has(k) && !s && existing[k]) continue;
    merged[k] = s;
  }
  const rows = Object.keys(merged).map(k => ({ key: k, value: merged[k] }));
  if (!rows.length) return;
  const res = await fetch(SB.url('meta'), {
    method: 'POST',
    headers: { ...SB.headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error('meta 저장 실패: ' + await res.text());
}

// ── field (id=1 단일 행) ──
const FIELD_DEFAULT = {
  q1formation:'4-3-3', q1tokens:[],
  q2formation:'', q2tokens:[],
  q3formation:'', q3tokens:[],
  q4formation:'', q4tokens:[],
  activeQuarter: 1,
};

async function sbSelectField() {
  const res = await fetch(SB.url('field', '?id=eq.1'), { headers: SB.headers });
  if (!res.ok) throw new Error('field 읽기 실패');
  const rows = await res.json();
  if (!rows.length) return { ...FIELD_DEFAULT };
  const r = rows[0];
  return {
    q1formation: r.q1formation || '4-3-3',
    q1tokens:    r.q1tokens    || [],
    q2formation: r.q2formation || '',
    q2tokens:    r.q2tokens    || [],
    q3formation: r.q3formation || '',
    q3tokens:    r.q3tokens    || [],
    q4formation: r.q4formation || '',
    q4tokens:    r.q4tokens    || [],
    activeQuarter: r.activeQuarter || 1,
  };
}

async function sbUpsertField(field) {
  if (!field) return;
  const row = {
    id: 1,
    q1formation: field.q1formation || field.formation || '4-3-3',
    q1tokens:    field.q1tokens    || field.tokens    || [],
    q2formation: field.q2formation || '',
    q2tokens:    field.q2tokens    || [],
    q3formation: field.q3formation || '',
    q3tokens:    field.q3tokens    || [],
    q4formation: field.q4formation || '',
    q4tokens:    field.q4tokens    || [],
    activeQuarter: field.activeQuarter || 1,
  };
  const res = await fetch(SB.url('field'), {
    method: 'POST',
    headers: { ...SB.headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error('field 저장 실패: ' + await res.text());
}

async function sbSelectQuoted(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: SB.headers });
  if (!res.ok) throw new Error(`${table} 읽기 실패`);
  return res.json();
}

// ── 전체 로드 (일부 테이블 실패해도 나머지는 로드) ──
async function apiLoadAll(silent = false) {
  if (!silent) syncUI('loading', '데이터 불러오는 중…');
  const jobs = [
    ['players',       () => sbSelect('players'),           []],
    ['matches',       () => sbSelect('matches'),           []],
    ['field',         () => sbSelectField(),               { ...FIELD_DEFAULT }],
    ['saves',         () => sbSelect('saves'),             []],
    ['meta',          () => sbSelectMeta(),                {}],
    ['dues',          () => sbSelect('dues'),              []],
    ['expenses',      () => sbSelect('expenses'),          []],
    ['settlements',   () => sbSelect('settlements'),       []],
    ['schedules',     () => sbSelect('schedules'),         []],
    ['notices',       () => sbSelect('notices'),           []],
    ['dueExemptions', () => sbSelectQuoted('dueExemptions'), []],
    ['dueMemos',      () => sbSelectQuoted('dueMemos'),    []],
    ['disciplines',   () => sbSelect('disciplines'),       []],
  ];
  const settled = await Promise.allSettled(jobs.map(([, fn]) => fn()));
  const failures = [];
  const out = {};
  jobs.forEach(([name], i) => {
    const r = settled[i];
    if (r.status === 'fulfilled') out[name] = r.value;
    else {
      failures.push(name);
      out[name] = jobs[i][2];
      console.warn(`[Supabase] ${name}:`, r.reason);
    }
  });
  if (failures.length === jobs.length) {
    syncUI('error', '불러오기 실패');
    throw new Error('Supabase 전체 로드 실패');
  }
  if (!silent) {
    syncUI('ok', failures.length ? `동기화됨 (${failures.length}개 테이블 제외)` : '동기화됨');
  }
  return {
    players: out.players, matches: out.matches, field: out.field, saves: out.saves, meta: out.meta,
    dues: out.dues, expenses: out.expenses, settlements: out.settlements,
    schedules: out.schedules, notices: out.notices,
    dueExemptions: out.dueExemptions, dueMemos: out.dueMemos, disciplines: out.disciplines,
  };
}

// ── 부분 저장 (동시 저장 직렬화 — DELETE/POST 경합 방지) ──
async function apiSavePartial(data) {
  return enqueueSave(async () => {
  syncUI('saving', '저장 중…');
  try {
    const tasks = [];
    if (data.players       !== undefined) tasks.push(sbUpsert('players',       data.players));
    if (data.matches       !== undefined) tasks.push(sbUpsert('matches',       data.matches));
    if (data.field         !== undefined) tasks.push(sbUpsertField(data.field));
    if (data.saves         !== undefined) tasks.push(sbUpsert('saves',         data.saves));
    if (data.meta          !== undefined) tasks.push(sbUpsertMeta(data.meta));
    if (data.dues          !== undefined) tasks.push(sbUpsert('dues',          data.dues));
    if (data.expenses      !== undefined) tasks.push(sbUpsert('expenses',      data.expenses));
    if (data.settlements   !== undefined) tasks.push(sbUpsert('settlements',   data.settlements));
    if (data.schedules     !== undefined) tasks.push(sbUpsert('schedules',     data.schedules));
    if (data.notices       !== undefined) tasks.push(sbUpsert('notices',       data.notices));
    if (data.dueExemptions !== undefined) tasks.push(sbUpsert('dueExemptions', data.dueExemptions));
    if (data.dueMemos      !== undefined) tasks.push(sbUpsert('dueMemos',      data.dueMemos));
    if (data.disciplines   !== undefined) tasks.push(sbUpsert('disciplines',   data.disciplines));
    await Promise.all(tasks);
    syncUI('ok', '동기화됨');
  } catch (e) {
    syncUI('error', '저장 실패');
    throw e;
  }
  });
}

// ── Storage: 팀 사진 (FC 제로 A안 — bucket team-photos) ──
const STORAGE_BUCKET_TEAM_PHOTOS = 'team-photos';
const STORAGE_PREFIX_FC_ZERO = 'fc-zero/';

function apiTeamPhotoPublicUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET_TEAM_PHOTOS}/${storagePath}`;
}

function apiStoragePathFromPublicUrl(url) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET_TEAM_PHOTOS}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

async function apiUploadTeamPhoto(file) {
  const extMatch = (file.name || '').match(/\.(jpe?g|png|gif|webp)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
  const path = `${STORAGE_PREFIX_FC_ZERO}${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET_TEAM_PHOTOS}/${path}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': file.type || 'image/jpeg',
    },
    body: file,
  });
  if (!res.ok) throw new Error(`사진 업로드 실패: ${await res.text()}`);
  return { url: apiTeamPhotoPublicUrl(path), storagePath: path };
}

async function apiDeleteTeamPhoto(storagePath) {
  if (!storagePath) return;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET_TEAM_PHOTOS}/${storagePath}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok && res.status !== 404) throw new Error(`사진 삭제 실패: ${await res.text()}`);
}
