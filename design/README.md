# 디자인 시안 원본 (스킨 4종)

앱 스킨의 출처가 된 시안 원본입니다. 각 `.dc.html`은 독립 아트보드 한 장이고,
`canvas.json`이 배치·설명 메모를 담습니다.

| 파일 | 화면 | 대응 스킨 (`Settings` → 화면 → 스킨) |
|---|---|---|
| `Main.dc.html` / `MinimalCard.dc.html` | 홈 / 암기 카드 | 미니멀 에디토리얼 (`minimal`) |
| `PlayfulHome.dc.html` / `PlayfulCard.dc.html` | 홈 / 암기 카드 | 플레이풀 팝 (`pop`) |
| `DarkHome.dc.html` / `DarkCard.dc.html` | 홈 / 암기 카드 | 다크 딥포커스 (`focus`) |
| `PaperHome.dc.html` / `PaperCard.dc.html` | 홈 / 암기 카드 | 소프트 페이퍼 (`paper`) |

실제 앱에 적용된 색·폰트 토큰은 `src/styles.css`의 `[data-skin='...']` 블록,
스킨 목록·설명은 `src/lib/types.ts`의 `SKINS`에 있습니다.
시안을 고치면 두 곳의 토큰도 함께 맞춰 주세요.

## 브라우저에서 열어보기

`.dc.html`은 Claude Design 캔버스용 포맷이라 그대로 열면 렌더링되지 않습니다.
시안을 다시 보려면 Claude Code에서 `/design`으로 재구성하거나,
이미 게시된 캔버스를 확인하세요:
https://claude.ai/code/artifact/ff5048d9-4814-4730-9ab7-efd890f30319
