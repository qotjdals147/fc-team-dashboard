// ── 상태 ──
// fieldTokens: { pid, slotIdx, freeX, freeY, pos, subPid? }
// slotIdx >= 0 → 슬롯 고정 / -1 → 자유위치
// subPid: 교체 예정 선수 pid (optional)
let players = [], editingId = null, fieldSize = {w:0,h:0};
let matchEvents = {}, matchMom = null, editingMatchId = null;
let fieldTokens = [], matches = [], formationSaves = [], myTeamName = '';

// 팝업 모드: 'pos' | 'sub'
let popupMode = 'pos', popupTargetPid = null;

function getFormation() { return document.getElementById('formationSelect').value; }
function getSlots()     { return FORMATIONS[getFormation()] || []; }
function getLabels()    { return FORMATION_POS_LABELS[getFormation()] || []; }

function tokenXY(t) {
  const slots = getSlots();
  if (t.slotIdx >= 0 && slots[t.slotIdx]) return {x:slots[t.slotIdx][0], y:slots[t.slotIdx][1]};
  return {x:t.freeX??0.5, y:t.freeY??0.5};
}
function tokenAtSlot(slotIdx, excludePid) {
  return fieldTokens.find(t => t.slotIdx === slotIdx && t.pid !== excludePid);
}

