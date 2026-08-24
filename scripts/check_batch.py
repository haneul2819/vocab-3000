#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""배치 출력 파일 1개를 검사한다. 사용: python3 scripts/check_batch.py 1 [2 3 ...]"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from enrich import THEMES, word_forms, sentence_contains, CACHE

POS_SET = {"명사", "동사", "형용사", "부사", "대명사", "전치사", "접속사",
           "감탄사", "관사", "조동사", "한정사", "수사"}


def check(batch_no):
    in_path = CACHE / "input" / f"batch_{batch_no:04d}.input.json"
    out_path = CACHE / "batches" / f"batch_{batch_no:04d}.json"
    if not out_path.exists():
        return [f"batch {batch_no}: 출력 파일 없음"]
    try:
        inp = json.loads(in_path.read_text(encoding="utf-8"))
        out = json.loads(out_path.read_text(encoding="utf-8"))
    except Exception as e:
        return [f"batch {batch_no}: JSON 파싱 실패 — {e}"]
    errs = []
    if len(inp) != len(out):
        errs.append(f"batch {batch_no}: 개수 불일치 입력 {len(inp)} vs 출력 {len(out)}")
    by_id = {e.get("id"): e for e in out}
    for i in inp:
        e = by_id.get(i["id"])
        w = i["word"]
        if not e:
            errs.append(f"{w}(id {i['id']}): 출력 누락")
            continue
        if e.get("word") != w:
            errs.append(f"id {i['id']}: word 불일치 '{e.get('word')}' != '{w}'")
        pos = e.get("pos") or []
        if not pos or not set(pos) <= POS_SET:
            errs.append(f"{w}: pos 오류 {pos}")
        ms = e.get("meanings") or []
        if not ms or any(not m.get("ko") for m in ms):
            errs.append(f"{w}: meanings 비었음")
        exs = e.get("examples") or []
        if len(exs) != 2:
            errs.append(f"{w}: 예문 {len(exs)}개 (2개 필요)")
        for x in exs:
            if not x.get("en") or not x.get("ko"):
                errs.append(f"{w}: 예문 en/ko 누락")
            elif not sentence_contains(w, x["en"]):
                errs.append(f"{w}: 예문에 단어 없음 — \"{x['en']}\"")
        if e.get("theme") not in THEMES:
            errs.append(f"{w}: theme 오류 '{e.get('theme')}'")
        if i.get("fn_example") and exs and exs[0].get("en", "").strip() != i["fn_example"].strip():
            errs.append(f"{w}: fn_example 미채택 (경고)")
    return errs


if __name__ == "__main__":
    total_errs = 0
    for arg in sys.argv[1:]:
        errs = check(int(arg))
        for e in errs:
            print("  ", e)
        status = "OK" if not errs else f"오류 {len(errs)}건"
        print(f"batch {arg}: {status}")
        total_errs += len(errs)
    sys.exit(1 if total_errs else 0)
