# 기본 어휘 3000 단어장 (vocab-3000)

교육부 고시 제2022-33호 기본 어휘 3,000 기반 초·중·고 영단어 암기·문제집 PWA.
서버 없음 · 완전 오프라인 동작 · 무료. 기능 개요는 `README.md` 참고.

이 저장소(`vocab-3000`)는 이 앱 전용입니다. 원래 `ai-prompt-practice` 저장소의
`vocab-app/` 하위 폴더였으나 2026-08-25에 `git subtree split`으로 히스토리를
보존한 채 분리했습니다.

## 작업 규칙

- **코드 주석과 커밋 메시지는 한국어로** 작성합니다.
- 기능 작업은 별도 브랜치에서 하고 main으로 머지합니다 (main에 직접 푸시하지 않음).
- API 키는 `.env`에서만 읽고 **절대 코드에 넣지 않습니다** (`.env`는 커밋 제외).

## 명령어

```bash
npm install
npm run dev        # 개발 서버 (아래 '포트 충돌' 주의)
npm test           # 단위 테스트 (vitest, src/**/*.test.ts)
npm run build      # 테스트 → tsc -b → vite build → dist/
npm run preview    # 빌드 결과 미리보기
```

**`npm run build`는 테스트를 먼저 돌립니다.** 실패하면 빌드가 멈추므로,
간격 반복·출제 규칙을 바꿀 때는 `src/lib/*.test.ts`도 함께 고치세요.

## 구조

```
src/
  App.tsx           라우팅 + 설정 컨텍스트(useSettings) + 스킨/글자크기 적용
  pages/            Home Search Diagnostic Learn Quiz Grammar Review Stats Settings
  components/       NavBar(SVG 아이콘) WordCard(스와이프·길게 누르기) ShareSheet ProgressRing
  components/LoadState.tsx  로딩·실패 화면 (모든 화면이 공유)
  components/ErrorBoundary.tsx  렌더 오류 시 흰 화면 대신 복구 안내
  lib/
    useAsync.ts     비동기 로딩 상태(로딩·실패·재시도) 훅
    backButton.ts   안드로이드 하드웨어 뒤로가기 처리
    reminder.ts     복습 로컬 알림 (네이티브 전용, 서버 없음)
    backup.ts       학습 기록 백업 — 앱은 공유 시트, 웹은 다운로드
    wakeLock.ts     듣기 모드 중 화면 꺼짐 방지
    types.ts        데이터 모델 + Settings + SKINS(스킨 메타 목록)
    data.ts         public/data 청크 지연 로딩 + 메모리 캐시, TRACKS 정의
    db.ts           IndexedDB(idb) — states(단어 상태) / meta(설정·일별기록)
    srs.ts          간격 반복 규칙
    quiz.ts         문제 출제(오답 선택지는 같은 level·같은 품사에서)
    tts.ts          음성 재생 — 나중에 mp3로 교체할 때 이 파일만 수정
    shareCard.ts    단어 카드 PNG 생성(캔버스)·공유/저장 — 스킨 토큰을 읽어 그림
    skin.ts         data-skin 적용 · 스킨별 웹폰트 로드 · theme-color 갱신
  styles.css        전역 스타일 + 스킨 토큰
public/data/        빌드 산출 데이터 (index.json, days/day-NN.json ×60, ...)
scripts/            데이터 파이프라인 (Python)
data/               원본 CSV + words_enriched.json
design/             스킨 시안 원본 (design/README.md 참고)
```

## 스킨 시스템 (수정 시 주의)

스킨 5종: `classic`(기본) `minimal` `pop` `focus` `paper`.
`<html data-skin="...">` + `[data-theme]` 조합으로 CSS 토큰 세트를 통째로 교체합니다.

**스킨을 추가·수정하려면 반드시 세 곳을 함께 맞춥니다:**

1. `src/styles.css` — `[data-skin='이름']` 토큰 블록 (+ 필요 시 다크 변형
   `[data-skin='이름'][data-theme='dark']`, 스킨별 특수 규칙)
2. `src/lib/types.ts` — `Skin` 타입과 `SKINS` 배열(이름·설명·스와치 색)
3. `src/lib/skin.ts` — `SKIN_FONTS`(웹폰트 URL)와 `THEME_COLOR`

