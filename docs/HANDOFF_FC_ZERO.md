# FC 팀 포메이션 매니저 — AI 인수인계 문서

> **목적**: 새 세션·새 에이전트·**옆 PC**가 이 파일만 읽고 바로 작업 이어가기.  
> **최종 갱신**: 2026-09-04 (§41 v122 pid 재사용 통계·출석 fix · 배포 `app.js?v=122` `data.js?v=83`)  
> **플랫폼** → **`docs/HANDOFF_PLATFORM.md`** — 이 파일(`HANDOFF_FC_ZERO.md`) **아님**  
> **작업자(기획)**: 배성민 — 클럽장 노민수 컨펌 하에 오프라인 이벤트(회식 브리핑, 분기 MVP 시상) 연계 예정  
> **워크스페이스**: `C:\Users\qotjd\Downloads\fv6` (옆 PC: 폴더 복사 또는 `qotjdals147/fc-team-dashboard` clone)  
> **DB**: **Supabase PostgreSQL** (Seoul) — Google Sheets/Code.gs는 **레거시** (`setup/` 보존, 운영 미사용)

---

## 0. 세션 재개 — 옆 PC에서 여기부터

### 옆 PC 3분 체크리스트
1. `fv6` 폴더 복사 또는 GitHub `fc-team-dashboard` clone
2. **`HANDOFF_FC_ZERO.md` §0 + §30~§31** + **`setup/SUPABASE_GUIDE.md`** 읽기  
   (플랫폼 작업 시 → **`docs/HANDOFF_PLATFORM.md`**)
3. `api.js` 상단 `SUPABASE_URL` / `SUPABASE_KEY` 확인
4. `index.html` → **`app.js?v=122` + `api.js?v=103` + `data.js?v=83`** (셋 다 캐시 확인)
5. 배포 URL **정본** → https://fc-team-dashboard.vercel.app · ~~github.io~~ Pages **OFF** (복구 §39.2) · 동기화 바 **↻ 수동 갱신**
6. **2026-09-04 버그** → §41 (pid 재사용 통계) · **lineup DB 역사 정리는 User 미결** (`setup/fix-lineup-pid-recycle.sql`)

### FC Zero ↔ 플랫폼 구단 홈 동기화 (2026-07-28)

| 영역 | FC Zero (`app.js` 루트) | 플랫폼 (`platform/club/app.js`) |
|------|-------------------------|----------------------------------|
| 포메·쿼터·큰 화면 UI | ✅ v122 | ✅ **동일 패치** · `club-boot.js` → `app.js?v=15` · `data.js?v=8` |
| 30초 poll | **제거** · `setupManualDataSync()` | **제거** (P7c와 통합) |
| 등번호 `"00"` | `parseJerseyInput` 문자열 | 동일 |
| 포메 필드 fit | `scheduleFormationLayout` · `computeFieldCanvasSize` | 동일 |

→ 포메/동기화/등번호/큰 화면 UI 수정 시 **두 `app.js` 모두** 반영 · 상세 **`HANDOFF_PLATFORM.md` §10c·§10d·§10e**

### 현재 아키텍처 (2026-06-13~)
```
브라우저 → **Vercel (정본)** · ~~GitHub Pages~~ OFF
    ↓
api.js — Supabase REST API (apiLoadAll / apiSavePartial)
    ↓
Supabase PostgreSQL (Seoul) — 13 tables, RLS off, anon key
```

| 항목 | 값 |
|------|-----|
| **캐시** | `app.js?v=122`, `style.css?v=118`, `data.js?v=83`, **`api.js?v=103`** |
| **배포 URL (정본)** | https://fc-team-dashboard.vercel.app |
| **배포 URL (레거시·백업)** | `https://qotjdals147.github.io/fc-team-dashboard/` — **Pages OFF** (2026-07-29) · **복구 §39.2** · Git push·Vercel 배포는 **OFF와 무관하게 유지** |
| **Vercel** | 팀 `popup-cube` · 프로젝트 `fc-team-dashboard` · Git **`qotjdals147/fc-team-dashboard`** 연동 ✅ · **`setup/VERCEL_MIGRATION.md`** |
| **GitHub** | `qotjdals147/fc-team-dashboard` (백업 태그: `v-google-sheets-backup`) |
| **Supabase** | 프로젝트 `FOOTBALL-SITE` — **`setup/SUPABASE_GUIDE.md`** (운영 정본) |
| **레거시** | `setup/Code.gs` — **운영 미사용**, 스키마 참고용만 |

> **사업화 (R37)**: 이 repo·URL·Supabase = **FC 제로 클럽 전용**. 사업 **플랫폼**은 **별도** (도메인·DB·배포). 상세 `docs/BUSINESS_VISION.md` **§1-0**.

### Supabase 전환 배경
- Google Sheets + Apps Script **콜드 스타트** → 동기화 3~10초 딜레이
- `api.js`만 교체, `app.js`/`data.js` 인터페이스 유지 (`apiLoadAll`, `apiSavePartial`)

### v99 — Supabase 후속 수정 (Cursor 세션)
| 파일 | 내용 |
|------|------|
| `api.js` | `apiLoadAll(silent)` — 폴링 시 로딩 바 미표시 |
| `api.js` | `sbUpsertMeta` — 기존 meta **병합** 후 key upsert (전체 DELETE 제거) |
| `app.js` | `pollRefresh` — 잔존 `SHEET_API` 호출 제거 → `apiLoadAll(true)` |

### 데이터 이전 상태 (Supabase)
| 테이블 | 상태 |
|--------|------|
| players | ✅ 25명 |
| meta | ✅ 팀명·비밀번호(`0906`/`0108`)·사진 등 |
| schedules | ✅ 2건 |
| notices | ✅ 4건 (회칙 포함) |
| field | ✅ 1~4쿼터 |
| matches, dues, expenses, settlements | ⬜ 없음 (신규 기록부터) |
| disciplines, dueExemptions, dueMemos, saves | ⬜ 없음 |

### 비밀번호 (Supabase)
- `meta.adminPw` = `0906`, `meta.treasurerPw` = `0108` (PostgreSQL **text** — 선행 0 유지)
- Google Sheets 시절 `906`/`108` 깨짐 이슈는 **Supabase 전환으로 해소** (§29는 레거시 참고)
- `app.js` `syncMetaPasswords` + `sbUpsertMeta`의 `String()` 유지

### ✅ v122에서 해소 (2026-09-04)
- ~~신규 정회원에게 과거 용병 `(용)` 경기 골/어시·**출석**·**수당**이 pid 재사용으로 합산~~ → **`resolveScorerPlayerId`** · **`matchParticipantPids(m, players)`** · **`computeMatchWages`** · DB scorer **2026-07-12 pid 29→11** ✅ · §41

### ⚠️ 알려진 이슈 (미해결)
- **RLS 비활성 + anon key** — 공개 repo에 키 노출. 프로덕션 강화 시 RLS·Edge Function 검토 (§30)

### ✅ v114에서 해소 (2026-07-28)
- ~~30초 `pollRefresh` + `persistField` 경쟁 → 쿼터·토큰 덮어쓰기~~ → **poll 제거** · ↻ 수동 · `visibilitychange` 1회 (`setupManualDataSync`)
- ~~포메 필드 위·아래 잘림 · ALL/⬇ 버튼 안 보임~~ → **`scheduleFormationLayout`** (벤치 먼저 → wrap 실측 → 캔버스 fit) · §36
- ~~등번호 `00` 미표시~~ → **문자열 저장** · DB `players.jersey` → `text` (`setup/jersey-text.sql`)

### ✅ v115~116에서 해소 (2026-07-28)
- ~~발표 모드 포메이션 드롭다운 없음~~ → 프레젠테이션 중 **`<select>`만** 노출 · §37
- ~~포메 슬롯 간격 불균일·상대 골대 침범~~ → **FORMATIONS 10종** 좌표 재조정 · §37
- ~~경기장 비율 들쑥날쑥 (벤치·선수 수)~~ → **`aspect-ratio` + bench 고정 높이** · §37
- ~~「발표」 버튼 직관성~~ → **「큰 화면」/「큰 화면 종료」** · §37

### ✅ v117에서 해소 (2026-07-28)
- ~~v115가 큰 화면까지 `aspect-ratio`+inner 실측 적용 → 캔버스 가로 늘어남~~ → **큰 화면은 v114 `fitFieldAspect` 복원** · §38
- ~~ST만 y 0.16으로 윙보다 위(4-3-3·4-2-1-3 등)~~ → **공격 라인 y 0.22 통일** · §38

### 다음 작업 예정 (우선순위)
1. **GitHub Pages** — `app.js?v=117` 배포 · **Supabase** `jersey-text.sql` RUN
2. 지출 영수증 이미지, 총무 피드백, 미납 ⚠️ 등

### 사용자 배포 체크
1. GitHub Pages: `index.html`, `app.js`, `api.js`, `style.css`, `data.js` — **`api.js?v=99`** 확인
2. push 후 5~15분 CDN 전파
3. **`Code.gs` 재배포 불필요** — Supabase 운영 중
4. Supabase 대시보드: 13 tables Data API exposed, RLS off (§30)

### 핵심 파일·함수
| 파일 | 역할 |
|------|------|
| `api.js` | `SUPABASE_URL/KEY`, `apiLoadAll`, `apiSavePartial`, `sbUpsert*`, `sbSelect*` |
| `app.js` | UI·비즈니스 로직, `persist*`, `applyRemoteData`, **`setupManualDataSync`** (↻ 수동) |

### v74~84 세션에서 완료된 것
| 영역 | 내용 |
|------|------|
| 팀명 | 홈 팀명 변경 시 과거 경기 `myTeam` 자동 통일 (`getDisplayMyTeam`, `syncAllMatchTeamNames`) |
| 일정 | 경기 일정 `time` 시트 ISO → `HH:mm` 표시 (`normalizeTime`) |
| 총무 메모 | `dueMemos.yearMonth` `YYYY-MM` 정규화 — 월 바꿔도 메모 유지 |
| 쿼터 복사 UI | 1Q~3Q 아래 **→** 버튼 (`copyQuarterForward`) — 일반·발표 모드 동일. **탭 전환만으로는 복사 안 함** |
| 회의용 문서 | `CLUB_MEMBER_GUIDE.md` — 클럽원 소개·Q&A 참고서 |
| 포메 동기화 (시도→롤백) | v80 회의 보호(폴링 차단·debounce) 적용 후 부작용 → **v81 롤백**. 아래 「예정 작업」 참고 |
| 포메 PNG (v82~84) | 필드 우하단 ⬇ — **활성 쿼터 1장**, 쿼터 라벨·화면과 동일 토큰 렌더·벤치 제외·**직접 다운로드**(공유 우선 제거). §27 참고 |

### ⚠️ 알려진 이슈 (미해결)
- **RLS 비활성 + anon key** — §30

### v114 — 포메·동기화·등번호 (2026-07-28 · 플랫폼 `club/app.js` 동기)

| 항목 | 내용 |
|------|------|
| **동기화** | 30초 `pollRefresh` **삭제** · `setupManualDataSync()` · `#syncRefreshBtn`(↻) · 탭 복귀 1회 fetch |
| **포메 레이아웃** | `renderBench()` → `scheduleFormationLayout()` → `computeFieldCanvasSize()` (wrap 실측, export 52px 여백) |
| **등번호** | `parseJerseyInput` · `"00"` 문자열 · DB `setup/jersey-text.sql` |
| **캐시** | `app.js?v=114`, `style.css?v=114` |

### v88~98 — 최근 완료 (패널티·UI·버그픽스)

| 버전 | 내용 |
|------|------|
| v88 | OVR 입력 `min=0`, 빈값/0/100초과 저장 차단 |
| v89~91 | PNG ALL 쿼터 일괄 다운로드 (`exportAllQuarterImages`) |
| v92 | 홈 **회칙 및 사이트 소개** (`notices` 순서·관리자 ▲▼) |
| v93~96 | **패널티(징계)** — `disciplines` 테이블, 가치·리워드 연동 (§28) |
| v94 | 가치 내역 `합;계`·`원;` 세미콜론 버그 수정 (`\uC6D0;` 오타) |
| v95 | 통계 **징계수** 열, 뱃지 ⚠ 우측, 헤더 **곸→골** (`&#xACE8;`) |
| v96 | 수당 라벨 **곸킨→골×N** (`&#xACF8;&#xD0A8;` → `&#xACE8;`) |
| v97 | UI **패널티** 명칭, 금액 -30/-50, 사유 지각·무단불참, 공지 작성란 확대 |
| v98 | **비밀번호 선행 0** (Google Sheets 레거시) — `Code.gs` 텍스트 강제 |
| v99 | **Supabase 전환** — `api.js` 교체, `pollRefresh` 수정, `sbUpsertMeta` 병합 |
| v100 | **동기화 버그픽스** — meta 팀명·사진 유실, 구버전 배포·캐시, 부분 로드 (§32) |
| v101 | 총무 **일괄 입금** Supabase 저장 (정수 id) |
| v102 | 총무 입금 **선택 삭제** (§33) |
| v109 | 총무 **지출 저장** 실패 시 DB·화면 유실 수정 (§33) |
| v110 | 총무 **영수증 PNG 메모** · 총무 탭 **폴링 스킵** (§33) |
| v111 | 영수증 **즉시 PNG 다운로드** · `지출영수증(YYYY.MM).png` 기준월 (§33) |
| v103 | 팀 사진 **Storage 파일 업로드** (A안, §34) |
| v106 | **수당 금액 수정** (관리자 메뉴, `meta.wageRates`) · **상대 자책골** (`matches.oppOwnGoals`) · MOM 기본 500원 |

