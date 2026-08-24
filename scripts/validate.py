#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
words_enriched.json 전체 검증 → validation_report.md 생성.

검사 항목:
  - 단어 수(3,001) 및 문서 기준(3,000)과의 차이, 중복 표제어
  - 필수 필드 누락(pos, meanings, examples, theme, ipa)
  - 예문 2개 존재, 예문에 단어(굴절형 포함) 실제 포함 여부
  - 예문 길이(등급별 제한 초과는 경고)
  - theme 고정 목록 준수, Day 배정 범위
"""
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from enrich import THEMES, MAX_EXAMPLE_WORDS, sentence_contains, ROOT, DATA


def main():
    path = DATA / "words_enriched.json"
    words = json.loads(path.read_text(encoding="utf-8"))
    errors, warnings = [], []

    # 1. 단어 수·중복
    dup = [w for w, n in Counter(x["word"].lower() for x in words).items() if n > 1]
    level_count = Counter(x["level"] for x in words)
    if dup:
        errors.append(f"중복 표제어: {dup}")

    # 2. 필드·예문 검사
    empty_meaning, missing_example, word_not_in_example = [], [], []
    bad_theme, missing_ipa, long_example, bad_day = [], [], [], []
    for x in words:
        w = x["word"]
        if not x.get("pos") or not x.get("meanings") or any(not m.get("ko") for m in x.get("meanings", [])):
            empty_meaning.append(w)
        exs = x.get("examples", [])
        if len(exs) != 2 or any(not e.get("en") or not e.get("ko") for e in exs):
            missing_example.append(w)
        for e in exs:
            en = e.get("en", "")
            if en and not sentence_contains(w, en):
                word_not_in_example.append(f"{w}: \"{en}\"")
            limit = MAX_EXAMPLE_WORDS[x["level"]]
            if en and len(en.split()) > limit + 3:
                long_example.append(f"{w}({x['level']}): {len(en.split())}단어")
        if x.get("theme") not in THEMES:
            bad_theme.append(w)
        if not x.get("ipa"):
            missing_ipa.append(w)
        if not (1 <= x.get("day", 0) <= 60):
            bad_day.append(w)

    for name, lst in [("뜻/품사 누락", empty_meaning), ("예문 부족/필드 누락", missing_example),
                      ("예문에 단어 미포함", word_not_in_example), ("theme 오류", bad_theme)]:
        if lst:
            errors.append(f"{name} ({len(lst)}건): {lst[:20]}")
    if missing_ipa:
        warnings.append(f"IPA 누락 ({len(missing_ipa)}건): {missing_ipa[:20]}")
    if long_example:
        warnings.append(f"예문 길이 초과(제한+3 초과) ({len(long_example)}건): {long_example[:10]}")
    if bad_day:
        warnings.append(f"Day 미배정/범위 밖 ({len(bad_day)}건)")

    theme_dist = Counter(x["theme"] for x in words)
    day_dist = Counter(x["day"] for x in words)

    lines = [
        "# 데이터 검증 보고서 (validation_report.md)", "",
        f"- 총 단어 수: **{len(words)}** (문서 기준 3,000 대비 +{len(words) - 3000})",
        f"  - 원본 `words.csv`가 실제 3,001단어를 수록하고 있으며 중복은 없음 → 전체 유지",
        f"- 등급 분포: 초등 {level_count['초등']} / 중고공통 {level_count['중고공통']} / 선택 {level_count['선택']}",
        f"- 중복 표제어: {'없음' if not dup else dup}", "",
        "## 오류", "",
    ]
    lines += [f"- {e}" for e in errors] or ["- 없음 ✅"]
    lines += ["", "## 경고", ""]
    lines += [f"- {w}" for w in warnings] or ["- 없음 ✅"]
    lines += ["", "## theme 분포", ""]
    lines += [f"- {t}: {theme_dist.get(t, 0)}" for t in THEMES]
    lines += ["", "## Day별 단어 수", ""]
    if day_dist and 0 not in day_dist:
        counts = sorted(set(day_dist.values()))
        lines.append(f"- Day 1–60 배정 완료, 하루 {counts[0]}~{counts[-1]}단어")
    else:
        lines.append(f"- 미배정 {day_dist.get(0, 0)}단어 (assign_days.py 실행 필요)")

    report = ROOT / "validation_report.md"
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"보고서 작성: {report}")
    print(f"오류 {len(errors)}건, 경고 {len(warnings)}건")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
