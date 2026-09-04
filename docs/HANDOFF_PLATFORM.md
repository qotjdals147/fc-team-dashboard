# FC 플랫폼 — 인수인계·DB·구현 진행 (정본)

> **이 파일 하나** = 플랫폼 인수인계 + Supabase 운영 + 구현 Living log + **에이전트 필수 규칙**.  
> **FC 제로** → `docs/HANDOFF_FC_ZERO.md` + `setup/SUPABASE_GUIDE.md` (**여기 아님**, R37)  
> **기획·법무·MK 규칙** (변경 적음) → `docs/BUSINESS_VISION.md` §5·§15·§17·§19  
> **최종 갱신**: 2026-09-04 · **FC Zero §41 동기** (`club/data.js` · `club/app.js` · `club-boot.js` v15/v8)  
> **2026-09-04 FC Zero §41**: pid 재사용 통계·출석 fix — **`platform/club/data.js`** · **`platform/club/app.js`** · **`club-boot.js` → `app.js?v=15` · `data.js?v=8`** · 상세 **`HANDOFF_FC_ZERO.md` §41**  
> **에이전트**: 플랫폼 코드·DB·스키마 작업 후 **반드시 이 파일 갱신** (§6 진행 · §13 이력). **플랫폼 인수인계는 이 파일만** — 별도 HANDOFF·`.mdc` 중복 금지.

---

## 0. 세션 재개 — 3분 체크리스트

### 에이전트 필수 (정본 = 이 파일)

| # | 할 일 |
|---|--------|
| 0 | **실질 작업 전** — Cursor **모델 질문** + **연동 필수 점검**(짝 기능 ⬜/✅). 동작 상세 → `.cursor/rules/fc-cursor-model-routing.mdc` · 모델·작업표 → **§11** |
| 0b | **기획자 `@docs/HANDOFF_PLATFORM.md` 멘션** → **이 파일 전체(§0~§13) 먼저 Read** · 부분 grep만으로 답변 **금지** |
| 1 | **플랫폼 작업 시작 전** — **이 파일 §0~§6** 읽기 |
| 2 | 스키마·RPC·api·UI 변경 **또는 기획 확정(포크 차등·동기화 정책 등)** 후 — **같은 세션** §6·§9·§10·**§13** 갱신 |
| 3 | 기획자에게 — 「`HANDOFF_PLATFORM.md` 갱신함」 한 줄 |
| 4 | SQL 안내 시 Query name (`platform-schema-v1` 등) 명시 |
| 5 | **FC 제로** 루트 `app.js`/`api.js`/DB — 플랫폼 목적으로 **수정 금지** (R37) |

**참고만 (인수인계 아님)**

| 문서 | 용도 |
|------|------|
| `docs/BUSINESS_VISION.md` §5·§15·§17·§19 | 기획·법무·MK |
| `.cursor/rules/fc-cursor-model-routing.mdc` | 모델 질문·연동 점검 **행동** 규칙 |
| `.cursor/rules/fc-platform-legal-positioning.mdc` | §19 LG·금지어 (구현·카피 전) |

**삭제됨·쓰지 않음**: `docs/PLATFORM_HANDOFF.md`, `setup/SUPABASE_GUIDE_Platform.md`, `fc-platform-handoff.mdc`, BUSINESS_VISION §20 본문

### 재개 체크 (기술)

1. **두 Supabase**
   | | FC 제로 | 플랫폼 |
   |--|----------|--------|
   | 프로젝트 | `ajcidqsjpkzupxeizbyp` | **`rdscgnvseplwlftjixom`** |
   | 코드 | 루트 `api.js` / `app.js` | `platform/js/` |
   | SQL | (과거 수동) | **`setup/platform_setup/`** |

2. **읽기**: **이 파일** + (기획 필요 시) `BUSINESS_VISION.md` §5·§15·§17

3. `platform/js/config.js` — URL·KEY (**제로 키 복사 금지**)

4. 로컬: `cd platform` → `npx --yes serve . -l 8770`

5. SQL Editor Query: `platform-schema-v1` · `platform-rpc-create-club` · `rpc-members` ✅

6. 캐시: `index.html` → `lobby.js?v=14` (올릴 때 숫자 +1)

7. **알림 Realtime** (v0.4.2): SQL Editor → `platform-realtime-notifications` (`realtime-notifications.sql`) **1회 RUN**

8. **탈퇴·강퇴** (v0.4.3): SQL Editor → `platform-rpc-leave-kick` (`rpc-leave-kick.sql`) **1회 RUN**

9. **재가입** (v0.4.5): 탈퇴/강퇴 후 초대 수락 duplicate key → `platform-rpc-members-rejoin` **1회 RUN**

10. **매칭** (v0.5): SQL Editor → `platform-rpc-matching` (`rpc-matching.sql`) **1회 RUN**

11. **명단 복구** (v0.5+): `platform-rpc-ensure-roster` (`rpc-ensure-roster.sql`) — 신규 구단 owner `players` 누락 시

12. **create_club 갱신** (선택): `platform-rpc-create-club-v2` — `rpc-members` 후 owner 명단 자동 생성

---

## 1. 아키텍처

