// ── 관리자 모드 ──
const ADMIN_PW = '0607';
let isAdmin = false; // 새로고침·재접속 시 항상 비관리자 (비밀번호 재입력 필요)

function applyAdminMode() {
  document.body.classList.toggle('is-admin', isAdmin);
  // 잠금 버튼 아이콘
  const btn = document.getElementById('adminToggleBtn');
  if (btn) {
    btn.textContent = isAdmin ? '🔓' : '🔒';
    btn.title = isAdmin ? '관리자 모드 해제' : '관리자 모드 진입';
    btn.classList.toggle('active', isAdmin);
  }
  // 통계 탭 버튼: 비관리자에게 숨김
  const statsTabBtn = document.getElementById('statsTabBtn');
  if (statsTabBtn) statsTabBtn.style.display = isAdmin ? '' : 'none';
  // 비관리자가 통계 탭에 있으면 홈으로
  if (!isAdmin && document.getElementById('tab-stats')?.classList.contains('active')) {
    switchTab('home');
  }
  // 포메이션 뷰 레이블 업데이트
  const vl = document.getElementById('formationViewLabel');
  if (vl) vl.textContent = getFormation() || '';
  // 동적 렌더 요소 재렌더 (편집 버튼 포함 여부 반영)
  renderRoster();
  renderRecords();
}

function toggleAdminMode() {
  if (isAdmin) {
    if (!confirm('관리자 모드를 해제하시겠습니까?')) return;
    isAdmin = false;
    applyAdminMode();
  } else {
    openAdminModal();
  }
}

function openAdminModal() {
  const inp = document.getElementById('adminPwInput');
  if (inp) inp.value = '';
  document.getElementById('adminModal').classList.add('open');
  setTimeout(() => document.getElementById('adminPwInput')?.focus(), 150);
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.remove('open');
}

function submitAdminPw() {
  const pw = document.getElementById('adminPwInput')?.value ?? '';
  if (pw === ADMIN_PW) {
    isAdmin = true;
    closeAdminModal();
    applyAdminMode();
  } else {
    alert('암호가 틀렸습니다');
    const inp = document.getElementById('adminPwInput');
    if (inp) { inp.value = ''; inp.focus(); }
  }
}

// ── 상태 ──
// fieldTokens: { pid, slotIdx, freeX, freeY, pos, subPid? }
// slotIdx >= 0 → 어느 포메이션 슬롯(역할)인지 / freeX·freeY → 실제 화면 좌표(미세 조정)
// subPid: 교체 예정 선수 pid (optional)
let players = [], editingId = null, fieldSize = {w:0,h:0};
let matchEvents = {}, matchMom = null, editingMatchId = null;
let fieldTokens = [], matches = [], formationSaves = [], myTeamName = '', teamPhotoUrl = '';
let cachedFormation = '';
let photoTransform = { x: 0, y: 0, scale: 1 };
let matchParticipants = [];
let statsSubTab = 'personal';
let slotHighlight = -1; // 드래그 중 강조할 포메이션 슬롯 인덱스

// 팝업 모드: 'pos' | 'sub'
let popupMode = 'pos', popupTargetPid = null;

function getFormation() { return document.getElementById('formationSelect').value; }
function getSlots()     { return FORMATIONS[getFormation()] || []; }
function getLabels()    { return FORMATION_POS_LABELS[getFormation()] || []; }
function isFormationSelected() {
  const f = getFormation();
  return !!(f && FORMATIONS[f]);
}
function saveFormationLocal(value) {
  if (value && FORMATIONS[value]) {
    cachedFormation = value;
    localStorage.setItem('fc_formation', value);
  }
}
function inferFormationFromTokens(tokens) {
  if (!tokens?.length) return '';
  let bestKey = '';
  let bestScore = -1;
  Object.keys(FORMATIONS).forEach(key => {
    const labels = FORMATION_POS_LABELS[key] || [];
    let score = 0;
    tokens.forEach(t => {
      if (t.slotIdx >= 0 && t.slotIdx < labels.length) {
        if (!t.pos || t.pos === labels[t.slotIdx] || slotAcceptsPos(labels[t.slotIdx], t.pos)) score += 2;
        else score += 1;
      } else if (t.pos && labels.some(l => slotAcceptsPos(l, t.pos))) score += 1;
    });
    if (score > bestScore) { bestScore = score; bestKey = key; }
  });
  return bestScore > 0 ? bestKey : '4-3-3';
}
function resolveFormation(remoteFormation, tokens) {
  if (remoteFormation && FORMATIONS[remoteFormation]) return remoteFormation;
  const local = localStorage.getItem('fc_formation');
  if (local && FORMATIONS[local]) return local;
  if (tokens?.length) return inferFormationFromTokens(tokens);
  return '';
}
function setFormationSelect(value) {
  const sel = document.getElementById('formationSelect');
  if (!sel) return;
  const v = value && FORMATIONS[value] ? value : '';
  sel.value = v;
  if (v) saveFormationLocal(v);
}
function getFormationForSave() {
  const sel = getFormation();
  if (sel && FORMATIONS[sel]) return sel;
  if (cachedFormation && FORMATIONS[cachedFormation]) return cachedFormation;
  if (fieldTokens.length) return inferFormationFromTokens(fieldTokens) || '4-3-3';
  return '';
}
// 포메이션 변경 시: 기존 pos 라벨 기준으로 새 슬롯에 재배치 (freeX/freeY 갱신)
function remapTokensToNewFormation() {
  const slots = getSlots();
  const labels = getLabels();
  if (!slots.length) return;

  // slotIdx 가 겹치지 않도록 순서대로 배정
  const claimed = new Set();

  // 1차: pos 가 있는 토큰 → 포지션에 맞는 빈 슬롯 탐색
  fieldTokens.forEach(ft => {
    if (!ft.pos) return;
    for (let i = 0; i < labels.length; i++) {
      if (!claimed.has(i) && slotAcceptsPos(labels[i], ft.pos)) {
        claimed.add(i);
        ft.slotIdx = i;
        ft.freeX = slots[i][0];
        ft.freeY = slots[i][1];
        return;
      }
    }
    // 포지션 맞는 자리 없으면 slotIdx=-1 유지 (자유 위치)
    ft.slotIdx = -1;
  });

  // 2차: pos 없는 토큰 → 남은 빈 슬롯에 순서대로
  fieldTokens.forEach(ft => {
    if (ft.slotIdx >= 0) return;
    for (let i = 0; i < labels.length; i++) {
      if (!claimed.has(i)) {
        claimed.add(i);
        ft.slotIdx = i;
        ft.freeX = slots[i][0];
        ft.freeY = slots[i][1];
        ft.pos = labels[i];
        return;
      }
    }
  });
}
function reconcileFieldTokensToFormation() {
  const slots = getSlots();
  const labels = getLabels();
  if (!slots.length) return;
  fieldTokens.forEach(ft => {
    if (ft.slotIdx >= 0 && ft.slotIdx < slots.length) {
      // 기존 slotIdx 유효 → 좌표만 새 포메이션 기준으로 갱신
      ft.freeX = slots[ft.slotIdx][0];
      ft.freeY = slots[ft.slotIdx][1];
      if (!ft.pos) ft.pos = labels[ft.slotIdx];
    }
  });
}
function alertFormationRequired() {
  alert('포메이션을 선택해주세요.');
}

function tokenXY(t) {
  // freeX/freeY = 실제 화면 위치 (슬롯 근처 미세 조정 가능)
  if (t.freeX != null && t.freeY != null) return { x: t.freeX, y: t.freeY };
  const slots = getSlots();
  if (t.slotIdx >= 0 && slots[t.slotIdx]) return { x: slots[t.slotIdx][0], y: slots[t.slotIdx][1] };
  return { x: 0.5, y: 0.5 };
}
function slotDefaultXY(i) {
  const slots = getSlots();
  return slots[i] ? { x: slots[i][0], y: slots[i][1] } : { x: 0.5, y: 0.5 };
}

const STAR_ARC_LAYOUT = {
  1: [[50, 2]],
  2: [[30, 10], [70, 10]],
  3: [[20, 16], [50, 2], [80, 16]],
  4: [[14, 20], [36, 6], [64, 6], [86, 20]],
  5: [[10, 22], [28, 8], [50, 0], [72, 8], [90, 22]],
};
function tokenStarArcHtml(ovr) {
  const n = ovrStarCount(ovr);
  if (!n) return '';
  const tier = ovrStarTier(ovr);
  const pts = STAR_ARC_LAYOUT[n] || STAR_ARC_LAYOUT[1];
  const stars = pts.map(([l, t]) =>
    `<span class="token-star" style="left:${l}%;top:${t}%">★</span>`
  ).join('');
  return `<div class="token-star-arc ${tier}">${stars}</div>`;
}
function tokenOvrPillHtml(ovr) {
  if (ovr == null) return '';
  const tier = ovrStarTier(ovr);
  return `<div class="token-ovr-pill ${tier}"><span class="token-ovr-label">OVR+</span><span class="token-ovr-val">${Math.round(ovr)}</span></div>`;
}
function buildTokenInnerHtml(p, pos, ovr, subPid) {
  let subStr = '';
  if (subPid) {
    const subP = players.find(x => x.id === subPid);
    if (subP) subStr = `<div class="token-sub">🔄 ${subP.jersey != null ? subP.jersey + ' ' : ''}${subP.name}</div>`;
  }
  // 필드 배치 포지션(pos)이 있으면 그 색으로, 없으면 등록 포지션 기준
  const circleColor = posColor(pos ? [pos] : p.positions);
  return `<div class="token-avatar-wrap">
    ${ovr != null ? tokenStarArcHtml(ovr) : ''}
    <div class="token-circle" style="background:${circleColor}">
      ${p.name.slice(0, 2)}
      ${pos ? `<span class="token-pos-badge">${pos}</span>` : ''}
    </div>
  </div>
  <div class="token-name">${p.jersey != null ? p.jersey + ' ' : ''}${p.name}</div>
  ${tokenOvrPillHtml(ovr)}${subStr}`;
}
function tokenAtSlot(slotIdx, excludePid) {
  // 1차: slotIdx 정확히 일치
  const exact = fieldTokens.find(t => t.slotIdx === slotIdx && t.pid !== excludePid);
  if (exact) return exact;
  // 2차: slotIdx가 어긋난 경우 슬롯 중심 좌표 근접 거리로 탐색 (0.03 이내)
  const slots = getSlots();
  if (!slots[slotIdx]) return undefined;
  const [sx, sy] = slots[slotIdx];
  return fieldTokens.find(t =>
    t.pid !== excludePid &&
    typeof t.freeX === 'number' && typeof t.freeY === 'number' &&
    Math.hypot(t.freeX - sx, t.freeY - sy) < 0.03
  );
}

// ── 포지션별 슬롯 수 체크 ──
// 해당 포지션이 배치 가능한 슬롯 총 수 vs 이미 배치된 수 비교
function countSlotsByPos(pos) {
  // 현재 포메이션에서 이 포지션을 수용하는 슬롯 수
  const labels = getLabels();
  return labels.filter(l => slotAcceptsPos(l, pos)).length;
}
function countFieldByPos(pos, excludePid) {
  // slotIdx >= 0 인 토큰만 카운트 (자유 위치 토큰은 슬롯 점유 안 함)
  const labels = getLabels();
  return fieldTokens.filter(t =>
    t.pid !== excludePid &&
    t.slotIdx >= 0 &&
    t.slotIdx < labels.length &&
    slotAcceptsPos(labels[t.slotIdx], pos)
  ).length;
}
function checkSlotCapacity(pos, excludePid) {
  // return null = OK, string = 오류 메시지
  if (!isFormationSelected()) return '포메이션을 선택해주세요.';
  const cap = countSlotsByPos(pos);
  if (cap === 0) return `현재 포메이션에 ${pos} 자리가 없습니다.`;
  const cur = countFieldByPos(pos, excludePid);
  if (cur >= cap) return `${pos} 자리가 이미 꽉 찼습니다. (${cap}/${cap})`;
  return null;
}