### 패널티 — 한 줄 요약 (§28 상세)
- **등록**: 관리자 → **통계** 탭 → `+ 패널티` 또는 선수 행 ⚠
- **가치**: `경기 수당 합 − 패널티 합` → 명단(×100만)·통계·**총무 리워드** 동일 공식
- **항목**: 1~3차 (-1000/-2000/-3000, 당일 출전정지), -30원, -50원
- **사유**: 팀 내 불화, 상대팀 마찰, **지각**, **무단 불참**, 기타

### `app.js` 핵심 함수 (대략)
| 기능 | 함수 |
|------|------|
| 쿼터 전환 | `switchQuarter()` |
| 쿼터 → 다음 복사 | `copyQuarterForward(fromQ)` |
| 포메 PNG | `exportFormationImage()`, `exportAllQuarterImages()`, `drawExportToken()` |
| 토큰 pos 통일 | `resolveTokenPos(t,p)` |
| 포메·DB 저장 | `confirmSaveFormation()`, `persistField()` |
| 폴링 | ~~`pollRefresh`~~ → **`manualDataRefresh`** · ↻ 버튼 (v114) |
| 홈 회칙·일정 | `openNoticeModal`, `saveNoticeItem`, `openScheduleModal` |
| **패널티** | `openDisciplineModal`, `saveDiscipline`, `deleteDiscipline`, `persistDisciplines` |
| **비밀번호** | `getAdminPw`, `getTreasurerPw`, `syncMetaPasswords`, `persistMeta` (adminPw/treasurerPw 병합) |
| **수당 기준** | `loadWageRates`, `openWageRatesModal`, `saveWageRates`, `computeMatchWages` |
| 가치·정산 | `computePlayerTotalWage`, `computeUnsettledWageBreakdown`, `openValueHistory` |
| 총무 | `renderTreasurer`, `previewSettlement`, `openTreasurerDisciplineDetail`, `cancelSettlement` |

### index.html 한글 수정 규칙 (필수)
- **PowerShell·StrReplace로 index.html 한글 직접 쓰기 금지** — CP949 깨짐·`?` 치환 사고
- **권장**: Python `encoding='utf-8'` 스크립트 (`scripts/patch_*.py` 참고)
- 또는 HTML 엔티티 `&#xACE8;` (=골) — **`&#xACF8;`은 곸(오타)** 이므로 골 컬럼·라벨에 쓰지 말 것
- `app.js` 동적 문구: `\uXXXX` 유니코드만 — **`\uC6D0;`처럼 뒤에 `;` 붙이면 화면에 `원;` 표시** (v94 사고)
- `innerHTML`에 HTML 엔티티(`&#xC6D0;`) OK / `textContent`·alert에는 `\uC6D0`만

### 연동 규칙 파일
- `.cursor/rules/fc-sheet-integration.mdc` — **Supabase 연동** (구 Google Sheets 레거시 참고 포함)
- `.cursor/rules/fc-change-review.mdc` — 기능 변경 시 연동 검토

---

## 1. 프로젝트 한 줄 요약

동호회 축구 FC의 **선수 명단 · 포메이션 배치(쿼터별) · 경기 기록 · 통계**를 관리하는 모바일 우선 웹앱.  
**Vanilla HTML/CSS/JS** + **Supabase(PostgreSQL) REST API** + **localStorage 오프라인 캐시**.  
**GitHub Pages** 정적 호스팅. 폰·PC·태블릿에서 동일 데이터 공유.

---

## 2. 파일 구조

```
fv6/
├── index.html    # 탭 UI, 모달 (캐시 app ?v=98, api ?v=99)
├── style.css
├── data.js       # 포지션·포메이션·OVR·DISCIPLINE_AMOUNTS
├── app.js        # 앱 로직 (~4600줄) — DB 호출은 api.js 경유
├── api.js        # ★ Supabase REST (SUPABASE_URL/KEY, apiLoadAll, apiSavePartial)
├── README.md     # 폴더 구조 안내
├── docs/
│   ├── HANDOFF_FC_ZERO.md
│   ├── BUSINESS_VISION.md
│   ├── CLUB_MEMBER_GUIDE.md
│   ├── PORTFOLIO_SK_HYNIX_AMHS.md
│   └── legacy/SUPABASE_GUIDE.txt
├── manual/       # 업무 매뉴얼 HTML (FC 제로와 별개)
├── setup/
│   ├── SUPABASE_GUIDE.md    # ★ Supabase 운영 정본 (SQL·트러블슈팅·에이전트 흐름)
│   ├── Code.gs              # 레거시 Google Sheets
│   └── GOOGLE_SHEET_SETUP.md
├── platform/     # 사업 플랫폼 (별도 URL·DB)
├── portfolio/    # 포트폴리오 HTML
├── scripts/      # 유틸 Python (patch_*.py 등)
├── projects/     # MERANTOOL(ADS) 등
├── archive/      # 구버전 zip·추출본
├── links/        # 바로가기 .url
└── .cursor/rules/
```

**외부 의존**: Tabler Icons CDN

**백엔드/빌드 도구 없음** — 정적 파일 배포만.

---

## 3. 현재 앱 구조 (탭 6개)

| 탭 ID | 화면명 | 주요 기능 | 비관리자 |
|-------|--------|-----------|----------|
| `home` | 홈 | 단체 사진, 팀명, **경기 일정·회칙 및 사이트 소개** 버튼, 클럽원 명단 | 일정/회칙 보기 (관리자만 편집) |
| `roster` | 명단 | 선수 CRUD, OVR·formBonus, 포지션 | 보기만 |
| `formation` | 포메이션 | **10종** 포메이션 (4-3-3·4-4-2·4-2-3-1·**4-1-4-1·4-2-1-3·4-1-2-3**·3-4-3·3-5-2·5-3-2·5-4-1), **1~4쿼터** 독립 배치, 드래그, 벤치, 저장/불러오기, **필드 PNG 다운로드**, **프레젠테이션 모드** | 보기만 |
| `records` | 경기기록 | 경기 입력/수정/삭제, 골·어시, MOM, **쿼터 집계 출전 명단** | 보기만 |
| `stats` | 통계 | 개인·팀 통계, **패널티 등록**, 징계수 열 | **숨김** (관리자만) |
| `treasurer` | 총무 | 회비·지출·리워드정산 | **숨김** (총무만) |

### 총무 모드
- 기본값: **비총무** (`isTreasurer = false`, 새로고침마다 초기화)
- 진입: 동기화 바 💰 → 비밀번호 (기본 `1234`, `localStorage` + Supabase `meta.treasurerPw`)
- 해제 메뉴: 💳 → 「총무 모드 해제」 / 「비밀번호 변경」
- **관리자 모드와 상호 배타** — 하나 켜면 다른 것 꺼짐
- `body.is-treasurer` 클래스로 `.treasurer-only` UI 토글

### 관리자 모드
- 기본값: **비관리자** (`isAdmin = false`, 새로고침마다 초기화)
- 진입: 동기화 바 🔒 → 비밀번호 (기본 `0607`, `localStorage` + Supabase `meta.adminPw`)
- 해제 메뉴: 🔓 → 「관리자 모드 해제」 / 「비밀번호 변경」
- `body.is-admin` 클래스로 `.admin-only` UI 토글

### 비밀번호 (Supabase text)
- 클럽 설정: 관리자 `0906`, 총무 `0108` — PostgreSQL `meta.value`에 **문자열** 저장 (선행 0 OK)
- Google Sheets 시절 깨짐 이슈: §29 레거시 참고

### 프레젠테이션 모드 (관리자 전용)
- 디스코드 화면공유용 — 필드·토큰 **크게** 표시
- 숨김: 탭바, 동기화바, 포메이션 툴바, 저장 패널, 포메이션 뷰 레이블
- **유지 (숨기면 안 됨)**: 쿼터 바, 벤치, **필드 ⬇ PNG 버튼**, 선수 팝업, 드래그·수정 전부
- 팝업 z-index: `popupOverlay` 9100, `.pos-popup` 9200 (발표 모드 `#tab-formation` z-index 9000보다 위)

### 자동 갱신
- 30초 poll **없음** (v114) — ↻ `manualDataRefresh` · 탭 복귀 1회 · `apiLoadAll(true)` → `applyRemoteData`

---

## 4. 데이터 저장

### localStorage 키

| 키 | 내용 |
|----|------|
| `fc_players` | 선수 배열 |
| `fc_field` | 현재 활성 쿼터 fieldTokens (하위호환) |
| `fc_field_full` | `{ formation, tokens }` (하위호환) |
| `fc_field_quarters` | `{ quarterData, activeQuarter }` **← 쿼터 시스템 핵심** |
| `fc_formation` | 마지막 선택 포메이션 |
| `fc_saves` | 저장된 포메이션 (4쿼터 묶음) |
| `fc_matches` | 경기 기록 |
| `fc_myteam` | 팀 이름 |
| `fc_team_photo` | 사진 1번 URL (하위 호환) |
| `fc_team_photos` | 사진 URL 배열 JSON (최대 5장) |
| `fc_photo_transform` | 현재 사진 transform (하위 호환) |
| `fc_photo_transforms` | 사진별 transform 배열 JSON |
| `fc_photo_interval` | 자동 전환 간격(초) |
| `fc_admin_pw` | 관리자 비밀번호 |
| `fc_treasurer_pw` | 총무 비밀번호 |
| `fc_dues` / `fc_expenses` / `fc_settlements` | 총무 데이터 |
| `fc_schedules` | 경기 일정 |
| `fc_notices` | 공지사항 |
| `fc_due_exemptions` | 회비 면제 기간 |
| `fc_due_memos` | 월별 선수 메모 |
| `fc_notice_opened_date` | 오늘 공지 확인 여부 (YYYY-MM-DD) |
| `fc_disciplines` | 패널티(징계) 기록 |

### 선수 객체
```js
{ id, name, jersey?: string, positions: string[], ovr: { [pos]: number }, formBonus?: number }
// formBonus: -99 ~ +99, 필드 OVR+ pill에 반영, 별 개수에도 적용
```

### fieldToken
```js
{ pid, slotIdx, freeX, freeY, pos, subPid? }
// subPid: 교체 예정(후보) 선수 pid — 경기 출전·출석 집계에 포함
```

### 쿼터 데이터 (앱 내부 + 시트)
```js
quarterData = {
  1: { formation: '4-3-3', tokens: [...] },
  2: { formation: '4-4-2', tokens: [...] },
  3: null,  // 미배치
  4: { formation: '3-5-2', tokens: [...] }
};
activeQuarter = 1;  // 현재 편집 중인 쿼터
```

### 경기 객체
```js
{
  id, myTeam, oppTeam, date,
  homeAway: null,   // 미사용 (하위호환 null 유지)
  scoreUs, scoreOpp, formation,
  lineup: [{ pid, name, pos, ovr, quarters?: [1,3] }],  // quarters: 출전 쿼터
  subs: [{ pid, name, pos, ovr, pairedWith?, quarters?: [2] }],
  scorers: [{ pid, name, pos, ovr, goals, assists }],
  mom, momName
}
```

### 경기 기록 ↔ 포메이션 연동
- **신규 경기**: `buildParticipantsFromField()` — **1~4쿼터 전체 집계**
- 선수가 1·3쿼터에만 있으면 → `민수(1,3Q)` 표시, 4쿼터 전부면 `(전체)`
- 교체 후보(`subPid`)도 해당 쿼터에 포함되면 출전 명단·출석에 반영
- 「포메이션에서 불러오기」(`syncMatchFromFormation`)로 재동기화 가능
- 용병: 명단에 임시 추가 → 해당 쿼터 필드 배치 → 경기 기록에 자동 포함

### 출석 통계
- `출전수` 삭제, **`출석수`만** 사용
- 기준: `matchParticipantPids(m)` = lineup + subs (교체 후보 포함) → 경기 1회 출석

---

## 5. Supabase DB 스키마 (현재 · 2026-06-13)

> **운영 DB = FC 제로 전용** (`ajcidqsjpkzupxeizbyp`).  
> **사업 플랫폼** = **별도 Supabase** — **`docs/HANDOFF_PLATFORM.md`** · `setup/platform_setup/schema-v1.sql` (R37).

> **운영 DB**. Google Sheets 탭명과 1:1 대응. JSON 필드는 **jsonb**.  
> RLS 비활성, anon key로 REST 접근. 스키마 변경 시 SQL Editor + `api.js` 동시 수정.

| 테이블 | 주요 컬럼 | 비고 |
|--------|-----------|------|
| `players` | id, name, jersey, positions(jsonb), ovr(jsonb), formBonus, isMercenary | |
| `matches` | id, myTeam, oppTeam, date, homeAway, scoreUs, scoreOpp, formation, lineup(jsonb), subs(jsonb), scorers(jsonb), mom, momName, bestDef, bestDef2 | |
| `field` | **id=1** (PK), q1~q4 formation+tokens(jsonb), activeQuarter | 단일 행 upsert |
| `saves` | id, name, q1~q4 formation+tokens(jsonb), date | |
| `meta` | **key** (PK), value (text) | adminPw, treasurerPw, myTeam, teamPhotoUrls 등 |
| `dues` | id, pid, amount, date, note, type | |
| `expenses` | id, date, amount, category, note, settlementId, status | |
| `settlements` | id, groupId, startDate, endDate, pid, settledAmount, settledAt, status | |
| `schedules` | id, date, time, opponent, note | |
| `notices` | id, title, body, date, createdAt | |
| `dueExemptions` | id, pid, fromMonth, toMonth | camelCase 테이블명 |
| `dueMemos` | id, pid, yearMonth, note | |
| `disciplines` | id, pid, level, amount, date, matchId, reason, note, settlementGroupId, createdAt | |

### api.js 저장 방식
| 대상 | 방식 |
|------|------|
| 일반 테이블 (id PK) | `DELETE ?id=gte.0` 후 `POST` 전체 교체 |
| `field` | `POST` + `Prefer: resolution=merge-duplicates` (id=1 upsert) |
| `meta` | 기존 로드 후 **병합** → `POST` key upsert (v99) |