```
브라우저 → **Vercel (정본)** · Pages 레거시(백업)
  → auth.js (이메일 · refresh_token)
  → api.js (REST + RPC)
  → lobby.js / club/ (FC 제로 UI 포크 · team_id)
  → Supabase rdscgnvseplwlftjixom
```

| | FC 제로 | 플랫폼 |
|--|---------|--------|
| 인증 | `meta.adminPw` | Auth + `profiles` |
| 테넌트 | 1클럽 | `clubs.team_id` |
| **구단 홈 동기화** | **↻ 수동** · visibility 1회 (v114) | **`persist*` 즉시** · poll **없음** ✅ P7c · 동일 정책 |
| **로비 Realtime** | 없음 | `notifications` only (v0.4.2) |

---

## 2. 접속·배포

| 용도 | URL |
|------|-----|
| 로비 (**정본**) | `https://fc-team-platform.vercel.app/` |
| 구단 홈 | `https://fc-team-platform.vercel.app/club/?slug={slug}` |
| 로비 (레거시·백업 Pages) | `https://qotjdals147.github.io/fc-team-platform/` — **ON 가능** · OFF/복구 → **`HANDOFF_FC_ZERO.md` §39.2** (Zero는 OFF) |
| Supabase | `https://supabase.com/dashboard/project/rdscgnvseplwlftjixom` |
| GitHub | `qotjdals147/fc-team-platform` |
| Vercel | 팀 `popup-cube` · 프로젝트 `fc-team-platform` · Git **`qotjdals147/fc-team-platform`** 연동 ✅ · **`setup/VERCEL_MIGRATION.md`** |

**Supabase Auth (✅ 2026-07-29)**: `FOOTBALL_SITE_PLATFORM` → Authentication → URL Configuration · Site URL `https://fc-team-platform.vercel.app` · Redirect `https://fc-team-platform.vercel.app/**` · **로그인 확인** · 회원가입은 미재테스트.

Organization: `FOOTBALL_PLATFORM` · Project: `FOOTBALL_SITE_PLATFORM`

---

## 3. SQL (`setup/platform_setup/`)

**repo SQL ≠ DB 자동 반영** — Dashboard에서 RUN.

| Query name | 파일 | 순서 |
|------------|------|------|
| `platform-schema-v1` | `schema-v1.sql` | 1 |
| `platform-rpc-create-club` | `rpc-create-club.sql` | 2 |
| `platform-rpc-members` | `rpc-members.sql` | 2b |
| `platform-realtime-notifications` | `realtime-notifications.sql` | 2c (알림 Realtime) |
| `platform-rpc-leave-kick` | `rpc-leave-kick.sql` | 2d (탈퇴·강퇴 M12) |
| `platform-rpc-members-rejoin` | `rpc-members-rejoin.sql` | 2e (탈퇴 후 재가입) |
| `platform-rpc-matching` | `rpc-matching.sql` | 3 (매칭 MK01~03) |
| `platform-rpc-ensure-roster` | `rpc-ensure-roster.sql` | 3b (명단 복구) |
| `platform-rpc-create-club-v2` | `rpc-create-club-v2.sql` | 3c (create_club 재RUN, 선택) |
| `platform-storage-team-photos` | `storage-team-photos.sql` | Storage 버킷 후 |

**Exposed tables (22/23)**: profiles, clubs, club_members, … matching_*, players~disciplines · **`teams` OFF**

Functions: … **`create_matching_post`**, **`apply_to_matching_post`**, **`respond_matching_application`**

---

## 4. 테이블 요약 (23개)

**플랫폼**: profiles, teams(내부), clubs, club_members, club_invitations(+role), club_applications, club_creation_payments, notifications, matching_posts, matching_applications

**구단 홈** (+ `team_id`, PK `(team_id,id)`): players(+user_id), matches, field, saves, meta, dues, expenses, settlements, schedules, notices, dueExemptions, dueMemos, disciplines

상세 DDL: `setup/platform_setup/schema-v1.sql`

---

## 5. 코드 연동

| 파일 | 역할 |
|------|------|
| `js/config.js` | URL·KEY · v0.5.0 |
| `js/auth.js` | 로그인 · JWT refresh |
| `js/api.js` | REST/RPC |
| `js/notifications.js` | REST + Realtime |
| `js/matching.js` | MK01~03 · 목록·공고·신청·승인 |
| `js/members.js` | M08~M10 · **M12 탈퇴·강퇴** |
| `js/lobby.js?v=14` | 로비·멤버·**매칭 탭** · 🔔 패널 fix |
| `js/lineup-picker.js` | MK18·MK20 저장 포메 선택 |
| `js/lineup-field-view.js` | MK18·MK19 필드 미리보기 · `formations-data.js?v=2` |
| `js/formations-data.js` | 포메 좌표·라벨 (**10종** · FC 제ero `data.js` 동기) |
| `club/data.js` | 구단 홈 포메 (`formations-data.js`와 **동일 10종**) |
| `club/club-boot.js?v=2` | 구단 홈 스크립트 로더 · `data.js?v=2` |
| `club/club-api.js` | team_id load/save |
| `club/club-platform.js` | role → UI (M15) |