// ── 구글 시트 동기화 ──
function updateSyncBar(state, msg) {
  const bar = document.getElementById('syncBar');
  const text = document.getElementById('syncText');
  if (!bar) return;
  // admin-only 클래스가 있는 syncInfo는 건드리지 않고 bar state만 변경
  bar.className = 'sync-bar ' + state;
  if (text) text.textContent = msg;
}
function handleSaveError(e) {
  console.error(e);
  updateSyncBar('error', '저장 실패');
  alert('저장에 실패했습니다. 인터넷 연결을 확인해주세요.');
}
function normalizeFieldTokens(raw) {
  return (raw || []).map(t => {
    // 구버전: slotIdx 없음 → {x,y} 좌표 방식
    if (t.slotIdx === undefined) {
      return { pid: t.pid, slotIdx: -1, freeX: t.x ?? 0.5, freeY: t.y ?? 0.5, pos: t.pos || '' };
    }
    // 현재 버전: pid/slotIdx 있음, 나머지 필드 기본값 보장
    return {
      pid: t.pid,
      slotIdx: t.slotIdx ?? -1,
      freeX: t.freeX ?? 0.5,
      freeY: t.freeY ?? 0.5,
      pos: t.pos || '',
      ...(t.subPid != null ? { subPid: t.subPid } : {}),
    };
  });
}
function applyRemoteData(data) {
  players = (data.players?.length ? data.players : DEFAULT_PLAYERS.map(p => ({...p}))).map(p => normalizePlayerOvr({...p}));
  matches = data.matches || [];
  formationSaves = data.saves || [];
  myTeamName = data.meta?.myTeam || '';
  teamPhotoUrl = normalizePhotoUrl(data.meta?.teamPhotoUrl || '');
  if (teamPhotoUrl) localStorage.setItem('fc_team_photo', teamPhotoUrl);
  const savedTransform = data.meta?.teamPhotoTransform;
  if (savedTransform && typeof savedTransform === 'object') {
    photoTransform = { x: savedTransform.x || 0, y: savedTransform.y || 0, scale: savedTransform.scale || 1 };
  } else {
    const lt = localStorage.getItem('fc_photo_transform');
    if (lt) try { photoTransform = JSON.parse(lt); } catch(e) {}
  }
  const field = data.field || {};
  const tokens = normalizeFieldTokens(field.tokens);
  const formation = resolveFormation(field.formation, tokens);
  if (formation) saveFormationLocal(formation);
  setFormationSelect(formation);
  fieldTokens = tokens;
  if (formation) reconcileFieldTokensToFormation();
}
async function maybeMigrateLocal(data) {
  const remoteEmpty = !data.players?.length && !data.matches?.length && !data.saves?.length;
  if (!remoteEmpty) return data;
  const lp = localStorage.getItem('fc_players');
  const lm = localStorage.getItem('fc_matches');
  const lf = localStorage.getItem('fc_field');
  const ls = localStorage.getItem('fc_saves');
  const lt = localStorage.getItem('fc_myteam');
  if (!lp && (!lm || lm === '[]') && !lf && (!ls || ls === '[]')) return data;
  const migrated = {
    players: lp ? JSON.parse(lp) : [],
    matches: lm ? JSON.parse(lm) : [],
    field: lf ? { formation: localStorage.getItem('fc_formation') || '4-3-3', tokens: JSON.parse(lf) } : (data.field || { formation: '4-3-3', tokens: [] }),
    saves: ls ? JSON.parse(ls) : [],
    meta: { myTeam: lt || '' },
  };
  await apiSavePartial(migrated);
  return migrated;
}
function loadLocalFallback() {
  const s = localStorage.getItem('fc_players');
  players = (s ? JSON.parse(s) : DEFAULT_PLAYERS.map(p => ({...p}))).map(p => normalizePlayerOvr({...p}));
  matches = JSON.parse(localStorage.getItem('fc_matches') || '[]');
  formationSaves = JSON.parse(localStorage.getItem('fc_saves') || '[]');
  myTeamName = localStorage.getItem('fc_myteam') || '';
  teamPhotoUrl = localStorage.getItem('fc_team_photo') || '';
  loadFieldState();
}
function hasLocalData() {
  return !!(localStorage.getItem('fc_players')
    || (localStorage.getItem('fc_matches') && localStorage.getItem('fc_matches') !== '[]')
    || localStorage.getItem('fc_field')
    || (localStorage.getItem('fc_saves') && localStorage.getItem('fc_saves') !== '[]'));
}
async function bootstrapApp() {
  setSyncHandler(updateSyncBar);
  try {
    let data = await apiLoadAll();
    const remoteEmpty = !data.players?.length && !data.matches?.length && !data.saves?.length;
    data = await maybeMigrateLocal(data);
    applyRemoteData(data);
    if (remoteEmpty && !hasLocalData()) {
      await persistPlayers();
      await persistField();
    }
  } catch (e) {
    console.error(e);
    updateSyncBar('error', '오프라인 (로컬 데이터)');
    loadLocalFallback();
  }
  renderHome();
  renderRoster();
  renderRecords();
  renderFormationSaves();
  populateStatsYearFilter();
  document.getElementById('formationSelect').addEventListener('change', () => {
    const f = getFormation();
    if (f) saveFormationLocal(f);
    remapTokensToNewFormation();
    slotHighlight = -1;
    drawFieldCanvas(-1);
    renderField();
    persistField().catch(handleSaveError);
    // 비관리자용 포메이션 레이블 갱신
    const vl = document.getElementById('formationViewLabel');
    if (vl) vl.textContent = f || '';
  });
  // 초기 관리자 모드 적용 (세션 복원 포함)
  applyAdminMode();
}
async function persistPlayers() { await apiSavePartial({ players }); }
async function persistField() {
  const formation = getFormationForSave();
  if (formation) saveFormationLocal(formation);
  const payload = { formation, tokens: fieldTokens };
  localStorage.setItem('fc_field', JSON.stringify(fieldTokens));
  localStorage.setItem('fc_field_full', JSON.stringify(payload));
  await apiSavePartial({ field: payload });
}
async function persistMatches() { await apiSavePartial({ matches }); }
async function persistSaves() { await apiSavePartial({ saves: formationSaves }); }
async function persistMeta() {
  await apiSavePartial({ meta: { myTeam: myTeamName, teamPhotoUrl: teamPhotoUrl || '', teamPhotoTransform: photoTransform } });
  if (teamPhotoUrl) localStorage.setItem('fc_team_photo', teamPhotoUrl);
  else localStorage.removeItem('fc_team_photo');
  localStorage.setItem('fc_photo_transform', JSON.stringify(photoTransform));
}
function normalizePhotoUrl(url) {
  if (!url) return '';
  const u = url.trim();
  // Google Drive: /file/d/ID/view 또는 ?id=ID 형태 모두 처리
  const fileId = u.match(/\/file\/d\/([^/?]+)/)?.[1]
    || (u.includes('drive.google.com') && u.match(/[?&]id=([^&]+)/)?.[1]);
  if (fileId) {
    // Google Drive thumbnail API: 공유 설정 무관하게 가장 안정적으로 로드됨
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
  }
  // OneDrive / Windows 공유 링크 → 직접 표시 불가
  if (/onedrive\.live\.com|1drv\.ms|sharepoint\.com/i.test(u)) return '__onedrive__';
  return u;
}