### meta 주요 key
| key | 설명 |
|-----|------|
| myTeam | 팀 이름 |
| adminPw / treasurerPw | 관리자·총무 비밀번호 (text) |
| teamPhotoUrl / teamPhotoUrls | 팀 사진 |
| photoInterval / teamPhotoTransform(s) | 슬라이드쇼 |
| presentScales / wageRates | 발표·수당 설정 (wageRates: 8항목 JSON, 미정산만 재계산) |

### Supabase 설정 (`api.js`만)
- `SUPABASE_URL`, `SUPABASE_KEY` (anon) — **공개 repo 노출 주의**
- REST 헤더: `apikey` + `Authorization: Bearer` + `Content-Type` + `Prefer`

**구형 field/saves (formation+tokens 2컬럼)** → `applyRemoteData`에서 q1으로 자동 마이그레이션.

---

## 5-legacy. Google Sheets 스키마 (레거시 · `setup/Code.gs`)

| 탭 | 컬럼 |
|----|------|
| `players` | id, name, jersey, positions, ovr, **formBonus**, isMercenary |
| `matches` | id, myTeam, oppTeam, date, homeAway, scoreUs, scoreOpp, formation, lineup, subs, scorers, mom, momName, bestDef, bestDef2 |
| `field` | **q1formation, q1tokens, q2formation, q2tokens, q3formation, q3tokens, q4formation, q4tokens, activeQuarter** |
| `saves` | id, name, **q1formation, q1tokens, … q4formation, q4tokens**, date |
| `meta` | key, value (`myTeam`, `teamPhotoUrl`, `teamPhotoTransform`, `adminPw`, **`treasurerPw`** 등) |
| `dues` | id, pid, amount, date, note, type (payment/other) |
| `expenses` | id, date, amount, category, note, settlementId, **status** (active/cancelled) |
| `settlements` | id, **groupId**, startDate, endDate, pid, settledAmount, settledAt, status (done/cancelled) |
| `schedules` | id, date, time, opponent, note |
| `notices` | id, title, body, date, createdAt |
| `dueExemptions` | id, pid, fromMonth, toMonth |
| `dueMemos` | id, pid, yearMonth, note |
| `disciplines` | id, pid, level, amount, date, matchId, reason, note, settlementGroupId, createdAt |

**구형 field/saves (formation+tokens 2컬럼)** → `readField`/`applyRemoteData`에서 q1으로 자동 마이그레이션.

**Phase 2 시트 4개** → Code.gs에 반영됨. **Supabase 전환 후 미사용.**

**`API_KEY` / `SHEET_API`는 제거됨** — `api.js`는 Supabase만 사용.

### api.js (현재 운영 값)
```
URL: https://script.google.com/macros/s/AKfycbw3rqhMrN6gT2iz51uN6iJP8ay1sIUh_Par2D1BdQEoy61j6yqHm68ILmc-RQNd9OWasg/exec
KEY: minsoo_fc
```
**Code.gs `API_KEY`와 구 `api.js` `KEY` 일치** — Supabase 전환 후 해당 없음.

### Code.gs 재배포 (레거시 — Supabase 운영 중 불필요)

| 재배포 **필요** | 재배포 **불필요** |
|----------------|------------------|
| `SHEETS` 컬럼 변경 | `app.js` / `index.html` / `style.css` / `data.js`만 |
| `doGet`/`doPost`/`readField`/`writeField` 변경 | 통계 UI가 matches 기존 JSON만 읽는 변경 |
| `API_KEY` 변경 | |

### 배포 시 주의
- **「새 배포」** → URL 변경 → **`api.js` URL 반드시 갱신**
- **「기존 배포 → 새 버전」** → URL 유지 → `api.js` 수정 불필요
- 스키마 변경 후 Apps Script에서 **`setupSheets` 1회 실행** (field/saves 헤더 행 갱신)

---

## 6. 포지션·OVR 규칙 (현행)

### 포지션 (최종)
- GK
- 수비: CB, LB, RB
- 미드: CDM, CAM
- 공격: LW, RW, ST
- 구 포지션(DF, CM, LWB, RWB, CF, FW 등) → `migratePos()` 자동 변환

### OVR
- **주포·부포만** 반영: `(1st×1.0 + 2nd×0.75) / 1.75`
- **별 구간**: ★1~39 / ★40~54 / ★55~69 / ★70~84 / ★85~100
- **formBonus** 적용 시 effective OVR로 별·pill 표시
- 4★: 펄스 글로우 / 5★: 레인보우 펄스 + 홀로그램 (1.5초 주기)

### 필드 토큰 표시
- 원 안: **이니셜만** (이름·등번호 제거)
- 별 아크 + 포지션 뱃지 + `OVR+ N(+bonus)` pill

---

## 7. app.js 주요 함수 가이드

| 영역 | 함수 |
|------|------|
| 쿼터 | `switchQuarter`, `updateQuarterButtons`, `quarterLabel`, `quarterData`, `activeQuarter` |
| 필드 저장 | `persistField` (4쿼터 payload), `loadFieldState`, `applyRemoteData` |
| 포메이션 저장 | `confirmSaveFormation`, `loadSave` (4쿼터 묶음) |
| 경기 | `buildParticipantsFromField`, `openMatchModal`, `saveMatch`, `renderRecords` |
| 선수 팝업 | `openFieldActionMenu` — **자리 교체 목록 제거됨**, 벤치 투입·교체예정·벤치로만 |
| 드래그 | `applySlotSnap`, `tokenAtSlot`, `onGlobalUp` (11명 교체는 드롭 시점 체크) |
| 관리자 | `toggleAdminMode`, `getAdminPw`, `persistMeta` (adminPw 병합) |
| 프레젠테이션 | `togglePresentMode`, `presentScales` (panelLeft/panelRight), `formatBenchPosTag` |
| 홈 | `openScheduleModal`, `openNoticeModal`, `saveNoticeItem`, `persistSchedules/Notices` |
| 패널티 | `DISCIPLINE_AMOUNTS`(data.js), `disciplineLevelLabel`, `computeUnsettledWageBreakdown` |
| 총무 | `renderTreasurer`, `previewSettlement`, `runSettlementBatch`, `openTreasurerDisciplineDetail` |
| 폴링 | `setupManualDataSync`, `manualDataRefresh` |

---

## 8. 완성도 스냅샷 (2026-06-09)

| 영역 | 완성도 | 비고 |
|------|--------|------|
| 포메이션/명단 | ~98% | 쿼터·formBonus·비관리자 쿼터 열람 |
| 경기 기록 | ~98% | 최신순·스코어 라벨 |
| 통계 | ~95% | 패널티·징계수·가치 내역 |
| 총무 | ~98% | 리워드 정산 시 패널티 차감·ⓘ 상세 |
| 홈 | ~98% | 회칙 및 사이트 소개·일정·공지 작성란 확대 |
| 프레젠테이션 | ~98% | 좌/우 패널·벤치 포지션 |
| 데이터 동기화 | ~95% | `disciplines` 포함 |
| 브랜딩/배포 | 운영 중 | GitHub Pages + **Supabase** (`api.js?v=99`) |

---

## 9. 세션 재개 시 확인할 것

- [x] Phase 2 P0~P4 코드 구현
- [x] API_KEY `minsoo_fc` 양쪽 일치
- [x] GK 단일 포지션만 자동 면제 (`isGkOnlyPlayer`)
- [x] 일정/공지 모달 인코딩 수정 (HTML 엔티티, v73)
- [x] **Code.gs** `disciplines` + `setupSheets` (v93+)
- [x] **GitHub Pages v=98** — 패널티·회칙 UI·비밀번호 fix (배포 확인)
- [ ] 실기기: 패널티 -30/-50·지각·무단불참 → 통계·명단·총무 정산 연동 확인
- [ ] 실기기: 홈 경기일정·공지 CRUD + 오늘 공지 알림
- [ ] 실기기: 총무 월별·성준(GK+ST) 미납 표시·일괄입금·영수증
- [ ] 실기기: 비관리자 쿼터 1~4 전환
- [ ] 실기기: 포메 1Q~4Q ⬇ PNG — 쿼터 라벨·토큰(OVR/별) 화면과 일치 확인

---

## 10. 2026-06-09 세션 — 완료 내역

| 영역 | 내용 |
|------|------|
| **사진 슬라이드쇼** | 홈 탭 최대 5장, 자동전환(간격 meta 저장), prev/next 버튼, 점 인디케이터, 사진별 pan/zoom, 관리자 모달에서 URL 5개+간격 설정 |
| **통계 메달** | 1~3위 금은동 메달 아이콘, 동점자 공동 순위, 드롭다운 「xx순 정렬」통일, 기본값 「종합순(골+어시+출석+MOM)」 |
| **경기카드 색상** | 승=파랑 배경/점수, 패=빨강 배경/점수, 무=회색 (OP.GG 스타일) |
| **포지션 색상** | 공격(LW/RW/ST)=빨강, 미드(CDM/CAM)=초록, 수비(CB/LB/RB)=파랑, GK=어두운 금노랑 |
| **오늘 멤버 필터** | 쿼터 바 옆 🗓️ 버튼(관리자전용), 세션 전용, 선수 토글 칩, 벤치에만 반영 |
| **index.html** | v=51, 인코딩 정상 |

### 슬라이드쇼 관련 meta 키 (시트 저장)
- `teamPhotoUrl`: 첫 번째 URL (하위 호환)
- `teamPhotoUrls`: JSON 배열 (최대 5개)
- `photoInterval`: 자동 전환 간격 초 (기본 10)
- `teamPhotoTransforms`: JSON 배열, 사진별 `{x,y,scale}`

### 오늘 멤버 필터 동작 원리
- `sessionAvailablePids`: `null` = 필터 없음, `Set<pid>` = 필터 활성
- 새로고침 시 초기화 (localStorage 저장 안 함)
- 벤치 렌더링 시 `sessionAvailablePids`가 있으면 `Set`에 없는 선수 숨김
- 필드 배치된 선수에는 영향 없음

### 10-1. 같은 날 후반 세션 (v74~84) — 요약

| 버전 | 내용 |
|------|------|
| v74 | 팀명 변경 시 과거 경기 `myTeam` 동기화 |
| v75~76 | 일정 `time` HH:mm, Code.gs `formatTimeCell` |
| v76+ | 총무 `yearMonth` 정규화 (`normalizeYearMonth`) |
| v79~81 | 쿼터 **→** 수동 복사 (`copyQuarterForward`); v80 동기화 보호 → **v81 롤백** |
| v82 | 필드 우하단 PNG ⬇, 툴바 「이미지」 제거, PNG에 `NQ` 라벨 |
| v83 | PNG **직접 다운로드** (공유 시트 우선 제거) |
| v84 | `drawExportToken` 화면 정합, 벤치 PNG 제거, `resolveTokenPos` |
| v85 | PNG 별 아치 `arcLift` (+5·tk) — 포지션 뱃지와 겹침 보정 |
| v86 | 필드·PNG 별 아치 `-17·tk` 통일; PNG 그리기 순서 원→뱃지→별 (뱃지가 원에 깔리던 문제) |
| v87 | PNG 파일명 `[NQ]YYYY_MM_DD(formation).png` |
| 문서 | `CLUB_MEMBER_GUIDE.md` (클럽원 소개 참고) |

상세: **§26·§27·§36**. ~~포메 poll 덮어쓰기~~ → v114 해소.

## 11. 2026-06-08 세션 — 완료 내역

| 영역 | 내용 |
|------|------|
| **쿼터 시스템** | 1Q~4Q 버튼, 쿼터별 독립 formation+tokens, 시트·localStorage·저장/불러오기 연동 |
| **경기 기록** | 4쿼터 집계 출전 명단, `quarters` 필드 저장, UI `민수(1,3Q)` |
| **Code.gs** | field/saves 스키마 확장, readField/writeField 쿼터 대응, 구형식 마이그레이션 |
| **API 연동 사고** | Code.gs 기본 KEY vs api.js `minsoo_fc` 불일치 → 저장 실패. **양쪽 동기화 필수** |
| **api.js** | 새 배포 URL로 갱신 (새 배포 시 URL 변경 주의) |
| **프레젠테이션** | 팝업 z-index 상향 (9100/9200); 쿼터 바 숨김 **되돌림** (기능 유지) |
| **선수 팝업** | 「↔ 자리 교체」필드 선수 목록 **삭제** (드래그로 대체, 임원 테스트 반영) |
| **경기 UI** | 홈/어웨이 제거, 출석수만, 교체후보 출석 반영 |
| **한글** | index.html Python UTF-8 스크립트로 수정·검증 (v=50) |

### 이번 세션에서 겪은 연동 실수 (재발 금지)

1. **쿼터 추가 후 프레젠테이션 모드 미반영** — 새 UI/기능 추가 시 프레젠테이션·관리자·폴링·경기기록·시트 스키마 **전부** 점검
2. **Code.gs 붙여넣기 시 API_KEY 기본값** — 배포 전 `api.js` KEY와 대조
3. **새 배포 vs 새 버전** — URL 바뀌면 `api.js` 미갱신 시 앱 전체 오프라인처럼 동작
4. **index.html 요소 삭제 시 연쇄 오류** — `homeAway` 제거할 때 `matchScoreUs`/`matchScoreOpp`까지 삭제되어 경기 모달 `null` 에러 발생했던 전례

---

## 12. 에이전트 필수 준수 사항 (기획자 지침 — 절대)

> 기획자는 시트/스크립트를 잘 모름. **연동 판단·수정·안내는 에이전트가 전담.**

### 11.1 한글 인코딩 (최우선)

