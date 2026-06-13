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

let _syncHandler = null;
function setSyncHandler(fn) { _syncHandler = fn; }
function syncUI(state, msg) { if (_syncHandler) _syncHandler(state, msg); }

// ── 단일 테이블 읽기 ──
async function sbSelect(table) {
  const res = await fetch(SB.url(table, '?select=*'), { headers: SB.headers });
  if (!res.ok) throw new Error(`${table} 읽기 실패: ${res.status}`);
  return res.json();
}

// ── 테이블 전체 교체 (upsert) ──
async function sbUpsert(table, rows) {
  if (!rows || !rows.length) {
    // 데이터 없으면 전체 삭제
    await fetch(SB.url(table, '?id=gte.0'), {
      method: 'DELETE',
      headers: SB.headers,
    });
    return;
  }
  // 기존 삭제 후 삽입
  await fetch(SB.url(table, '?id=gte.0'), {
    method: 'DELETE',
    headers: SB.headers,
  });
  const res = await fetch(SB.url(table), {
    method: 'POST',
    headers: SB.headers,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${table} 저장 실패: ${err}`);
  }
}

// ── meta 테이블 (key/value 구조) ──
async function sbSelectMeta() {
  const rows = await sbSelect('meta');
  const meta = {};
  rows.forEach(r => { if (r.key) meta[r.key] = r.value; });
  return meta;
}
async function sbUpsertMeta(meta) {
  if (!meta) return;
  const rows = Object.keys(meta).map(k => ({ key: k, value: String(meta[k] ?? '') }));
  // meta는 key가 PK라서 upsert 방식
  await fetch(SB.url('meta'), {
    method: 'DELETE',
    headers: { ...SB.headers, 'Prefer': '' },
  });
  if (!rows.length) return;
  await fetch(SB.url('meta'), {
    method: 'POST',
    headers: SB.headers,
    body: JSON.stringify(rows),
  });
}

// ── field 테이블 (항상 id=1 단일 행) ──
async function sbSelectField() {
  const res = await fetch(SB.url('field', '?id=eq.1'), { headers: SB.headers });
  if (!res.ok) throw new Error('field 읽기 실패');
  const rows = await res.json();
  if (!rows.length) return {
    q1formation:'4-3-3', q1tokens:[],
    q2formation:'', q2tokens:[],
    q3formation:'', q3tokens:[],
    q4formation:'', q4tokens:[],
    activeQuarter: 1,
  };
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
  if (!res.ok) throw new Error('field 저장 실패');
}

// ── dueExemptions / dueMemos (따옴표 필요한 테이블명) ──
async function sbSelectQuoted(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: SB.headers });
  if (!res.ok) throw new Error(`${table} 읽기 실패`);
  return res.json();
}

// ── 전체 로드 ──
async function apiLoadAll() {
  syncUI('loading', '데이터 불러오는 중…');
  try {
    const [players, matches, field, saves, meta,
           dues, expenses, settlements, schedules, notices,
           dueExemptions, dueMemos, disciplines] = await Promise.all([
      sbSelect('players'),
      sbSelect('matches'),
      sbSelectField(),
      sbSelect('saves'),
      sbSelectMeta(),
      sbSelect('dues'),
      sbSelect('expenses'),
      sbSelect('settlements'),
      sbSelect('schedules'),
      sbSelect('notices'),
      sbSelectQuoted('dueExemptions'),
      sbSelectQuoted('dueMemos'),
      sbSelect('disciplines'),
    ]);
    syncUI('ok', '동기화됨');
    return { players, matches, field, saves, meta,
             dues, expenses, settlements, schedules, notices,
             dueExemptions, dueMemos, disciplines };
  } catch (e) {
    syncUI('error', '불러오기 실패');
    throw e;
  }
}

// ── 부분 저장 ──
async function apiSavePartial(data) {
  syncUI('saving', '저장 중…');
  try {
    const tasks = [];
    if (data.players     !== undefined) tasks.push(sbUpsert('players',     data.players));
    if (data.matches     !== undefined) tasks.push(sbUpsert('matches',     data.matches));
    if (data.field       !== undefined) tasks.push(sbUpsertField(data.field));
    if (data.saves       !== undefined) tasks.push(sbUpsert('saves',       data.saves));
    if (data.meta        !== undefined) tasks.push(sbUpsertMeta(data.meta));
    if (data.dues        !== undefined) tasks.push(sbUpsert('dues',        data.dues));
    if (data.expenses    !== undefined) tasks.push(sbUpsert('expenses',    data.expenses));
    if (data.settlements !== undefined) tasks.push(sbUpsert('settlements', data.settlements));
    if (data.schedules   !== undefined) tasks.push(sbUpsert('schedules',   data.schedules));
    if (data.notices     !== undefined) tasks.push(sbUpsert('notices',     data.notices));
    if (data.dueExemptions !== undefined) tasks.push(sbUpsert('dueExemptions', data.dueExemptions));
    if (data.dueMemos    !== undefined) tasks.push(sbUpsert('dueMemos',    data.dueMemos));
    if (data.disciplines !== undefined) tasks.push(sbUpsert('disciplines', data.disciplines));
    await Promise.all(tasks);
    syncUI('ok', '동기화됨');
  } catch (e) {
    syncUI('error', '저장 실패');
    throw e;
  }
}