// ── 홈 (단체 사진 · 클럽원) ──
function applyPhotoTransform() {
  const img = document.getElementById('homePhoto');
  if (!img) return;
  img.style.transform = `translate(${photoTransform.x}px, ${photoTransform.y}px) scale(${photoTransform.scale})`;
  img.style.transformOrigin = 'center center';
}
let _photoSaveTimer = null;
function savePhotoTransform() {
  clearTimeout(_photoSaveTimer);
  _photoSaveTimer = setTimeout(() => {
    persistMeta().catch(handleSaveError);
  }, 600);
}
function resetPhotoTransform() {
  photoTransform = { x: 0, y: 0, scale: 1 };
  applyPhotoTransform();
  persistMeta().catch(handleSaveError);
}
function initPhotoDrag() {
  const wrap = document.getElementById('homePhotoWrap');
  if (!wrap || wrap._photoDragInit) return;
  wrap._photoDragInit = true;
  let pd = { active: false, startX: 0, startY: 0, startTX: 0, startTY: 0 };
  // 마우스 드래그
  wrap.addEventListener('mousedown', e => {
    if (e.target.closest('button')) return;
    if (!isAdmin || !teamPhotoUrl) return;
    pd = { active: true, startX: e.clientX, startY: e.clientY, startTX: photoTransform.x, startTY: photoTransform.y };
    wrap.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!pd.active) return;
    photoTransform.x = pd.startTX + (e.clientX - pd.startX);
    photoTransform.y = pd.startTY + (e.clientY - pd.startY);
    applyPhotoTransform();
  });
  document.addEventListener('mouseup', () => {
    if (!pd.active) return;
    pd.active = false;
    const w = document.getElementById('homePhotoWrap');
    if (w) w.style.cursor = '';
    savePhotoTransform();
  });
  // 터치 드래그
  let pinchDist0 = 0, pinchScale0 = 1;
  wrap.addEventListener('touchstart', e => {
    if (!isAdmin || !teamPhotoUrl) return;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      pd = { active: true, startX: t.clientX, startY: t.clientY, startTX: photoTransform.x, startTY: photoTransform.y };
    } else if (e.touches.length === 2) {
      pd.active = false;
      pinchDist0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchScale0 = photoTransform.scale;
    }
  }, { passive: true });
  wrap.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && pd.active) {
      const t = e.touches[0];
      photoTransform.x = pd.startTX + (t.clientX - pd.startX);
      photoTransform.y = pd.startTY + (t.clientY - pd.startY);
      applyPhotoTransform();
      e.preventDefault();
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      photoTransform.scale = Math.max(0.3, Math.min(4, pinchScale0 * (dist / pinchDist0)));
      applyPhotoTransform();
      e.preventDefault();
    }
  }, { passive: false });
  wrap.addEventListener('touchend', () => {
    if (pd.active) { pd.active = false; savePhotoTransform(); }
  });
  // 마우스 휠 줌
  wrap.addEventListener('wheel', e => {
    if (!isAdmin || !teamPhotoUrl) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    photoTransform.scale = Math.max(0.3, Math.min(4, photoTransform.scale + delta));
    applyPhotoTransform();
    savePhotoTransform();
  }, { passive: false });
}
function renderHome() {
  const nameEl = document.getElementById('homeTeamName');
  if (nameEl) nameEl.textContent = myTeamName || '우리 FC';
  const img = document.getElementById('homePhoto');
  const ph = document.getElementById('homePhotoPlaceholder');
  if (img && ph) {
    if (teamPhotoUrl) {
      img.src = teamPhotoUrl;
      img.draggable = false;
      img.style.display = 'block';
      ph.style.display = 'none';
      img.onerror = () => { img.style.display = 'none'; ph.style.display = 'flex'; };
      applyPhotoTransform();
    } else {
      img.style.display = 'none';
      img.removeAttribute('src');
      ph.style.display = 'flex';
    }
  }
  initPhotoDrag();
  // 초기화 버튼 (사진 있을 때만)
  const wrap = document.getElementById('homePhotoWrap');
  let resetBtn = document.getElementById('photoResetBtn');
  if (wrap && teamPhotoUrl) {
    if (!resetBtn) {
      resetBtn = document.createElement('button');
      resetBtn.id = 'photoResetBtn';
      resetBtn.type = 'button';
      resetBtn.className = 'btn-photo-reset';
      resetBtn.title = '사진 위치/크기 초기화';
      resetBtn.textContent = '↺';
      resetBtn.onclick = resetPhotoTransform;
      wrap.appendChild(resetBtn);
    }
    resetBtn.style.display = 'block';
  } else if (resetBtn) {
    resetBtn.style.display = 'none';
  }
  const countEl = document.getElementById('homeMemberCount');
  if (countEl) countEl.textContent = `(${players.length}명)`;
  const grid = document.getElementById('homeMemberGrid');
  if (grid) {
    grid.innerHTML = players.length
      ? players.map(p => `<div class="home-member-chip">${p.jersey != null ? `<span class="home-member-no">${p.jersey}</span>` : ''}${p.name}</div>`).join('')
      : '<div style="font-size:12px;color:var(--text3)">명단 탭에서 선수를 추가해주세요</div>';
  }
}
function refreshHomeIfVisible() {
  if (document.getElementById('tab-home')?.classList.contains('active')) renderHome();
}
function openPhotoUrlModal() {
  document.getElementById('photoUrlInput').value = teamPhotoUrl || '';
  document.getElementById('photoUrlModal').classList.add('open');
  setTimeout(() => document.getElementById('photoUrlInput').focus(), 100);
}
function closePhotoUrlModal() {
  document.getElementById('photoUrlModal').classList.remove('open');
}
function saveTeamPhotoUrl() {
  const raw = document.getElementById('photoUrlInput').value.trim();
  if (!raw) { alert('URL을 입력해주세요'); return; }
  if (!/^https?:\/\//i.test(raw)) { alert('http:// 또는 https:// 로 시작하는 주소를 입력해주세요'); return; }
  const normalized = normalizePhotoUrl(raw);
  if (normalized === '__onedrive__') {
    alert('OneDrive/윈도우 공유 링크는 외부에서 직접 표시할 수 없습니다.\n\n사진을 등록하려면:\n① Google Drive에 업로드 후 공유 링크\n② 이미지 호스팅 사이트(예: Imgur)에 업로드 후 직접 링크\n를 사용해 주세요.');
    return;
  }
  teamPhotoUrl = normalized;
  persistMeta().then(() => {
    closePhotoUrlModal();
    renderHome();
  }).catch(handleSaveError);
}
function clearTeamPhoto() {
  if (!teamPhotoUrl && !document.getElementById('photoUrlInput').value.trim()) {
    closePhotoUrlModal();
    return;
  }
  if (!confirm('단체 사진을 제거할까요?')) return;
  teamPhotoUrl = '';
  persistMeta().then(() => {
    closePhotoUrlModal();
    renderHome();
  }).catch(handleSaveError);
}
function editTeamName() {
  const name = prompt('팀 이름', myTeamName || '우리 FC');
  if (name === null) return;
  myTeamName = name.trim() || '우리 FC';
  persistMeta().then(() => renderHome()).catch(handleSaveError);
}

// ── 선수 데이터 ──
function savePlayers() { persistPlayers().catch(handleSaveError); }
function nextId() { return players.length ? Math.max(...players.map(p=>p.id))+1 : 1; }

function playerLayerRange(positions) {
  if (!positions.length) return {min:3,max:3};
  const layers = positions.map(p => POS_LAYER[p]??3);
  return {min:Math.min(...layers), max:Math.max(...layers)};
}
function overlapSortKey(p) {
  const {min,max} = playerLayerRange(p.positions);
  return min===max ? min*10 : min*10+5;
}
function sortByPosition() { players.sort((a,b)=>overlapSortKey(a)-overlapSortKey(b)); savePlayers(); renderRoster(); }

// ── 명단 렌더 ──
function renderRoster() {
  const el = document.getElementById('playerList');
  if (!players.length) { el.innerHTML='<div class="empty-state">선수가 없습니다</div>'; return; }
  el.innerHTML = players.map((p,i) => {
    const bestOvr = getBestOvr(p);
    const ovrText = bestOvr!=null ? `<span class="ovr-badge">${bestOvr}</span>${ovrStars(bestOvr)}` : '';
    const posOvrTags = p.positions.map(pos => {
      const ov = p.ovr?p.ovr[pos]:null;
      return `<span class="ovr-pos-item">${pos}${ov!=null?' '+ov:''}</span>`;
    }).join('');
    const jersey = p.jersey != null ? p.jersey : '—';
    return `<div class="player-card">
      ${isAdmin ? `<div class="num-ctrl">
        <button class="btn-num" onclick="movePlayerNum(${p.id},-1)" ${i===0?'disabled':''}>▲</button>
        <button class="btn-num" onclick="movePlayerNum(${p.id},1)" ${i===players.length-1?'disabled':''}>▼</button>
      </div>` : ''}
      <div class="player-jersey" style="background:${posColor(p.positions)}22;color:${posColor(p.positions)};border:1px solid ${posColor(p.positions)}44">${jersey}</div>
      <div class="player-info">
        <div class="player-name-row"><span class="player-name">${p.name}</span>${ovrText}</div>
        <div class="ovr-pos-list">${posOvrTags||'<span style="font-size:11px;color:var(--text3)">포지션 없음</span>'}</div>
      </div>
      ${isAdmin ? `
      <button class="btn-icon" onclick="openEditModal(${p.id})"><i class="ti ti-edit"></i></button>
      <button class="btn-icon danger" onclick="deletePlayer(${p.id})"><i class="ti ti-trash"></i></button>` : ''}
    </div>`;
  }).join('');
}
function movePlayerNum(id,dir) {
  const idx=players.findIndex(p=>p.id===id), ni=idx+dir;
  if (ni<0||ni>=players.length) return;
  [players[idx],players[ni]]=[players[ni],players[idx]];
  savePlayers(); renderRoster();
}

// ── 선수 모달 ──
function buildPosCheckboxes() {
  document.getElementById('posCheckboxes').innerHTML = ALL_POS.map(p=>`
    <input type="checkbox" class="pos-cb" id="pcb_${p}" value="${p}" onchange="updateOvrInputs()">
    <label class="pos-cb-label" for="pcb_${p}">${p}</label>`).join('');
}
function updateOvrInputs() {
  const selected = ALL_POS.filter(p=>document.getElementById('pcb_'+p)?.checked);
  const sec=document.getElementById('ovrSection'), inp=document.getElementById('ovrInputs');
  sec.style.display = selected.length?'block':'none';
  const curVals={};
  inp.querySelectorAll('.ovr-range').forEach(r=>{curVals[r.dataset.pos]=r.value;});
  inp.innerHTML = selected.map(pos => {
    const v = curVals[pos]??'50';
    return `<div class="ovr-row">
      <span class="pos-label">${pos}</span>
      <input type="range" class="ovr-range" data-pos="${pos}" min="1" max="100" step="1" value="${v}"
        oninput="this.nextElementSibling.textContent=this.value;this.parentElement.querySelector('.ovr-star-preview').innerHTML=ovrStars(parseInt(this.value))">
      <span class="ovr-val">${v}</span>
      <span class="ovr-star-preview">${ovrStars(parseInt(v))}</span>
    </div>`;
  }).join('');
}
function openAddModal() {
  editingId=null;
  document.getElementById('modalTitle').textContent='선수 추가';
  document.getElementById('inputName').value='';
  document.getElementById('inputJersey').value='';
  buildPosCheckboxes();
  document.getElementById('ovrSection').style.display='none';
  document.getElementById('ovrInputs').innerHTML='';
  document.getElementById('playerModal').classList.add('open');
  setTimeout(()=>document.getElementById('inputName').focus(),100);
}
function openEditModal(id) {
  const p=players.find(x=>x.id===id); if(!p) return;
  editingId=id;
  document.getElementById('modalTitle').textContent='선수 편집';
  document.getElementById('inputName').value=p.name;
  document.getElementById('inputJersey').value=p.jersey||'';
  buildPosCheckboxes();
  p.positions.forEach(pos=>{const cb=document.getElementById('pcb_'+pos); if(cb)cb.checked=true;});
  const inp=document.getElementById('ovrInputs');
  document.getElementById('ovrSection').style.display=p.positions.length?'block':'none';
  inp.innerHTML=p.positions.map(pos=>{
    const v=(p.ovr&&p.ovr[pos]!=null)?p.ovr[pos]:50;
    return `<div class="ovr-row">
      <span class="pos-label">${pos}</span>
      <input type="range" class="ovr-range" data-pos="${pos}" min="1" max="100" step="1" value="${v}"
        oninput="this.nextElementSibling.textContent=this.value;this.parentElement.querySelector('.ovr-star-preview').innerHTML=ovrStars(parseInt(this.value))">
      <span class="ovr-val">${v}</span>
      <span class="ovr-star-preview">${ovrStars(v)}</span>
    </div>`;
  }).join('');
  document.getElementById('playerModal').classList.add('open');
}
function closeModal() { document.getElementById('playerModal').classList.remove('open'); }
function savePlayer() {
  const name=document.getElementById('inputName').value.trim();
  if(!name){alert('이름을 입력해주세요');return;}
  const jersey=parseInt(document.getElementById('inputJersey').value)||null;
  const positions=ALL_POS.filter(p=>document.getElementById('pcb_'+p)?.checked);
  const ovr={};
  document.getElementById('ovrInputs').querySelectorAll('.ovr-range').forEach(r=>{ovr[r.dataset.pos]=parseInt(r.value);});
  if(editingId){
    const idx=players.findIndex(x=>x.id===editingId);
    if(idx>=0) players[idx]=normalizePlayerOvr({...players[idx],name,jersey,positions,ovr});
  } else {
    players.push(normalizePlayerOvr({id:nextId(),name,jersey,positions,ovr}));
  }
  savePlayers(); closeModal(); renderRoster(); renderField(); refreshHomeIfVisible();
}
function deletePlayer(id) {
  if(!confirm('삭제하시겠습니까?')) return;
  players=players.filter(p=>p.id!==id);
  fieldTokens=fieldTokens.filter(t=>t.pid!==id);
  saveFieldState(); savePlayers(); renderRoster(); renderField(); refreshHomeIfVisible();
}
document.getElementById('playerModal').addEventListener('click',function(e){if(e.target===this)closeModal();});

// ── 통합 팝업 (포지션 변경 + 선수 변경) ──
function renderPosPopupGrid(pid) {
  const p = players.find(x => x.id === pid);
  const ft = fieldTokens.find(t => t.pid === pid);
  if (!p) return '';
  const curPos = ft?.pos || p.positions[0] || '';
  if (!isFormationSelected()) {
    return '<div class="pos-popup-hint">포메이션을 먼저 선택해주세요.</div>';
  }
  return ALL_POS.map(pos =>
    `<button class="pos-popup-btn ${pos === curPos ? 'active' : ''}" onclick="selectPosFromPopup('${pos}')">${pos}</button>`
  ).join('');
}
function hidePosPopupExtras() {
  document.getElementById('posPopupSwapBtn').style.display = 'none';
  document.getElementById('posPopupSubBtn').style.display = 'none';
  document.getElementById('posPopupBenchBtn').style.display = 'none';
}
function findBestEmptySlotForPlayer(p) {
  const labels = getLabels();
  let bestIdx = -1;
  let bestScore = -1;
  for (let i = 0; i < labels.length; i++) {
    if (tokenAtSlot(i, null)) continue;
    const label = labels[i];
    const matching = p.positions?.length
      ? p.positions.filter(pos => slotAcceptsPos(label, pos))
      : [];
    let score;
    if (matching.length) {
      score = Math.max(...matching.map(pos => getOvr(p, pos) ?? 0));
    } else if (!p.positions?.length) {
      score = 0;
    } else {
      continue;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}
function autoPlaceFromBench(pid) {
  if (!isFormationSelected()) return false;
  if (fieldTokens.length >= MAX_FIELD) return false; // 알림은 handlePlayerTap에서 처리
  if (fieldTokens.find(t => t.pid === pid)) return false;
  const p = players.find(x => x.id === pid);
  if (!p) return false;
  const slots = getSlots();
  const labels = getLabels();
  const slotIdx = findBestEmptySlotForPlayer(p);
  if (slotIdx < 0) return false;
  const pos = labels[slotIdx];
  // findBestEmptySlotForPlayer가 이미 빈 슬롯만 반환하므로 추가 용량 체크 불필요
  fieldTokens.push({
    pid,
    slotIdx,
    freeX: slots[slotIdx][0],
    freeY: slots[slotIdx][1],
    pos,
  });
  saveFieldState();
  renderField();
  return true;
}
function openBenchPosMenu(pid, anchorEl) {
  popupMode = 'bench-pos';
  popupTargetPid = pid;
  const p = players.find(x => x.id === pid);
  if (!p) return;
  document.getElementById('posPopupTitle').textContent =
    `${p.jersey != null ? '#' + p.jersey + ' ' : ''}${p.name} · 포지션 선택`;
  const grid = document.getElementById('posPopupGrid');
  grid.className = 'pos-popup-grid';
  grid.innerHTML = renderPosPopupGrid(pid);
  hidePosPopupExtras();
  _showPopupAt(anchorEl);
}
function openFieldActionMenu(pid, anchorEl) {
  popupMode = 'field-menu';
  popupTargetPid = pid;
  const p = players.find(x => x.id === pid);
  if (!p) return;
  anchorEl = anchorEl || document.querySelector(`.player-token[data-pid="${pid}"]`);
  document.getElementById('posPopup').classList.remove('wide');
  document.getElementById('posPopupTitle').textContent =
    `${p.jersey != null ? '#' + p.jersey + ' ' : ''}${p.name}`;
  const grid = document.getElementById('posPopupGrid');
  grid.className = 'pos-popup-grid actions';
  grid.innerHTML = `
    <button type="button" class="pos-popup-action" onclick="event.stopPropagation();openFieldPosGrid(${pid})">📍 포지션 바꾸기</button>
    <button type="button" class="pos-popup-action" onclick="event.stopPropagation();openSwapPopup(${pid})">↔️ 다른 선수와 교체</button>
    <button type="button" class="pos-popup-action pos-popup-action-danger" onclick="event.stopPropagation();sendToBenchFromPopup()">벤치로 보내기</button>
  `;
  hidePosPopupExtras();
  _showPopupAt(anchorEl);
}
function openFieldPosGrid(pid) {
  popupMode = 'pos';
  popupTargetPid = pid;
  const p = players.find(x => x.id === pid);
  if (!p) return;
  document.getElementById('posPopupTitle').textContent = `포지션 변경 · ${p.name}`;
  const grid = document.getElementById('posPopupGrid');
  grid.className = 'pos-popup-grid pos-popup-grid-wide';
  grid.innerHTML =
    `<button type="button" class="pos-popup-back" onclick="event.stopPropagation();openFieldActionMenu(${pid}, null)">← 메뉴로</button>
     <div class="pos-popup-grid-inner">${renderPosPopupGrid(pid)}</div>`;
  hidePosPopupExtras();
  document.getElementById('posPopupSubBtn').style.display = 'block';
  document.getElementById('posPopup').classList.add('wide');
  const anchorEl = document.querySelector(`.player-token[data-pid="${pid}"]`);
  _showPopupAt(anchorEl);
}
function handlePlayerTap(pid, anchorEl, fromBench) {
  if (!isAdmin) return;
  if (fromBench) {
    if (!isFormationSelected()) { alertFormationRequired(); return; }
    // 필드 꽉 찼으면 → 교체 팝업 (포지션 팝업 X)
    if (fieldTokens.length >= MAX_FIELD) {
      openBenchReplace(pid);
      return;
    }
    if (autoPlaceFromBench(pid)) return;
    const p = players.find(x => x.id === pid);
    if (p && findBestEmptySlotForPlayer(p) < 0) {
      alert('맞는 빈 자리가 없습니다. 포지션을 직접 선택해주세요.');
    }
    openBenchPosMenu(pid, anchorEl);
    return;
  }
  if (fieldTokens.find(t => t.pid === pid)) {
    openFieldActionMenu(pid, anchorEl);
  } else {
    openBenchPosMenu(pid, anchorEl);
  }
}

function openSubPopup(pid) {
  popupMode = 'sub';
  popupTargetPid = pid;
  const p = players.find(x=>x.id===pid); if(!p) return;
  const ft = fieldTokens.find(t=>t.pid===pid);
  const anchorEl = document.querySelector(`.player-token[data-pid="${pid}"]`);

  document.getElementById('posPopupTitle').textContent = `🔄 ${p.name} — 후반 교체 예정`;

  const onField = new Set(fieldTokens.map(t=>t.pid));
  const bench = players.filter(x=>x.id!==pid&&!onField.has(x.id));
  const rows = bench.map(x => {
    const isSub = ft?.subPid === x.id;
    const ovr = getBestOvr(x);
    return `<button class="pos-popup-btn sub-player-btn ${isSub?'active':''}" onclick="selectSubPlayer(${x.id})" style="width:100%;text-align:left;display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:var(--radius);margin-bottom:3px">
      <span style="font-weight:600;flex:1">${x.jersey!=null?'#'+x.jersey+' ':''}${x.name}</span>
      ${ovr!=null?`<span style="font-size:10px;color:var(--text3)">${ovr}</span>`:''}
      <span style="font-size:9px;background:var(--bg2);color:var(--text3);padding:1px 5px;border-radius:6px">벤치</span>
    </button>`;
  }).join('');

  const subGrid = document.getElementById('posPopupGrid');
  subGrid.className = 'pos-popup-grid';
  subGrid.innerHTML = bench.length
    ? `<div style="width:100%;max-height:200px;overflow-y:auto">${rows}</div>`
    : '<div style="font-size:11px;color:var(--text3)">벤치에 교체 가능한 선수가 없습니다</div>';

  document.getElementById('posPopupSwapBtn').style.display = 'none';
  document.getElementById('posPopupSubBtn').style.display = 'none';
  const bb = document.getElementById('posPopupBenchBtn');
  bb.style.display = ft?.subPid ? 'block' : 'none';
  bb.textContent = '교체 예정 해제';
  bb.onclick = clearSubPlayer;

  _showPopupAt(anchorEl);
}

function openSwapPopup(pid) {
  popupMode = 'swap';
  popupTargetPid = pid;
  const p = players.find(x=>x.id===pid); if(!p) return;
  const anchorEl = document.querySelector(`.player-token[data-pid="${pid}"]`);

  document.getElementById('posPopupTitle').textContent = `↔️ ${p.name} — 즉시 교체`;

  const others = fieldTokens.filter(t=>t.pid!==pid);
  const rows = others.map(t => {
    const x = players.find(pl=>pl.id===t.pid); if(!x) return '';
    const ovr = getOvr(x, t.pos);
    return `<button class="pos-popup-btn" onclick="selectSwapPlayer(${t.pid})" style="width:100%;text-align:left;display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:var(--radius);margin-bottom:3px">
      <span style="font-weight:600;flex:1">${x.jersey!=null?'#'+x.jersey+' ':''}${x.name}</span>
      <span style="font-size:10px;color:var(--text3)">${t.pos||''}</span>
      ${ovr!=null?`<span style="font-size:10px;color:var(--text3)">${ovr}</span>`:''}
    </button>`;
  }).join('');

  const swapGrid = document.getElementById('posPopupGrid');
  swapGrid.className = 'pos-popup-grid';
  swapGrid.innerHTML = others.length
    ? `<div style="width:100%;max-height:200px;overflow-y:auto">${rows}</div>`
    : '<div style="font-size:11px;color:var(--text3)">교체할 필드 선수가 없습니다</div>';

  document.getElementById('posPopupSwapBtn').style.display = 'none';
  document.getElementById('posPopupSubBtn').style.display = 'none';
  document.getElementById('posPopupBenchBtn').style.display = 'none';

  _showPopupAt(anchorEl);
}

function openBenchReplace(benchPid) {
  popupMode = 'bench-replace';
  popupTargetPid = benchPid;
  const p = players.find(x=>x.id===benchPid); if(!p) return;

  document.getElementById('posPopupTitle').textContent = `🔄 ${p.name} — 누구와 교체?`;

  const rows = fieldTokens.map(t => {
    const x = players.find(pl=>pl.id===t.pid); if(!x) return '';
    return `<button class="pos-popup-btn" onclick="benchReplaceWith(${benchPid},${t.pid})" style="width:100%;text-align:left;display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:var(--radius);margin-bottom:3px">
      <span style="font-weight:600;flex:1">${x.jersey!=null?'#'+x.jersey+' ':''}${x.name}</span>
      <span style="font-size:10px;color:var(--text3)">${t.pos||''}</span>
    </button>`;
  }).join('');

  const brGrid = document.getElementById('posPopupGrid');
  brGrid.className = 'pos-popup-grid';
  brGrid.innerHTML = fieldTokens.length
    ? `<div style="width:100%;max-height:200px;overflow-y:auto">${rows}</div>`
    : '<div style="font-size:11px;color:var(--text3)">필드에 교체할 선수가 없습니다</div>';

  document.getElementById('posPopupSwapBtn').style.display = 'none';
  document.getElementById('posPopupSubBtn').style.display = 'none';
  document.getElementById('posPopupBenchBtn').style.display = 'none';

  const anchorEl = document.querySelector(`.btn-bench-swap[data-pid="${benchPid}"]`);
  _showPopupAt(anchorEl);
}

function _showPopupAt(anchorEl) {
  const rect = anchorEl ? anchorEl.getBoundingClientRect() : {left:window.innerWidth/2-115, bottom:window.innerHeight/2, top:window.innerHeight/2-200, right:0};
  const pw=240, ph=300;
  let left=rect.left, top=rect.bottom+6;
  if(left+pw>window.innerWidth) left=window.innerWidth-pw-8;
  if(top+ph>window.innerHeight) top=rect.top-ph-6;
  if(top<0) top=8;
  const popup=document.getElementById('posPopup');
  popup.style.left=left+'px'; popup.style.top=top+'px';
  popup.classList.add('open');
  document.getElementById('popupOverlay').style.display='block';
}

function closePosPopup() {
  document.getElementById('posPopup').classList.remove('open', 'wide');
  document.getElementById('popupOverlay').style.display='none';
  popupTargetPid = null;
  popupMode = 'pos';
  const grid = document.getElementById('posPopupGrid');
  if (grid) grid.className = 'pos-popup-grid';
  const bb = document.getElementById('posPopupBenchBtn');
  bb.textContent = '벤치로 보내기';
  bb.onclick = sendToBenchFromPopup;
  hidePosPopupExtras();
}

function sendToBenchFromPopup() {
  if(!popupTargetPid) return;
  fieldTokens=fieldTokens.filter(t=>t.pid!==popupTargetPid);
  saveFieldState(); closePosPopup(); renderField();
}

function selectPosFromPopup(pos) {
  if(!popupTargetPid) return;
  if (!isFormationSelected()) { alertFormationRequired(); closePosPopup(); return; }
  const pid=popupTargetPid;
  const p=players.find(x=>x.id===pid); if(!p) return;

  const slots=getSlots(), labels=getLabels();
  const ft=fieldTokens.find(t=>t.pid===pid);

  if(!ft) {
    // 벤치 → 필드: 인원·용량 체크 필요
    if(fieldTokens.length>=MAX_FIELD){alert(`최대 ${MAX_FIELD}명까지만 출전 가능합니다.`);closePosPopup();return;}
    const err = checkSlotCapacity(pos, null);
    if(err) { alert(err); return; }
  }
  // 필드 선수 포지션 변경: 체크 없음 (자리만 바뀌므로 총 인원 변동 없음)

  // 포지션 목록 맨 앞으로
  if(!p.positions.includes(pos)) p.positions.unshift(pos);
  else { p.positions=p.positions.filter(x=>x!==pos); p.positions.unshift(pos); }
  savePlayers(); renderRoster();

  if(ft) {
    // 1차: 빈 슬롯 탐색
    let slotIdx=findBestSlot(pos, slots, labels, pid);
    // 2차: 빈 슬롯 없으면 이미 차 있는 슬롯도 허용 (swap)
    if(slotIdx<0) {
      for(let i=0;i<labels.length;i++){
        if(i!==ft.slotIdx && slotAcceptsPos(labels[i],pos)){slotIdx=i;break;}
      }
    }
    if(slotIdx>=0) {
      const other=tokenAtSlot(slotIdx,pid);
      // 현재 위치 먼저 저장 (덮어쓰기 전에)
      const prevSlot=ft.slotIdx, prevX=ft.freeX, prevY=ft.freeY, prevPos=ft.pos;
      // ft를 새 슬롯으로 이동
      ft.slotIdx=slotIdx; ft.freeX=slots[slotIdx][0]; ft.freeY=slots[slotIdx][1]; ft.pos=pos;
      if(other) {
        // other를 ft가 있던 자리로 swap
        other.slotIdx=prevSlot;
        other.freeX=prevSlot>=0?(slots[prevSlot]?.[0]??prevX):prevX;
        other.freeY=prevSlot>=0?(slots[prevSlot]?.[1]??prevY):prevY;
        other.pos=prevSlot>=0&&labels[prevSlot]?labels[prevSlot]:prevPos;
      }
    } else {
      ft.pos=pos; // 맞는 슬롯 자체가 없는 포메이션일 때 pos만 변경
    }
  } else {
    const slotIdx=findBestSlot(pos, slots, labels, null);
    if(slotIdx<0){alert(`${pos} 에 배치할 수 있는 빈 자리가 없습니다.`);closePosPopup();return;}
    fieldTokens.push({pid, slotIdx, freeX:slots[slotIdx][0], freeY:slots[slotIdx][1], pos});
  }
  saveFieldState(); closePosPopup(); renderField();
}

// ── 교체 예정 (벤치만) ──
function selectSubPlayer(targetPid) {
  if(!popupTargetPid) return;
  const ft=fieldTokens.find(t=>t.pid===popupTargetPid); if(!ft) return;
  ft.subPid=targetPid;
  saveFieldState(); closePosPopup(); renderField();
}
// ── 즉시 교체 (필드↔필드) ──
function selectSwapPlayer(targetPid) {
  if(!popupTargetPid) return;
  const ft=fieldTokens.find(t=>t.pid===popupTargetPid);
  const targetFt=fieldTokens.find(t=>t.pid===targetPid);
  if(!ft||!targetFt) return;
  const tmp={slotIdx:ft.slotIdx,freeX:ft.freeX,freeY:ft.freeY,pos:ft.pos};
  ft.slotIdx=targetFt.slotIdx; ft.freeX=targetFt.freeX; ft.freeY=targetFt.freeY; ft.pos=targetFt.pos;
  targetFt.slotIdx=tmp.slotIdx; targetFt.freeX=tmp.freeX; targetFt.freeY=tmp.freeY; targetFt.pos=tmp.pos;
  ft.subPid=null; targetFt.subPid=null;
  saveFieldState(); closePosPopup(); renderField();
}
// ── 벤치 → 필드 즉시 교체 ──
function benchReplaceWith(benchPid, fieldPid) {
  const ft=fieldTokens.find(t=>t.pid===fieldPid);
  const benchP=players.find(p=>p.id===benchPid);
  if(!ft||!benchP) return;
  const newToken={pid:benchPid,slotIdx:ft.slotIdx,freeX:ft.freeX,freeY:ft.freeY,pos:ft.pos||benchP.positions[0]||'',subPid:null};
  fieldTokens=fieldTokens.map(t=>t.pid===fieldPid?newToken:t);
  saveFieldState(); closePosPopup(); renderField();
}
function clearSubPlayer() {
  const ft=fieldTokens.find(t=>t.pid===popupTargetPid); if(!ft) return;
  ft.subPid=null;
  saveFieldState(); closePosPopup(); renderField();
}

// 팝업 닫기는 오버레이(#popupOverlay) onclick으로 처리

// ── 슬롯 탐색 ──
function slotAcceptsPos(slotLabel, pos) { return (SLOT_LABEL_MATCH[slotLabel]||[slotLabel]).includes(pos); }
function findBestSlot(pos, slots, labels, excludePid) {
  for(let i=0;i<labels.length;i++){
    if(!tokenAtSlot(i,excludePid)&&slotAcceptsPos(labels[i],pos)) return i;
  }
  // fallback 제거: 포지션 맞는 슬롯 없으면 -1 반환 (빈 슬롯으로 밀어넣기 금지)
  return -1;
}

// ── 필드 캔버스 ──
function fieldPad(W) { return Math.max(8, Math.round(W * 16 / 400)); }
function getCanvasRect() { return document.getElementById('fieldCanvas').getBoundingClientRect(); }
function pointerToNorm(clientX, clientY) {
  const cr = getCanvasRect();
  const pad = fieldPad(cr.width);
  const nx = (clientX - cr.left - pad) / (cr.width - 2 * pad);
  const ny = (clientY - cr.top - pad) / (cr.height - 2 * pad);
  return {
    x: Math.max(0.02, Math.min(0.98, nx)),
    y: Math.max(0.02, Math.min(0.98, ny)),
  };
}
/** 포메이션 기본 좌표(0~1, 플레이 영역) → 캔버스 픽셀 — 슬롯 마커·선수 공통 */
function normToCanvasPx(nx, ny, W, H) {
  const pad = fieldPad(W);
  return { x: pad + nx * (W - 2 * pad), y: pad + ny * (H - 2 * pad) };
}
/** 포메이션 슬롯을 필드 캔버스에 직접 그림 — 선수와 무관한 고정 자리 */
function drawFormationSlots(ctx, W, H, nearSlot) {
  if (!document.getElementById('tab-formation')?.classList.contains('active')) return;
  const slots = getSlots(), labels = getLabels();
  const occupied = new Set(fieldTokens.map(t => t.slotIdx).filter(i => i >= 0));
  const sc = W / 420;
  const rBase = Math.max(10, 14 * sc);
  const rNear = Math.max(14, 20 * sc);
  slots.forEach((sl, i) => {
    const { x, y } = normToCanvasPx(sl[0], sl[1], W, H);
    const isNear = i === nearSlot;
    const isOccupied = occupied.has(i);
    const r = isNear ? rNear : rBase;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = isNear ? 'rgba(255,255,255,0.38)' : isOccupied ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.24)';
    ctx.fill();
    ctx.strokeStyle = isNear ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.32)';
    ctx.lineWidth = isNear ? 2 : 1;
    ctx.stroke();
    if (labels[i]) {
      ctx.fillStyle = isNear ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.52)';
      ctx.font = `bold ${isNear ? Math.max(9, Math.round(11 * sc)) : Math.max(8, Math.round(9 * sc))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], x, y);
    }
  });
}
function drawFieldCanvas(highlightSlot) {
  if (highlightSlot !== undefined) slotHighlight = highlightSlot;
  const canvas=document.getElementById('fieldCanvas');
  const wrap=document.getElementById('fieldWrap');
  const RATIO=1.45;
  const maxW=(wrap.clientWidth||window.innerWidth)-24;
  const maxH=wrap.clientHeight-8;
  let W=maxW;
  let H=Math.round(W*RATIO);
  if(maxH>120&&H>maxH){H=maxH;W=Math.round(H/RATIO);}
  W=Math.max(200,W); H=Math.round(W*RATIO);
  canvas.width=W; canvas.height=H;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  fieldSize={w:W,h:H};
  drawGrass(canvas);
  drawFormationSlots(canvas.getContext('2d'), W, H, slotHighlight);
}
function refreshFieldSlots(highlightSlot) {
  drawFieldCanvas(highlightSlot);
  repositionFieldTokens();
}
function repositionFieldTokens() {
  fieldTokens.forEach(t => {
    const el = document.querySelector(`.player-token[data-pid="${t.pid}"]`);
    if (!el) return;
    const { x, y } = tokenXY(t);
    const { left, top } = tokenPos(x, y);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  });
}
function drawGrass(canvas) {
  const W=canvas.width, H=canvas.height;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#1e7a43'; ctx.fillRect(0,0,W,H);
  for(let i=0;i<8;i++){if(i%2===0){ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(0,i*H/8,W,H/8);}}
  ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1.5;
  const pad=fieldPad(W);
  ctx.strokeRect(pad,pad,W-pad*2,H-pad*2);
  const mx=W/2, my=H/2;
  ctx.beginPath();ctx.moveTo(pad,my);ctx.lineTo(W-pad,my);ctx.stroke();
  ctx.beginPath();ctx.arc(mx,my,W*0.12,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(mx,my,3,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.85)';ctx.fill();
  const bw=W*0.5, bh=H*0.12;
  ctx.strokeRect((W-bw)/2,pad,bw,bh); ctx.strokeRect((W-bw)/2,H-pad-bh,bw,bh);
  const pw=W*0.28, ph=H*0.055;
  ctx.strokeRect((W-pw)/2,pad,pw,ph); ctx.strokeRect((W-pw)/2,H-pad-ph,pw,ph);
  const cr=H*0.038;
  [[pad,pad],[W-pad,pad],[pad,H-pad],[W-pad,H-pad]].forEach(([cx,cy])=>{
    const a=(cx===pad?(cy===pad?0:270):(cy===pad?90:180))*Math.PI/180;
    ctx.beginPath();ctx.arc(cx,cy,cr,a,a+Math.PI/2);ctx.stroke();
  });
}
function canvasRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
function drawExportToken(ctx, p, t, cx, cy, sc) {
  ctx.save(); // 전체 토큰 상태 보호
  const pos = t.pos || p.positions[0] || '';
  const ovr = getOvr(p, pos);
  const r = 18 * sc;
  // 필드 배치 포지션(t.pos) 기준 색깔 — 없으면 등록 포지션 기준
  const color = posColor(pos ? [pos] : p.positions);

  // 1) OVR 별 아치 — circle top 위에만 위치 (circle과 겹치지 않음)
  if (ovr != null) {
    const n = ovrStarCount(ovr);
    const pts = STAR_ARC_LAYOUT[n] || STAR_ARC_LAYOUT[1];
    const arcW = 48 * sc;
    // 별 중심 최하단이 circle top(cy - r) 에서 6px 위에 오도록
    const arcBaseY = cy - r - 6 * sc;
    const arcH = 16 * sc;
    ctx.font = `${7 * sc}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = n >= 5 ? '#ffd700' : n >= 4 ? '#f5d060' : n >= 3 ? '#d4d4d8' : '#a8a8a8';
    pts.forEach(([l, tv]) => {
      const ax = cx - arcW / 2 + (l / 100) * arcW;
      const ay = arcBaseY - (tv / 22) * arcH; // tv 높을수록 위로
      ctx.fillText('★', ax, ay);
    });
  }

  // 2) 원 (circle) — save/restore 로 shadow 격리
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 4 * sc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore(); // shadow 해제
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2 * sc;
  ctx.stroke();

  // 3) 이니셜
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${12 * sc}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.name.slice(0, 2), cx, cy);

  // 4) 포지션 뱃지 — circle top 바로 위 (별 아래)
  if (pos) {
    ctx.font = `bold ${8 * sc}px sans-serif`;
    ctx.textAlign = 'center';
    const bw = Math.max(ctx.measureText(pos).width + 8 * sc, 22 * sc);
    const bh = 12 * sc;
    const bx = cx - bw / 2;
    const by = cy - r - bh - 2 * sc; // circle top 바로 위
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    canvasRoundRect(ctx, bx, by, bw, bh, 4 * sc);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(pos, cx, by + bh / 2);
  }

  // 5) 이름
  const name = `${p.jersey ? p.jersey + ' ' : ''}${p.name}`;
  ctx.font = `600 ${10 * sc}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 3 * sc;
  ctx.strokeText(name, cx, cy + r + 10 * sc);
  ctx.fillStyle = '#fff';
  ctx.fillText(name, cx, cy + r + 10 * sc);

  // 6) OVR pill
  if (ovr != null) {
    const n = ovrStarCount(ovr);
    const ovrText = `OVR+ ${Math.round(ovr)}`;
    ctx.font = `bold ${8 * sc}px sans-serif`;
    const ovrY = cy + r + 22 * sc;
    const tw = ctx.measureText(ovrText).width + 10 * sc;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    canvasRoundRect(ctx, cx - tw / 2, ovrY - 6 * sc, tw, 12 * sc, 4 * sc);
    ctx.fill();
    ctx.fillStyle = n >= 5 ? '#ffd700' : '#fff';
    ctx.fillText(ovrText, cx, ovrY);
  }

  // 7) 교체 예정 표시
  if (t.subPid) {
    const subP = players.find(x => x.id === t.subPid);
    if (subP) {
      const subText = `🔄 ${subP.jersey ? subP.jersey + ' ' : ''}${subP.name}`;
      ctx.font = `600 ${8 * sc}px sans-serif`;
      const tw = ctx.measureText(subText).width + 8 * sc;
      const sx = cx - tw / 2;
      const sy = cy + r + (ovr != null ? 34 : 24) * sc;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      canvasRoundRect(ctx, sx, sy, tw, 12 * sc, 5 * sc);
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.fillText(subText, cx, sy + 6 * sc);
    }
  }
  ctx.restore();
}
function getBenchPlayers() {
  const onField = new Set(fieldTokens.map(t => t.pid));
  fieldTokens.forEach(t => { if (t.subPid) onField.add(t.subPid); });
  return players.filter(p => !onField.has(p.id));
}
function downloadPngBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
async function exportFormationImage() {
  if (!isFormationSelected()) { alertFormationRequired(); return; }
  if (!fieldTokens.length) { alert('배치된 선수가 없습니다'); return; }
  const sc = 2;
  const fieldW = 420 * sc;
  const fieldH = Math.round(fieldW * 1.45);
  const pad = 14 * sc;
  const headerH = 48 * sc;
  const bench = getBenchPlayers();
  const benchH = bench.length ? 36 * sc : 0;
  const canvas = document.createElement('canvas');
  canvas.width = fieldW + pad * 2;
  canvas.height = headerH + fieldH + pad * 2 + benchH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#141412';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const team = myTeamName || '우리 FC';
  const formation = getFormation();
  const dateStr = new Date().toLocaleDateString('ko-KR');
  ctx.fillStyle = '#f0f0ee';
  ctx.font = `bold ${15 * sc}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`⚽ ${team}`, pad, headerH / 2 - 8 * sc);
  ctx.fillStyle = '#a0a09d';
  ctx.font = `${11 * sc}px sans-serif`;
  ctx.fillText(`${formation} · ${fieldTokens.length}/${MAX_FIELD}명 · ${dateStr}`, pad, headerH / 2 + 10 * sc);
  const fieldCanvas = document.createElement('canvas');
  fieldCanvas.width = fieldW;
  fieldCanvas.height = fieldH;
  drawGrass(fieldCanvas);
  const fieldY = headerH + pad;
  ctx.drawImage(fieldCanvas, pad, fieldY, fieldW, fieldH);
  const cornerR = 12 * sc;
  ctx.save();
  canvasRoundRect(ctx, pad, fieldY, fieldW, fieldH, cornerR);
  ctx.clip();
  fieldTokens.forEach(t => {
    const p = players.find(x => x.id === t.pid);
    if (!p) return;
    const { x, y } = tokenXY(t);
    const { x: px, y: py } = normToCanvasPx(x, y, fieldW, fieldH);
    drawExportToken(ctx, p, t, pad + px, fieldY + py, sc);
  });
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1 * sc;
  canvasRoundRect(ctx, pad, fieldY, fieldW, fieldH, cornerR);
  ctx.stroke();
  if (bench.length) {
    const benchY = fieldY + fieldH + pad;
    ctx.fillStyle = '#a0a09d';
    ctx.font = `600 ${9 * sc}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('벤치', pad, benchY + 10 * sc);
    const labels = bench.map(p => {
      const o = getBestOvr(p);
      return `${p.jersey != null ? '#' + p.jersey + ' ' : ''}${p.name}${o != null ? `(${o})` : ''}`;
    });
    ctx.fillStyle = '#d0d0cd';
    ctx.font = `${10 * sc}px sans-serif`;
    ctx.fillText(labels.join(' · '), pad, benchY + 26 * sc);
  }
  const safeTeam = team.replace(/[^\w가-힣]/g, '').slice(0, 12) || 'FC';
  const filename = `formation-${formation}-${safeTeam}-${new Date().toISOString().slice(0, 10)}.png`;
  canvas.toBlob(async blob => {
    if (!blob) { alert('이미지 생성에 실패했습니다'); return; }
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${team} ${formation}` });
        return;
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    downloadPngBlob(blob, filename);
  }, 'image/png');
}
function findNearestSlot(excludePid,nx,ny){
  const slots=getSlots();
  let best=-1, bd=SNAP_RADIUS;
  slots.forEach((sl,i)=>{const d=Math.hypot(sl[0]-nx,sl[1]-ny);if(d<bd){bd=d;best=i;}});
  return best;
}
/** 슬롯에 스냅 — 슬롯 정중앙으로 고정, 교체 처리 포함
 *  드래그는 용량 체크 없음 (팝업 포지션 선택에서만 체크)
 */