// ── 포지션별 슬롯 수 체크 ──
// 해당 포지션이 배치 가능한 슬롯 총 수 vs 이미 배치된 수 비교
function countSlotsByPos(pos) {
  // 현재 포메이션에서 이 포지션을 수용하는 슬롯 수
  const labels = getLabels();
  return labels.filter(l => slotAcceptsPos(l, pos)).length;
}
function countFieldByPos(pos, excludePid) {
  // 현재 필드에 이 포지션으로 배치된 선수 수
  return fieldTokens.filter(t => t.pid !== excludePid && t.pos === pos).length;
}
function checkSlotCapacity(pos, excludePid) {
  // return null = OK, string = 오류 메시지
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
    if (t.slotIdx !== undefined) return t;
    return { pid: t.pid, slotIdx: -1, freeX: t.x ?? 0.5, freeY: t.y ?? 0.5, pos: t.pos || '' };
  });
}
function applyRemoteData(data) {
  players = data.players?.length ? data.players : DEFAULT_PLAYERS.map(p => ({...p}));
  matches = data.matches || [];
  formationSaves = data.saves || [];
  myTeamName = data.meta?.myTeam || '';
  const field = data.field || { formation: '4-3-3', tokens: [] };
  const sel = document.getElementById('formationSelect');
  if (sel) sel.value = field.formation || '4-3-3';
  fieldTokens = normalizeFieldTokens(field.tokens);
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
    field: lf ? { formation: '4-3-3', tokens: JSON.parse(lf) } : (data.field || { formation: '4-3-3', tokens: [] }),
    saves: ls ? JSON.parse(ls) : [],
    meta: { myTeam: lt || '' },
  };
  await apiSavePartial(migrated);
  return migrated;
}
function loadLocalFallback() {
  const s = localStorage.getItem('fc_players');
  players = s ? JSON.parse(s) : DEFAULT_PLAYERS.map(p => ({...p}));
  matches = JSON.parse(localStorage.getItem('fc_matches') || '[]');
  formationSaves = JSON.parse(localStorage.getItem('fc_saves') || '[]');
  myTeamName = localStorage.getItem('fc_myteam') || '';
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
  renderRoster();
  renderRecords();
  renderFormationSaves();
  document.getElementById('formationSelect').addEventListener('change', () => {
    persistField().catch(handleSaveError);
  });
}
async function persistPlayers() { await apiSavePartial({ players }); }
async function persistField() {
  await apiSavePartial({ field: { formation: getFormation(), tokens: fieldTokens } });
}
async function persistMatches() { await apiSavePartial({ matches }); }
async function persistSaves() { await apiSavePartial({ saves: formationSaves }); }
async function persistMeta() { await apiSavePartial({ meta: { myTeam: myTeamName } }); }

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
    const jersey = p.jersey||(i+1);
    return `<div class="player-card">
      <div class="num-ctrl">
        <button class="btn-num" onclick="movePlayerNum(${p.id},-1)" ${i===0?'disabled':''}>▲</button>
        <button class="btn-num" onclick="movePlayerNum(${p.id},1)" ${i===players.length-1?'disabled':''}>▼</button>
      </div>
      <div class="player-jersey" style="background:${posColor(p.positions)}22;color:${posColor(p.positions)};border:1px solid ${posColor(p.positions)}44">${jersey}</div>
      <div class="player-info">
        <div class="player-name-row"><span class="player-name">${p.name}</span>${ovrText}</div>
        <div class="ovr-pos-list">${posOvrTags||'<span style="font-size:11px;color:var(--text3)">포지션 없음</span>'}</div>
      </div>
      <button class="btn-icon" onclick="openEditModal(${p.id})"><i class="ti ti-edit"></i></button>
      <button class="btn-icon danger" onclick="deletePlayer(${p.id})"><i class="ti ti-trash"></i></button>
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
    if(idx>=0) players[idx]={...players[idx],name,jersey,positions,ovr};
  } else {
    players.push({id:nextId(),name,jersey,positions,ovr});
  }
  savePlayers(); closeModal(); renderRoster(); renderField();
}
function deletePlayer(id) {
  if(!confirm('삭제하시겠습니까?')) return;
  players=players.filter(p=>p.id!==id);
  fieldTokens=fieldTokens.filter(t=>t.pid!==id);
  saveFieldState(); savePlayers(); renderRoster(); renderField();
}
document.getElementById('playerModal').addEventListener('click',function(e){if(e.target===this)closeModal();});

// ── 통합 팝업 (포지션 변경 + 선수 변경) ──
function openPosPopup(pid, anchorEl, fromBench) {
  popupMode = 'pos';
  popupTargetPid = pid;
  const p = players.find(x=>x.id===pid); if(!p) return;
  const ft = fieldTokens.find(t=>t.pid===pid);
  const curPos = ft?.pos||p.positions[0]||'';

  // 팝업 제목
  document.getElementById('posPopupTitle').textContent = `${p.jersey?'#'+p.jersey+' ':''}${p.name}`;

  // 포지션 버튼
  document.getElementById('posPopupGrid').innerHTML = ALL_POS.map(pos =>
    `<button class="pos-popup-btn ${pos===curPos?'active':''}" onclick="selectPosFromPopup('${pos}')">${pos}</button>`
  ).join('');

  // 선수 변경 버튼: 필드에 있을 때만
  const subBtn = document.getElementById('posPopupSubBtn');
  subBtn.style.display = ft ? 'block' : 'none';

  // 벤치로 버튼: 필드에 있을 때만
  document.getElementById('posPopupBenchBtn').style.display = ft ? 'block' : 'none';

  _showPopupAt(anchorEl);
}

function openSubPopup(pid, anchorEl) {
  popupMode = 'sub';
  popupTargetPid = pid;
  const p = players.find(x=>x.id===pid); if(!p) return;
  const ft = fieldTokens.find(t=>t.pid===pid);

  document.getElementById('posPopupTitle').textContent = `🔄 ${p.name} 선수 변경`;

  // 현재 sub 표시
  const subP = ft?.subPid ? players.find(x=>x.id===ft.subPid) : null;

  // 모든 선수 목록 (본인 제외) - 필드/벤치 구분해서 표시
  const onFieldPids = fieldTokens.map(t=>t.pid);
  const allOthers = players.filter(x=>x.id!==pid);
  const rows = allOthers.map(x => {
    const isField = onFieldPids.includes(x.id) && x.id!==pid;
    const isSub = ft?.subPid === x.id;
    const ovr = getBestOvr(x);
    const tag = isField
      ? `<span style="font-size:9px;background:var(--info-bg);color:var(--info-text);padding:1px 5px;border-radius:6px">출전중</span>`
      : `<span style="font-size:9px;background:var(--bg2);color:var(--text3);padding:1px 5px;border-radius:6px">벤치</span>`;
    return `<button class="pos-popup-btn sub-player-btn ${isSub?'active':''}" onclick="selectSubPlayer(${x.id})" style="width:100%;text-align:left;display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:var(--radius);margin-bottom:3px">
      <span style="font-weight:600;flex:1">${x.jersey?'#'+x.jersey+' ':''}${x.name}</span>
      ${ovr!=null?`<span style="font-size:10px;color:var(--text3)">${ovr}</span>`:''}
      ${tag}
    </button>`;
  }).join('');

  document.getElementById('posPopupGrid').innerHTML = `<div style="width:100%;max-height:200px;overflow-y:auto">${rows}</div>`;

  // 교체 해제 버튼
  const subBtn = document.getElementById('posPopupSubBtn');
  subBtn.style.display = 'none';
  document.getElementById('posPopupBenchBtn').style.display = ft?.subPid ? 'block' : 'none';
  document.getElementById('posPopupBenchBtn').textContent = '교체 해제';
  document.getElementById('posPopupBenchBtn').onclick = clearSubPlayer;

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
}

function closePosPopup() {
  document.getElementById('posPopup').classList.remove('open');
  popupTargetPid=null; popupMode='pos';
  // 벤치로 버튼 원복
  const bb=document.getElementById('posPopupBenchBtn');
  bb.textContent='벤치로 보내기';
  bb.onclick=sendToBenchFromPopup;
}

function sendToBenchFromPopup() {
  if(!popupTargetPid) return;
  fieldTokens=fieldTokens.filter(t=>t.pid!==popupTargetPid);
  saveFieldState(); closePosPopup(); renderField();
}

function selectPosFromPopup(pos) {
  if(!popupTargetPid) return;
  const pid=popupTargetPid;
  const p=players.find(x=>x.id===pid); if(!p) return;

  const slots=getSlots(), labels=getLabels();
  const ft=fieldTokens.find(t=>t.pid===pid);

  // ── 포지션별 슬롯 수 초과 체크 ──
  const err = checkSlotCapacity(pos, ft?pid:null);
  if(err) { alert(err); return; }

  // 포지션 목록 맨 앞으로
  if(!p.positions.includes(pos)) p.positions.unshift(pos);
  else { p.positions=p.positions.filter(x=>x!==pos); p.positions.unshift(pos); }
  savePlayers(); renderRoster();

  if(ft) {
    const slotIdx=findBestSlot(pos, slots, labels, pid);
    if(slotIdx>=0) {
      const other=tokenAtSlot(slotIdx,pid);
      if(other){other.slotIdx=ft.slotIdx; other.freeX=ft.freeX; other.freeY=ft.freeY;}
      ft.slotIdx=slotIdx; ft.freeX=slots[slotIdx][0]; ft.freeY=slots[slotIdx][1];
    }
    ft.pos=pos;
  } else {
    if(fieldTokens.length>=MAX_FIELD){alert(`최대 ${MAX_FIELD}명까지만 출전 가능합니다.`);closePosPopup();return;}
    const slotIdx=findBestSlot(pos, slots, labels, null);
    if(slotIdx<0){alert(`${pos} 에 배치할 수 있는 빈 자리가 없습니다.`);closePosPopup();return;}
    fieldTokens.push({pid, slotIdx, freeX:slots[slotIdx][0], freeY:slots[slotIdx][1], pos});
  }
  saveFieldState(); closePosPopup(); renderField();
}

// ── 선수 변경 (sub) ──
function selectSubPlayer(targetPid) {
  if(!popupTargetPid) return;
  const mainPid=popupTargetPid;
  const ft=fieldTokens.find(t=>t.pid===mainPid); if(!ft) return;

  const targetFt=fieldTokens.find(t=>t.pid===targetPid);
  if(targetFt) {
    // 필드 선수끼리 자리 교체
    const tmpSlot=ft.slotIdx, tmpFX=ft.freeX, tmpFY=ft.freeY, tmpPos=ft.pos;
    ft.slotIdx=targetFt.slotIdx; ft.freeX=targetFt.freeX; ft.freeY=targetFt.freeY; ft.pos=targetFt.pos;
    targetFt.slotIdx=tmpSlot; targetFt.freeX=tmpFX; targetFt.freeY=tmpFY; targetFt.pos=tmpPos;
    // 교체 예정 해제
    ft.subPid=null;
  } else {
    // 벤치 선수 → 교체 예정으로 등록
    ft.subPid=targetPid;
  }
  saveFieldState(); closePosPopup(); renderField();
}
function clearSubPlayer() {
  const ft=fieldTokens.find(t=>t.pid===popupTargetPid); if(!ft) return;
  ft.subPid=null;
  saveFieldState(); closePosPopup(); renderField();
}

document.addEventListener('click',function(e){
  const pp=document.getElementById('posPopup');
  if(pp.classList.contains('open')&&!pp.contains(e.target)&&!e.target.closest('.player-token')&&!e.target.closest('.bench-player'))
    closePosPopup();
});

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
function getCanvasRect() { return document.getElementById('fieldCanvas').getBoundingClientRect(); }
function drawFieldCanvas() {
  const canvas=document.getElementById('fieldCanvas');
  const wrap=document.getElementById('fieldWrap');
  const W=(wrap.clientWidth||window.innerWidth)-24;
  const H=Math.round(W*1.45);
  canvas.width=W; canvas.height=H;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  const ov=document.getElementById('snapOverlay');
  ov.width=W; ov.height=H; ov.style.width=W+'px'; ov.style.height=H+'px';
  fieldSize={w:W,h:H};
  drawGrass(canvas);
}
function drawGrass(canvas) {
  const W=canvas.width, H=canvas.height;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#1e7a43'; ctx.fillRect(0,0,W,H);
  for(let i=0;i<8;i++){if(i%2===0){ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(0,i*H/8,W,H/8);}}
  ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1.5;
  const pad=16;
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
function drawSnapOverlay(activePid, nx, ny) {
  const ov=document.getElementById('snapOverlay');
  const slots=getSlots(), labels=getLabels();
  const ctx=ov.getContext('2d');
  ctx.clearRect(0,0,ov.width,ov.height);
  const nearSlot=findNearestSlot(activePid,nx,ny);
  slots.forEach((sl,i)=>{
    const sx=sl[0]*ov.width, sy=sl[1]*ov.height, isNear=(nearSlot===i);
    ctx.beginPath();ctx.arc(sx,sy,isNear?18:12,0,Math.PI*2);
    ctx.fillStyle=isNear?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.25)';ctx.fill();
    ctx.strokeStyle=isNear?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.3)';
    ctx.lineWidth=isNear?2:1;ctx.stroke();
    if(labels[i]){
      ctx.fillStyle=isNear?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.5)';
      ctx.font=`${isNear?11:9}px sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(labels[i],sx,sy);
    }
  });
}
function clearSnapOverlay(){const ov=document.getElementById('snapOverlay');ov.getContext('2d').clearRect(0,0,ov.width,ov.height);}
function findNearestSlot(excludePid,nx,ny){
  const slots=getSlots();
  let best=-1, bd=SNAP_RADIUS;
  slots.forEach((sl,i)=>{const d=Math.hypot(sl[0]-nx,sl[1]-ny);if(d<bd){bd=d;best=i;}});
  return best;
}
function tokenPos(nx,ny){
  const wr=document.getElementById('fieldWrap').getBoundingClientRect(), cr=getCanvasRect();
  return {left:cr.left-wr.left+nx*cr.width, top:cr.top-wr.top+ny*cr.height};
}

