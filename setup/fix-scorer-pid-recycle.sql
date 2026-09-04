-- ISS: 용병 슬롯 pid(26~29 등) 재사용 후 과거 scorer.pid 가 신규 정회원 통계에 합산됨
-- 2026-09-04 — 2026-07-12 언더브릿지: pid 29「용민(용)」→ id 11 용민 (근찬 id 29 오귀속 방지)
-- Supabase SQL Editor에서 RUN (FOOTBALL-SITE)

UPDATE matches
SET scorers = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN (elem->>'pid')::bigint = 29 AND elem->>'name' = '용민(용)'
          THEN jsonb_set(jsonb_set(elem, '{pid}', '11'), '{name}', '"용민"')
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(scorers) AS elem
)
WHERE id = 1783869924827
  AND date = '2026-07-12';