규칙:
- 화면 컴포넌트에 **색·폰트를 하드코딩하지 말고 토큰**(`var(--primary)` 등)을 씁니다.
  토큰만 쓰면 새 스킨이 자동으로 전 화면에 적용됩니다.
- `focus` 스킨은 `alwaysDark: true` — 다크모드 토글과 무관하게 항상 어둡고,
  설정 화면은 토글 대신 안내 문구를 보여줍니다.
- 웹폰트는 선택한 스킨의 것만 동적 로드하고, workbox 런타임 캐시로 오프라인 유지.
  **로드 실패해도 폴백 스택으로 정상 동작해야 합니다.**
- 글자 크기: `Settings.fontScale`이 `html`의 font-size(16px×배율)를 조절하므로
  **텍스트 크기는 rem 단위**를 써야 함께 커집니다. 반대로 앱 틀(내비 높이,
  카드 최대 폭, 안내 토스트)은 **px 고정**이라 확대해도 화면 밖으로 나가지 않습니다.
- **큰 화면 대응**: 768px 이상에서 본문 폭이 760px로 넓어지고 카드가 `min(52vh, 560px)`로
  커집니다. `.app`·`.navbar`·`.grade-bar`는 **폭을 함께 맞춰야** 어긋나지 않습니다.
  가로로 눕힌 휴대전화(높이 520px 이하)는 카드를 줄여 판정 버튼과 겹치지 않게 합니다.
- **모든 제스처에는 버튼 대체 경로가 있어야 합니다.** 스와이프 → 카드 아래 이전/다음 버튼,
  길게 누르기 → 카드 우상단 공유 버튼. 새 제스처를 넣으면 대체 경로도 함께 만드세요.
- **두 손가락 핀치 = 글자 크기 조절**(`src/lib/pinchFontZoom.ts`). 브라우저 기본
  확대는 `index.html` viewport(`user-scalable=no`) + touchmove preventDefault로
  끕니다. 핀치 중에는 저장 없이 미리보기만 하고 손을 뗄 때 `fontScale`을 저장합니다.

## 학습 상태 · SRS

상태 모델: `unseen → learning → confused → mastered`

| 판정 | 다음 복습 | 비고 |
|---|---|---|
| 모름 | 1일 | 오답 노트 등록, 연속 앎 초기화 |
| 헷갈림 | 3일 | 오답 노트 등록, 연속 앎 초기화 |
| 앎 | 7 → 30 → 90 → 180일 | 연속 3회 '앎'이면 오답 노트 졸업·헷갈림에서 학습중 회복 / 마지막 간격까지 통과하면 mastered |

암기 카드는 **좌우 스와이프 = 이전·다음 카드 이동**(임계값 90px, 판정은
하단 모름/헷갈림/앎 버튼으로만), **길게 누르기(0.5초) = 이미지 공유/저장
시트**입니다. 이 제스처들은 세로 스크롤·핀치 줌·탭 뒤집기와 공존하도록
만들었으니(가로 우세 판정, pointercancel 시 원위치, 드래그·길게 누르기
직후 click 억제, 10px 이상 이동하면 길게 누르기 취소) 수정 시 다섯 가지를
모두 확인하세요.

## 데이터 파이프라인

```bash
python3 scripts/enrich.py --stage ipa    # CMUdict 기반 IPA (오프라인)
python3 scripts/enrich.py --stage prep   # 배치 입력 생성
python3 scripts/enrich.py --stage llm    # Claude API로 뜻·예문·theme 생성 (.env 필요)
python3 scripts/enrich.py --stage merge  # cache → data/words_enriched.json
python3 scripts/assign_days.py           # Day 배정 (초등1–16/중고17–40/선택41–60)
python3 scripts/validate.py              # 검증 → validation_report.md
python3 scripts/build_chunks.py          # → public/data/ 청크 생성
```

스토어 스크린샷은 개발 서버를 띄운 뒤:
`node scripts/store_screenshots.mjs [phone|tablet7|tablet10]`

- `cache/batches/`에 결과가 있으면 건너뛰므로 **중단 후 재개 가능**.
  캐시가 이미 커밋되어 있어 API 키 없이도 `merge` 이후 단계는 재실행됩니다.