1. `index.html` 한글 수정 시 **PowerShell `Set-Content` / StrReplace / Write 도구로 한글 직접 쓰기 금지** (깨짐·`?` 치환 반복 발생)
2. **권장**: Python `open(..., encoding='utf-8')` 스크립트로 전체 또는 해당 블록 재작성
3. 수정 후 **UTF-8 검증** 필수: `홈`, `명단`, `포메이션`, `쿼터` 등 실제 한글 존재 확인
4. 버전 bump: `?v=N` — Python 또는 안전한 방식만
5. 배포 후에도 깨지면 → GitHub Pages 구버전 + 브라우저 캐시 의심

### 11.2 연동·일관성 (기능 추가 시 체크리스트)

새 기능·UI 추가할 때 **아래 전부** 연관 여부 확인:

| 체크 | 항목 |
|------|------|
| ☐ | `app.js` 상태·저장 로직 |
| ☐ | `localStorage` 키 |
| ☐ | `setup/Code.gs` SHEETS·parseCell·read/write |
| ☐ | `api.js` (URL/KEY 변경 필요 시) |
| ☐ | `applyRemoteData` / `loadLocalFallback` / `maybeMigrateLocal` |
| ☐ | `persistField` / `persistSaves` / `persistMeta` |
| ☐ | 경기 기록 `buildParticipantsFromField` / `saveMatch` |
| ☐ | 통계 `computePlayerStats` / `matchParticipantPids` |
| ☐ | 포메이션 저장/불러오기 |
| ☐ | **프레젠테이션 모드** (숨기지 말아야 할 UI인지) |
| ☐ | **관리자 모드** (`.admin-only` 적용) |
| ☐ | **30초 폴링** (덮어쓰기 충돌 없는지) |
| ☐ | `setup/GOOGLE_SHEET_SETUP.md` / 이 HANDOFF_FC_ZERO.md |
| ☐ | Code.gs **재배포 필요 여부** 사용자에게 명시 |

### 11.3 프레젠테이션 모드 원칙

- **목적**: 디스코드 화질 대응 — **크게 보여주기만**, 기능은 일반 모드와 **동일**
- 숨겨도 되는 것: 탭바, 동기화바, 포메이션 툴바, 저장 패널
- 숨기면 안 되는 것: **쿼터 바**, 벤치, 선수 팝업, 드래그·수정·교체예정
- z-index: 팝업이 `#tab-formation`(9000) 위에 와야 함

### 11.4 관리자 모드 원칙

- 새로고침 시 항상 비관리자
- 수정 UI는 `.admin-only` + `isAdmin` 가드
- 통계 탭은 관리자만

### 11.5 Code.gs / 배포 안내 템플릿

사용자에게 전달 시:
1. **무엇을 왜 바꿨는지** (1~2문장)
2. Apps Script 붙여넣기 → **새 버전** 재배포 (URL 유지 권장)
3. `setupSheets` 실행 필요 여부
4. `api.js` URL 변경 필요 여부
5. GitHub Pages 업로드 파일 목록

### 11.6 코딩 일반

1. 범위 최소화 — 요청 없는 리팩터링 금지
2. 기존 패턴·네이밍 유지
3. 모바일·터치 항상 고려
4. git commit은 사용자 요청 시만

---

## 12. 한글 깨짐 사고 — 누적 기록

**증상**: `index.html` 고정 문구 `?` / `app.js` 동적 문구는 정상  
**원인**: PowerShell·에이전트 Write/StrReplace의 비UTF-8 저장  
**복구**: Python UTF-8 전체 재작성  
**재발**: 2026-06-07, 2026-06-08 여러 차례 — **§11.1 절대 준수**

---

## 13. 드래그·교체 로직 요약

```
startDrag → origSlotIdx 저장
onGlobalMove → slotIdx=-1 (미세조정), 벤치→필드 시 MAX_FIELD 체크 없음
onGlobalUp → applySlotSnap
  → 필드↔필드: other를 origSlotIdx로 swap
  → 벤치→필드 11명 초과: onGlobalUp에서 제거+알림
팝업 포지션 선택만 checkSlotCapacity (드래그는 교체 허용)
```

---

## 14. GitHub Pages 배포 체크리스트

업로드 (현재 **`?v=84`** — 구간별 구버전은 아래 히스토리 참고):
- [ ] `index.html` (UTF-8, `app.js?v=84` — 한글은 Python UTF-8 또는 HTML 엔티티)
- [ ] `app.js`
- [ ] `style.css` (`?v=82` 이상 — `.field-export-btn` 포함)
- [ ] `data.js`
- [ ] `api.js` (URL/KEY 최신)

확인:
- [ ] 한글 탭·버튼·모달
- [ ] 쿼터 1~4 전환·저장·동기화됨
- [ ] 포메 필드 ⬇ — 쿼터별 PNG 다운로드·파일명 `formation-NQ-...`
- [ ] 관리자 모드·프레젠테이션·쿼터·팝업
- [ ] 경기 기록 추가/수정·쿼터 표기
- [ ] 선수 팝업에 자리 교체 없음 (벤치 투입만)

---

## 15. 기본 선수 명단

경표(7), 승규(5), 인수(8), 주용(6), 승지(4), 청재(9), 종민(3), 성진(10), 인성(2), 성준(1), 용민(11), 미수(12), 지원(13), 철민(21), 진우(14), 승위(16), 지환(17) — 17명.

---

## 16. 대화·로드맵 맥락

- Claude → Cursor 이관. 구글 시트 DB 합의. 시트는 DB만, UI 자유.
- 발표회 전 **완벽 동작** 요구 — 연동·한글·프레젠테이션 빠짐없이.
- **연동 규칙**: `.cursor/rules/fc-sheet-integration.mdc`
- **v2 제품 규칙 (선수가치·시즌·OVR)**: `BUSINESS_VISION.md` **§13.9** + `.cursor/rules/fc-v2-season-ovr.mdc` — **대화할 때마다 갱신**
- **⚠️ 현재는 사업 구상만** — FC 제로 운영 사이트 임의 v2 구현 **금지** (R00)
- **§13.9** 사업 구상 규칙 확정 완료 — 구현은 착수 지시 후 (R32 FC제로 이관만 협의)
- **§14** 레프리·심판·앱 — 사업 구상 문서만 (`BUSINESS_VISION.md`)

---

## 17. 이전 세션 요약 (2026-06-07 이전)

- OVR UI 리디자인, 포메이션 유지, 드래그 스냅·교체·11명 로직
- 관리자 모드, 사진 pan/zoom, 포지션 단순화, formBonus, OVR 별 구간
- 홈 등번호순 정렬, GK 슬롯 하향, 필드 토큰 이름 제거
- 상세: git 히스토리 또는 이전 HANDOFF §15 참고

---

*기능 추가·사고 시 **§0(재개)** · **§28(패널티)** · **§11(에이전트 필수)** · **§22~25(Phase2)** 우선 갱신.*

---

## 21. 2026-06-09 세션 — 총무 UX 개선

| 영역 | 내용 |
|------|------|
| **상단 버튼** | sticky 빠른등록 바 제거 (섹션별 버튼만 유지) |
| **정산 취소** | `cancelled` 표시 대신 **완전 삭제** — 연동 지출도 삭제, 미정산 복원 |
| **개별 정산** | 미정산 조회표 선수별 [정산] 버튼 + 전체 정산 유지 |
| **입금 기록** | 테이블 UI + 스크롤 박스, 최신 날짜 상단 |
| **메모 필수** | 회비·지출 저장 시 메모(증빙) 필수, 목록에 메모 컬럼 |
| **입금 유형** | 유형 드롭다운 맨 위: `회비 입금`(payment) / `기타`(other) — 기타만 메모 필수 |
| **기타 입금** | `type=other`, `pid=null` — 선수별 요약 제외·총 수입 합산 포함 |
| **환불 유형** | 제거 (잘못 입금 → 기록 삭제) |
| **정산 기록** | 스크롤 박스, 대상 열에 인원·이름 표시 |
| **연동 규칙** | `.cursor/rules/fc-change-review.mdc` 추가 |
| **버전** | `?v=71` |

### Code.gs 재배포
- 이번 수정은 **프론트만** — Code.gs 재배포 **불필요** (이전 v=68 스키마 그대로)

---

## 20. 2026-06-09 세션 — 총무 버그픽스

| 영역 | 내용 |
|------|------|
| **expenses.status** | Code.gs `expenses` 시트에 `status` 컬럼 추가 — 취소된 지출이 동기화 후 복원되던 버그 수정 |
| **settlements.groupId** | 정산 그룹 ID 추가, 지출 `settlementId`와 1:1 연동 → 정산 취소 시 연결 지출도 취소 |
| **정산 기간 필터** | `computeUnsettledWage(pid, from, to)` — 미정산 조회·실행 시 선택 기간 경기만 집계 |
| **폴링** | `refreshCurrentTab`에 `treasurer` 탭 추가 (30초 자동 갱신 누락 수정) |
| **버전** | `?v=68` |

### Code.gs 재배포 안내 (이번 수정 필수)
- `expenses`에 `status` 컬럼, `settlements`에 `groupId` 컬럼 추가 → **재배포 필요**
- 기존 URL 유지 배포("새 버전") 권장
- 재배포 후 **`setupSheets` 1회 실행** → 헤더 행 갱신

---

## 19. 2026-06-09 세션 — 총무 페이지 구현

| 영역 | 내용 |
|------|------|
| **총무 모드** | 💰 버튼(syncBar), 비밀번호 입력·변경, 관리자와 상호 배타, `isTreasurer` 전역 |
| **총무 탭** | `tab-treasurer` 패널, 4섹션(요약/회비/지출/정산) 동적 렌더 |
| **회비 관리** | dues CRUD, 선수별 납부 현황 표, 미납(3개월) ⚠️ 경고 |
| **지출 관리** | expenses CRUD, 정산 연결 시 자동 처리 |
| **리워드 정산** | `computeUnsettledWage`, 기간 선택 → 미리보기 → 전체 정산 실행, 정산 취소 |
| **Google Sheets** | dues/expenses/settlements 시트 추가, `parseCell`·`loadAll`·`saveAll` 확장 |
| **인코딩** | Python 스크립트 전용 수정, v=63 |

### Code.gs 재배포 안내 (이번 세션 필수)
- `SHEETS`에 `dues`, `expenses`, `settlements` 3개 탭 추가됨 → **재배포 필요**
- 기존 URL 유지 배포("새 버전") 권장
- 재배포 후 **`setupSheets` 1회 실행** → 시트 탭 자동 생성

---

## 18. 총무 페이지 — 기획 완료 / **구현 완료**

> **"총무 페이지 작업 시작해"** 라고 하면 아래 스펙 그대로 구현 시작할 것.  
> 기획 확정일: 2026-06-09. 기획자 승인 완료.

---

### 18-1. 총무 로그인

- syncBar의 🔒(관리자) 버튼 **옆에 💰(총무) 버튼 추가**
- 클릭 → 비밀번호 입력 모달 (관리자와 동일한 UI/로직)
- 기본 비밀번호: `1234`
- 저장 위치: `localStorage.fc_treasurer_pw` + 시트 `meta.treasurerPw`
- 비밀번호 변경: 🔓 메뉴에 「비밀번호 변경」(관리자와 동일 패턴)
- 전역 변수: `let isTreasurer = false;` (새로고침 시 초기화)
- **관리자 모드와 상호 배타** — 하나 켜면 다른 것 꺼짐
- CSS: `body.is-treasurer` 클래스 → `.treasurer-only` UI 토글

---

### 18-2. 탭 가시성 규칙

| 상태 | 보이는 탭 | 비고 |
|------|-----------|------|
| 비로그인 | 홈 · 명단 · 포메 · 경기 | 읽기만 |
| 관리자 로그인 | + **통계** | 기존 그대로 |
| 총무 로그인 | + **총무전용** | 통계 탭 대신 총무 탭 |

- 총무 탭 ID: `tab-treasurer`
- `tab-stats`는 총무 모드일 때 숨김, 총무 탭이 그 자리에 표시
- `.treasurer-only` 클래스: `body:not(.is-treasurer) .treasurer-only { display:none !important; }`

---

### 18-3. Google Sheets 신규 탭 3개

#### `dues` (회비 입금 기록)
```
id | pid | amount | date | note | type
                                  (payment / refund)
```

#### `expenses` (지출 기록)
```
id | date | amount | category | note | settlementId
                                       (리워드 정산 연결 시 자동)
```

#### `settlements` (리워드 정산 기록)
```
id | startDate | endDate | pid | settledAmount | settledAt | status
                                                             (done / cancelled)
```
- 선수별 1행 → 개별 취소 가능
- `settledAmount`: 정산 시점 스냅샷 금액 (취소 후에도 히스토리 보존)
- 연결된 `expenses` 레코드: `settlementId`로 조인, 취소 시 같이 `cancelled` 처리

> **Code.gs 재배포 필요** — `SHEETS`에 `dues`, `expenses`, `settlements` 추가 + 각 `parseCell` + `doPost` 라우팅

---

### 18-4. 총무 탭 UI 구조 (4섹션)

#### ① 요약 대시보드 (상단 카드형)
| 카드 | 계산식 |
|------|--------|
| 총 회비 수입 | `sum(dues where type=payment)` |
| 총 지출 | `sum(expenses where status≠cancelled)` |
| 현재 잔액 | 수입 − 지출 |
| 연말 결산 가능 예산 | 잔액 × 20% ~ 잔액 × 30% |

예시 표시: `총 회비 1,000,000원 → 연말 결산 가능: 200,000원 ~ 300,000원`

#### ② 회비 현황
- **[+ 회비 입금]** 버튼 → 모달: 선수 선택(드롭다운) + 금액 + 날짜 + 메모 + 유형(입금/환불)
- 선수별 납부 현황 요약 테이블: `선수명 | 납부 횟수 | 합계`
- 전체 입금 기록 목록 (날짜·금액·메모 · 수정/삭제)
- 미납 강조: 오랫동안 입금 이력 없는 선수 자동 노란 하이라이트