**구단 홈 REST**: `?team_id=eq.{clubs.team_id}` · 저장 DELETE+POST

**역할 → UI**: owner/admin → 관리 · owner/treasurer → 총무 · 🔒/💰 비밀번호 없음

**멤버 RPC**: §3 · UI **내 구단 → 멤버 관리**

**알림 Realtime (v0.4.2)**: 로그인 후 WebSocket 구독 · 초대/신청 시 **🔔 숫자·패널 즉시** (새로고침 불필요). `@supabase/supabase-js` esm.sh CDN.

### 포메이션 10종 (FC 제ero `HANDOFF_FC_ZERO.md` §35 동기 · 2026-07-23)

| 추가(3) | 전체 10종 |
|---------|-----------|
| **4-1-4-1** · **4-2-1-3** · **4-1-2-3** | 4-3-3 · 4-4-2 · 4-2-3-1 · 위 3 · 3-4-3 · 3-5-2 · 5-3-2 · 5-4-1 |

| 파일 | 용도 |
|------|------|
| `club/data.js` | 구단 홈 포메 탭 · 자동배치·저장·쿼터 |
| `club/index.html` | `#formationSelect` 드롭다운 |
| `js/formations-data.js` | 로비 MK18·MK19·MK20 필드 미리보기 |
| `js/lineup-field-view.js` | `formations-data.js?v=2` import |

- **DB 변경 없음** — `field.formation` · `saves` JSON 문자열 그대로
- **배포 캐시**: `club/club-boot.js?v=2` · `club/data.js?v=2` · `formations-data.js?v=2` (로비는 `lobby.js` 경유 import)

---

## 6. 구현 진행 (Living)

```
[P0] Supabase + schema + Pages + config              ✅
[P1] Auth · profiles · create_club · 로비            ✅ v0.2
[P2] 구단 홈 team_id + role                          ✅ v0.3
[P3] 멤버 M08~M10                                    ✅ v0.4 · 실테스트 통과
[P3.1] JWT refresh                                   ✅ v0.4.1
[P3.2] 알림 Realtime (notifications)                 ✅ v0.4.2 · SQL 1회 필요
[P3.3] 탈퇴·강퇴 M12~14 UI+RPC                       ✅ v0.4.3 · SQL 1회 필요
[P4] matching_posts/applications                     ✅ v0.5.0 · MK01~03·05·12 · **회귀 실테스트 ✅**
[P4.1] MK23~24 성사 매칭 취소·일정 수정 요청           ← v0.5c
[P5] 본인인증 M03 · Pro PG (베타 스텁)               ← v0.6
[P6] MK18 공고 · MK20 신청 — 저장 포메 선택 UI              ✅ v0.5b
[P6b] MK19 신청 목록 상대 포메 보기 (접기/펼치기)          ✅ v0.5b · MK19
```

### v0.5 회귀 실테스트 ✅ (2026-07-10)

- SQL: `rpc-members` 갱신 · `ensure-roster` · `create-club-v2` RUN  
- 신규 구단 owner **명단** 복구 확인  
- A 공고 → B 신청 → 승인 → **양쪽 구단 홈 일정** 반영 (MK05)

### v0.4 실테스트 ✅ (2026-06-18)

- 초대 → 수락 → 내 구단 소속  
- owner 역할 드롭다운 변경  
- JWT expired → refresh_token 자동 갱신  

### UI — 어디서?

| 동작 | 위치 |
|------|------|
| platform_id | **내 정보** |
| 구단 만들기 | **내 구단** |
| 초대·역할·모집 | **내 구단 → 멤버 관리** (역할 변경 **owner만**) |
| 탈퇴·강퇴 | **내 구단** 카드 · **멤버 관리 → 강퇴** (M12) |
| 수락 | **받은 초대** / 🔔 |
| 홈피 | **홈피 가기** (새 탭) |
| 매칭 공고 | **매칭** → 공고 올리기 (owner/admin) |
| 공고 포메 선택 (MK18) | **매칭** → 공고 올리기 → 저장 포메 선택 · **필드 미리보기** · 1~4Q 전환 |
| 신청 포메 선택 (MK20) | **매칭** → 공고 상세 → 저장 포메 선택 · **필드 미리보기** · 1~4Q 전환 |
| 신청 상대 포메 (MK19) | **매칭** → 공고 상세 → 신청 목록 → **상대 포메이션 보기** (기본 접힘) |
| 매칭 신청·승인 | **매칭** → 공고 상세 |

### 회귀 테스트 (v0.4.3)

1. B **구단 탈퇴** → A 🔔 탈퇴 알림 Realtime  
2. A가 B **재초대** → B 🔔 초대 Realtime  
3. A **강퇴** → B 🔔 강퇴 알림  

### 회귀 테스트 (v0.4)

1. A·B platform_id → 2. A 초대 B → 3. B 수락 → 4. B 명단 → 5. A 역할 변경

---

## 7. 기능 추가 7단계

```
1  HANDOFF_PLATFORM + BUSINESS_VISION — 설계
2  setup/platform_setup/*.sql — SQL Editor
3  Data API Exposed tables
4  RLS (Go 전 membership 정책)
5  platform/js/api.js
6  lobby.js · club/
7  Pages 배포 + **이 파일 §12** 갱신
```

