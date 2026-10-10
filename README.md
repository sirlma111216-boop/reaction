# 리액션 카페

중학교 과학 수업용 실시간 팀 대항 게임. 교사 1명과 학생 최대 40명이 최대 8팀으로 나뉘어 카페를 운영한다. 과학 원리를 쓰는 메뉴 13종을 만들어 손님에게 팔고, 순이익이 가장 큰 팀이 이긴다. 제한시간, 퀴즈, 개인 점수는 없다.

- 과학 범위: 2022 개정 교육과정 중학교 과학 (열, 물질의 상태 변화, 기체의 성질, 물질의 특성, 화학 반응의 규칙성). 화면의 과학 문장은 `src/shared/content/menus.ts` 와 `principles.ts` 에만 있다.
- 메뉴판 4종: 1학년(6종), 2학년(9종), 3학년(13종), 화학 반응 집중(7종). 교사가 방을 만들 때 고른다.
- 하루(영업일)에 행동 3번(장보기·만들기·장비 설치). 음식 내기와 마감은 행동을 쓰지 않는다. 모든 팀이 마감하면 다음 날이 열린다.

## 로컬 실행

```bash
npm install
cp .dev.vars.example .dev.vars   # TEACHER_PASSWORD 를 채운다 (로컬 전용, 커밋하지 않는다)
npm run dev:worker               # Worker + Durable Objects (http://127.0.0.1:8787)
npm run dev                      # Vite 개발 서버 (http://localhost:5173, /api 와 /ws 를 8787 로 프록시)
```

연습 모드(타이틀의 「연습」 탭)는 서버 없이 브라우저 안에서 같은 엔진으로 AI 카페와 6일을 경쟁한다. `npm run dev` 만으로도 된다.

## 교사가 게임을 여는 순서

1. 타이틀 → 「교사」 탭에서 로그인한다 (아이디와 비밀번호는 배포 때 비밀값으로 등록한 값).
2. 메뉴판과 영업일 수(6·8·10)를 고르고 「새 방 만들기」.
3. 대기실에서 방 코드·QR·입장 링크(`/?room=코드`)를 교실 화면에 띄운다.
4. 학생이 들어오면 「팀장 임명」을 누른다. 팀장이 카페(이름·색·마스코트)를 만들고, 나머지 학생이 카페를 골라 들어간다. 교사가 학생을 옮기거나 내보낼 수 있고, 교사도 한 팀의 팀장으로 참가할 수 있다.
5. 「영업 시작」. 교사 보드에서 팀별 누적 순이익, 마감 여부, 접속 인원, 남은 행동, 오늘의 점장을 본다. 잠시 멈춤, 팀 건너뛰기(그 팀을 마감 처리), 점장 넘기기, 조기 종료가 있다.
6. 끝나면 「오늘의 과학」(학급 전체의 메뉴별 횟수, 첫 시도 성공 비율, 원리 한 줄)으로 정리하고, 결과를 JSON·CSV 로 내보낸다. 팀 단위 기록만 있다.

## 학생 조작

- 상단 바: 며칠 차, 오늘 날씨와 내일 예보, 코인, 남은 행동, 오늘의 점장, 「오늘 영업 마감」.
- 시장: 재료 카드를 눌러 장바구니에 담고 「사기」(한 번에 4종류·6개). 장비 진열대.
- 주방: 메뉴를 고르고 레시피 → 조건 고르기(「원리 힌트」 무료) → 결과(「왜 그럴까?」, 변화 종류·반응식, 안전 한 줄). 만들기 1번에 2인분.
- 카운터: 손님을 고르면 낼 수 있는 음식과 예상 별점·대금이 보인다. 원한 결과와 같으면 별 3개와 팁. 어제 만든 음식은 별점이 1 줄고, 그다음 날 마감 때 폐기된다.
- 원리 노트: 메뉴판의 메뉴와 장비의 원리 카드. 만들어 본 메뉴는 결과별 설명까지.
- 점장이 아닌 팀원은 같은 화면을 보며 메뉴·손님·재료에 「추천」 표시를 남긴다.

## 검증 명령

```bash
npm run typecheck
npm run lint
npm run test              # vitest: 엔진·손님 생성·정산·순위·저장 복원·봇
npm run verify:content    # 6.5 콘텐츠 검사 (금지 용어, 메뉴판·재료·장비, 선택지·손님 말, 자산 ID)
npm run assets:validate   # 그림·소리 파일 유무와 형식 → reports/asset-coverage.json
npm run sim:smoke         # 메뉴판 4종 × 영업일 3종, 100경기 완주
npm run sim:balance       # 학습 시드로 후보 탐색
npm run sim:validate      # 검증 시드 2,000경기 → reports/balance/BALANCE_REPORT.md
npm run build
npx wrangler deploy --dry-run --outdir dist/worker-dry
TEACHER_PASSWORD=... node scripts/e2e-ws.mjs http://127.0.0.1:8787 30 1   # wrangler dev 를 띄운 뒤
```

## 구조

```text
src/shared/content   재료·장비·메뉴·손님·원리 카드·메뉴판·자산 ID (데이터만. 메뉴를 더해도 엔진·서버·화면 코드를 고치지 않는다)
src/shared/config    economy.ts — 가격·보상 등 조정 가능한 수치와 조정 기록
src/shared/engine    순수 상태 전이: 명령 검증(commands), 하루 마감(phases), 손님·날씨·단체 주문(customers), 별점·대금(scoring)
src/shared/protocol.ts, projection.ts   메시지 봉투와 역할별 화면 데이터
src/worker           Worker(index) + RoomDurableObject(room) + DirectoryDurableObject(directory)
src/client           화면 (screens, places, components) 과 연결·세션·소리·그림 로더 (lib)
src/sim              정책 봇 5종, 헤드리스 러너, 지표, 밸런스 CLI
scripts              자산 변환·검수, 콘텐츠 검사, 실서버 통합 테스트
tests                vitest
docs                 CURRICULUM, SCIENCE_NOTES, DECISIONS, ASSETS, KNOWN_LIMITATIONS
reports              자산 검수 결과, 밸런스 보고서
```

## 그림·소리 넣는 법

- 그림 원본을 `assets-source/images/<ID>.png` 에 넣는다 (ID 는 `docs/ASSETS.md` 또는 `/asset-review`). 소리는 `public/assets/audio/<ID>.mp3`.
- `npm run assets:build` 를 실행하면 크기별 WebP 와 `index.json` 이 만들어진다. 앱은 `index.json` 으로 파일 유무를 알고, 없는 그림은 점선 상자, 없는 소리는 무음으로 동작한다.
- `npm run assets:validate` 로 형식과 투명 배경을 확인한다.

## 배포 (Cloudflare Workers)

1. `npx wrangler login`
2. 교사 아이디와 비밀번호를 비밀값으로 등록한다. 코드·설정·문서 어디에도 적지 않는다 (아이디를 등록하지 않으면 `teacher`).
   ```bash
   npx wrangler secret put TEACHER_ID
   npx wrangler secret put TEACHER_PASSWORD
   ```
3. `npm run deploy` (`vite build` 뒤 `wrangler deploy`). 비밀번호가 없으면 교사 로그인이 「교사 비밀번호가 설정되지 않았습니다」로 막힌다.
4. 방은 Durable Object 하나이며 SQLite 저장소에 상태를 둔다. 대기실에서 2시간, 종료 뒤 24시간, 최대 48시간 뒤에 만료된다.

이 게임은 실제 조리나 실험 방법의 안내가 아니다. 실제로 따라 할 때는 선생님과 함께한다.