// ── 필드 렌더 ──
function renderField() {
  const td=document.getElementById('tokens');
  td.innerHTML='';
  document.getElementById('slotInfo').textContent=fieldTokens.length+'/'+MAX_FIELD;
  fieldTokens.forEach(t=>{
    const p=players.find(x=>x.id===t.pid); if(!p) return;
    const pos=t.pos||p.positions[0]||'';
    const ovr=getOvr(p,pos);
    const {x,y}=tokenXY(t);
    const {left,top}=tokenPos(x,y);
    const el=document.createElement('div');
    el.className='player-token';
    el.style.left=left+'px'; el.style.top=top+'px';
    el.dataset.pid=t.pid;

    const isElite=ovr!=null&&ovr>80;
    const ovrStr=ovr!=null?`<div class="token-ovr${isElite?' elite':''}">${ovr} ${ovrStarsText(ovr)}</div>`:'';

    // 교체 예정 표시
    let subStr='';
    if(t.subPid){
      const subP=players.find(x=>x.id===t.subPid);
      if(subP) subStr=`<div class="token-sub">🔄 ${subP.jersey?subP.jersey+' ':''}${subP.name}</div>`;
    }

    // 순서: 포지션뱃지(원 위) → 이름 → OVR → 🔄교체예정
    el.innerHTML=`<div class="token-circle" style="background:${posColor(p.positions)}">
      ${p.name.slice(0,2)}${pos?`<span class="token-pos-badge">${pos}</span>`:''}
    </div>
    <div class="token-name">${p.jersey?p.jersey+' ':''}${p.name}</div>
    ${ovrStr}${subStr}`;
    el.addEventListener('mousedown',onTokenMouseDown);
    el.addEventListener('touchstart',onTokenTouchStart,{passive:false});
    td.appendChild(el);
  });
  renderBench();
}