---

## 8. RLS · Storage · 트러블슈팅

**RLS**: 파일럿 `pilot_allow_all` → Go 전 `club_members` 기반

**Storage B안**: bucket `team-photos` · `{club_id}/` · `storage-team-photos.sql`

| 증상 | 조치 |
|------|------|
| JWT expired | v0.4.1 refresh · 재로그인 |
| field snapshot empty | 구단 홈 **포메** → **포메이션 저장** 후 공고·신청 화면에서 선택 (MK08·MK18·MK20) |
| duplicate key club_members | `platform-rpc-members-rejoin` RUN (탈퇴 후 재초대) |
| 명단 비어 있음 (신규 구단) | `platform-rpc-ensure-roster` RUN · 구단 홈 **강력 새로고침** (club-api v2) |
| Realtime 알림 안 옴 | `realtime-notifications.sql` **재RUN** (`REPLICA IDENTITY FULL`) · F12 `[notifications] realtime` · 받는 쪽 **로비 탭 열린 상태** |
| 🔔 눌러도 패널 안 열림 / 바로 닫힘 | **v0.5b fix** — `lobby.js?v=14` · 🔔 클릭 리스너 **1회만** 바인딩 (중복 토글) · 강력 새로고침 |
| RPC 미설치 | rpc-*.sql RUN |
| 401/404 | Auth · Exposed tables |
| FC 제로 데이터 섞임 | config KEY · team_id players DELETE |
| 포메 편집 중 화면 튐 / ALL·⬇ 안 보임 | **v114** · `scheduleFormationLayout` · **`HANDOFF_FC_ZERO.md` §36** · `app.js?v=9` |
| 포메 슬롯·경기장 비율·큰 화면 UI | **v115~116** · **`HANDOFF_FC_ZERO.md` §37** · §10e |
| v115 큰 화면 회귀 · ST 라인 | **v117 fix** · **`HANDOFF_FC_ZERO.md` §38** · §10f |
| 등번호 00 안 보임 | `platform_setup/jersey-text.sql` RUN · `app.js?v=7` |
| 다른 기기에 admin 저장 미반영 | **↻ 버튼** 또는 탭 복귀(visibility 1회 fetch) · MK05 → **로비 🔔** |

**보안 TODO**: 약관 Q34 · Auth Redirect URL Pages 등록

---

## 9. 아직 안 함

MK19 공고 스냅샷 보기 (후순위) · **MK23 성사 매칭 취소 요청** · **MK24 일정 수정 요청** · M03 본인인증 · Pro PG · 카카오 · 레프리/포인트 (LG04) · FC 제로 변경 금지

---

## 10. 다음 (v0.5b~)

```
MK19 라인업 보기 · MK23~24 성사 매칭 취소·일정 수정 요청 (v0.5c)
팀 사진 Storage · Pro 미리보기
M03 본인인증 스텁
[P7a] FC 제로 포크 정리 ✅ (M15 잔재) · [P7b] PY11 Pro · [P7c] 30초 poll 제거 ✅ · [P8] 명단/OVR Phase A
```

### §10b — FC 제ero vs 구단 홈 포크 차등 (2026-07-23)

> **읽는 법**: `BUSINESS_VISION.md` §5(v1 범위) · §13·R19(v2 OVR) · §15(M15) · PY10~11 · `M11`과 **함께** 본다.  
> **v0.5 현재**: `platform/club/` = FC 제ero UI **거의 전체 포크** + Auth·`team_id`·역할(M15)만 얹음. 아래 ⬜ = **코드에 아직 FC 제ero 잔재**.

#### v1 파일럿 vs v2(Phase A) — 시점 구분 (혼동 금지)

| 시점 | 문서 | 명단·OVR |
|------|------|----------|
| **v0.5 파일럿 (지금)** | §5 「구단별 **현재 기능** 그대로」 | FC 제ero식 **수동 OVR·form ±99** 포크 **허용**(과도기) |
| **Phase A / 사업 1시즌** | §13·**R19**·R03 | **수동 OVR 없음** · OVR 30 시작 → 활약점 **자동** · form **+3 풀** |

→ 「플랫폼에서 OVR 수동 입력 **없애야 한다**」= **장기·R19 방향 맞음**. 「**지금 v0.5 백로그에 이미 확정**」= **아님** — §10b 백로그 **[P8]**.

#### 🔴 플랫폼에 없어야 함 (또는 즉시 정리)

| FC 제ero | 플랫폼 | 근거 | 코드 |
|----------|--------|------|------|
| 🔒/💰 **비밀번호** 잠금·변경 | **Auth + role** (M15) | §5·M15 | 숨김 ✅ · M15 버튼 DOM ⬜ |
| **`meta.adminPw` / `treasurerPw`** | 저장 안 함 | M15 | persist skip ✅ |
| **홈 팀명 ✏️** (`editTeamName`) | **`clubs.name`만** (로비에서 변경) | 멀티테넌트 | 차단+안내 ✅ |
| **구단별 `wageRates` 변경** | **고정 `WAGE_DEFAULTS`** (PM09·R38) | 크로스구단 공정성 | UI 숨김 ✅ · meta 미저장 ✅ |
| **`localStorage` fc_*** 쓰기 | **중단** (타 구단 섞임) | §8 | `fcLocalSet` ✅ |
| **데모 명단·로컬 마이그레이션** | 없음 | v0.3 | 부분 ✅ |

