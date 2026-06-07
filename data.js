const ALL_POS = ['GK','CB','DF','LB','RB','LWB','RWB','CDM','CM','CAM','MF','LW','RW','CF','ST','FW'];

const POS_BG = {
  GK:'#185FA5',
  CB:'#3B6D11', DF:'#3B6D11', LB:'#3B6D11', RB:'#3B6D11', LWB:'#3B6D11', RWB:'#3B6D11',
  CDM:'#BA7517', CM:'#BA7517', CAM:'#BA7517', MF:'#BA7517',
  LW:'#D85A30', RW:'#D85A30', CF:'#D85A30', ST:'#D85A30', FW:'#D85A30'
};
const POS_LAYER = {
  GK:0, CB:1, DF:1, LB:1, RB:1, LWB:1.5, RWB:1.5,
  CDM:2, CM:3, CAM:4, MF:3, LW:5, RW:5, CF:6, ST:6, FW:6
};
function posClass(p) {
  return {GK:'gk',CB:'def',DF:'def',LB:'def',RB:'def',LWB:'def',RWB:'def',
          CDM:'mid',CM:'mid',CAM:'mid',MF:'mid',LW:'fwd',RW:'fwd',CF:'fwd',ST:'fwd',FW:'fwd'}[p]||'';
}
function posColor(positions) { return POS_BG[positions&&positions[0]] || '#6b6b68'; }

// ── 포메이션 슬롯 좌표 ──
// y=0 상단(공격방향), y=1 하단(골키퍼방향)
// 그라운드: pad=16px기준 실제 플레이 영역은 y≈0.04~0.96
// GK: 하단 페널티박스 안쪽 = y≈0.87
// 공격라인: y≈0.15~0.20
const FORMATIONS = {
  '4-3-3':   [[.5,.87],[.2,.68],[.4,.68],[.6,.68],[.8,.68],[.3,.48],[.5,.48],[.7,.48],[.2,.24],[.5,.18],[.8,.24]],
  '4-4-2':   [[.5,.87],[.2,.68],[.4,.68],[.6,.68],[.8,.68],[.2,.48],[.4,.48],[.6,.48],[.8,.48],[.35,.22],[.65,.22]],
  '4-2-3-1': [[.5,.87],[.2,.68],[.4,.68],[.6,.68],[.8,.68],[.35,.53],[.65,.53],[.2,.35],[.5,.37],[.8,.35],[.5,.17]],
  '3-4-3':   [[.5,.87],[.25,.68],[.5,.68],[.75,.68],[.2,.48],[.4,.48],[.6,.48],[.8,.48],[.2,.22],[.5,.18],[.8,.22]],
  '3-5-2':   [[.5,.87],[.25,.68],[.5,.68],[.75,.68],[.15,.48],[.35,.48],[.5,.43],[.65,.48],[.85,.48],[.35,.20],[.65,.20]],
  '5-3-2':   [[.5,.87],[.1,.68],[.3,.68],[.5,.68],[.7,.68],[.9,.68],[.3,.48],[.5,.48],[.7,.48],[.35,.20],[.65,.20]],
  '5-4-1':   [[.5,.87],[.1,.68],[.3,.68],[.5,.68],[.7,.68],[.9,.68],[.2,.48],[.4,.48],[.6,.48],[.8,.48],[.5,.19]]
};

const FORMATION_POS_LABELS = {
  '4-3-3':   ['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW'],
  '4-4-2':   ['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'],
  '4-2-3-1': ['GK','LB','CB','CB','RB','CDM','CDM','LW','CAM','RW','ST'],
  '3-4-3':   ['GK','CB','CB','CB','LM','CM','CM','RM','LW','ST','RW'],
  '3-5-2':   ['GK','CB','CB','CB','LWB','CDM','CM','CDM','RWB','ST','ST'],
  '5-3-2':   ['GK','LWB','CB','CB','CB','RWB','CM','CM','CM','ST','ST'],
  '5-4-1':   ['GK','LWB','CB','CB','CB','RWB','LM','CM','CM','RM','CF']
};