// ── 전역 드래그 ──
let drag={active:false,pid:null,fromBench:false,startX:0,startY:0,moved:false,longPressTimer:null,el:null};
const LONG_PRESS=200, MOVE_THRESH=6;
function onTokenMouseDown(e){e.preventDefault();startDrag(parseInt(this.dataset.pid),false,e.clientX,e.clientY,this);}
function onTokenTouchStart(e){e.preventDefault();startDrag(parseInt(this.dataset.pid),false,e.touches[0].clientX,e.touches[0].clientY,this);}
function startDrag(pid,fromBench,ex,ey,el){
  if(drag.longPressTimer){clearTimeout(drag.longPressTimer);drag.longPressTimer=null;}
  if(drag.el)drag.el.classList.remove('dragging','snapping');
  drag={active:false,pid,fromBench,startX:ex,startY:ey,moved:false,longPressTimer:null,el};
  drag.longPressTimer=setTimeout(()=>{
    drag.active=true;drag.el.classList.add('dragging');
    document.getElementById('snapOverlay').classList.add('active');
    const {x,y}=tokenXY(fieldTokens.find(t=>t.pid===pid)||{slotIdx:-1,freeX:0.5,freeY:0.5});
    drawSnapOverlay(pid,x,y);
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
    document.getElementById('snapOverlay').classList.add('active');
    if(drag.fromBench&&!fieldTokens.find(t=>t.pid===drag.pid)){
      if(fieldTokens.length>=MAX_FIELD){
        drag={active:false,pid:null,fromBench:false,startX:0,startY:0,moved:false,longPressTimer:null,el:null};
        alert(`최대 ${MAX_FIELD}명까지만 출전 가능합니다.`);return;
      }
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
        const pos=p.positions[0]||'';
        const ovr=getOvr(p,pos);
        const isElite=ovr!=null&&ovr>80;
        const ovrStr=ovr!=null?`<div class="token-ovr${isElite?' elite':''}">${ovr} ${ovrStarsText(ovr)}</div>`:'';
        newEl.innerHTML=`<div class="token-circle" style="background:${posColor(p.positions)}">${p.name.slice(0,2)}${pos?`<span class="token-pos-badge">${pos}</span>`:''}</div><div class="token-name">${p.jersey?p.jersey+' ':''}${p.name}</div>${ovrStr}`;
        newEl.addEventListener('mousedown',onTokenMouseDown);
        newEl.addEventListener('touchstart',onTokenTouchStart,{passive:false});
        td.appendChild(newEl);
        drag.el=newEl;
      }
    }
    if(drag.el)drag.el.classList.add('dragging');
  }
  const cr=getCanvasRect();
  const nx=Math.max(0.04,Math.min(0.96,(ex-cr.left)/cr.width));
  const ny=Math.max(0.04,Math.min(0.96,(ey-cr.top)/cr.height));
  const ft=fieldTokens.find(t=>t.pid===drag.pid);
  if(ft){ft.slotIdx=-1;ft.freeX=nx;ft.freeY=ny;}
  if(drag.el){
    const {left,top}=tokenPos(nx,ny);
    drag.el.style.left=left+'px';drag.el.style.top=top+'px';
    drag.el.classList.toggle('snapping',findNearestSlot(drag.pid,nx,ny)>=0);
  }
  drawSnapOverlay(drag.pid,nx,ny);
}