#### ③ 지출 기록
- **[+ 지출 등록]** 버튼 → 모달: 날짜 + 금액 + 사용처(직접 입력, 예: 회식) + 메모
- 지출 목록: `날짜 | 사용처 | 금액 | 비고 | 상태(active/리워드정산/cancelled)`
- 리워드 정산 실행 시 → **지출 자동 등록**: `"리워드 정산 — 2025년 연말"` + 선수별 세부 내역

#### ④ 리워드 정산
- 정산 기간 설정: from ↔ to 날짜 선택
- 선수별 미정산 리워드 현황 표:
  ```
  선수명 | 해당 기간 리워드 | 정산 여부 | [완료 토글]
  ```
- **[전체 정산 완료]** 버튼 + 개별 토글
- **[정산 실행]** → `settlements` 행 생성(pid별) + `expenses` 자동 1건 등록
- 정산 기록 목록: `기간 | 대상 인원 | 총액 | 실행일 | 상태 | [취소]`
- 취소 시: `settlements.status = 'cancelled'` + 연결 `expenses`도 동일 처리

---

### 18-5. 핵심 계산 로직 2가지

#### 미정산 리워드 (총무 — v93+ 패널티 반영)
```js
// computeUnsettledWage(pid, from, to) → breakdown.net
// net = max(0, 기간 경기수당(미정산) − 기간 미반영 패널티)
// previewSettlement: 경기수당 | 징계차감 | 실지급 열 + ⓘ 상세
```

#### 선수 가치 (명단·통계 — v93+)
```js
// computePlayerTotalWage(pid) = 전체 경기수당 − 전체 패널티 합 (최소 0)
// 명단 표시: formatPlayerValue(합계) → ×1,000,000
```

---

### 18-6. 추가 제안 기능 (기획자 승인 대기)
- 회비 미납 알림: 3개월 이상 입금 없으면 이름에 ⚠️ 표시
- 정산 보고서 뷰: 특정 정산 기간 선수별 내역 한눈에 (스크린샷용)
- 예산 카테고리 설정: 연말/MT/용품 등 지출 분류

---

### 18-7. 구현 순서 권장
1. 총무 로그인 버튼 + 모드 전환 (`isTreasurer`, `body.is-treasurer`)
2. `tab-treasurer` HTML 뼈대 + CSS 기본 스타일
3. Code.gs `dues` / `expenses` / `settlements` 시트 스키마 + API 라우팅
4. 회비 현황 섹션 (CRUD + 요약 대시보드)
5. 지출 기록 섹션
6. 리워드 정산 섹션 (`computeUnsettledWage` 포함)
7. 자동 지출 등록 연동
8. 인코딩 검증 + Code.gs 재배포 안내

---

### 18-8. 구현 체크리스트
- [x] `isTreasurer` 전역 변수 추가
- [x] `treasurerPw` meta 키 → Code.gs 추가 불필요 (기존 meta key/value 구조 활용)
- [x] `dues` / `expenses` / `settlements` Code.gs SHEETS 등록
- [ ] `setupSheets` 실행으로 시트 탭 자동 생성 (사용자 1회)
- [x] `applyRemoteData` / `loadLocalFallback` 에 dues·expenses·settlements 로드 추가
- [x] 총무 모드 전환 시 관리자 모드 해제 로직
- [x] 비밀번호 입력 `****` 마스킹 (기존 관리자와 동일)
- [x] 모바일 대응 (총무 페이지도 터치 친화적으로)
- [x] `expenses.status` 시트 컬럼 추가 (취소 상태 동기화)
- [x] 정산 기간(from~to) 필터링 + `groupId` 정산-지출 연동
- [x] 30초 폴링 시 총무 탭 갱신

---

## 22. Phase 2 로드맵 (v73 — 2026-06-09 완료)

### P0 — 포메이션·경기 버그픽스
| 항목 | 상태 | 비고 |
|------|------|------|
| 경기 목록 최신순 | ✅ | `renderRecords()` 날짜 내림차순 |
| 스코어 라벨 수정 | ✅ | 경기 모달 `등번호` → `스코어` |
| 쿼터 바 일반 공개 | ✅ | `quarter-bar`에서 `admin-only` 제거 |
| 쿼터 수동 복사 (→ 버튼) | ✅ v79~81 | `copyQuarterForward()` — 탭 전환 자동복사 **제거** (회의 중 왔다갔다 안전) |
| 발표 패널 스케일 분리 | ✅ | `panelLeft` / `panelRight` 분리, 우측에서 bench/avail 제거 |

### P1 — 발표 모드 UX
| 항목 | 상태 | 비고 |
|------|------|------|
| 벤치 포지션 표시 | ✅ | `formatBenchPosTag()` — 주포·부포 |
| 좌패널 너비 확대 | ✅ | 210px → 260px |

### P2 — 홈 경기 일정·공지
| 항목 | 상태 | 비고 |
|------|------|------|
| `schedules` 시트 | ✅ | Code.gs + `persistSchedules` |
| `notices` 시트 | ✅ | Code.gs + `persistNotices` |
| 홈 버튼·모달 | ✅ | 경기 일정 카드 / 공지 아코디언 |
| 오늘 공지 1회 알림 | ✅ | `checkNewNoticeAlert()` — `fc_notice_opened_date` 로컬 |

### P3 — 총무 월별 시스템
| 항목 | 상태 | 비고 |
|------|------|------|
| 년/월 필터 (기본=현재월) | ✅ | `trFilterYearMonth`, `type=month` |
| 납부 색상 | ✅ | 1원이라도 입금=초록, 미납=빨강, GK단일·기간면제=회색 |
| 월별 메모 | ✅ | `dueMemos` 시트, 엑셀 ◤ 플래그 |
| 일괄 입금 | ✅ | 미납 선수 체크박스 일괄 등록 |
| 면제 관리 | ✅ | `dueExemptions` 시트, **GK 단일 포지션만** 자동 면제 (GK+ST 등 복수 포지션은 회비 대상) |
| 영수증 이미지 | ✅ | `exportTreasurerReceipt()` — 해당 월 지출 PNG → 카톡 공유 |

**납부 판정**: 해당 월에 `type=payment` 입금 1건 이상 → 납부 완료(초록)

**GK 자동 면제**: `positions`가 `['GK']` 하나뿐인 선수만. GK+ST처럼 복수 포지션이면 일반 회비 대상 (`isGkOnlyPlayer()`)

**잔액 카드**: 누적 전체 수입−지출 (필터 무관). 수입/지출 카드만 월별.

### P4 — 배포
- `?v=73` 캐시 버전 bump (모달 인코딩 수정 포함)
- **Code.gs 재배포 + `setupSheets` 1회** (`schedules`, `notices`, `dueExemptions`, `dueMemos` 탭 생성)

### P4-b — 세션 말미 핫픽스
| 항목 | 내용 |
|------|------|
| GK 면제 | `isGkPlayer` → `isGkOnlyPlayer` — `positions===['GK']`만 자동 면제. GK+ST(성준)는 회비 대상 |
| 모달 깨짐 | PowerShell 인코딩 사고 → `index.html` 일정/공지/일괄입금/면제 모달을 `&#xXXXX;` 엔티티로 복구 |

---

## 23. Phase 2 시트 스키마 (신규)

| 시트 | 컬럼 |
|------|------|
| `schedules` | id, date, time, opponent, note |
| `notices` | id, title, body, date, createdAt |
| `dueExemptions` | id, pid, fromMonth, toMonth |
| `dueMemos` | id, pid, yearMonth, note |

### localStorage 추가 키
| 키 | 내용 |
|----|------|
| `fc_schedules` | 경기 일정 |
| `fc_notices` | 공지사항 |
| `fc_due_exemptions` | 회비 면제 기간 |
| `fc_due_memos` | 월별 선수 메모 |
| `fc_notice_opened_date` | 오늘 공지 확인 여부 (YYYY-MM-DD) |
| `fc_disciplines` | 패널티(징계) 기록 |

---

## 24. Phase 2 배포 체크리스트
- [x] **Supabase** 13 tables + Data API exposed (§30)
- [x] `api.js` Supabase 전환 + v99 (pollRefresh·meta 병합)
- [ ] GitHub Pages `api.js?v=99`, `app.js?v=98`
- [ ] 동기화·30초 폴링·저장 E2E 테스트
- [ ] ~~Code.gs 재배포~~ — **불필요** (레거시)
- [ ] 총무: 월별 필터·일괄입금·영수증·성준 미납 확인
- [ ] 홈: 경기 일정·공지 제목/닫기 한글 정상 (모달)
- [ ] 포메: 비관리자 쿼터 전환·발표 좌/우 패널 스케일·**쿼터별 PNG ⬇**

### 인코딩 주의 (index.html) — 재발 금지
- v72: PowerShell로 모달 삽입 → `寃쎄린 ?쇱젙`, `?リ린` 등 깨짐
- v73: 신규 모달 블록을 **HTML 엔티티**로 복구 (`&#xACBD;&#xAE30;` = 경기)
- 홈 버튼(경기 일정/공지사항)은 원본 UTF-8 한글 — 정상
- `app.js` UI 문자열은 `\uXXXX` 이스케이프 사용

---

## 25. 옆 PC 작업 시 프롬프트 예시

```
HANDOFF_FC_ZERO.md §0·§31 + setup/SUPABASE_GUIDE.md 읽고 이어서 작업해줘.
DB는 Supabase. Google Sheets/Code.gs는 레거시.
Supabase 변경 시: SQL → Data API expose → api.js → app.js → HANDOFF·SUPABASE_GUIDE 갱신.
배포: api.js?v=99 이상. index.html 한글은 StrReplace 금지.
URL: https://qotjdals147.github.io/fc-team-dashboard/
```

**비밀번호**: 관리자 `0906`, 총무 `0108` (Supabase meta.text)

---

## 26. v74~84 변경 상세 & 포메 저장 구분

### 포메 PNG vs 이름저장 vs 시트 — **다름**

| 기능 | 버튼/UI | 쿼터 범위 | 저장 위치 |
|------|---------|-----------|-----------|
| **PNG 다운로드** | `#fieldInner` 우하단 `.field-export-btn` → `exportFormationImage()` (admin-only) | **활성 쿼터 1개** | 로컬 파일만 (시트 X) |
| **이름 붙여 저장** | 툴바 💾 `saveFormation()` / `confirmSaveFormation()` | **4쿼터 전부** | `saves` 시트 + `formationSaves` |
| **자동 동기화** | 드래그·배치 시 `persistField()` | **4쿼터 전부** | `field` 시트 `q1~4tokens` |

→ **4쿼터 PNG**: 1Q~4Q 탭 선택 후 ⬇ 반복 (한 번에 4장 ZIP/공유 방식은 기획 단계에서 **미채택** — 모바일 공유 UX 단순화 우선).

### 쿼터 복사 UX (v79~81)
- `quarter-cols`: 1Q~3Q 아래 `→` (`quarter-copy-arrow`, admin-only)
- 일반: `#quarterBar` / 발표: `#presentQuarterBtns` 동일 구조
- `copyQuarterForward(1|2|3)`: 해당 쿼터 → 다음 쿼터, **화면 쿼터는 유지**, 다음에 데이터 있으면 confirm

### 포메 동기화 (v114 ✅ · FC Zero = 플랫폼 P7c 패리티)

- **원인 (구)**: 30초 `pollRefresh` → `applyRemoteData`가 `fieldTokens`/`quarterData`/`activeQuarter` 덮어씀 + `persistField` 경쟁
- **해결**: `setupManualDataSync()` — poll **없음** · `#syncRefreshBtn`(↻) · `visibilitychange` 1회 · 드래그/모달 중 skip
- **레이아웃 (v114)**: `scheduleFormationLayout` — 벤치 DOM 먼저 → RAF×2 → `computeFieldCanvasSize` (wrap 실측만, export 52px reserve)
- **v80~81 롤백 이력**: debounce/preserveSize 시도는 **제거** — v114에서 다른 방식으로 해결

### Code.gs v76+ (시간·월)
- `parseCell`: `time` → `formatTimeCell` (`HH:mm`)
- `parseCell`: `yearMonth`/`fromMonth`/`toMonth` → `formatYearMonthCell` (`yyyy-MM`)
- **재배포 필요** / `setupSheets` 재실행 **불필요**

---

## 27. 포메 PNG 다운로드 (v82~84) — 구현 메모

### 기획 결정 (2026-06-09)
| 검토안 | 내용 | 결과 |
|--------|------|------|
| A | 한 장에 4쿼터 합성 | 미채택 |
| B | 버튼 1번 → PNG 4장 (공유/ZIP) | 미채택 — 모바일 다중 파일 공유 이슈 |
| **채택** | **쿼터 탭 + 필드 ⬇** → 해당 쿼터 1장 | 지금 쓰던 1장 공유/저장 흐름과 동일 |

### UI (`index.html` + `style.css`)
- **추가**: `#fieldInner` 안 `.field-export-btn` (Tabler `ti-download`, `title="쿼터 이미지 저장"`, `admin-only`)
- **제거**: 툴바 `.btn-export-field` 「이미지」 버튼 (v82) — 중복 방지
- **스타일**: `style.css` `.field-export-btn` — 필드 우하단 absolute, 발표 모드에서도 표시
- **index.html 한글**: Python UTF-8 스크립트로만 수정 (규칙 준수)

### 동작 (`exportFormationImage` ~2398행)
1. 활성 쿼터 `fieldTokens` 없으면 alert
2. 캔버스: 헤더(팀명·`NQ`·포메·인원·날짜) + 잔디 필드 + 토큰
3. **벤치 영역 없음** (v84 — PNG 하단 벤치 텍스트 제거)
4. `downloadPngBlob()` **직접 다운로드만** (v83 — `navigator.share` 우선 제거)
5. 파일명: `[{N}Q]{YYYY}_{MM}_{DD}({formation}).png` — 예: `[4Q]2026_06_10(4-2-3-1).png` (v87~)

