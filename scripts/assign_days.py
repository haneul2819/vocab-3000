#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
단계 B — Day 배정 스크립트.

트랙: 초등(Day 1–16) → 중고공통(Day 17–40) → 선택(Day 41–60), 하루 약 50단어.

배정 원칙:
  - 알파벳순 그대로 쓰지 않고 theme 그룹을 라운드로빈으로 섞어
    하루 안에 다양한 첫 글자·주제·품사가 오도록 배분
  - 파생어(derived)가 있는 단어는 각 theme 그룹 안에서 균등 간격으로
    끼워 넣어 특정 Day에 몰리지 않게 분산
  - 난수 없이 결정적(deterministic)으로 동작 → 재실행해도 같은 결과

사용: python3 scripts/assign_days.py
"""
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# 등급별 Day 범위
TRACKS = [("초등", 1, 16), ("중고공통", 17, 40), ("선택", 41, 60)]


def interleave_derived(group):
    """derived 보유 단어를 그룹 안에서 균등 간격으로 재배치한다."""
    plain = [w for w in group if not w["derived"]]
    withd = [w for w in group if w["derived"]]
    if not withd:
        return plain
    result = []
    step = max(1, (len(plain) + len(withd)) // len(withd))
    di = 0
    for i, w in enumerate(plain):
        result.append(w)
        if (i + 1) % step == 0 and di < len(withd):
            result.append(withd[di])
            di += 1
    result.extend(withd[di:])
    return result


def assign_track(words, day_from, day_to):
    """한 등급의 단어를 theme 라운드로빈으로 Day에 배정한다."""
    n_days = day_to - day_from + 1
    groups = defaultdict(list)
    for w in words:
        groups[w["theme"] or "추상"].append(w)
    # theme 그룹별 알파벳순 정렬 후 derived 균등 재배치
    ordered_groups = [interleave_derived(sorted(g, key=lambda x: x["word"].lower()))
                      for _, g in sorted(groups.items())]
    # 라운드로빈으로 전역 시퀀스 생성 → 인접 단어의 theme·첫 글자가 계속 바뀜
    seq = []
    idx = [0] * len(ordered_groups)
    while len(seq) < len(words):
        for gi, g in enumerate(ordered_groups):
            if idx[gi] < len(g):
                seq.append(g[idx[gi]])
                idx[gi] += 1
    # 순서대로 Day 버킷에 균등 분할 (앞 Day부터 채우되 나머지는 마지막 Day에)
    base, extra = divmod(len(seq), n_days)
    pos = 0
    for d in range(n_days):
        size = base + (1 if d >= n_days - extra else 0)
        for w in seq[pos:pos + size]:
            w["day"] = day_from + d
        pos += size


def main():
    path = DATA / "words_enriched.json"
    words = json.loads(path.read_text(encoding="utf-8"))
    by_level = defaultdict(list)
    for w in words:
        by_level[w["level"]].append(w)
    for level, day_from, day_to in TRACKS:
        assign_track(by_level[level], day_from, day_to)
        days = defaultdict(int)
        for w in by_level[level]:
            days[w["day"]] += 1
        sizes = sorted(days.values())
        print(f"{level}: Day {day_from}–{day_to}, 하루 {sizes[0]}~{sizes[-1]}단어")
    path.write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Day 배정 완료 → {path}")


if __name__ == "__main__":
    main()