function applySlotSnap(ft, nearSlot, pid, wasFromBench, origSlotIdx, origFreeX, origFreeY) {
  const labels = getLabels();
  const slots = getSlots();
  const slotPos = labels[nearSlot] || '';
  const other = tokenAtSlot(nearSlot, pid);
  const snapX = slots[nearSlot][0];
  const snapY = slots[nearSlot][1];

  if (other) {
    // proximity로 찾은 경우 slotIdx를 nearSlot으로 먼저 동기화
    other.slotIdx = nearSlot;
    if (wasFromBench) {
      // 벤치→필드: 기존 선수 벤치로 내보내기
      fieldTokens = fieldTokens.filter(t => t.pid !== other.pid);
    } else {
      // 필드→필드 swap: 드래그 전 원래 슬롯 정보 사용 (onGlobalMove가 -1로 리셋하기 전 값)
      const prevSlot = (origSlotIdx != null && origSlotIdx >= 0) ? origSlotIdx : ft.slotIdx;
      const prevX = (origSlotIdx != null && origSlotIdx >= 0) ? (slots[origSlotIdx]?.[0] ?? origFreeX) : (origFreeX ?? ft.freeX);
      const prevY = (origSlotIdx != null && origSlotIdx >= 0) ? (slots[origSlotIdx]?.[1] ?? origFreeY) : (origFreeY ?? ft.freeY);
      other.slotIdx = prevSlot;
      other.freeX = prevX;
      other.freeY = prevY;
      if (prevSlot >= 0 && labels[prevSlot]) other.pos = labels[prevSlot];
    }
  }
  // 드래그는 빈 슬롯 용량 체크 없이 무조건 허용

  ft.slotIdx = nearSlot;
  ft.freeX = snapX;
  ft.freeY = snapY;
  if (slotPos) ft.pos = slotPos;
  return true;
}
function tokenPos(nx, ny) {
  const cr = getCanvasRect();
  const inner = document.getElementById('fieldInner').getBoundingClientRect();
  const { x, y } = normToCanvasPx(nx, ny, cr.width, cr.height);
  return { left: cr.left - inner.left + x, top: cr.top - inner.top + y };
}