function onGlobalUp(e){
  if(drag.pid===null)return;
  clearTimeout(drag.longPressTimer);drag.longPressTimer=null;
  const ex=e.clientX, ey=e.clientY;
  const pid=drag.pid,wasActive=drag.active,wasMoved=drag.moved,wasFromBench=drag.fromBench,el=drag.el;
  drag={active:false,pid:null,fromBench:false,startX:0,startY:0,moved:false,longPressTimer:null,el:null};
  if(el)el.classList.remove('dragging','snapping');
  document.getElementById('snapOverlay').classList.remove('active');
  clearSnapOverlay();

  if(!wasActive&&!wasMoved){openPosPopup(pid,el,wasFromBench);return;}

  if(wasActive){
    // 벤치로 드래그
    const benchRect=document.querySelector('.bench-section').getBoundingClientRect();
    if(ey>=benchRect.top&&ex>=benchRect.left&&ex<=benchRect.right){
      fieldTokens=fieldTokens.filter(t=>t.pid!==pid);
      saveFieldState();renderField();return;
    }
    const cr=getCanvasRect();
    const nx=Math.max(0.04,Math.min(0.96,(ex-cr.left)/cr.width));
    const ny=Math.max(0.04,Math.min(0.96,(ey-cr.top)/cr.height));
    const ft=fieldTokens.find(t=>t.pid===pid);
    if(!ft){saveFieldState();renderField();return;}

    const nearSlot=findNearestSlot(pid,nx,ny);
    if(nearSlot>=0){
      const labels=getLabels();
      const other=tokenAtSlot(nearSlot,pid);
      if(!other){
        // 빈 슬롯에 드래그: 포지션 슬롯 수 초과 체크
        // ft.pos가 이 슬롯 레이블과 안 맞으면 경고 (단, 포지션 없는 경우 허용)
        if(ft.pos){
          const err=checkSlotCapacity(ft.pos, pid);
          if(err){ alert(err); ft.slotIdx=-1;ft.freeX=nx;ft.freeY=ny; saveFieldState();renderField();return; }
        }
      }
      // 이전 슬롯 기억 (other 교체용)
      const prevSlot=ft.slotIdx, prevFX=ft.freeX??getSlots()[ft.slotIdx]?.[0]??0.5, prevFY=ft.freeY??getSlots()[ft.slotIdx]?.[1]??0.5;
      if(other){
        other.slotIdx=prevSlot;
        other.freeX=prevSlot>=0?getSlots()[prevSlot]?.[0]??prevFX:prevFX;
        other.freeY=prevSlot>=0?getSlots()[prevSlot]?.[1]??prevFY:prevFY;
      }
      ft.slotIdx=nearSlot;
      ft.freeX=getSlots()[nearSlot][0];
      ft.freeY=getSlots()[nearSlot][1];
      if(!ft.pos&&labels[nearSlot])ft.pos=labels[nearSlot];
    } else {
      ft.slotIdx=-1;ft.freeX=nx;ft.freeY=ny;
    }
    saveFieldState();renderField();
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
    const div=document.createElement('div');
    div.className='bench-player';div.dataset.pid=p.id;
    div.innerHTML=`<div class="dot" style="background:${posColor(p.positions)}"></div>${p.jersey?'#'+p.jersey+' ':''}${p.name}${ovr!=null?`<span class="bench-player-ovr">${ovr}</span>`:''}`;
    div.addEventListener('mousedown',function(e){e.preventDefault();startDrag(p.id,true,e.clientX,e.clientY,this);});
    div.addEventListener('touchstart',function(e){e.preventDefault();startDrag(p.id,true,e.touches[0].clientX,e.touches[0].clientY,this);},{passive:false});
    el.appendChild(div);
  });
}

