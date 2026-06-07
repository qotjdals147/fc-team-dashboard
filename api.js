// ── 구글 시트 API 설정 ──
const SHEET_API = {
  URL: 'https://script.google.com/macros/s/AKfycbz-jEgsrrbBUiwbqm3fMwzb4UTZtWjjqJDRHcm74fpV-_suIpU-jobPkTsQgVP4DN0Ebw/exec',
  KEY: 'minsoo_fc',
};

let _syncHandler = null;

function setSyncHandler(fn) { _syncHandler = fn; }

function syncUI(state, msg) {
  if (_syncHandler) _syncHandler(state, msg);
}

async function apiLoadAll() {
  syncUI('loading', '데이터 불러오는 중…');
  const res = await fetch(`${SHEET_API.URL}?key=${encodeURIComponent(SHEET_API.KEY)}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || '불러오기 실패');
  syncUI('ok', '동기화됨');
  return json.data;
}

async function apiSavePartial(data) {
  syncUI('saving', '저장 중…');
  const res = await fetch(SHEET_API.URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key: SHEET_API.KEY, action: 'saveAll', data }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || '저장 실패');
  syncUI('ok', '동기화됨');
}