// ── 필드 렌더 ──
function renderField() {
  if (document.getElementById('tab-formation')?.classList.contains('active')) {
    // 캔버스 크기는 이미 결정된 fieldSize 기준으로만 슬롯 마커 재그림
    // (벤치 높이 변화에 의한 크기 재계산 방지 → 경기장 흔들림 없음)
    if (fieldSize.w && fieldSize.h) {
      const canvas = document.getElementById('fieldCanvas');
      drawGrass(canvas);
      drawFormationSlots(canvas.getContext('2d'), fieldSize.w, fieldSize.h, slotHighlight);
    } else {
      drawFieldCanvas(slotHighlight);
    }
  }
  const td=document.getElementById('tokens');
  td.innerHTML='';
  document.getElementById('slotInfo').textContent=fieldTokens.length+'/'+MAX_FIELD;
  fieldTokens.forEach(t=>{
    const p=players.find(x=>x.id===t.pid); if(!p) return;
    // t.pos 우선 (사용자가 명시적으로 지정한 포지션)
    // t.pos 없으면 슬롯 라벨로 채움 (초기 로드·자동배치 등)
    const labels=getLabels();
    const slotLabel=(t.slotIdx>=0&&labels[t.slotIdx])?labels[t.slotIdx]:'';
    if(!t.pos&&slotLabel) t.pos=slotLabel; // 비어있을 때만 슬롯 라벨로 채움
    const pos=t.pos||slotLabel||p.positions[0]||'';
    const ovr=getOvr(p,pos);
    const {x,y}=tokenXY(t);
    const {left,top}=tokenPos(x,y);
    const el=document.createElement('div');
    el.className='player-token';
    el.style.left=left+'px'; el.style.top=top+'px';
    el.dataset.pid=t.pid;

    el.innerHTML = buildTokenInnerHtml(p, pos, ovr, t.subPid);
    el.addEventListener('mousedown',onTokenMouseDown);
    el.addEventListener('touchstart',onTokenTouchStart,{passive:false});
    td.appendChild(el);
  });
  renderBench();
}