function applyFormation(){
  const f=getFormation(), slots=FORMATIONS[f]; if(!slots)return;
  const labels=FORMATION_POS_LABELS[f]||[];
  fieldTokens=[];
  players.slice(0,MAX_FIELD).forEach((p,i)=>{
    if(slots[i])fieldTokens.push({pid:p.id,slotIdx:i,freeX:slots[i][0],freeY:slots[i][1],pos:p.positions[0]||labels[i]||''});
  });
  saveFieldState();renderField();
}
function clearField(){fieldTokens=[];saveFieldState();renderField();}
function saveFieldState(){ persistField().catch(handleSaveError); }
function loadFieldState(){
  const s=localStorage.getItem('fc_field'); if(!s)return;
  fieldTokens=normalizeFieldTokens(JSON.parse(s));
}

// ── 포메이션 저장 ──
function saveFormation(){
  const name=prompt('포메이션 이름을 입력하세요'); if(!name)return;
  formationSaves.unshift({id:Date.now(),name,formation:getFormation(),tokens:JSON.parse(JSON.stringify(fieldTokens)),date:new Date().toLocaleDateString('ko-KR')});
  persistSaves().then(()=>{renderFormationSaves();alert('저장되었습니다!');}).catch(handleSaveError);
}
function loadSave(id){
  const s=formationSaves.find(x=>x.id===id); if(!s)return;
  fieldTokens=normalizeFieldTokens(s.tokens);
  document.getElementById('formationSelect').value=s.formation||'4-3-3';
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
function openMatchModal(editId){
  matchEvents={};matchMom=null;editingMatchId=editId||null;
  let em=null;
  if(editId){em=matches.find(m=>m.id===editId);}
  document.getElementById('matchMyTeam').value=em?.myTeam||myTeamName||'';
  document.getElementById('matchOppTeam').value=em?.oppTeam||'';
  document.getElementById('matchDate').value=em?.date||new Date().toISOString().slice(0,10);
  document.getElementById('matchScoreUs').value=em?.scoreUs??0;
  document.getElementById('matchScoreOpp').value=em?.scoreOpp??0;
  const onField=fieldTokens.map(t=>{
    const p=players.find(x=>x.id===t.pid); if(!p)return null;
    return {pid:p.id,name:p.name,pos:t.pos||p.positions[0]||'',ovr:getOvr(p,t.pos||p.positions[0]||'')};
  }).filter(Boolean);
  const list=document.getElementById('matchEventList');
  if(!onField.length){
    list.innerHTML='<div style="font-size:13px;color:var(--text3)">포메이션 탭에서 선수를 배치해주세요</div>';
    document.getElementById('momSelectWrap').innerHTML='';
  } else {
    matchEvents=Object.fromEntries(onField.map(x=>[x.pid,{
      goals:em?.scorers?.find(s=>s.pid===x.pid)?.goals||0,
      assists:em?.scorers?.find(s=>s.pid===x.pid)?.assists||0
    }]));
    matchMom=em?.mom||null;
    list.innerHTML=onField.map(x=>`
      <div class="player-event-row">
        <span class="player-event-name">${x.name}</span>
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
      </div>`).join('');
    document.getElementById('momSelectWrap').innerHTML=`<div class="mom-select" id="momBtns">
      ${onField.map(x=>`<button class="mom-btn ${matchMom===x.pid?'active':''}" onclick="selectMom(${x.pid})" id="mom_${x.pid}">${x.name}</button>`).join('')}
    </div>`;
  }
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
  const myTeam=document.getElementById('matchMyTeam').value.trim()||'우리 FC';
  const oppTeam=document.getElementById('matchOppTeam').value.trim()||'상대 FC';
  const date=document.getElementById('matchDate').value;
  const scoreUs=parseInt(document.getElementById('matchScoreUs').value)||0;
  const scoreOpp=parseInt(document.getElementById('matchScoreOpp').value)||0;
  myTeamName=myTeam;
  const scorers=fieldTokens.map(t=>{
    const p=players.find(x=>x.id===t.pid);if(!p)return null;
    const ev=matchEvents[t.pid]||{goals:0,assists:0};
    return{pid:t.pid,name:p.name,pos:t.pos||p.positions[0]||'',ovr:getOvr(p,t.pos||p.positions[0]||''),goals:ev.goals,assists:ev.assists};
  }).filter(x=>x&&(x.goals>0||x.assists>0));
  const lineup=fieldTokens.map(t=>{
    const p=players.find(x=>x.id===t.pid);if(!p)return null;
    return{pid:t.pid,name:p.name,pos:t.pos||p.positions[0]||'',ovr:getOvr(p,t.pos||p.positions[0]||'')};
  }).filter(Boolean);
  const momPlayer=matchMom?players.find(p=>p.id===matchMom):null;
  const matchData={id:editingMatchId||Date.now(),myTeam,oppTeam,date,scoreUs,scoreOpp,formation:getFormation(),lineup,scorers,mom:matchMom||null,momName:momPlayer?.name||null};
  if(editingMatchId){const idx=matches.findIndex(m=>m.id===editingMatchId);if(idx>=0)matches[idx]=matchData;else matches.unshift(matchData);}
  else matches.unshift(matchData);
  Promise.all([persistMatches(), persistMeta()]).then(()=>{
    closeMatchModal();renderRecords();
  }).catch(handleSaveError);
}
function deleteMatch(id){
  if(!confirm('삭제하시겠습니까?'))return;
  matches=matches.filter(m=>m.id!==id);
  persistMatches().then(renderRecords).catch(handleSaveError);
}
function renderRecords(){
  const el=document.getElementById('recordsContent');
  if(!matches.length){el.innerHTML='<div class="empty-state">기록된 경기가 없습니다</div>';return;}
  el.innerHTML=matches.map(m=>{
    const res=m.scoreUs>m.scoreOpp?'🏆 승':m.scoreUs===m.scoreOpp?'🤝 무':'💔 패';
    const scorerRows=m.scorers.map(s=>`
      <div class="match-scorer-row">
        <span class="match-scorer-icon">⚽</span>
        <span class="match-scorer-name">${s.name}</span>
        <span class="match-scorer-pos">${s.pos}</span>
        <span class="match-scorer-ovr">${s.ovr!=null?s.ovr+' '+ovrStarsText(s.ovr):''}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--text2)">골 ${s.goals}${s.assists>0?' · 어시 '+s.assists:''}</span>
      </div>`).join('');
    const momBadge=m.momName?`<span class="match-mom">🏅 MOM ${m.momName}</span>`:'';
    return `<div class="match-card">
      <div class="match-score-row">
        <span class="match-team" style="text-align:right">${m.myTeam}</span>
        <span class="match-score">${m.scoreUs} : ${m.scoreOpp}</span>
        <span class="match-team">${m.oppTeam}</span>
      </div>
      <div class="match-meta">${m.date} · ${res}<span class="match-formation-badge">${m.formation}</span>${momBadge}</div>
      ${scorerRows?`<div class="match-scorers">${scorerRows}</div>`:''}
      <div class="match-card-btns">
        <button class="btn-match-edit" onclick="openMatchModal(${m.id})"><i class="ti ti-edit"></i> 수정</button>
        <button class="btn-match-del" onclick="deleteMatch(${m.id})"><i class="ti ti-trash"></i> 삭제</button>
      </div>
    </div>`;
  }).join('');
}

// ── 탭 ──
function switchTab(tab){
  ['roster','formation','records'].forEach((t,i)=>{
    document.querySelectorAll('.tab-btn')[i].classList.toggle('active',t===tab);
    document.getElementById('tab-'+t).classList.toggle('active',t===tab);
  });
  if(tab==='formation'){drawFieldCanvas();renderField();renderFormationSaves();}
  if(tab==='records')renderRecords();
}

// ── 초기화 ──
document.getElementById('matchModal').addEventListener('click',function(e){if(e.target===this)closeMatchModal();});
bootstrapApp();
window.addEventListener('resize',()=>{
  if(document.getElementById('tab-formation').classList.contains('active')){drawFieldCanvas();renderField();}
});