#### 🟡 v1 유지 → Phase A에서 차등 (명단 편집)

| 항목 | v0.5 (포크) | Phase A 목표 | 비고 |
|------|-------------|--------------|------|
| **포지션·등번호** | 관리자 편집 | **유지** | 포메·MK 스냅샷에 필요 |
| **이름** | 수동 | `user_id` 정회원 → **프로필 연동·read-only** | RPC `_create_player_row` |
| **OVR 슬라이더** | 수동 | **read-only 자동** (R22) | MK10·MK21 스냅샷 |
| **formBonus ±99** | 선수별 | **구단 +3 풀** (R04) | |
| **용병 체크** | 모든 선수 | **게스트 전용** (M11) · 정회원=RPC | §16 플랫폼 용병=v2 |
| **선수 추가/삭제** | 자유 CRUD | **멤버십·강퇴·M11**와 짝 | §6 회귀 4단계 |

**기획자 방향(2026-07-23)**: 일반 명단 편집 = **포지션·등번호** (+ 게스트 이름). OVR·form·용병 체크는 **일반 모달에서 제외** — §10b **[P8]**에 반영.

#### 🟢 그대로 유지 (구단 홈 v1)

포메(쿼터·저장·PNG) · 경기 기록 · 통계(admin) · 패널티 · 일정·공지 · 팀 사진 · 프레젠 · 경기 「수당 확인」 열람.

**로비만**: 매칭 MK01~20 · 🔔 알림 · 멤버·초대 · Pro(예정) · **포메 편집 없음**(MK18·20 선택만) — §5 UI 표.

#### 🟠 기획 확정 · 코드 ⬜ (PY)

| 항목 | 문서 |
|------|------|
| **총무 Pro 게이트** | PY11 — 무료 미리보기+CTA |
| **포메 템플릿** | PY06 — 무료 2 / Pro 5 |
| **팀 사진 장수** | 무료 2 / Pro 10 |
| **로비 광고** | Pro·슈퍼 무광고 |

#### ⚪ FC 제ero만 · 플랫폼 없음

단일클럽 익명 · Google Sheets · 비밀번호 admin/treasurer · 17명 시드 · v2 시즌 **선반영 금지**(R00).

#### 백로그 우선순위 (구현은 기획자 「구현해」 후)

| ID | 내용 |
|----|------|
| **[P7a]** | M15 잔재 — 비밀번호·팀명·wageRates·localStorage ✅ (2026-07-23) · 모달 DOM 정리는 후순위 |
| **[P7b]** | PY11 총무 Pro · PY06/PY 사진·포메 슬롯 |
| **[P7c]** | **30초 poll 제거** ✅ · ↻ 수동 · visibility 1회 · §10c |
| **[P8]** | Phase A — OVR 자동·form +3·게스트 용병(M11) · 명단 모달 차등 |

**LG:** 🟢 §10b 문서화 · 🟡 Pro·명단 차등은 약관·PG와 단계 적용.

### §10c — 구단 홈 30초 poll 제거 (기획 확정 2026-07-23 · **P7c** · ✅ 2026-07-23)

> **FC 제ero `HANDOFF_FC_ZERO.md` §26·§36** — poll+persistField 경쟁 · 포메 fit · 등번호 00.  
> **2026-07-28**: FC Zero도 poll 제거(v114) — **플랫폼과 동일 정책** · `platform/club/app.js` 동기 패치.

#### 확정 정책

| | 플랫폼 구단 홈 | FC 제ero |
|--|----------------|----------|
| 30초 poll | **없음** [P7c] | **없음** [v114] ✅ |
| 쓰기 → DB | `persist*` 즉시 (현행) | 동일 |
| 다른 사람 화면 갱신 | **↻ 수동** · `visibilitychange` **1회** | **동일** (v114) |
| MK05 일정·매칭 | **로비 🔔** → 홈피 가기 / 새로고침 | ↻ 또는 새로고침 |

#### 코드 (2026-07-28 · `club/app.js?v=7`)

- `setupManualDataSync()` — poll **미시작** · `#syncRefreshBtn`(↻) · `visibilitychange` 1회 fetch
- `manualDataRefresh()` — `apiLoadAll` → `applyRemoteData` → `refreshCurrentTab`
- ~~`setupPlatformDataSync()` / `#platformSyncRefreshBtn`~~ → v114에서 **FC Zero와 함수명 통일**
- **포메 fit** · **등번호 00** — FC Zero v114와 **동일** (`scheduleFormationLayout`, `parseJerseyInput`) · §10d

#### P7a 동시 반영 (`club/app.js` · `club-platform.js`)

- `fcLocalSet/Get/Remove` — 플랫폼 `fc_*` localStorage **쓰기 없음**
- `editTeamName` — 차단 + 로비 안내
- `openWageRatesModal` / `saveWageRates` / meta `wageRates` — 플랫폼 **고정 `WAGE_DEFAULTS`**
- `hidePlatformClubLegacyUI()` — 🔒💰·팀명✏️·비밀번호/수당 버튼 숨김