// ── 전역 드래그 ──
let drag={active:false,pid:null,fromBench:false,origFromBench:false,startX:0,startY:0,moved:false,longPressTimer:null,el:null};
const LONG_PRESS=200, MOVE_THRESH=6;
function onTokenMouseDown(e){e.preventDefault();startDrag(parseInt(this.dataset.pid),false,e.clientX,e.clientY,this);}
function onTokenTouchStart(e){e.preventDefault();startDrag(parseInt(this.dataset.pid),false,e.touches[0].clientX,e.touches[0].clientY,this);}
function startDrag(pid,fromBench,ex,ey,el){
  if(!isAdmin) return;
  if(drag.longPressTimer){clearTimeout(drag.longPressTimer);drag.longPressTimer=null;}
  if(drag.el)drag.el.classList.remove('dragging','snapping');
  const origToken = fieldTokens.find(t => t.pid === pid);
  drag={active:false,pid,fromBench,origFromBench:fromBench,
    origSlotIdx: origToken?.slotIdx ?? -1,
    origFreeX: origToken?.freeX ?? 0.5,
    origFreeY: origToken?.freeY ?? 0.5,
    startX:ex,startY:ey,moved:false,longPressTimer:null,el};
  drag.longPressTimer=setTimeout(()=>{
    drag.active=true;drag.el.classList.add('dragging');
    const { x, y } = tokenXY(fieldTokens.find(t => t.pid === pid) || { slotIdx: -1, freeX: 0.5, freeY: 0.5 });
    refreshFieldSlots(findNearestSlot(pid, x, y));
  },LONG_PRESS);
}
document.addEventListener('mousemove',onGlobalMove);
document.addEventListener('mouseup',onGlobalUp);
document.addEventListener('touchmove',e=>{if(drag.pid!==null){e.preventDefault();onGlobalMove(e.touches[0]);}},{passive:false});
document.addEventListener('touchend',e=>{if(drag.pid!==null)onGlobalUp(e.changedTouches[0]);});

function onGlobalMove(e){
  if(drag.pid===null)return;
  const ex=e.clientX, ey=e.clientY;
  if(!drag.active){
    if(Math.sqrt((ex-drag.startX)**2+(ey-drag.startY)**2)<MOVE_THRESH)return;
    drag.moved=true;
    clearTimeout(drag.longPressTimer);drag.longPressTimer=null;
    drag.active=true;
    if(drag.fromBench&&!fieldTokens.find(t=>t.pid===drag.pid)){
      if (!isFormationSelected()) {
        drag={active:false,pid:null,fromBench:false,startX:0,startY:0,moved:false,longPressTimer:null,el:null};
        alertFormationRequired(); return;
      }
      // MAX_FIELD 체크는 onGlobalUp(드롭 시점)에서 수행 — 교체 의도 판단 후 차단
      // 드래그 중엔 renderField 호출 안 함 — 토큰 DOM만 직접 생성
      fieldTokens.push({pid:drag.pid,slotIdx:-1,freeX:0.5,freeY:0.5,pos:''});
      drag.fromBench=false;
      const p=players.find(x=>x.id===drag.pid);
      if(p){
        const td=document.getElementById('tokens');
        const newEl=document.createElement('div');
        newEl.className='player-token dragging';
        newEl.dataset.pid=drag.pid;
        newEl.style.left='0px';newEl.style.top='0px';
        const pos=p.positions[0]||''; // 드래그 시작 시 아직 슬롯 미정이므로 등록 포지션 기본값
        const ovr=getOvr(p,pos);
        newEl.innerHTML = buildTokenInnerHtml(p, pos, ovr, null);
        newEl.addEventListener('mousedown',onTokenMouseDown);
        newEl.addEventListener('touchstart',onTokenTouchStart,{passive:false});
        td.appendChild(newEl);
        drag.el=newEl;
      }
    }
    if(drag.el)drag.el.classList.add('dragging');
  }
  const { x: nx, y: ny } = pointerToNorm(ex, ey);
  const ft=fieldTokens.find(t=>t.pid===drag.pid);
  if(ft){ft.slotIdx=-1;ft.freeX=nx;ft.freeY=ny;}
  if(drag.el){
    const {left,top}=tokenPos(nx,ny);
    drag.el.style.left=left+'px';drag.el.style.top=top+'px';
    drag.el.classList.toggle('snapping',findNearestSlot(drag.pid,nx,ny)>=0);
  }
  refreshFieldSlots(findNearestSlot(drag.pid, nx, ny));
}

function onGlobalUp(e){
  if(drag.pid===null)return;
  clearTimeout(drag.longPressTimer);drag.longPressTimer=null;
  const ex=e.clientX, ey=e.clientY;
  const pid=drag.pid,wasActive=drag.active,wasMoved=drag.moved,wasFromBench=drag.origFromBench,origSlotIdx=drag.origSlotIdx,origFreeX=drag.origFreeX,origFreeY=drag.origFreeY,el=drag.el;
  drag={active:false,pid:null,fromBench:false,startX:0,startY:0,moved:false,longPressTimer:null,el:null};
  if(el)el.classList.remove('dragging','snapping');
  slotHighlight = -1;

  if(!wasActive&&!wasMoved){handlePlayerTap(pid,el,wasFromBench);refreshFieldSlots(-1);return;}

  if(wasActive){
    // 벤치로 드래그
    const benchRect=document.querySelector('.bench-section').getBoundingClientRect();
    if(ey>=benchRect.top&&ex>=benchRect.left&&ex<=benchRect.right){
      fieldTokens=fieldTokens.filter(t=>t.pid!==pid);
      saveFieldState();renderField();return;
    }
    const { x: nx, y: ny } = pointerToNorm(ex, ey);
    const ft=fieldTokens.find(t=>t.pid===pid);
    if(!ft){saveFieldState();renderField();return;}

    const nearSlot=findNearestSlot(pid,nx,ny);
    if(nearSlot>=0){
      if (!applySlotSnap(ft, nearSlot, pid, wasFromBench, origSlotIdx, origFreeX, origFreeY)) {
        ft.slotIdx=-1; ft.freeX=nx; ft.freeY=ny;
      }
    } else {
      ft.slotIdx=-1;ft.freeX=nx;ft.freeY=ny;
    }
    // 벤치→필드 드래그였는데 교체 없이 추가된 경우 MAX_FIELD 초과 차단
    if (wasFromBench && fieldTokens.length > MAX_FIELD) {
      fieldTokens = fieldTokens.filter(t => t.pid !== pid);
      alert(`최대 ${MAX_FIELD}명까지만 출전 가능합니다.`);
      saveFieldState(); renderField(); return;
    }
    saveFieldState();renderField();
  } else {
    refreshFieldSlots(-1);
  }
}

function renderBench(){
  const onField=fieldTokens.map(t=>t.pid);
  const bench=players.filter(p=>!onField.includes(p.id));
  const el=document.getElementById('benchList');
  if(!bench.length){el.innerHTML='<span style="font-size:12px;color:var(--text3)">전원 출전 중</span>';return;}
  el.innerHTML='';
  bench.forEach(p=>{
    const ovr=getBestOvr(p);
    const wrap=document.createElement('div');
    wrap.className='bench-item';
    const div=document.createElement('div');
    div.className='bench-player';div.dataset.pid=p.id;
    div.innerHTML=`<div class="dot" style="background:${posColor(p.positions)}"></div>${p.jersey!=null?'#'+p.jersey+' ':''}${p.name}${ovr!=null?`<span class="bench-player-ovr">${ovr}</span>`:''}`;
    div.addEventListener('mousedown',function(e){e.preventDefault();startDrag(p.id,true,e.clientX,e.clientY,this);});
    div.addEventListener('touchstart',function(e){e.preventDefault();startDrag(p.id,true,e.touches[0].clientX,e.touches[0].clientY,this);},{passive:false});
    const swapBtn=document.createElement('button');
    swapBtn.className='btn-bench-swap';swapBtn.dataset.pid=p.id;
    swapBtn.textContent='🔄';
    swapBtn.title='출전 교체';
    swapBtn.onclick=function(e){e.stopPropagation();openBenchReplace(p.id);};
    wrap.appendChild(div);wrap.appendChild(swapBtn);
    el.appendChild(wrap);
  });
}

