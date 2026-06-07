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
// x,y = 흰색 라인 안 플레이 영역 기준 0~1 (0=상단 공격, 1=하단 GK)
const FORMATIONS = {
  '4-3-3':   [[.5,.90],[.18,.72],[.38,.72],[.62,.72],[.82,.72],[.28,.50],[.5,.50],[.72,.50],[.18,.22],[.5,.14],[.82,.22]],
  '4-4-2':   [[.5,.90],[.18,.72],[.38,.72],[.62,.72],[.82,.72],[.18,.50],[.38,.50],[.62,.50],[.82,.50],[.35,.20],[.65,.20]],
  '4-2-3-1': [[.5,.90],[.18,.72],[.38,.72],[.62,.72],[.82,.72],[.35,.54],[.65,.54],[.18,.34],[.5,.36],[.82,.34],[.5,.15]],
  '3-4-3':   [[.5,.90],[.25,.72],[.5,.72],[.75,.72],[.18,.50],[.38,.50],[.62,.50],[.82,.50],[.18,.20],[.5,.14],[.82,.20]],
  '3-5-2':   [[.5,.90],[.25,.72],[.5,.72],[.75,.72],[.12,.50],[.32,.50],[.5,.46],[.68,.50],[.88,.50],[.35,.18],[.65,.18]],
  '5-3-2':   [[.5,.90],[.10,.72],[.28,.72],[.5,.72],[.72,.72],[.90,.72],[.28,.50],[.5,.50],[.72,.50],[.35,.18],[.65,.18]],
  '5-4-1':   [[.5,.90],[.10,.72],[.28,.72],[.5,.72],[.72,.72],[.90,.72],[.18,.50],[.38,.50],[.62,.50],[.82,.50],[.5,.16]]
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
  if(!p.positions?.length)return null;
  if(!p.ovr)p.ovr={};
  if(pos&&p.ovr[pos]!=null)return p.ovr[pos];
  const first=pos||p.positions[0];
  if(p.ovr[first]!=null)return p.ovr[first];
  return p.positions.length?50:null;
}
function getBestOvr(p) {
  if(!p.positions?.length)return null;
  if(!p.ovr)p.ovr={};
  const vals=p.positions.map(pos=>p.ovr[pos]!=null?p.ovr[pos]:50);
  return vals.length?Math.max(...vals):null;
}
function normalizePlayerOvr(p) {
  if(!p.positions?.length)return p;
  if(!p.ovr)p.ovr={};
  p.positions.forEach(pos=>{if(p.ovr[pos]==null)p.ovr[pos]=50;});
  return p;
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

// ── 통계 집계 (matches 배열 기준, 클라이언트 계산) ──
function matchResult(m) {
  if (m.scoreUs > m.scoreOpp) return 'W';
  if (m.scoreUs === m.scoreOpp) return 'D';
  return 'L';
}
function matchParticipantPids(m) {
  const pids = new Set();
  (m.lineup || []).forEach(l => { if (l.pid != null) pids.add(l.pid); });
  (m.subs || []).forEach(s => { if (s.pid != null) pids.add(s.pid); });
  return pids;
}
function getMatchYears(matches) {
  const years = new Set(matches.map(m => m.date?.slice(0, 4)).filter(Boolean));
  return [...years].sort((a, b) => b - a);
}
function filterMatchesByYear(matches, year) {
  if (!year || year === 'ALL') return matches;
  return matches.filter(m => m.date && m.date.startsWith(String(year)));
}
function filterMatchesByVenue(matches, venue) {
  if (!venue || venue === 'all') return matches;
  return matches.filter(m => m.homeAway === venue);
}
function computePlayerStats(matches, players) {
  const total = matches.length;
  const map = {};
  players.forEach(p => {
    map[p.id] = { pid: p.id, name: p.name, jersey: p.jersey, positions: p.positions,
      appearances: 0, goals: 0, assists: 0, mom: 0, attendance: 0 };
  });
  matches.forEach(m => {
    matchParticipantPids(m).forEach(pid => { if (map[pid]) map[pid].appearances++; });
    (m.scorers || []).forEach(s => {
      if (!map[s.pid]) return;
      map[s.pid].goals += s.goals || 0;
      map[s.pid].assists += s.assists || 0;
    });
    if (m.mom != null && map[m.mom]) map[m.mom].mom++;
  });
  return Object.values(map).map(s => ({
    ...s,
    attendance: total ? Math.round(s.appearances / total * 100) : 0,
  }));
}
function computeTeamStats(matches) {
  const n = matches.length;
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  matches.forEach(m => {
    gf += m.scoreUs || 0;
    ga += m.scoreOpp || 0;
    const r = matchResult(m);
    if (r === 'W') w++; else if (r === 'D') d++; else l++;
  });
  return {
    played: n, w, d, l, gf, ga,
    winRate: n ? Math.round(w / n * 100) : 0,
    gpg: n ? (gf / n).toFixed(1) : '0.0',
    cpg: n ? (ga / n).toFixed(1) : '0.0',
  };
}
function computeStreaks(matches) {
  const sorted = [...matches].filter(m => m.date).sort((a, b) => a.date.localeCompare(b.date));
  const best = {
    win: { count: 0, from: null, to: null },
    unbeaten: { count: 0, from: null, to: null },
    lose: { count: 0, from: null, to: null },
  };
  let curWin = 0, winFrom = null;
  let curUnbeaten = 0, unbeatenFrom = null;
  let curLose = 0, loseFrom = null;
  const setBest = (key, count, from, to) => {
    if (count > best[key].count) best[key] = { count, from, to };
  };
  sorted.forEach(m => {
    const r = matchResult(m);
    if (r === 'W') {
      if (!curWin) winFrom = m.date;
      curWin++;
      setBest('win', curWin, winFrom, m.date);
    } else curWin = 0;
    if (r !== 'L') {
      if (!curUnbeaten) unbeatenFrom = m.date;
      curUnbeaten++;
      setBest('unbeaten', curUnbeaten, unbeatenFrom, m.date);
    } else curUnbeaten = 0;
    if (r === 'L') {
      if (!curLose) loseFrom = m.date;
      curLose++;
      setBest('lose', curLose, loseFrom, m.date);
    } else curLose = 0;
  });
  return best;
}
function getPlayerStatHistory(matches, pid, type) {
  return matches
    .filter(m => (m.scorers || []).some(s => s.pid === pid && (type === 'goals' ? (s.goals || 0) > 0 : (s.assists || 0) > 0)))
    .map(m => {
      const s = m.scorers.find(x => x.pid === pid);
      return {
        date: m.date, oppTeam: m.oppTeam, scoreUs: m.scoreUs, scoreOpp: m.scoreOpp,
        count: type === 'goals' ? (s.goals || 0) : (s.assists || 0),
      };
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