### 토큰 렌더 정합 (v84)
- **문제**: 구 `drawExportToken`이 화면과 달랐음 — 전체 이름, 별/OVR/폼보너스 미반영, 레이아웃 어긋남
- **해결**: `buildTokenInnerHtml`과 동일 구조로 캔버스 재작성
  - `resolveTokenPos(t,p)` — `t.pos` → 슬롯 라벨 → 등록 포지션 (`renderField`와 공유)
  - 별: `effectiveOvr = getOvr + formBonus`, `STAR_ARC_LAYOUT`·티어 색
  - 원: 이니셜 2글자 + 포지션 뱃지(원 상단)
  - OVR pill: `OVR+` / 값 / `+N`·`-N` 폼뱃지
  - 교체: `subPid` → 🔄 후보명
  - 앵커: norm 좌표 = **토큰 열 전체 중심** (화면 `player-token`과 동일)
- **한계**: CSS 애니메이션(별·pill 펄스)은 정지 프레임 색/글로우로 근사 — 픽셀 퍼펙트 DOM 캡처 아님

### 관련 함수
| 함수 | 역할 |
|------|------|
| `exportFormationImage()` | PNG 생성·다운로드 |
| `drawExportToken(ctx,p,t,cx,cy,tk)` | 토큰 1개 그리기 |
| `resolveTokenPos(t,p)` | 포지션 문자열 통일 |
| `downloadPngBlob(blob,filename)` | `<a download>` — 포메·총무 영수증 공용 |
| `buildTokenInnerHtml()` | 화면 DOM 토큰 (PNG와 레이아웃 기준) |

### 총무 영수증 PNG와 차이
- `exportTreasurerReceipt()` — **아직 `navigator.share` 우선** (카톡 공유 편의)
- 포메만 v83부터 **다운로드 전용** — 필요 시 총무도 동일 패턴 적용 가능

### 모바일 참고
- **PC/안드로이드**: ⬇ → 다운로드 폴더 저장 정상 기대
- **iOS Safari**: `<a download>` 미지원·무시되는 경우 있음 — 그때만 「다운로드 / 공유」 선택 모달 추가 검토 (미구현)

### Code.gs
- **변경 없음** — GitHub Pages 프론트만 배포

---

## 28. 패널티(징계) 시스템 (v93~v97)

### 기획 배경
- 회칙 9조 8항(불화·마찰 1~3차) + 운영상 **지각·무단 불참·소액 차감** 필요
- **선수 가치**(게임 점수)와 **연말 리워드 정산**에 동일 금액 반영 (회비와 별개)

### UI 위치 (관리자만)
| 위치 | 내용 |
|------|------|
| 통계 탭 툴바 | `+ 패널티` 버튼 (`stats-discipline-add-btn`, `admin-only`) |
| 통계 표 선수 열 | ⚠ 버튼 + 건수 뱃지 (⚠ 바로 우측) |
| 통계 표 | **징계수** 열 (MOM ↔ 선수 가치 사이, 정렬 필터 없음) |
| 가치 숫자 클릭 | `openValueHistory` — 수당 + / 패널티 − 내역 |
| 표 하단 | 패널티 기록 목록 (관리자, 삭제 가능) |
| 총무 정산 미리보기 | 경기수당 \| 징계차감 \| 실지급 + ⓘ (`openTreasurerDisciplineDetail`) |

> 비관리자: **통계 탭 자체 숨김**. 명단 선수 가치만 감소분 반영.

### 금액 및 항목 (`DISCIPLINE_AMOUNTS` — `data.js`)
| level | amount | 비고 |
|-------|--------|------|
| 1 | 1000 | 1차 + **당일 출전 정지** alert |
| 2 | 2000 | 2차 + 출전 정지 |
| 3 | 3000 | 3차 + 출전 정지 |
| 30 | 30 | 소액 차감, 출전 정지 없음 |
| 50 | 50 | 소액 차감, 출전 정지 없음 |

### 사유 (`reason` → `DISCIPLINE_REASON_LABELS`)
| key | 표시 |
|-----|------|
| internal | 팀 내 불화 |
| opponent | 상대팀 마찰 |
| late | 지각 |
| no_show | 무단 불참 |
| other | 기타 |

### 시트 `disciplines`
```
id, pid, level, amount, date, matchId, reason, note, settlementGroupId, createdAt
```
- `settlementGroupId`: 리워드 정산 실행 시 연결 → 이중 차감 방지
- `cancelSettlement(groupId)` 시 해당 징계 `settlementGroupId` null 복구

### 핵심 계산 (`app.js`)
```js
computePlayerTotalWage(pid)
  = max(0, 전체 경기수당 − 전체 패널티 amount 합)

computeUnsettledWageBreakdown(pid, from, to)
  gross  = 기간 내 미정산 경기수당
  discipline = 기간 내 settlementGroupId 없는 패널티 합
  net    = max(0, gross − discipline)
```
- **용병**: 패널티·수당 모두 0
- 정산 `settledAmount` = **net** (실지급)

### 권장 차수 안내 (1~3차만)
- `getConflictDisciplineCount(pid)`: level 1~3 건수
- 모달 힌트: 불화·마찰 이력 N건 → 다음 1~3차 권장
- -30/-50은 차수 권장에 포함 안 함

### 출전 정지
- `checkSuspensionWarning(pid)`: level 1~3 + **당일 date** 필드 배치 시 관리자 alert
- -30/-50은 alert 없음

### localStorage
- `fc_disciplines` — 오프라인 캐시 (`persistDisciplines`)

### Code.gs 재배포
- **v93 최초 1회**: `SHEETS.disciplines` + `loadAll`/`saveAll` — **이후 프론트만 배포**
- 패널티 항목·사유 추가(v97)는 **프론트만** — 시트 스키마 변경 없음

### 한글·표기 사고 정리 (재발 방지)
| 증상 | 원인 | 수정 |
|------|------|------|
| `합;계`, `원;`, `수;당` | `\uD569;&#xACC4;`, `\uC6D0;` — `\u` 뒤 `;`가 글자로 출력 | 순수 `\uXXXX` 연속 |
| 통계 헤더 `곸` | `&#xACF8;` (U+ACF8) | `&#xACE8;` (U+ACE8, 골) |
| 가치 내역 `곸킨×2` | 수당 라벨 `&#xACF8;&#xD0A8;` | `&#xACE8;` + `&times;N` |

### 회칙·공지 작성 UI (v97)
- `#noticeEditModal` → `.notice-edit-modal` (max-width 560px)
- `#noticeEditBody.notice-edit-body` — min-height 300px, rows=14

### 관련 스크립트
- `scripts/patch_index_discipline.py` — 징계 모달 최초 추가
- `scripts/patch_penalty_notice.py` — 패널티 명칭·-30/-50·공지란

---

## 29. 비밀번호 선행 0 버그 (v98, Google Sheets 레거시)

> **Supabase 전환 후**: `meta.value`가 PostgreSQL **text**라 동일 증상 없음. Google Sheets 백업/롤백 시에만 참고.

### 한 줄 요약
Google Sheets가 `0906`을 숫자 `906`으로 저장 → 새로고침 시 시트 값이 `localStorage`를 덮어써서 로그인 실패.

### 재현 조건
- 비밀번호가 **0으로 시작하는 숫자** (예: `0906`, `0108`)
- 앱에서 「비밀번호 변경」 → `persistMeta` → `writeMeta` → 시트에 숫자로 기록
- 이후 `pollRefresh` / `bootstrapApp` → `applyRemoteData` → `syncMetaPasswords`

### 데이터 흐름
```
비번 변경 → localStorage "0906" (OK, 당장 로그인 됨)
    ↓ persistMeta
시트 meta.adminPw = 906 (숫자, 0 소실)
    ↓ pollRefresh / 새로고침
applyRemoteData → syncMetaPasswords → localStorage "906"
    ↓
getAdminPw() === "906" ≠ 사용자 입력 "0906" → 실패
```

### 수정된 코드 위치

**`setup/Code.gs`** (~134~161, ~213~218행)
- `META_PW_KEYS = { adminPw, treasurerPw }`
- `metaValueForWrite`: 저장 시 `'` + 문자열 (시트 텍스트 강제)
- `readMeta`: 비번 키는 `metaPasswordString()` → `String()`
- `writeTable`: meta 탭 value 열에 `metaValueForWrite` 적용

**`app.js`**
- `getAdminPw()` / `getTreasurerPw()` → `String(...)`
- `syncMetaPasswords(meta)` → `applyRemoteData`에서 호출
- `persistMeta()` → localStorage 비번을 meta에 병합 저장 (기존)

### 시트 수동 복구 (기획자·클럽장)

`meta` 탭:

| key | 잘못된 value | 고칠 value |
|-----|-------------|------------|
| adminPw | `906` | `0906` (텍스트) |
| treasurerPw | `108` | `0108` (텍스트) |

**방법 A**: value 셀 → **서식 → 숫자 → 일반 텍스트** → `0906` / `0108` 입력

**방법 B**: `'0906` / `'0108` 입력 (앞 `'`는 표시 안 됨)

**확인**: 셀 클릭 시 수식 입력줄에 `0906`이 보여야 함 (`906`만 보이면 실패)

### 배포 체크리스트 (v98)
- [ ] `meta` 시트 수동 복구
- [ ] Apps Script `Code.gs` 붙여넣기 → 배포 (URL 동일 유지)
- [ ] GitHub Pages: `index.html`, `app.js`, `style.css` (`?v=98`)
- [ ] Ctrl+F5 → 관리자 `0906` / 총무 `0108` 로그인
- [ ] (선택) 앱에서 비번 재저장 → 시트가 텍스트로 유지되는지 확인

### Code.gs 재배포 필요 여부
| 변경 | 재배포 |
|------|--------|
| v98 `META_PW_KEYS` | **필요** |
| `app.js`만 | 불필요 (GitHub Pages만) |
| 시트 수동 복구만 | 불필요 (단, Code.gs 없이 앱에서 비번 변경하면 다시 깨짐) |

### 브라우저 localStorage
Application → `fc_admin_pw` / `fc_treasurer_pw` 삭제 후 시트 복구·새로고침.

### 회귀 테스트
1. 관리자 비번 `0123`으로 변경 → 시트 value가 `0123`(텍스트)인지 (`123` 아님)
2. 새로고침 후 `0123` 로그인
3. 다른 기기에서도 동일

---

## 30. Supabase 전환 인수인계 (2026-06-13)

> Claude 세션에서 전환 완료. **운영·SQL·트러블슈팅 상세는 `setup/SUPABASE_GUIDE.md`**.  
> Cursor 에이전트 작업 브리핑은 **§31**.

### 전환 배경
- Apps Script 콜드 스타트 → 동기화 3~10초
- **변경 범위**: `api.js`만 교체 (`app.js`/`data.js`/`index.html` 구조 유지)
- Google Sheets 실물은 **삭제 안 함**, 운영은 Supabase만

### Supabase 프로젝트

| 항목 | 값 |
|------|-----|
| 조직 | football-manager |
| 프로젝트 | FOOTBALL-SITE |
| Project URL | `https://ajcidqsjpkzupxeizbyp.supabase.co` |
| Region | Northeast Asia (Seoul) |
| 대시보드 | https://supabase.com/dashboard/project/ajcidqsjpkzupxeizbyp |
| anon key | `api.js`의 `SUPABASE_KEY` (공개 repo 노출 — RLS off 상태) |

> Secret key는 대시보드 Settings → API Keys. **클라이언트에 넣지 말 것.**

### Data API 설정 (완료 상태)
- Settings → Integrations → Data API → 13 tables exposed
- Automatically expose new tables: **OFF**
- RLS: 전 테이블 **비활성** + allow-all (anon REST 허용)

### api.js 인터페이스 (app.js 계약)

```javascript
async function apiLoadAll(silent?)   // Promise.all 병렬 SELECT
async function apiSavePartial(data)  // 변경된 테이블만 저장
setSyncHandler(fn)                   // 동기화 바 콜백
```

### 내부 헬퍼
| 함수 | 역할 |
|------|------|
| `sbSelect(table)` | 단일 테이블 전체 읽기 |
| `sbSelectQuoted('dueExemptions'/'dueMemos')` | camelCase 테이블 |
| `sbSelectMeta()` / `sbUpsertMeta(meta)` | key/value meta (병합 upsert) |
| `sbSelectField()` / `sbUpsertField(field)` | id=1 단일 행 |
| `sbUpsert(table, rows)` | id 테이블 DELETE+INSERT 교체 |

### REST 호출 주의
- 헤더: `apikey` + `Authorization: Bearer <anon>` + `Content-Type: application/json`
- POST 시 `Prefer: return=representation` (field/meta upsert는 `resolution=merge-duplicates` 추가)
- `dueExemptions`, `dueMemos` — URL에 그대로 사용 (인코딩 불필요)

### 스키마 변경 시 에이전트 체크리스트
1. Supabase SQL Editor 또는 Table Editor에서 컬럼 추가
2. `api.js` — 해당 `sbSelect`/`sbUpsert` 필드 매핑
3. `app.js` — 객체 구조·`persist*`·`applyRemoteData` (필요 시)
4. `HANDOFF_FC_ZERO.md` §5 테이블 갱신
5. ~~`Code.gs`~~ — 레거시면 선택적 동기화

### GitHub
| 항목 | 값 |
|------|-----|
| Repo | `qotjdals147/fc-team-dashboard` |
| 배포 | GitHub Pages (파일 직접 업로드) |
| 백업 태그 | `v-google-sheets-backup` — Sheets 버전 직전 |

### Cursor에서 수정하면 안 되는 것
- `app.js`에 Supabase URL/KEY 직접 넣기 → **`api.js`만**
- `index.html` 한글 StrReplace → Python UTF-8 (규칙 유지)