- ⚠️ **캐시는 단어 id로 병합됩니다.** `words.csv`에서 행을 추가·삭제하면
  이후 단어의 id가 밀리므로 `cache/batches/`와 `cache/ipa.json`의 id도
  같은 규칙으로 재번호해야 합니다 (과거 `math` 행 삭제 시 실제로 수행).
- `cache/GEN_SPEC.md`의 경로는 예전 작업 환경 기준 절대 경로라 참고용입니다.

## 안정성 규칙 (지키지 않으면 앱이 멈춥니다)

- **데이터 로딩은 반드시 `useAsync` + `LoadFailed`를 씁니다.** `loadDay`·`loadIndex` 등은
  실패 시 예외를 던집니다. `.then()`만 쓰면 화면이 '로딩 중…'에서 영원히 멈춥니다.
- **새 화면을 추가하면 실패 경로도 함께 확인합니다.** (fetch를 실패시켜 재시도가 되는지)
- **뒤로가기로 닫혀야 하는 오버레이**(시트·다이얼로그)는 `registerOverlay()`로 등록합니다.
  등록하지 않으면 안드로이드에서 뒤로가기 시 앱이 종료됩니다.
- **간격 반복 규칙을 바꾸면 `srs.test.ts`를 함께 고칩니다.** 간격 배열(`KNOW_INTERVALS`)
  길이를 줄이면 `confused → learning` 회복 분기가 다시 도달 불가능해집니다
  (졸업이 회복보다 먼저 일어나기 때문). 배열을 바꿀 때는 테스트로 확인하세요.

## 네이티브 전용 기능

앱(Capacitor)에서만 동작하고 웹에서는 조용히 비활성되는 기능들입니다.
**웹에서도 화면이 깨지지 않도록 항상 `Capacitor.isNativePlatform()`으로 분기**하고,
설정 화면에는 왜 못 쓰는지 안내를 남깁니다.

| 기능 | 모듈 | 웹에서는 |
|---|---|---|
| 복습 알림 | `reminder.ts` | 안내 문구만 표시 |
| 백업 공유 | `backup.ts` | 파일 다운로드로 대체 |
| 뒤로가기 | `backButton.ts` | 브라우저 뒤로가기가 처리 |
| 음성 | `tts.ts` | Web Speech API 사용 |

알림 문구의 복습 개수는 **앱을 열 때마다 다시 예약**해 최신으로 유지합니다(`App.tsx`).

## 주의사항

- **개발 서버 포트**: 미지정이라 vite 기본 **5173**을 씁니다. 사용자의 다른 앱
  ("오늘의 말씀")이 5173을 쓰므로 두 앱을 동시에 띄우면 충돌합니다.
  필요하면 `npm run dev -- --port 5190`.
- **배포**: main에 push하면 GitHub Actions가 웹을 자동 배포합니다 →
  https://haneul2819.github.io/vocab-3000/ . 플레이스토어용 안드로이드 앱은
  Capacitor 완전 내장형(`android/`) — Actions의 "Build Android App"으로 AAB를
  만듭니다(서명 키는 GitHub Secrets). 절차는 `README.md` 배포 섹션 참고.
  네이티브에서는 Web Speech가 없어 `tts.ts`가 네이티브 TTS 플러그인으로
  분기합니다. 아이콘 재생성: `python scripts/make_icon.py` 후
  `npx @capacitor/assets generate --android`.
- **배포 시 서비스 워커 충돌**: 이 앱은 PWA입니다. 서비스 워커 범위가 `/`인
  다른 PWA와 **같은 도메인에 올리지 마세요** (요청을 가로채 엉뚱한 화면이 뜸).
  별도 도메인이나 서브도메인을 씁니다.
- **학습 진도는 브라우저 IndexedDB에만** 저장되어 기기 간 이동이 안 됩니다.
  이동하려면 설정 → 데이터 내보내기/가져오기(JSON)를 씁니다.
- 데이터는 3,000단어(초등 800 / 중고공통 1,200 / 선택 1,000)입니다.
  문서 기준과 다른 3,001이 나오면 잘못된 것 — 경위는 `README.md` 참고.