### §10d — FC Zero v114 → 구단 홈 동기 (2026-07-28)

> **원칙**: 포메·동기화·명단 등 **FC 제ero UI 포크**(`platform/club/`)는 루트 `app.js`와 **쌍으로** 유지.  
> 로비·매칭·Auth만 `platform/js/` — **별도**.

| 패치 | 함수/파일 | FC Zero | `platform/club/` |
|------|-----------|---------|------------------|
| poll 제거 | `setupManualDataSync`, `manualDataRefresh` | `app.js` v114 | `app.js` v7 ✅ |
| 포메 fit | `scheduleFormationLayout`, `computeFieldCanvasSize` | ✅ | ✅ |
| 등번호 00 | `parseJerseyInput`, `normalizeJerseyFromDb` | ✅ | ✅ |
| CSS fit | `.field-wrap`, `.bench-section` min-height | `style.css` v114 | `style.css` v2 ✅ |

**배포 (플랫폼 구단 홈)**: `club-boot.js?v=3` → `app.js?v=9` · `club/index.html` → `style.css?v=3` · `data.js?v=3` · 강력 새로고침.

**DB (양쪽 Supabase)**:

- FC Zero: `setup/jersey-text.sql`
- 플랫폼: `setup/platform_setup/jersey-text.sql`

**아직 포크 밖 (공유만)**:

- `platform/js/lineup-field-view.js` — 매칭 MK18·19 **읽기 전용** · **`formations-data.js?v=4`**

- `platform/js/lineup-picker.js` — 타입 주석 `jersey?: number` (표시만)

### §10e — FC Zero v115~116 → 구단 홈 동기 (2026-07-28)

> **`HANDOFF_FC_ZERO.md` §37** — 큰 화면 UI · 프레젠 포메 select · FORMATIONS 1차 · aspect-ratio(→§10f에서 큰 화면 분리)

### §10f — v117 큰 화면 fit 복원 · ST 라인 (2026-07-28)

> **FC Zero `HANDOFF_FC_ZERO.md` §38** — v115가 큰 화면까지 깨뜨린 회귀 수정.

| 패치 | FC Zero | `platform/club/` |
|------|---------|------------------|
| 큰 화면 캔버스 fit | `presentMode` 우선 · `fitFieldAspect` | ✅ `app.js` v10 |
| CSS aspect-ratio | **일반 모드만** | ✅ `style.css` v4 |
| ST 라인 y=0.22 통일 | `data.js` v79 | `data.js` v4 · `formations-data.js` v4 |

**배포**: `club-boot.js?v=4` → `app.js?v=10` · `style.css?v=4` · `data.js?v=4`

### §10g — Vercel 이관 · Git · Auth · v121 (2026-07-29)

> **FC Zero `HANDOFF_FC_ZERO.md` §39~§40** · **`setup/VERCEL_MIGRATION.md`**

| 항목 | 값 |
|------|-----|
| Production | https://fc-team-platform.vercel.app · 구단 `/club/` |
| 레거시 Pages (백업) | https://qotjdals147.github.io/fc-team-platform/ · **아직 ON 가능** |
| FC Zero Pages | **OFF** (2026-07-29) — Zero만 Unpublish · Platform은 선택 |
| Vercel Trial | 카드 없음 → Hobby(무료) · 사이트 유지 — **`HANDOFF_FC_ZERO.md` §39.3** |
| Vercel | 팀 `popup-cube` · 프로젝트 `fc-team-platform` · Git 연동 ✅ |
| Supabase Auth | Site URL + Redirect Vercel (**§2**) · 로그인 OK |
| v121 | 4-1-4-1·3-5-2 y ±0.03 · admin→`scheduleFormationLayout` · `ResizeObserver` |

| 패치 | FC Zero | `platform/club/` |
|------|---------|------------------|
| Vercel 정적 | `vercel.json` · `.vercelignore` | `platform/vercel.json` |
| 포메 y 미세 | `data.js` v81 | `data.js` v6 · `formations-data.js` v6 |
| 관리자 GK 밀림 | `app.js` v121 | `app.js` v14 |

**배포**: `club-boot.js` → `app.js?v=14` · `lobby.js` import `formations-data.js?v=6` · GitHub push → Vercel auto.

**아직 (선택)**: GitHub repo에 `vercel.json` push · Platform Pages OFF(Unpublish) · 팀 slug rename.

### MK23~24 — 성사 매칭 변경 (기획 확정 2026-07-10)

**전제**: `matched` 확정 후 · 요청·승인은 **양 구단 owner/admin** · 플랫폼은 **중개만** (LG01)

| ID | 기능 | 흐름 |
|----|------|------|
| **MK23** | **취소 요청** | 한쪽이 **사유** 작성 → 상대에게 요청 → 상대 **승인** 시 매칭 `cancelled` · **양쪽** `schedules` 해당 경기 **삭제/비활성** · 알림(M16) |
| **MK24** | **일정 수정 요청** | 한쪽이 **변경안**(일시·장소·메모 등) + 사유 → 상대 **승인** 시 `matching_posts` 일정 필드 + **양쪽** `schedules` **동시 갱신** · 거절 시 기존 유지 |

