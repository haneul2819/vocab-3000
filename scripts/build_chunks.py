#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
빌드용 데이터 청크 생성 스크립트.

data/words_enriched.json + data/grammar.csv →
  public/data/index.json        : Day 메타데이터 + 경량 단어 색인(검색·진단용)
  public/data/days/day-NN.json  : Day별 전체 단어 데이터 (초기 로딩 경량화)
  public/data/grammar.json      : 문법 예문 (범주·level별)
  public/data/distractors.json  : 문제집 오답 선택지 풀 (level|품사별)

사용: python3 scripts/build_chunks.py
"""
import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "public" / "data"


def main():
    words = json.loads((DATA / "words_enriched.json").read_text(encoding="utf-8"))
    days_dir = OUT / "days"
    days_dir.mkdir(parents=True, exist_ok=True)

    # Day별 청크
    by_day = defaultdict(list)
    for w in words:
        by_day[w["day"]].append(w)
    day_meta = []
    for day in sorted(by_day):
        chunk = by_day[day]
        (days_dir / f"day-{day:02d}.json").write_text(
            json.dumps(chunk, ensure_ascii=False), encoding="utf-8")
        day_meta.append({"day": day, "level": chunk[0]["level"], "count": len(chunk)})

    # 경량 색인: 진단 테스트·검색·통계에 사용 (뜻은 첫 번째 하나만)
    index_words = [{
        "id": w["id"], "w": w["word"], "d": w["day"], "l": w["level"],
        "ko": (w["meanings"][0]["ko"][0] if w["meanings"] and w["meanings"][0]["ko"] else ""),
    } for w in words]
    (OUT / "index.json").write_text(json.dumps({
        "days": day_meta, "words": index_words,
    }, ensure_ascii=False), encoding="utf-8")

    # 오답 선택지 풀: 같은 level·같은 품사에서 뽑기 위한 사전
    pools = defaultdict(list)
    for w in words:
        for m in w["meanings"]:
            if m["ko"]:
                pools[f"{w['level']}|{m['pos']}"].append(
                    {"id": w["id"], "w": w["word"], "ko": m["ko"][0]})
    (OUT / "distractors.json").write_text(
        json.dumps(pools, ensure_ascii=False), encoding="utf-8")

    # 문법 데이터
    grammar = defaultdict(list)
    with open(DATA / "grammar.csv", encoding="utf-8-sig") as f:
        for i, row in enumerate(csv.DictReader(f), start=1):
            grammar[row["category"]].append(
                {"id": i, "sentence": row["sentence"].strip(), "level": row["level"].strip()})
    (OUT / "grammar.json").write_text(json.dumps(
        [{"category": c, "items": items} for c, items in grammar.items()],
        ensure_ascii=False), encoding="utf-8")

    print(f"청크 생성 완료: Day {len(day_meta)}개, 색인 {len(index_words)}단어, "
          f"문법 {sum(len(v) for v in grammar.values())}문장 → {OUT}")


if __name__ == "__main__":
    main()