### 알려진 후속 버그 (v99에서 수정)
| 버그 | 증상 | 수정 |
|------|------|------|
| `pollRefresh` → `SHEET_API` | 30초 폴링 무동작 | `apiLoadAll(true)` |
| `sbUpsertMeta` DELETE all | `persistMeta` 시 다른 meta 키 삭제 | 기존 병합 후 key upsert |

### 보안 메모 (향후)
- 현재 anon key + RLS off = **누구나 REST로 읽기/쓰기 가능**
- 강화 시: RLS 정책, Edge Function, 또는 service role 서버 프록시 검토
- 키 로테이션: Supabase 대시보드 → `api.js` → GitHub Pages 재배포

### 관련 문서
| 파일 | 용도 |
|------|------|
| `setup/SUPABASE_GUIDE.md` | **정본** — 대시보드·SQL·백업·트러블슈팅·기능 추가 7단계 |
| `docs/legacy/SUPABASE_GUIDE.txt` | 초기 이관 스냅샷 (Claude) — MD와 불일치 시 **MD 우선** |
| `docs/HANDOFF_FC_ZERO.md` §5 | 스키마 표 |
| `docs/HANDOFF_FC_ZERO.md` §31 | 에이전트 Supabase 체크리스트 |

---

## 31. 에이전트 Supabase 작업 브리핑

> **기획자는 DB를 모름.** 스키마·SQL·Data API·`api.js` 연동은 **에이전트가 전담**.  
> 변경 후 **`setup/SUPABASE_GUIDE.md` + 이 HANDOFF §5·§30** 동시 갱신.

### 언제 Supabase를 건드리나

| 작업 유형 | Supabase | 코드 |
|-----------|----------|------|
| UI만·집계만 | ❌ | `app.js` / `index.html` |
| 새 필드 (경기 날씨 등) | ✅ ALTER TABLE | `api.js` + `app.js` |
| 새 탭/기능 (평점 등) | ✅ CREATE TABLE + Exposed + RLS | `api.js` + `app.js` |
| 비번·팀명 수동 복구 | ✅ SQL `UPDATE meta` | 보통 불필요 |
| 데이터 확인·삭제 | ✅ SQL Editor / Table Editor | — |

### 기능 추가 7단계 (필수 순서)

1. **설계** — 테이블/컬럼 결정 (`HANDOFF_FC_ZERO.md` §5와 대조)
2. **SQL Editor** — `CREATE TABLE` 또는 `ALTER TABLE` 실행
3. **Data API** — Settings → Integrations → Data API → Exposed tables 체크 → Save
4. **RLS** (신규 테이블만) — `ENABLE ROW LEVEL SECURITY` + `allow all` policy
5. **`api.js`** — `apiLoadAll` / `apiSavePartial`에 테이블 추가
6. **`app.js`** — `persist*`, `applyRemoteData`, localStorage 키
7. **배포** — GitHub Pages + `?v=` + 문서 갱신

### `api.js` 수정 체크리스트

- [ ] `SUPABASE_URL` / `SUPABASE_KEY`는 **이 파일에만** (app.js에 넣지 않음)
- [ ] REST 헤더: `apikey` + `Authorization: Bearer` + `Prefer`
- [ ] `field` → `sbUpsertField` (id=1 merge-duplicates)
- [ ] `meta` → `sbUpsertMeta` **병합 upsert** (전체 DELETE 금지)
- [ ] `dueExemptions` / `dueMemos` → `sbSelectQuoted` / `sbUpsert` camelCase
- [ ] 일반 테이블 → `sbUpsert` DELETE+INSERT (빈 배열이면 전체 삭제)

### 수동 DB 작업 예 (기획자 대신 에이전트가 안내·실행)

```sql
-- 비밀번호 확인/수정
SELECT key, value FROM meta WHERE key IN ('adminPw', 'treasurerPw');
UPDATE meta SET value = '0906' WHERE key = 'adminPw';

-- 선수 확인
SELECT id, name, jersey FROM players ORDER BY id;
```

### 트러블슈팅 빠른 표

| Console | 원인 | 조치 |
|---------|------|------|
| 401 | anon key 불일치 | `api.js` ↔ 대시보드 API Keys |
| 404 | 테이블 미노출/오타 | Exposed tables · 테이블명 |
| 400 | JSON/타입 오류 | payload vs 컬럼 타입 (jsonb) |
| `SHEET_API is not defined` | 구버전 app.js | `pollRefresh` → `apiLoadAll(true)` |
| 동기화 후 meta 키 소실 | 구 `sbUpsertMeta` | v99 병합 upsert 확인 |

### 문서 갱신 의무 (변동 시)

| 변경 내용 | 갱신할 파일 |
|-----------|-------------|
| 테이블/컬럼 추가 | `setup/SUPABASE_GUIDE.md` §4·§6, `HANDOFF_FC_ZERO.md` §5 |
| api.js 저장 방식 | `SUPABASE_GUIDE.md` §5, `HANDOFF_FC_ZERO.md` §30 |
| 데이터 이전 상태 | `SUPABASE_GUIDE.md` §9, `HANDOFF_FC_ZERO.md` §0 |
| 배포 버전 | `HANDOFF_FC_ZERO.md` §0, `index.html` `?v=` |

### Code.gs / Google Sheets

- **재배포·시트 수정 안내 불필요** (레거시)
- 롤백 시에만 `setup/Code.gs` + `v-google-sheets-backup` 태그 참고

---

## 32. 동기화 버그 — 팀명·사진 유실 / 총무 오프라인 (v100, 2026-06-13)

### 증상
- 홈 **팀 이름·대표사진** 설정 직후 보이다가 **새로고침 후 사라짐**
- 본인 PC는 동기화·회비 입금 OK, **총무 PC는 「오프라인 (로컬 데이터)」** · 입금 미저장

### 원인 (확인됨)

**1) GitHub Pages에 구버전 배포**
| 파일 | 배포된 구버전 문제 | 로컬 v100 |
|------|-------------------|-----------|
| `api.js` | `sbUpsertMeta`가 meta **전체 DELETE** 후 POST, **에러 미검사** | 병합 upsert + `META_PRESERVE_IF_EMPTY` |
| `app.js` | `pollRefresh`가 **`SHEET_API`** 호출 (Sheets 잔재) | `apiLoadAll(true)` |

**2) meta DB가 빈 값으로 고정**
- Supabase `meta.myTeam=""`, `teamPhotoUrls="[]"` (실측)
- `stepPresentScale` 등 **부분 `persistMeta`** 가 빈 팀명·사진으로 DB 덮어씀

**3) `fc_myteam` localStorage 미저장**
- `persistMeta`가 `fc_myteam` 안 씀 → 새로고침 시 remote 빈 값이 우선

**4) 총무 오프라인**
- **사이트 URL은 동일** (`https://qotjdals147.github.io/fc-team-dashboard/`) — Sheets 시절 메일 링크와 같음
- DB만 Sheets → Supabase로 바뀜 (`api.js` 내용). **브라우저 캐시**에 구 `app.js`/`api.js` 남으면 `apiLoadAll` 실패 → 오프라인
- `Promise.all` 한 테이블만 실패해도 전체 오프라인이던 문제 → v100 `allSettled` 완화

### v100 수정
| 파일 | 내용 |
|------|------|
| `api.js` | meta 병합·빈값 덮어쓰기 방지·`metaValueString`·`allSettled` 부분 로드 |
| `app.js` | `fc_myteam` 저장·remote 빈 때 localStorage fallback·`teamPhotoTransform` JSON |
| `index.html` | `app.js?v=100`, `api.js?v=100` |

### 배포·검증 (클럽 전원)
1. GitHub Pages에 **`api.js` + `app.js` + `index.html`** 업로드 (v100)
2. **총무 포함 전원** Ctrl+Shift+R (강력 새로고침) 또는 시크릿 창 테스트
3. F12 → Network → `supabase.co/rest/v1/` 요청 **200** 확인
4. 동기화 바 **「동기화됨」** (오프라인 아님)
5. 홈 팀명·사진 저장 → 새로고침 후 유지 확인
6. Supabase Table Editor → `meta` → `myTeam`, `teamPhotoUrls` 값 확인

### 총무에게 안내할 한 줄
> 같은 주소 맞음. **Ctrl+Shift+R**로 새로고침. 상단이 「오프라인」이면 캐시 문제 — v100 배포 후 재시도.

---

## 33. v101~102 — 총무 일괄 입금·선택 삭제 (2026-06)

| 버전 | 내용 |
|------|------|
| **v101** | 일괄 입금 `dues.id` 소수 → **`nextDueId()` 정수** — Supabase 저장 실패 수정 |
| **v102** | 입금 기록 **체크박스 + 선택 삭제** (`deleteSelectedDues`) |
| **v109** | 지출 저장 — `api.js` **`sbUpsert` POST 선행**(실패 시 기존 행 유지), 저장 **직렬화**, `nextExpenseId()`, 실패 시 **화면 롤백**·Supabase 에러 문구 표시 |
| **v110** | **영수증 PNG**에 메모 열 추가 · **총무 탭**에서 30초 폴링 **스킵**(스크롤·입력 상태 보호) |
| **v111** | 영수증 버튼 → **공유 없이 PNG 즉시 다운로드**, 파일명 `지출영수증(2026.07).png` 형식(**기준 년월** 필터) |

배포: `api.js?v=103`, `app.js?v=112`, `index.html` 갱신.

---

## 34. 팀 사진 — Supabase Storage 업로드 (v103, A안)

### 기획자가 Supabase에서 **1회만** 할 일 (~2분)

1. **Storage** → **New bucket**  
   - Name: `team-photos`  
   - **Public bucket: ON**
2. **SQL Editor** → `setup/storage-team-photos.sql` 내용 붙여넣기 → **Run**  
   (anon insert/select/delete/update 정책)

이후 사진 추가·삭제·저장은 **앱에서만** — Dashboard 추가 작업 없음.

### A안 (FC 제로 — 현재 구현)

| 항목 | 내용 |
|------|------|
| UX | 관리자 모달 — **파일 첨부**, 페이지 추가/삭제, 자동 전환 간격 |
| Storage | `team-photos/fc-zero/{timestamp}-{rand}.{ext}` |
| meta | `teamPhotoUrls` **순서 배열**(URL 문자열), `teamPhotoTransforms` **같은 인덱스** |
| 삭제 | 슬롯 제거·전체 삭제·교체 시 Storage 객체 삭제 시도 |
| 레거시 | 기존 Drive/외부 URL은 그대로 표시 (`normalizePhotoUrl`) |

배포: `index.html`, `app.js?v=103`, `api.js?v=102`, `style.css?v=103`.

### B안 (플랫폼)

`meta.teamPhotos` 객체 배열 — **BUSINESS_VISION.md` §13.10** · 구현 **`docs/HANDOFF_PLATFORM.md`**

---

## 35. 포메이션 3종 추가 (2026-07-23 · data.js v=77)

| 추가 | 슬롯 라벨 (11) |
|------|----------------|
| **4-1-4-1** | GK, LB, CB, CB, RB, CDM, LW, CAM, CAM, RW, ST |
| **4-2-1-3** | GK, LB, CB, CB, RB, CDM, CDM, CAM, LW, ST, RW |
| **4-1-2-3** | GK, LB, CB, CB, RB, CDM, CAM, CAM, LW, ST, RW |

- **정본**: `data.js` `FORMATIONS` + `FORMATION_POS_LABELS`
- **UI**: `index.html` `#formationSelect` (Python UTF-8 편집)
- **동기**: `platform/club/data.js`, `platform/js/formations-data.js` (플랫폼 구단 홈·라인업 미리보기) — **`docs/HANDOFF_PLATFORM.md` §5 포메이션**
- **DB 변경 없음** — `field.formation` 문자열·`saves` JSON 그대로
- **자동 연동**: `applyFormation`, `inferFormationFromTokens`, 쿼터 저장/불러오기, PNG·프레젠테이션, 경기 「포메이션에서 불러오기」 — `FORMATIONS` 키만 추가하면 동작
- 배포 FC 제ero: `index.html`, **`data.js?v=77`**
- 배포 플랫폼: `club/data.js?v=2`, `club-boot.js` → **`app.js?v=7`**, `style.css?v=2`, `formations-data.js?v=2`

---

## 36. v114 — poll 수동화 · 포메 fit · 등번호 00 (2026-07-28)

### 동기화 (FC Zero = 플랫폼 구단 홈)

| | v113 이전 | v114 |
|--|-----------|------|
| 30초 poll | FC Zero **있음** | **없음** (`setupManualDataSync`) |
| 수동 갱신 | — | 동기화바 **↻** · `manualDataRefresh()` |
| 탭 복귀 | — | `visibilitychange` → 1회 fetch |

플랫폼은 P7c(2026-07-23)부터 poll 없었음 · FC Zero v114에서 **동일 정책** · `platform/club/app.js` **동시 패치**.

### 포메 캔버스 fit

1. `renderField()` → **`renderBench()` 먼저**
2. `scheduleFormationLayout()` — RAF×2 후 `drawFieldCanvas()`
3. `computeFieldCanvasSize()` — `#fieldWrap` **clientWidth/Height** 만 사용 (`vpH*0.58` 제거)
4. `FIELD_EXPORT_RESERVE = 52` — ALL/⬇ 버튼 영역
5. CSS: `.field-inner`/`.field-canvas` `max-height:100%` · `.bench-section` `min-height:52px`

### 등번호 `"00"`

- `parseJerseyInput` — `/^\d+$/` · 선행 0 유지 → `"00"`
- `normalizeJerseyFromDb` — 로드 시 문자열
- `jerseySortNum` — 정렬용 숫자 파싱
- **DB**: `setup/jersey-text.sql` (FC Zero) · `setup/platform_setup/jersey-text.sql` (플랫폼) — `jersey int` → `text`

### 배포 캐시

| 대상 | 파일 |
|------|------|
| FC Zero Pages | `index.html` → `app.js?v=116`, `style.css?v=115` |
| 플랫폼 구단 홈 | `club-boot.js` → `app.js?v=9`, `club/index.html` → `style.css?v=3` |