function getOvrForSlot(p, slotLabel) {
  const matching=p.positions.filter(pos=>slotAcceptsPos(slotLabel,pos));
  if(!matching.length) return getBestOvr(p);
  return Math.max(...matching.map(pos=>getOvr(p,pos)??0));
}
function bestPosForSlot(p, slotLabel) {
  const matching=p.positions.filter(pos=>slotAcceptsPos(slotLabel,pos));
  if(!matching.length) return slotLabel;
  return matching.sort((a,b)=>(getOvr(p,b)??0)-(getOvr(p,a)??0))[0];
}
function pickBestPlayerForSlot(slotLabel, used) {
  let candidates=players.filter(p=>!used.has(p.id)&&p.positions.some(pos=>slotAcceptsPos(slotLabel,pos)));
  if(!candidates.length&&slotLabel==='GK') candidates=players.filter(p=>!used.has(p.id)&&p.positions.includes('GK'));
  if(!candidates.length) return null;
  candidates.sort((a,b)=>getOvrForSlot(b,slotLabel)-getOvrForSlot(a,slotLabel));
  return candidates[0];
}

function applyFormation(){
  if (!isFormationSelected()) { alertFormationRequired(); return; }
  const f=getFormation(), slots=FORMATIONS[f]; if(!slots)return;
  const labels=FORMATION_POS_LABELS[f]||[];
  const used=new Set();
  fieldTokens=[];
  for(let i=0;i<slots.length;i++){
    const label=labels[i]||'';
    const p=pickBestPlayerForSlot(label,used);
    if(!p) continue;
    used.add(p.id);
    const def=slotDefaultXY(i);
    fieldTokens.push({pid:p.id,slotIdx:i,freeX:def.x,freeY:def.y,pos:bestPosForSlot(p,label)});
  }
  // 크기 먼저 확정하고 렌더 (자동배치 후 경기장 크기 재계산 방지)
  drawFieldCanvas(slotHighlight);
  saveFieldState();renderField();
}
function clearField(){fieldTokens=[];saveFieldState();renderField();}
function saveFieldState(){ persistField().catch(handleSaveError); }
function loadFieldState(){
  const full = localStorage.getItem('fc_field_full');
  if (full) {
    try {
      const o = JSON.parse(full);
      fieldTokens = normalizeFieldTokens(o.tokens);
      const formation = resolveFormation(o.formation, fieldTokens);
      if (formation) { saveFormationLocal(formation); setFormationSelect(formation); }
      if (formation) reconcileFieldTokensToFormation();
      return;
    } catch (e) { /* fall through */ }
  }
  const s = localStorage.getItem('fc_field');
  if (!s) return;
  fieldTokens = normalizeFieldTokens(JSON.parse(s));
  const formation = resolveFormation(localStorage.getItem('fc_formation'), fieldTokens);
  if (formation) { saveFormationLocal(formation); setFormationSelect(formation); }
  if (formation) reconcileFieldTokensToFormation();
}

// ── 포메이션 저장 ──
function saveFormation(){
  document.getElementById('fsaveNameInput').value='';
  document.getElementById('fsaveModal').classList.add('open');
  setTimeout(()=>document.getElementById('fsaveNameInput').focus(),100);
}
function closeFsaveModal(){document.getElementById('fsaveModal').classList.remove('open');}
function confirmSaveFormation(){
  const name=document.getElementById('fsaveNameInput').value.trim();
  if(!name){alert('이름을 입력해주세요');return;}
  formationSaves.unshift({id:Date.now(),name,formation:getFormation(),tokens:JSON.parse(JSON.stringify(fieldTokens)),date:new Date().toLocaleDateString('ko-KR')});
  persistSaves().then(()=>{closeFsaveModal();renderFormationSaves();alert('저장되었습니다!');}).catch(handleSaveError);
}
document.getElementById('fsaveModal')?.addEventListener('click',function(e){if(e.target===this)closeFsaveModal();});
function loadSave(id){
  const s=formationSaves.find(x=>x.id===id); if(!s)return;
  fieldTokens=normalizeFieldTokens(s.tokens);
  setFormationSelect(s.formation);
  // 저장본 불러올 때도 pos·좌표 정규화 (구버전 저장본 호환)
  if(s.formation) reconcileFieldTokensToFormation();
  drawFieldCanvas();renderField();renderFormationSaves();
  persistField().catch(handleSaveError);
}
function deleteSave(id){
  if(!confirm('삭제하시겠습니까?'))return;
  formationSaves=formationSaves.filter(s=>s.id!==id);
  persistSaves().then(renderFormationSaves).catch(handleSaveError);
}
function renderFormationSaves(){
  const panel=document.getElementById('formationSavesPanel');
  const list=document.getElementById('formationSavesList');
  panel.style.display=formationSaves.length?'block':'none';
  list.innerHTML=formationSaves.map(s=>`
    <div class="fsave-item">
      <div class="fsave-info">
        <div class="fsave-name">${s.name}</div>
        <div class="fsave-meta">${s.formation} · ${s.tokens.length}명 · ${s.date}</div>
      </div>
      <button class="btn-fsave-load" onclick="loadSave(${s.id})">불러오기</button>
      <button class="btn-fsave-del" onclick="deleteSave(${s.id})">✕</button>
    </div>`).join('');
}

