# 기본 어휘 3000 단어장 · 문제집 (PWA)

교육부 고시 제2022-33호 [별책 14] 영어과 교육과정 부록의 **기본 어휘 3,000**을
기반으로 한 초·중·고 학생용 영단어 암기 + 문제집 앱입니다.
서버 없이 완전 오프라인으로 동작하는 PWA(설치형 웹앱)이며 무료입니다.

> 단어 목록: 교육부 고시 제2022-33호 영어과 교육과정 기본 어휘.
> 뜻·예문·음성은 본 앱에서 자체 제작. **교육부 공식 앱이 아닙니다.**

## 주요 기능

- **홈**: 오늘 학습 Day 카드(원형 진행률·복습 대기 수), 트랙(초등/중·고 공통/심화) 선택, 진단 테스트 진입
- **진단 테스트**: 등급별 10문항(총 30문항) → 정답률로 시작 Day 추천
- **암기 카드**: 앞면(단어·IPA·발음), 뒷면(품사별 뜻·예문 2개·파생어)
  - 모드: 학습(뒷면 자동 공개) / 셀프 테스트(탭해서 뒤집기) / 오답 노트(3연속 '앎'이면 졸업) / 듣기(화면 어둡게, 단어→뜻→예문 자동 재생, 간격·반복 설정)
  - 토글: 영→한 / 한→영, 셔플, 자동 발음
  - 카드를 **오른쪽으로 스와이프**하면 ‘앎’으로 판정 (세로 스크롤·핀치 줌·탭 뒤집기와 공존)
- **문제집**: 단어→뜻·뜻→단어 4지선다, 철자 입력, 듣고 쓰기, 예문 빈칸, 파생어 문제.
  오답 선택지는 같은 등급·같은 품사에서 출제
- **문법**: 언어 형식 예문 312개를 39개 범주·수준(초/중/고)별 열람 + 빈칸/어순 배열 문제
- **복습**: 간격 반복(모름→1일 / 헷갈림→3일 / 앎→7일→30일) 자동 큐,
  7일마다 누적 테스트 100문항(80% 미만이면 재시험 안내)
- **통계**: Day별 학습·정답률, 단어 상태(미학습/학습중/헷갈림/완료) 분포, 연속 학습일
- **설정**: 스킨 5종(클래식/미니멀 에디토리얼/플레이풀 팝/다크 딥포커스/소프트 페이퍼),
  글자 크기(작게~아주 크게, 핀치 줌도 항상 허용), 다크모드, 듣기 옵션, 진도 초기화, 데이터 내보내기/가져오기(JSON)
  - 스킨은 CSS 토큰(`[data-skin]`)으로 전환되며 선택은 IndexedDB에 저장.
    스킨별 웹폰트(Google Fonts)는 선택 시에만 로드되고 런타임 캐시로 오프라인에서도 유지.
    ‘다크 딥포커스’는 항상 다크로 표시되어 다크모드 토글과 무관.

기술 스택: Vite + React + TypeScript, vite-plugin-pwa, IndexedDB(idb), Web Speech API.
단어 상태 모델: `unseen → learning → confused → mastered`.

## 데이터 출처와 구조

| 파일 | 내용 |
|---|---|
| `data/words.csv` | 원본 3,000단어 (`word, stars, level, alt_spelling, derived`) |
| `data/functions.csv` | 의사소통 기능 예시문 545개 |
| `data/grammar.csv` | 언어 형식 예문 (39개 범주, 초/중/고) |
| `data/words_enriched.json` | 보강 완료 데이터 (IPA·품사·뜻·예문·theme·Day) |
| `cache/batches/` | 50단어 단위 보강 배치 결과 (재생성 시 캐시) |

원본 데이터는 공공 고시 자료(저작권 제한 없음)입니다. 최초 추출본에는
원문 한 항목(`mathematics* / maths* / math*`)이 줄바꿈 때문에 `math` 별도
행으로 분리되어 3,001단어로 들어 있었고, `math` 행을 삭제하고 mathematics의
`alt_spelling`에 `maths / math`를 병합해 문서 기준과 같은 3,000단어(초등
800 / 중고공통 1,200 / 선택 1,000)로 교정했습니다. 중복은 없습니다
(검증 결과: `validation_report.md`).

## 데이터 재생성 방법 (`scripts/enrich.py`)

뜻·예문 등을 다시 생성하려면 Anthropic API 키가 필요합니다.

```bash
pip install cmudict anthropic
echo "ANTHROPIC_API_KEY=sk-..." > .env   # 키는 코드에 넣지 않는다

python3 scripts/enrich.py --stage ipa    # CMUdict 기반 IPA (오프라인)
python3 scripts/enrich.py --stage prep   # 배치 입력 생성 (functions.csv 예문 매칭)
python3 scripts/enrich.py --stage llm    # Claude(sonnet)로 뜻·예문·theme 생성
python3 scripts/enrich.py --stage merge  # cache → data/words_enriched.json 병합

python3 scripts/assign_days.py           # Day 배정 (초등 1–16 / 중고 17–40 / 선택 41–60)
python3 scripts/validate.py              # 검증 → validation_report.md
python3 scripts/build_chunks.py          # Day별 청크 → public/data/
```

- `llm` 단계는 50단어 배치로 `cache/batches/`에 저장되며, 중단 후 재실행하면
  이어서 진행됩니다. 특정 배치만 다시 만들려면 `--batch N`.
- 배치 1개 검사: `python3 scripts/check_batch.py N`
- 이 저장소의 현재 데이터는 API 대신 Claude Code가 같은 규격
  (`cache/GEN_SPEC.md`)으로 직접 배치를 작성해 저장한 것입니다.

## 개발·빌드

```bash
npm install
npm run dev       # 개발 서버
npm run build     # 타입 검사 + 프로덕션 빌드 (dist/)
npm run preview   # 빌드 미리보기
```

데이터는 빌드 시 `public/data/`의 Day별 청크(60개)로 나뉘어 필요할 때만
로드되므로 초기 로딩이 가볍고, 서비스 워커가 전부 프리캐시해 오프라인에서도
동작합니다.

## 배포

### Vercel

```bash
npm i -g vercel
vercel --cwd vocab-app   # 또는 vocab-app 디렉터리에서 vercel
```

- Framework Preset: **Vite** / Build Command: `npm run build` / Output: `dist`

### Firebase Hosting

```bash
npm i -g firebase-tools
firebase login
firebase init hosting    # public 디렉터리를 dist 로 지정, SPA rewrite는 불필요(해시 라우팅)
npm run build
firebase deploy
```

## 라이선스·고지

- 단어 목록·예시문 원본: 교육부 고시 제2022-33호 (공공 고시 자료)
- 뜻풀이·예문·발음 기호(CMUdict 변환)·음성(Web Speech API)은 본 앱 자체 제작
- 본 앱은 교육부와 무관한 개인 학습용 무료 앱입니다