**공통**

- 요청 중 상태 (`pending_cancel` / `pending_reschedule` 등) — **동시에 두 요청** 불가(한 건 처리 후 다음)
- Realtime 알림: 요청 도착 · 승인 · 거절
- UI: 매칭 탭 **확정 경기 상세** 또는 로비 **다가오는 일정**에서 진입
- 구현 시: `matching_change_requests` 테이블 또는 `matching_posts` 상태 확장 + RPC — §7 7단계

> `BUSINESS_VISION.md` §17 MK 번호 동기화는 구현 착수 전 1회 반영.

### 회귀 테스트 (v0.5) ✅

1. A 구단 홈 **포메** → **포메이션 저장** → A **매칭 공고** 화면에서 저장 포메 **선택** 후 등록 (MK18)  
2. B 구단 홈 저장 포메 선택 후 **신청** (MK20) → A 🔔  
3. A **신청 목록** → B **상대 포메이션 보기** 펼침 · 1~4Q 확인 (MK19) → A **승인**  
4. 양쪽 구단 홈 **일정**에 경기 추가 확인 (MK05)  

---

## 11. Cursor 모델 라우팅 (기획자용)

**인수인계는 이 파일(§11)** · 에이전트 **행동**(모델 질문·연동 점검 타이밍)만 → `.cursor/rules/fc-cursor-model-routing.mdc`

### 연동 필수 점검 (예: P1 v0.5 회귀)

| 있음 | 없으면 막히는 짝 | 현재 |
|------|------------------|------|
| 공고·신청·승인 MK01~03·05 | 포메 선택 **MK18·MK20** ✅ · 신청 상대 포메 **MK19** ✅ |
| 매칭 성사 MK05 | **MK23 취소 요청** · **MK24 일정 수정 요청** · 일정 롤백/동기 갱신 | ⬜ |
| MK16 마감 알림 | MK17 미성사 알림 | 📋문서 |
| 초대·수락 | 탈퇴·강퇴·재가입 | ✅ v0.4.3~4.5 |

회귀 테스트만 돌릴 때도 위 ⬜를 **먼저 짚고** — 이번에 넣을지·백로그할지 기획자 확인.

### 기본 원칙

| 일상 | 막힐 때 | 기획·문서 |
|------|---------|-----------|
| **Composer 2.5** | **Sonnet 5** → **Opus 4.8** | **Fable 5** |
| MAX 끔 | 3회 실패 시 **MAX 켬** | MAX 끔 |

### 남은 작업별 추천 (플랫폼)

| 우선 | 작업 | 추천 모델 | MAX | 비고 |
|------|------|-----------|-----|------|
| **P1** | v0.5 회귀 테스트 | ✅ 2026-07-10 |
| **P2** | **MK18·MK20** 저장 포메 선택 UI | ✅ 2026-07-10 |
| **P2b** | **MK23~24** 취소·일정 수정 요청 RPC+UI | **Opus 4.8** | 권장 | MK05 이후 · LG01 |
| **P3** | **MK19** 신청 목록 상대 포메 보기 | ✅ 2026-07-10 |
| **P4** | 팀 사진 **Storage B안** (`storage-team-photos.sql`) | **Sonnet 5** | 끔 | SQL+업로드 UI |
| **P5** | **M03** 본인인증 스텁 | **Opus 4.8** | 권장 | LG 🟡 · 약관·고지 |
| **P6** | **Pro PG** 베타 스텁 | **Opus 4.8** | 권장 | 결제·환불 문구 §19 |
| **P7c** | **30초 poll 제거** — FC Zero v114 패리티 · §10c·§10d | ✅ 2026-07-28 |
| **P7** | Supabase **Paused Resume**·RUN 체크·401/404 | GPT-5.6 Sol 또는 Composer 2.5 | 끔 | 코드 변경 없을 수 있음 |
| **P8** | Realtime·RPC·duplicate key·명단 비음 **장애** | **Opus 4.8** | **켬** | §8 트러블슈팅 |
| **P9** | `HANDOFF_PLATFORM`·§12 이력·우선순위 정리 | **Fable 5** | 끔 | 구현 전 |
| **P10** | §19 법무 문구·랭킹 고지·카피 검수 | **Fable 5** | 끔 | LG 🔴 회피 |
| 후순위 | 카카오 로그인 · 레프리/포인트 (LG04) | Opus 4.8 | 켬 | v1 이후 |

### FC 제로 (운영만 · R00)

| 작업 | 추천 모델 |
|------|-----------|
| 총무·지출·영수증·폴링 등 **소규모 버그** | Composer 2.5 |
| `sbUpsert`·동시저장·DB 유실 등 **데이터 버그** | Sonnet 5 → Opus 4.8 |
| v2 시즌·OVR **문서 설계만** | Fable 5（코드 금지） |

### 모델 별칭 (Cursor Pro 메뉴)