// ── 경기 기록 ──
function participantEntry(pid, pos, type, pairedWith) {
  const p=players.find(x=>x.id===pid); if(!p) return null;
  const usePos=pos||p.positions[0]||'';
  return {pid,name:p.name,pos:usePos,ovr:getOvr(p,usePos),type:type||'starter',pairedWith:pairedWith||null};
}
function buildParticipantsFromField() {
  const list=[];
  fieldTokens.forEach(t=>{
    const e=participantEntry(t.pid,t.pos,'starter');
    if(e) list.push(e);
    if(t.subPid){const s=participantEntry(t.subPid,t.pos,'sub',t.pid);if(s) list.push(s);}
  });
  return list;
}
function buildParticipantsFromMatch(em) {
  const list=[];
  (em.lineup||[]).forEach(l=>list.push({...l,type:'starter'}));
  (em.subs||[]).forEach(s=>list.push({...s,type:'sub'}));
  return list;
}
function renderMatchLineupPreview() {
  const el=document.getElementById('matchLineupPreview');
  if(!matchParticipants.length){el.innerHTML='<span style="color:var(--text3)">출전 선수 없음</span>';return;}
  const starters=matchParticipants.filter(x=>x.type!=='sub');
  const subs=matchParticipants.filter(x=>x.type==='sub');
  el.innerHTML=`선발 ${starters.length}명`+(subs.length?` · 교체 ${subs.length}명`:'')+
    `<div style="margin-top:4px;font-size:11px">${starters.map(x=>x.name).join(', ')}`+
    (subs.length?`<br>🔄 ${subs.map(x=>x.name).join(', ')}`:'')+`</div>`;
}
function renderMatchModalEvents(em) {
  const list=document.getElementById('matchEventList');
  if(!matchParticipants.length){
    list.innerHTML='<div style="font-size:13px;color:var(--text3)">포메이션에서 선수를 배치하거나 「현재 포메이션 반영」을 눌러주세요</div>';
    document.getElementById('momSelectWrap').innerHTML='';
    renderMatchLineupPreview();
    return;
  }
  matchEvents=Object.fromEntries(matchParticipants.map(x=>[x.pid,{
    goals:em?.scorers?.find(s=>s.pid===x.pid)?.goals||0,
    assists:em?.scorers?.find(s=>s.pid===x.pid)?.assists||0
  }]));
  list.innerHTML=matchParticipants.map(x=>{
    const subTag=x.type==='sub'?'<span class="match-part-sub">🔄교체</span>':'';
    return `<div class="player-event-row">
      <span class="player-event-name">${x.name}</span>${subTag}
      <span class="player-event-pos">${x.pos}</span>
      <span class="player-event-ovr">${x.ovr!=null?x.ovr+' '+ovrStarsText(x.ovr):''}</span>
      <span style="font-size:11px;color:var(--text2);margin-left:auto">⚽</span>
      <div class="event-count">
        <button class="btn-event" onclick="changeEvent(${x.pid},'goals',-1)">−</button>
        <span class="event-num" id="g_${x.pid}">${matchEvents[x.pid].goals}</span>
        <button class="btn-event" onclick="changeEvent(${x.pid},'goals',1)">+</button>
      </div>
      <span style="font-size:11px;color:var(--text2);margin-left:4px">🅰️</span>
      <div class="event-count">
        <button class="btn-event" onclick="changeEvent(${x.pid},'assists',-1)">−</button>
        <span class="event-num" id="a_${x.pid}">${matchEvents[x.pid].assists}</span>
        <button class="btn-event" onclick="changeEvent(${x.pid},'assists',1)">+</button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('momSelectWrap').innerHTML=`<div class="mom-select" id="momBtns">
    ${matchParticipants.map(x=>`<button class="mom-btn ${matchMom===x.pid?'active':''}" onclick="selectMom(${x.pid})" id="mom_${x.pid}">${x.name}${x.type==='sub'?' 🔄':''}</button>`).join('')}
  </div>`;
  renderMatchLineupPreview();
}
function syncMatchFromFormation(){
  const em=editingMatchId?matches.find(m=>m.id===editingMatchId):null;
  matchParticipants=buildParticipantsFromField();
  renderMatchModalEvents(em);
}
function openMatchModal(editId){
  matchEvents={};matchMom=null;editingMatchId=editId||null;
  const em=editId?matches.find(m=>m.id===editId):null;
  document.getElementById('matchMyTeam').value=em?.myTeam||myTeamName||'';
  document.getElementById('matchOppTeam').value=em?.oppTeam||'';
  document.getElementById('matchDate').value=em?.date||new Date().toISOString().slice(0,10);
  document.getElementById('matchScoreUs').value=em?.scoreUs??0;
  document.getElementById('matchScoreOpp').value=em?.scoreOpp??0;
  document.getElementById('matchHomeAway').value=em?.homeAway||'home';
  matchMom=em?.mom||null;
  if(em) matchParticipants=buildParticipantsFromMatch(em);
  else matchParticipants=buildParticipantsFromField();
  renderMatchModalEvents(em);
  document.getElementById('matchModal').classList.add('open');
}
function selectMom(pid){
  matchMom=(matchMom===pid)?null:pid;
  document.querySelectorAll('.mom-btn').forEach(b=>b.classList.remove('active'));
  if(matchMom){const b=document.getElementById('mom_'+matchMom);if(b)b.classList.add('active');}
}
function changeEvent(pid,type,delta){
  if(!matchEvents[pid])matchEvents[pid]={goals:0,assists:0};
  matchEvents[pid][type]=Math.max(0,matchEvents[pid][type]+delta);
  document.getElementById((type==='goals'?'g_':'a_')+pid).textContent=matchEvents[pid][type];
}
function closeMatchModal(){document.getElementById('matchModal').classList.remove('open');}
function saveMatch(){
  if(!matchParticipants.length){alert('출전 선수가 없습니다');return;}
  const myTeam=document.getElementById('matchMyTeam').value.trim()||'우리 FC';
  const oppTeam=document.getElementById('matchOppTeam').value.trim()||'상대 FC';
  const date=document.getElementById('matchDate').value;
  const scoreUs=parseInt(document.getElementById('matchScoreUs').value)||0;
  const scoreOpp=parseInt(document.getElementById('matchScoreOpp').value)||0;
  const homeAway=document.getElementById('matchHomeAway').value;
  const totalGoals=matchParticipants.reduce((s,x)=>s+(matchEvents[x.pid]?.goals||0),0);
  if(totalGoals!==scoreUs){
    alert(`선수 골 합(${totalGoals})과 우리 팀 득점(${scoreUs})이 일치하지 않습니다.`);
    return;
  }
  myTeamName=myTeam;
  const em=editingMatchId?matches.find(m=>m.id===editingMatchId):null;
  const scorers=matchParticipants.map(x=>{
    const ev=matchEvents[x.pid]||{goals:0,assists:0};
    return{pid:x.pid,name:x.name,pos:x.pos,ovr:x.ovr,goals:ev.goals,assists:ev.assists};
  }).filter(x=>x.goals>0||x.assists>0);
  const lineup=matchParticipants.filter(x=>x.type!=='sub').map(({pid,name,pos,ovr})=>({pid,name,pos,ovr}));
  const subs=matchParticipants.filter(x=>x.type==='sub').map(({pid,name,pos,ovr,pairedWith})=>({pid,name,pos,ovr,pairedWith}));
  const momPlayer=matchMom?players.find(p=>p.id===matchMom):null;
  const matchData={
    id:editingMatchId||Date.now(),myTeam,oppTeam,date,homeAway,scoreUs,scoreOpp,
    formation:em?.formation||getFormation(),lineup,subs,scorers,
    mom:matchMom||null,momName:momPlayer?.name||null
  };
  if(editingMatchId){const idx=matches.findIndex(m=>m.id===editingMatchId);if(idx>=0)matches[idx]=matchData;else matches.unshift(matchData);}
  else matches.unshift(matchData);
  Promise.all([persistMatches(), persistMeta()]).then(()=>{
    closeMatchModal();renderRecords();refreshStatsIfVisible();
  }).catch(handleSaveError);
}
function deleteMatch(id){
  if(!confirm('삭제하시겠습니까?'))return;
  matches=matches.filter(m=>m.id!==id);
  persistMatches().then(()=>{renderRecords();refreshStatsIfVisible();}).catch(handleSaveError);
}
function renderRecords(){
  const el=document.getElementById('recordsContent');
  if(!matches.length){el.innerHTML='<div class="empty-state">기록된 경기가 없습니다</div>';return;}
  el.innerHTML=matches.map(m=>{
    const res=m.scoreUs>m.scoreOpp?'🏆 승':m.scoreUs===m.scoreOpp?'🤝 무':'💔 패';
    const haBadge=m.homeAway?`<span class="match-homeaway">${m.homeAway==='home'?'홈':'어웨이'}</span>`:'';
    const scorerRows=(m.scorers||[]).map(s=>`
      <div class="match-scorer-row">
        <span class="match-scorer-icon">⚽</span>
        <span class="match-scorer-name">${s.name}</span>
        <span class="match-scorer-pos">${s.pos}</span>
        <span class="match-scorer-ovr">${s.ovr!=null?s.ovr+' '+ovrStarsText(s.ovr):''}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--text2)">골 ${s.goals}${s.assists>0?' · 어시 '+s.assists:''}</span>
      </div>`).join('');
    const lineupTags=(m.lineup||[]).map(l=>`<span class="match-lineup-tag">${l.name}</span>`).join('');
    const subTags=(m.subs||[]).map(s=>`<span class="match-lineup-tag sub">🔄${s.name}</span>`).join('');
    const momBadge=m.momName?`<span class="match-mom">🏅 MOM ${m.momName}</span>`:'';
    return `<div class="match-card">
      <div class="match-score-row">
        <span class="match-team" style="text-align:right">${m.myTeam}</span>
        <span class="match-score">${m.scoreUs} : ${m.scoreOpp}</span>
        <span class="match-team">${m.oppTeam}</span>
      </div>
      <div class="match-meta">${m.date} · ${res}${haBadge}<span class="match-formation-badge">${m.formation}</span>${momBadge}</div>
      ${(m.lineup||[]).length?`<div class="match-lineup"><div class="match-lineup-title">출전</div><div class="match-lineup-tags">${lineupTags}${subTags}</div></div>`:''}
      ${scorerRows?`<div class="match-scorers">${scorerRows}</div>`:''}
      ${isAdmin ? `<div class="match-card-btns">
        <button class="btn-match-edit" onclick="openMatchModal(${m.id})"><i class="ti ti-edit"></i> 수정</button>
        <button class="btn-match-del" onclick="deleteMatch(${m.id})"><i class="ti ti-trash"></i></button>
      </div>` : ''}
    </div>`;
  }).join('');
}

// ── 통계 ──
function switchStatsSub(sub) {
  statsSubTab = sub;
  document.querySelectorAll('.stats-sub-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sub === sub);
  });
  const toolbar = document.getElementById('statsToolbar');
  if (toolbar) toolbar.style.display = sub === 'personal' ? 'flex' : 'none';
  renderStats();
}
function populateStatsYearFilter() {
  const sel = document.getElementById('statsYearFilter');
  if (!sel) return;
  const prev = sel.value;
  const years = getMatchYears(matches);
  sel.innerHTML = `<option value="ALL">전체 기간</option>${years.map(y => `<option value="${y}">${y}년</option>`).join('')}`;
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}
function refreshStatsIfVisible() {
  if (document.getElementById('tab-stats')?.classList.contains('active')) renderStats();
}
function formatStreakPeriod(s) {
  if (!s.count) return '기록 없음';
  if (s.from === s.to) return s.from;
  return `${s.from} ~ ${s.to}`;
}
function renderPersonalStats(filtered) {
  const sortKey = document.getElementById('statsSortKey')?.value || 'goals';
  const rows = computePlayerStats(filtered, players)
    .filter(s => s.appearances > 0 || s.goals > 0 || s.assists > 0 || s.mom > 0)
    .sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
  if (!filtered.length) {
    return '<div class="empty-state">경기 기록이 없습니다</div>';
  }
  if (!rows.length) {
    return '<div class="empty-state">출전·기록 데이터가 없습니다</div>';
  }
  const top = rows[0];
  const totalGoals = rows.reduce((s, r) => s + r.goals, 0);
  const totalApps = rows.reduce((s, r) => s + r.appearances, 0);
  const summary = `<div class="stats-summary">
    <div class="stats-card"><div class="stats-card-val">${filtered.length}</div><div class="stats-card-label">경기</div></div>
    <div class="stats-card"><div class="stats-card-val">${totalGoals}</div><div class="stats-card-label">팀 골</div></div>
    <div class="stats-card"><div class="stats-card-val">${top.goals}</div><div class="stats-card-label">득점 1위 ${top.name}</div></div>
  </div>`;
  const tableRows = rows.map(r => {
    const gCls = r.goals > 0 ? 'stat-click' : 'stat-click zero';
    const aCls = r.assists > 0 ? 'stat-click' : 'stat-click zero';
    return `<tr>
      <td><span class="stat-name">${r.name}</span>${r.jersey != null ? `<span class="stat-jersey">#${r.jersey}</span>` : ''}</td>
      <td>${r.appearances}</td>
      <td><span class="${gCls}" onclick="openStatHistory(${r.pid},'goals')">${r.goals}</span></td>
      <td><span class="${aCls}" onclick="openStatHistory(${r.pid},'assists')">${r.assists}</span></td>
      <td>${r.mom || '—'}</td>
      <td>${r.attendance}<span class="stat-pct">%</span></td>
    </tr>`;
  }).join('');
  return summary + `<table class="stats-table">
    <thead><tr><th>선수</th><th>출전</th><th>골</th><th>어시</th><th>MOM</th><th>참석</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div style="font-size:10px;color:var(--text3)">총 출전 ${totalApps}회 · 골·어시 숫자를 누르면 경기별 히스토리</div>`;
}
function renderTeamStats(filtered) {
  if (!filtered.length) {
    return '<div class="empty-state">경기 기록이 없습니다</div>';
  }
  const venues = [
    { key: 'all', label: '전체' },
    { key: 'home', label: '홈' },
    { key: 'away', label: '어웨이' },
  ];
  const tableRows = venues.map(v => {
    const ms = filterMatchesByVenue(filtered, v.key);
    const t = computeTeamStats(ms);
    return `<tr>
      <td>${v.label}</td>
      <td>${t.played}</td>
      <td>${t.w}</td>
      <td>${t.d}</td>
      <td>${t.l}</td>
      <td>${t.gf}</td>
      <td>${t.ga}</td>
      <td>${t.winRate}%</td>
    </tr>`;
  }).join('');
  const overall = computeTeamStats(filtered);
  const streaks = computeStreaks(filtered);
  const total = overall.w + overall.d + overall.l || 1;
  const wPct = Math.round(overall.w / total * 100);
  const dPct = Math.round(overall.d / total * 100);
  const lPct = 100 - wPct - dPct;
  const cards = `<div class="stats-summary">
    <div class="stats-card"><div class="stats-card-val">${overall.winRate}%</div><div class="stats-card-label">승률</div></div>
    <div class="stats-card"><div class="stats-card-val">${overall.gpg}</div><div class="stats-card-label">경기당 득점</div></div>
    <div class="stats-card"><div class="stats-card-val">${overall.cpg}</div><div class="stats-card-label">경기당 실점</div></div>
  </div>`;
  const bar = `<div class="wdl-bar">
    <div class="wdl-seg win" style="width:${wPct}%"></div>
    <div class="wdl-seg draw" style="width:${dPct}%"></div>
    <div class="wdl-seg lose" style="width:${lPct}%"></div>
  </div>
  <div class="wdl-legend">
    <span class="lg-win">승 ${overall.w}</span>
    <span class="lg-draw">무 ${overall.d}</span>
    <span class="lg-lose">패 ${overall.l}</span>
  </div>`;
  const table = `<div class="team-table-wrap"><table class="team-record-table">
    <thead><tr><th>구분</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득</th><th>실</th><th>승률</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table></div>`;
  const streakHtml = `<div class="streak-cards">
    <div class="streak-card"><div class="streak-card-title">최다 연승</div><div class="streak-card-val">${streaks.win.count}경기</div><div class="streak-card-period">${formatStreakPeriod(streaks.win)}</div></div>
    <div class="streak-card"><div class="streak-card-title">최다 무패</div><div class="streak-card-val">${streaks.unbeaten.count}경기</div><div class="streak-card-period">${formatStreakPeriod(streaks.unbeaten)}</div></div>
    <div class="streak-card"><div class="streak-card-title">최다 연패</div><div class="streak-card-val">${streaks.lose.count}경기</div><div class="streak-card-period">${formatStreakPeriod(streaks.lose)}</div></div>
  </div>`;
  return cards + bar + table + streakHtml;
}
function renderStats() {
  populateStatsYearFilter();
  const year = document.getElementById('statsYearFilter')?.value || 'ALL';
  const filtered = filterMatchesByYear(matches, year);
  const el = document.getElementById('statsContent');
  if (!el) return;
  el.innerHTML = statsSubTab === 'team' ? renderTeamStats(filtered) : renderPersonalStats(filtered);
}
function openStatHistory(pid, type) {
  const p = players.find(x => x.id === pid);
  const year = document.getElementById('statsYearFilter')?.value || 'ALL';
  const filtered = filterMatchesByYear(matches, year);
  const history = getPlayerStatHistory(filtered, pid, type);
  if (!history.length) return;
  const label = type === 'goals' ? '골' : '어시스트';
  document.getElementById('statHistoryTitle').textContent = `${p?.name || ''} — ${label} 히스토리`;
  document.getElementById('statHistoryList').innerHTML = history.map(h =>
    `<div class="stat-history-row">
      <span class="stat-history-date">${h.date}</span>
      <span class="stat-history-score">${h.scoreUs}:${h.scoreOpp}</span>
      <span class="stat-history-opp">vs ${h.oppTeam || '상대'}</span>
      <span class="stat-history-count">${label} ${h.count}</span>
    </div>`
  ).join('');
  document.getElementById('statHistoryModal').classList.add('open');
}
function closeStatHistory() {
  document.getElementById('statHistoryModal').classList.remove('open');
}

// ── 탭 ──
function switchTab(tab){
  ['home','roster','formation','records','stats'].forEach((t,i)=>{
    document.querySelectorAll('.tab-btn')[i].classList.toggle('active',t===tab);
    document.getElementById('tab-'+t).classList.toggle('active',t===tab);
  });
  if(tab==='home')renderHome();
  if(tab==='formation'){
    slotHighlight=-1;
    fieldSize={w:0,h:0}; // 탭 전환 시 크기 강제 재측정 (이후 renderField는 고정 크기 유지)
    drawFieldCanvas(-1);
    renderField();
    renderFormationSaves();
  }
  if(tab==='records')renderRecords();
  if(tab==='stats'){switchStatsSub(statsSubTab);}
}

// ── 초기화 ──
document.getElementById('matchModal').addEventListener('click',function(e){if(e.target===this)closeMatchModal();});
document.getElementById('adminModal')?.addEventListener('click',function(e){if(e.target===this)closeAdminModal();});
document.getElementById('statHistoryModal')?.addEventListener('click',function(e){if(e.target===this)closeStatHistory();});
document.getElementById('photoUrlModal')?.addEventListener('click',function(e){if(e.target===this)closePhotoUrlModal();});
bootstrapApp();
function onFieldResize(){
  if(!document.getElementById('tab-formation').classList.contains('active'))return;
  if(drag.active&&drag.pid!=null){
    const ft=fieldTokens.find(t=>t.pid===drag.pid);
    if(ft){const {x,y}=tokenXY(ft);refreshFieldSlots(findNearestSlot(drag.pid,x,y));}
  } else {
    drawFieldCanvas(-1);renderField();
  }
}
window.addEventListener('resize',onFieldResize);
if(window.visualViewport)window.visualViewport.addEventListener('resize',onFieldResize);