---

## 37. v115~116 — 포메 슬롯·경기장 고정 · 큰 화면 UI (2026-07-28)

### 동기화 (FC Zero = 플랫폼 구단 홈)

| 패치 | FC Zero | `platform/club/` |
|------|---------|------------------|
| UI 라벨 | `#btnPresent` **큰 화면** / **큰 화면 종료** | ✅ 동일 |
| 프레젠 모드 포메 `<select>` | CSS — toolbar 일부만 노출 | ✅ |
| FORMATIONS 10종 | `data.js` v78 | `data.js` v3 · `formations-data.js` v3 |
| 경기장 고정 비율 | `aspect-ratio` · inner 실측 | ✅ |
| 벤치 높이 | `max-height:96px` scroll | ✅ |

코드 내부: `presentation-mode` · `presentMode` · `togglePresentMode()` — **변수/함수명 유지** (DB·meta 키 호환).

### UI — 「큰 화면」(구 「발표」)

| 요소 | 문구 |
|------|------|
| `#btnPresent` (일반) | 🖥️ **큰 화면** |
| `#btnPresent` (active) | ✕ **큰 화면 종료** |
| `.pp-exit-btn` | ✕ **큰 화면 종료** |
| `title` | 큰 화면으로 보기 |

### 프레젠테이션 — 포메이션 드롭다운

- 기존: `body.presentation-mode .formation-toolbar { display:none }`
- v115: toolbar **표시** · `자동 배치`·`저장`·`초기화` **숨김** · `<select id="formationSelect">`만 사용

### FORMATIONS 슬롯 (고정자리)

행 기준 (y, 0=상단 공격): FWD ~0.16–0.20 · AM ~0.34 · MID ~0.50 · DM ~0.56 · DEF ~0.70 · GK ~0.88

- 공격 라인을 아래로 (구 y 0.12 → 0.16) — **상대 페널티 침범 완화**
- 기존 저장 포메·쿼터 데이터는 `slotIdx` 유지 → **자동 배치** 1회 시 새 좌표 반영

### 경기장 비율 고정 (일반 모드만 — v117에서 큰 화면 분리)

1. ~~CSS `.field-inner { aspect-ratio }` 전 모드~~ → **`body:not(.presentation-mode)`만** (§38)
2. `.bench-section { max-height: 96px; overflow-y: auto }` — 벤치 증가해도 field-wrap 높이 안정
3. `computeFieldCanvasSize()` — 일반: inner 실측 + `fitFieldAspect` · 큰 화면: v114 fit (§38)
4. `drawFieldCanvas()` — ±2px 미만 크기 변화 **무시**

### 배포 캐시 (v115~116, §38에서 갱신)

| 대상 | 파일 |
|------|------|
| FC Zero Vercel | `app.js?v=122`, `style.css?v=118`, `data.js?v=83` |
| 플랫폼 구단 홈 | `club-boot.js` → `app.js?v=15`, `style.css?v=6`, `data.js?v=8` |
| 플랫폼 라인업 미리보기 | `formations-data.js?v=6` |

---

## 38. v117 — 큰 화면 fit 복원 · ST 라인 통일 (2026-07-28)

### 원인 (v115 회귀)

v115에서 **일반·큰 화면 공통**으로:

1. CSS `.field-inner { aspect-ratio; width:100% }` — 큰 화면 `field-wrap`이 넓으면 inner **가로 과확장**
2. `computeFieldCanvasSize()`가 **`presentMode` 전에** inner `{W:iw,H:ih}` 반환 — **1.45 비율 미검증**
3. → 토큰·슬롯 **가로로 벌어짐** (큰 화면 스크린샷)

**의도**: 작은 화면만 안정화 · 큰 화면은 **v114 fit 로직 유지**.

### 수정

| 구분 | 일반 모드 | 큰 화면 |
|------|-----------|---------|
| CSS | `body:not(.presentation-mode) .field-inner { aspect-ratio:100/145 }` | `width:auto` · aspect unset |
| `computeFieldCanvasSize` | inner → `fitFieldAspect` | `presentMode` **우선** · 좌260+우210 패널 제외 |

### FORMATIONS ST 라인

- **삼각형 미드**(4-2-3-1 · 4-1-4-1 · 4-2-1-3 · 4-1-2-3): AM y≈0.38~0.42 + ST y=0.22 — **유지**
- **일자 미드**(4-3-3 · 4-4-2 · 3-4-3 · 3-5-2 · 5-3-2 · 5-4-1): AM층 없음 → 공격 y **0.34**(MID 0.50과 ~0.16 간격) · 0.22 쓰면 ST 단독 부상
- `data.js` v80 · 슬롯 y 일자/삼각형 분리 (위 표)

### 토큰 UI 겹침 (CAM OVR ↔ CB 별) — **미적용**

**증상**: 4-2-1-3 등 중앙 CAM **OVR pill**이 아래 CB **별**과 겹칠 수 있음.

**v119 시도(롤백)**: 슬롯=원 중심 앵커 + z-index — **슬롯 정렬이 전반적으로 어긋나 롤백**. 현재는 **토큰 박스 중심** `translate(-50%,-50%)` 유지.

**v121 대안(적용)**: 문제 포메만 `FORMATIONS` **y ±0.03** — 4-1-4-1(CDM·AM↑) · 3-5-2(ST↑). `data.js` v81 · 플랫폼 `data.js`/`formations-data.js` 동기.

---

## 39. Vercel 이관 · Git 연동 (2026-07-29)

### 배경

- GitHub Pages → **Vercel** (Popup과 **동일 팀** `popup-cube`). **DB(Supabase) 변경 없음** — 정적 파일 호스팅만 이동.
- **Production URL (정본)**: https://fc-team-dashboard.vercel.app
- **GitHub Pages**: **OFF** (2026-07-29) — `github.io` URL 비활성 · **Git·Vercel 배포는 그대로** · ON/OFF → **§39.2**

### §39.2 GitHub Pages ON/OFF · 백업 (저장소 설정 · Git/Vercel 무관)

**배경 (2026-07-29)**: Vercel = **정본 URL**. Pages = **임시 백업** — Vercel 장애·긴급 시 아래 ON으로 `github.io` 복구.

| | |
|---|---|
| **OFF** | `qotjdals147/fc-team-dashboard` → **Settings → Pages** → **Unpublish site** (빨간 버튼) |
| **UI 주의** | Source 드롭다운에 **`None` 없음** (2024~ UI) — OFF는 **Unpublish site**만 |
| **ON (백업 복구)** | **Settings → Pages** → Source → **Deploy from a branch** → **`main`** · **`/ (root)`** → Save |
| **OFF 영향** | `github.io` 404 · **Git·push·Vercel 배포·Supabase ✅ 유지** |
| **ON 영향** | `github.io` 재개 · Vercel과 동일 repo·DB |

> 에이전트는 GitHub Settings **직접 변경 불가** — User 조작.

### §39.3 Vercel Pro Trial → Hobby (2026-07-29 FAQ)

| 질문 | 답 |
|---|---|
| Trial 만료 배너 | 카드 없음 → **Hobby(무료)** · 카드 있음 → **Pro ~$20/월** |
| 사이트 닫히나? | 카드 없이 Hobby 전환만 → **보통 유지** (FC Zero 정적·데모 트래픽) |
| 정본 URL | **https://fc-team-dashboard.vercel.app** |
| Pages OFF와? | **무관** — GitHub 호스팅만 중지 |

### Vercel

| 항목 | 값 |
|------|-----|
| 팀 | `popup-cube` (Popup `popup-cube-web`와 동일 · 팀 slug rename 가능 — preview URL만 영향, §39.1) |
| 프로젝트 | `fc-team-dashboard` |
| Git | `qotjdals147/fc-team-dashboard` · **Connect Git ✅** (2026-07-29) |
| 배포 | `main` push → 자동 · 또는 CLI `vercel deploy --prod --scope popup-cube` |
| 설정 | 루트 `vercel.json` · `.vercelignore` (platform/docs/setup 제외) |

상세: **`setup/VERCEL_MIGRATION.md`**

### FC Zero만 해당 없음

- Supabase **Auth URL** 설정 불필요 (`meta.adminPw` / `meta.treasurerPw`).

### §39.1 인프라 메모 (기획·에이전트)

- Vercel **Hobby/Pro는 팀 단위** — FC를 같은 팀에 넣어도 **프로젝트 수만큼 요금 3배 아님**. 정적 사이트 트래픽 적음.
- Production `*.vercel.app`는 **프로젝트명** 기준 (`fc-team-dashboard.vercel.app`). Preview URL에만 `-popup-cube` 팀 slug.
- 결제 수단 미등록 시 Trial 종료 → **Hobby downgrade** (사이트 유지·무료) — **§39.3**

---

## 40. v121 — 포메 y 미세조정 · 관리자 전환 GK 밀림 (2026-07-29)

### FORMATIONS y (±0.03 · 겹침 완화)

| 포메 | 슬롯 | 변경 |
|------|------|------|
| **4-1-4-1** | CDM | 0.56 → **0.53** |
| | LW·CAM·CAM·RW | 0.42 → **0.39** |
| **3-5-2** | ST·ST | 0.34 → **0.31** |
| | 5미드 | **유지** |

- `data.js` v81 · `platform/club/data.js` · `platform/js/formations-data.js` v6
- `app.js` v121 / `club-boot.js` → `app.js?v=14` — `applyAdminMode()` 후 `scheduleFormationLayout` · `#fieldInner` `ResizeObserver`

### 관리자 모드 → GK 밑으로 박힘

- **원인**: 관리자 ON 시 `formation-toolbar` 표시 → `#fieldWrap` 높이 변화 · **재측정 누락**
- **수정**: `applyAdminMode()`에서 포메 탭 active 시 `fieldSize` reset + `scheduleFormationLayout` · `ResizeObserver` on `fieldInner`

---

## 41. v122 — scorer pid 재사용 통계 오류 (2026-09-04)

### 증상
- 신규 멤버 **근찬** (#14, id **29**) — 실제 **1골 1어시**인데 **2골 1어시** 표시
- 골 히스토리에 **2026-07-12 vs 언더브릿지 FC** (근찬 입단 전) 1골 포함

### 원인
- 초기 경기에서 **용병 `(용)`** 기록 시 **임시 pid 26~29** 슬롯 사용
- 이후 같은 id가 **도훈·성빈·우진·근찬** 등 신규 정회원에게 **재할당**
- `computePlayerStats` / `getPlayerStatHistory`가 **`scorers[].pid`만** 보면 과거 용병 기록이 신규 선수에게 귀속

### 조치
| 구분 | 내용 |
|------|------|
| **코드** | `matchParticipantPids(m, players)` · **`computeMatchWages`** — lineup/subs/scorers 동일 `resolveScorerPlayerId` |
| **파일** | `data.js` · `platform/club/data.js` · `app.js` · `platform/club/app.js` |
| **DB** | `setup/fix-scorer-pid-recycle.sql` · `apply-fix-scorer-pid-recycle.mjs` — **2026-07-12** `용민(용)` pid **29→11** ✅ |
| **캐시** | `index.html` **`app.js?v=122`** · **`data.js?v=83`** · `style.css?v=118` · **`api.js?v=103`** |
| **플랫폼 구단 홈** | `club-boot.js` → **`app.js?v=15`** · **`data.js?v=8`** (FC Zero `data.js`/`app.js` 동기 필수) |

### 타 멤버 출석 (코드 fix 후 · audit 2026-09-04)
| 선수 | 수정 전 | 수정 후 |
|------|---------|---------|
| 근찬 (29) | 6 | **4** |
| 도훈 (26) | 5 | **3** |
| 성빈 (27) | 7 | **3** |
| 우진 (28) | 8 | **4** |

### ⬜ User 미결 — lineup/subs DB 역사 정리
| | |
|---|---|
| **상태** | User **2026-09-04** — 고민 후 결정 · **에이전트 임의 RUN ❌** |
| **현재** | 코드만으로 **통계·선수 가치(수당)는 정확** · DB lineup JSON은 과거 `(용)` pid 그대로 |
| **하면 좋은 것** | 용민 7/12 출석 등 **정회원 본인 과거 출석** roster 복원 |
| **스크립트** | `setup/fix-lineup-pid-recycle.sql` (주석·예시만) · `setup/audit-attendance-pid-recycle.mjs` (17건 목록) |
| **이미 적용된 DB** | `setup/fix-scorer-pid-recycle.sql` — **scorers만** 2026-07-12 ✅ |

### User 확인 (배포 후)
1. https://fc-team-dashboard.vercel.app **강력 새로고침**
2. 근찬 — **1골 1어시 · 출석 4**
3. 골 히스토리 — **2026-08-09** 1건만

### 타 멤버 점검 — scorers (resolveScorerPlayerId 적용 후)
| 날짜 | 저장 pid | scorer name | 현재 pid 소유 | 결과 |
|------|----------|-------------|---------------|------|
| 2026-07-12 | 26 | 보윤(용) | 도훈 | **통계 제외** (roster에 보윤 없음) |
| 2026-07-12 | 29 | 용민(용) | 근찬 | **용민(id 11)** 귀속 (DB+코드) |
| 2026-07-19 | 26 | 도훈(용) | 도훈 | **도훈** (이름 일치) |
| 2026-08-09 | 33 | 준용(용) | 한영(용) | **통계 제외** |
| 2026-08-09 | 34 | 현덕(용) | 정현(용) | **통계 제외** |

### 잔여 주의
- **MOM / bestDef / bestDef2** — match 단일 pid 필드는 아직 raw pid · 빈도 낮음 · 필요 시 §41과 동일 패턴
- **setup/** 검증 스크립트 — `.env.local` `FC_ZERO_*` (워크스pace 루트) · service_role **커밋 금지**