| 라벨 | 용도 |
|------|------|
| Composer 2.5 · Fast | 빠른 수정·반복 |
| Sonnet 5 · High | 멀티파일 기능 |
| Opus 4.8 · High | RPC·복합 버그 |
| Fable 5 · High | 기획·문서·법무 |
| Codex 5.3 · Medium | 정해진 스펙 구현 다듬기 |
| Grok 4.5 · High Fast | 짧은 검토·LG 판별 |
| GPT-5.5 / 5.6 Sol / Terra · Medium | 운영 안내·에러 해석 |

---

## 12. 문서 규칙

| 갱신 | 안 함 |
|------|-------|
| **`docs/HANDOFF_PLATFORM.md`** (이 파일 **하나** — 인수인계·DB·진행·에이전트 규칙) | `docs/HANDOFF_FC_ZERO.md` (FC 제로) |
| `setup/platform_setup/*.sql` | FC 제로 `SUPABASE_GUIDE.md` |
| `platform/README.md` (한 줄) | BUSINESS_VISION §20 (스텁만) |
| — | ~~`fc-platform-handoff.mdc`~~ · ~~`PLATFORM_HANDOFF.md`~~ (삭제·통합됨) |

**기획 규칙 변경** 시에만 `BUSINESS_VISION.md` §15·§17 등 수정.

---

## 13. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-29 | **§10g · v0.5.6** — Vercel 정본 · FC Zero Pages OFF(Unpublish) · Trial→Hobby FAQ §39.3 · Git 연동 · Auth · v121 · **`VERCEL_MIGRATION.md`** |
| 2026-07-28 | **§10f · v117** — 큰 화면 fit 복원 · ST y=0.22 · `app.js?v=10` · `style.css?v=4` · `data.js?v=4` · `formations-data.js?v=4` |
| 2026-07-28 | **§10e · FC Zero v115~116 동기** — 큰 화면 UI · 프레젠 포메 select · `app.js?v=9` · §37 |
| 2026-07-28 | **§10d · FC Zero v114 동기** — poll·포메 fit·등번호 00 · `club/app.js?v=7` · `style.css?v=2` · `jersey-text.sql` |
| 2026-07-23 | **P7a·P7c ✅** — poll 제거 · fcLocal* · editTeamName·wageRates · `club/app.js?v=6` · `club-platform.js` |
| 2026-07-23 | **§10c · P7c** — 구단 홈 **30초 poll 제거 확정**(기획) · §0b 멘션=전체 Read 규칙 |
| 2026-07-23 | **§10b** — FC 제ero vs 구단 홈 포크 차등 (v1/v2 시점 · M15·OVR·명단 · P7a~P8 백로그) |
| 2026-07-23 | **포메이션 3종** — 4-1-4-1 · 4-2-1-3 · 4-1-2-3 (FC 제ero 동기 · **10종**) · `club/data.js` · `formations-data.js?v=2` · `club-boot.js?v=2` |
| 2026-07-21 | **🔔 알림 패널 fix** — `notifBell` 리스너 중복 등록 제거 · Realtime 시 매칭 탭 `renderMain` 생략 (`lobby.js?v=14`) |
| 2026-07-10 | **MK19** — 신청 목록 **상대 포메이션 보기** 접기/펼치기 (`lobby.js?v=13` · `field_snapshot`) |
| 2026-07-10 | **MK18·MK20 필드 뷰** — 저장 포메 **캔버스·OVR·쿼터 전환** (`lineup-field-view.js` · `lobby.js?v=12`) |
| 2026-07-10 | **MK18·MK20 수정** — 로비 포메 편집 제거 · `saves` 선택만 (`lineup-picker.js` · `lobby.js?v=11`) |
| 2026-07-10 | **v0.5b MK18** (1차) — 로비 공고 라인업 (`lobby.js?v=10`) |
| 2026-07-10 | **v0.5 회귀 실테스트 ✅** · **MK23~24** 취소·일정 수정 요청 기획 (§10) |
| 2026-06-18 | **인수인계 단일화** — `fc-platform-handoff.mdc` 삭제 · 에이전트 규칙 **§0**로 통합 |
| 2026-06-18 | **§11 연동 필수 점검** — 성사 매칭 취소 요청 등 짝 기능 |
| 2026-06-18 | **v0.5.0** 매칭 MK01~03·05·12 — `rpc-matching.sql` · `matching.js` · 매칭 탭 |
| 2026-06-18 | **v0.4.5** 재가입 fix — `rpc-members-rejoin.sql` (left → active) |
| 2026-06-18 | **v0.4.4** Realtime fix — `notifications` REPLICA IDENTITY FULL · 구독 재시도 |
| 2026-06-18 | **v0.4.2** 알림 Realtime — `realtime-notifications.sql` · `notifications.js` WebSocket |
| 2026-06-18 | **HANDOFF_PLATFORM** 통합 — PLATFORM_HANDOFF + SUPABASE_GUIDE_Platform + §20 이관 |
| 2026-06-18 | v0.4.1 JWT refresh · 멤버 실테스트 · setup/platform_setup |
| 2026-06-17~18 | v0.2~v0.4 Auth·구단홈·멤버 |

---

*LG: 🟢 로비·구단·멤버·매칭 중개 · 🟡 본인인증·약관 후순위*