const SLOT_LABEL_MATCH = {
  'GK' :['GK'],
  'CB' :['CB','DF'], 'DF':['DF','CB'],
  'LB' :['LB','LWB'], 'RB':['RB','RWB'],
  'LWB':['LWB','LB'], 'RWB':['RWB','RB'],
  'LM' :['LW','LWB','LB'], 'RM':['RW','RWB','RB'],
  'CDM':['CDM','CM','MF'], 'CM':['CM','CDM','CAM','MF'],
  'CAM':['CAM','CM','MF'], 'MF':['MF','CM','CAM','CDM'],
  'LW' :['LW','LWB','CF','ST','FW'], 'RW':['RW','RWB','CF','ST','FW'],
  'CF' :['CF','ST','FW','LW','RW'],
  'ST' :['ST','CF','FW','LW','RW'], 'FW':['FW','ST','CF']
};

const SNAP_RADIUS = 0.1;
const MAX_FIELD = 11;

// ── OVR: 1~100, 20단위 별 1개씩 ──
function ovrStarCount(ovr) {
  if (ovr==null||ovr<1) return 0;
  return Math.min(5, Math.ceil(ovr/20));
}
function ovrStars(ovr) {
  const n=ovrStarCount(ovr); if(n===0)return '';
  const stars='★'.repeat(n);
  if(n===5) return `<span class="ovr-stars elite">${stars}</span>`;
  const color=n>=3?'#f59e0b':'#9ca3af';
  return `<span class="ovr-stars" style="color:${color}">${stars}</span>`;
}
function ovrStarsText(ovr) { const n=ovrStarCount(ovr); return n>0?'★'.repeat(n):''; }
function getOvr(p,pos) {
  if(!p.ovr)return null;
  if(p.ovr[pos]!=null)return p.ovr[pos];
  return p.ovr[p.positions[0]]??null;
}
function getBestOvr(p) {
  if(!p.ovr||!p.positions.length)return null;
  const vals=p.positions.map(pos=>p.ovr[pos]).filter(v=>v!=null);
  return vals.length?Math.max(...vals):null;
}

const DEFAULT_PLAYERS = [
  {id:1,  name:'경표', jersey:7,  positions:['LW','RW'],           ovr:{}},
  {id:2,  name:'승규', jersey:5,  positions:['CB','CDM','ST'],      ovr:{}},
  {id:3,  name:'인수', jersey:8,  positions:['MF'],                 ovr:{}},
  {id:4,  name:'주용', jersey:6,  positions:['MF','CB'],            ovr:{}},
  {id:5,  name:'승지', jersey:4,  positions:['MF','CB'],            ovr:{}},
  {id:6,  name:'청재', jersey:9,  positions:['ST','LW','RW'],       ovr:{}},
  {id:7,  name:'종민', jersey:3,  positions:['CB'],                 ovr:{}},
  {id:8,  name:'성진', jersey:10, positions:['CAM','MF'],           ovr:{}},
  {id:9,  name:'인성', jersey:2,  positions:['CB','CDM'],           ovr:{}},
  {id:10, name:'성준', jersey:1,  positions:['GK','ST'],            ovr:{}},
  {id:11, name:'용민', jersey:11, positions:['LB','RB'],            ovr:{}},
  {id:12, name:'미수', jersey:12, positions:['RW','LW','LB','MF'],  ovr:{}},
  {id:13, name:'지원', jersey:13, positions:['LW','RW','LB','RB'],  ovr:{}},
  {id:14, name:'철민', jersey:21, positions:['GK'],                 ovr:{}},
  {id:15, name:'진우', jersey:14, positions:['MF'],                 ovr:{}},
  {id:16, name:'승위', jersey:16, positions:[],                     ovr:{}},
  {id:17, name:'지환', jersey:17, positions:['MF','FW'],            ovr:{}}
];
