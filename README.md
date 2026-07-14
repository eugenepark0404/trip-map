# 여행 다이어리

친구와 함께 지도 위에 쌓는 국내 여행 기록. React + TypeScript + Vite, Tailwind CSS, Supabase.

## 시작하기

1. 의존성 설치

   ```bash
   npm install
   ```

2. `.env` 생성 (`.env.example` 참고)

   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```

3. Supabase 프로젝트의 SQL Editor에서 `supabase/migrations/0001_init.sql`을 실행해 스키마와 RLS 정책을 적용한다.

4. 개발 서버 실행

   ```bash
   npm run dev
   ```

## 구조

- `src/lib/supabase.ts` — Supabase 클라이언트
- `src/context/AuthContext.tsx` — 세션 상태
- `src/pages/` — 화면
- `supabase/migrations/` — DB 스키마 및 RLS
- `scripts/` — 아이콘 생성 등 빌드 보조 스크립트
