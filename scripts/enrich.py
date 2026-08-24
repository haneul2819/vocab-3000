#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
교육부 기본 어휘 3,000 데이터 보강 스크립트

words.csv → data/words_enriched.json 생성 파이프라인.

단계(stage):
  ipa    : CMUdict 기반 미국식 IPA 생성 (실패 시 Free Dictionary API 조회,
           그래도 없으면 missing_ipa.txt 기록)
  prep   : LLM 배치 입력 파일 생성 (functions.csv 예문 매칭 포함)
  llm    : Anthropic API로 뜻·품사·예문·theme 생성 (50단어 배치, 캐시·재시도)
  merge  : 캐시 병합 → data/words_enriched.json

사용 예:
  python scripts/enrich.py                 # 전체 실행
  python scripts/enrich.py --stage ipa     # 특정 단계만
  python scripts/enrich.py --stage llm --batch 3   # 특정 배치만 재실행

API 키는 .env 파일의 ANTHROPIC_API_KEY 또는 환경 변수에서 읽는다.
중단 후 재실행하면 cache/에 저장된 배치는 건너뛰므로 이어서 진행된다.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = ROOT / "cache"
BATCH_SIZE = 50
LLM_MODEL = "claude-sonnet-5"  # 작업 지시서 기준 sonnet 계열

# 주제 태그 고정 목록 (20개)
THEMES = [
    "가족", "학교", "감정", "음식", "자연", "시간", "장소", "신체", "직업", "과학",
    "사회", "추상", "일상", "여가", "교통", "동물", "사물", "수량", "행동", "소통",
]

# 등급별 예문 최대 단어 수
MAX_EXAMPLE_WORDS = {"초등": 6, "중고공통": 12, "선택": 15}

# ---------------------------------------------------------------------------
# 공통 유틸
# ---------------------------------------------------------------------------

def load_env():
    """루트의 .env 파일을 환경 변수로 로드한다(이미 있는 값은 유지)."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_words():
    """words.csv를 읽어 id를 부여한 dict 리스트로 반환한다."""
    rows = []
    with open(DATA / "words.csv", encoding="utf-8-sig") as f:
        for i, row in enumerate(csv.DictReader(f), start=1):
            rows.append({
                "id": i,
                "word": row["word"].strip(),
                "stars": row["stars"].strip(),
                "level": row["level"].strip(),
                "alt_spelling": row["alt_spelling"].strip(),
                "derived": [d.strip() for d in row["derived"].split(";") if d.strip()],
            })
    return rows


def word_forms(word):
    """단어의 굴절형 후보(원형, 복수, 과거, 진행형 등)를 소문자로 반환한다."""
    w = word.lower()
    forms = {w}
    forms.add(w + "s")
    forms.add(w + "es")
    forms.add(w + "ed")
    forms.add(w + "ing")
    if w.endswith("e"):
        forms.add(w + "d")          # love → loved (e로 끝날 때만 +d, car→card 오탐 방지)
        forms.add(w[:-1] + "ing")   # make → making
        forms.add(w[:-1] + "ed")
    if w.endswith("y") and len(w) > 2 and w[-2] not in "aeiou":
        forms.add(w[:-1] + "ies")   # study → studies
        forms.add(w[:-1] + "ied")
        forms.add(w[:-1] + "ier")
        forms.add(w[:-1] + "iest")
    if len(w) >= 3 and w[-1] not in "aeiouwxy" and w[-2] in "aeiou" and w[-3] not in "aeiou":
        forms.add(w + w[-1] + "ing")  # run → running
        forms.add(w + w[-1] + "ed")
    forms.add(w + "er")
    forms.add(w + "est")
    return forms


def sentence_contains(word, sentence):
    """문장에 단어(굴절형 포함)가 실제 단어 단위로 포함되는지 검사한다."""
    tokens = set(re.findall(r"[a-zA-Z']+", sentence.lower()))
    tokens |= {t.strip("'") for t in tokens}
    # 하이픈 복합어(twenty-first 등)도 하나의 토큰으로 인식하도록 추가
    tokens |= set(re.findall(r"[a-zA-Z']+(?:-[a-zA-Z']+)*", sentence.lower()))
    return bool(word_forms(word) & tokens)


# ---------------------------------------------------------------------------
# 단계 1: IPA (CMUdict → 실패 시 Free Dictionary API)
# ---------------------------------------------------------------------------

# ARPABET → 미국식 IPA 대응표
ARPA_IPA = {
    "AA": "ɑ", "AE": "æ", "AH": "ʌ", "AO": "ɔ", "AW": "aʊ", "AY": "aɪ",
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "EH": "ɛ", "ER": "ɝ",
    "EY": "eɪ", "F": "f", "G": "ɡ", "HH": "h", "IH": "ɪ", "IY": "i",
    "JH": "dʒ", "K": "k", "L": "l", "M": "m", "N": "n", "NG": "ŋ",
    "OW": "oʊ", "OY": "ɔɪ", "P": "p", "R": "r", "S": "s", "SH": "ʃ",
    "T": "t", "TH": "θ", "UH": "ʊ", "UW": "u", "V": "v", "W": "w",
    "Y": "j", "Z": "z", "ZH": "ʒ",
}


def arpabet_to_ipa(phones):
    """CMUdict 발음(ARPABET 목록)을 IPA 문자열로 변환한다."""
    out = []
    for p in phones:
        stress = ""
        base = p
        if p and p[-1].isdigit():
            base, num = p[:-1], p[-1]
            if num == "1":
                stress = "ˈ"
            elif num == "2":
                stress = "ˌ"
        ipa = ARPA_IPA.get(base, "")
        if base == "AH" and p.endswith("0"):
            ipa = "ə"  # 무강세 AH는 슈와
        if base == "ER" and p.endswith("0"):
            ipa = "ɚ"
        out.append(stress + ipa)
    return "".join(out)


def fetch_ipa_from_api(word):
    """Free Dictionary API에서 미국식 발음 기호를 조회한다."""
    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(word)}"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        for entry in data:
            for ph in entry.get("phonetics", []):
                text = ph.get("text", "")
                if text:
                    return text.strip("/")
    except Exception:
        pass
    return ""


def stage_ipa(words):
    """전 단어의 IPA를 생성해 cache/ipa.json에 저장한다."""
    import cmudict
    cmu = cmudict.dict()
    ipa_path = CACHE / "ipa.json"
    ipa_map = json.loads(ipa_path.read_text(encoding="utf-8")) if ipa_path.exists() else {}
    missing = []
    for i, w in enumerate(words):
        word = w["word"]
        if ipa_map.get(word):
            continue
        key = word.lower()
        phones = cmu.get(key)
        if phones:
            ipa_map[word] = "/" + arpabet_to_ipa(phones[0]) + "/"
        else:
            # 복합어(공백 포함)는 단어별 변환 후 이어 붙인다
            parts = key.split()
            if len(parts) > 1 and all(cmu.get(p) for p in parts):
                ipa_map[word] = "/" + " ".join(arpabet_to_ipa(cmu[p][0]) for p in parts) + "/"
            else:
                api_ipa = fetch_ipa_from_api(word)
                if api_ipa:
                    ipa_map[word] = "/" + api_ipa + "/"
                    time.sleep(0.4)  # API 과호출 방지
                else:
                    ipa_map[word] = ""
                    missing.append(word)
        if (i + 1) % 500 == 0:
            print(f"  IPA {i + 1}/{len(words)}")
            ipa_path.write_text(json.dumps(ipa_map, ensure_ascii=False, indent=1), encoding="utf-8")
    ipa_path.write_text(json.dumps(ipa_map, ensure_ascii=False, indent=1), encoding="utf-8")
    (ROOT / "missing_ipa.txt").write_text("\n".join(missing), encoding="utf-8")
    print(f"IPA 완료: {len(ipa_map) - len(missing)}/{len(words)}개, 누락 {len(missing)}개 → missing_ipa.txt")


# ---------------------------------------------------------------------------
# 단계 2: 배치 입력 준비 (functions.csv 예문 매칭)
# ---------------------------------------------------------------------------

def load_function_sentences():
    """functions.csv에서 자리표시자 없는 문장 목록을 반환한다."""
    sentences = []
    with open(DATA / "functions.csv", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            s = row["sentence"].strip()
            # 자리표시자(..., X/Y 등)가 있는 문장은 예문으로 쓰지 않는다
            if "..." in s or "…" in s or re.search(r"\bX\b|\bY\b|/", s):
                continue
            sentences.append(s)
    return sentences


def stage_prep(words):
    """단어별 배치 입력 파일(cache/input/batch_NNNN.input.json)을 만든다."""
    fn_sentences = load_function_sentences()
    in_dir = CACHE / "input"
    in_dir.mkdir(parents=True, exist_ok=True)
    for b in range(0, len(words), BATCH_SIZE):
        batch_no = b // BATCH_SIZE + 1
        entries = []
        for w in words[b:b + BATCH_SIZE]:
            limit = MAX_EXAMPLE_WORDS[w["level"]]
            fn_example = ""
            for s in fn_sentences:
                # 등급 제한보다 3단어 이상 길면 제외하고 짧은 문장을 우선 채택
                if len(s.split()) <= limit + 3 and sentence_contains(w["word"], s):
                    fn_example = s
                    break
            entries.append({
                "id": w["id"], "word": w["word"], "level": w["level"],
                "derived": w["derived"], "max_example_words": limit,
                "fn_example": fn_example,
            })
        path = in_dir / f"batch_{batch_no:04d}.input.json"
        path.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    total = (len(words) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"배치 입력 {total}개 생성 완료 → {in_dir}")


# ---------------------------------------------------------------------------
# 단계 3: LLM 생성 (Anthropic API)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """당신은 한국 초·중·고 학생용 영어 단어장 데이터를 만드는 전문가입니다.
입력으로 단어 목록(JSON)을 받으면, 각 단어에 대해 아래 스키마의 JSON 배열만 출력하세요.
설명·마크다운·코드펜스 없이 순수 JSON 배열만 출력합니다.

스키마(단어별):
{
  "id": 입력과 동일한 정수,
  "word": 입력과 동일한 문자열,
  "pos": ["명사", ...],            // 해당 단어의 주요 품사 (1~3개). 명사/동사/형용사/부사/대명사/전치사/접속사/감탄사/관사/조동사/한정사/수사 중 선택
  "meanings": [ {"pos": "명사", "ko": ["뜻1", "뜻2"]} ],  // 품사별 1~3개, 학생용 간결한 한국어 뜻
  "examples": [ {"en": "...", "ko": "..."} ],  // 예문 정확히 2개, 한국어 번역 포함
  "theme": "가족"                   // 아래 고정 목록에서 1개
}

theme 고정 목록: 가족, 학교, 감정, 음식, 자연, 시간, 장소, 신체, 직업, 과학, 사회, 추상, 일상, 여가, 교통, 동물, 사물, 수량, 행동, 소통

예문 규칙:
1. 각 예문의 en에는 해당 단어(굴절형 포함: 복수형, 과거형, -ing 등)가 반드시 들어가야 합니다.
2. 입력의 max_example_words 이하 단어 수의 쉬운 문장으로 작성합니다. 초등(6단어)은 특히 짧고 쉽게.
3. 입력에 fn_example(교육과정 예시문)이 있으면 그 문장을 첫 번째 예문의 en으로 그대로 쓰고 자연스러운 한국어 번역을 붙입니다. 두 번째 예문만 새로 만듭니다.
4. 두 예문은 서로 다른 상황을 담고, 학생이 이해하기 쉬운 일상적인 내용으로 합니다.
5. 한국어 번역은 자연스러운 구어체(존댓말 불필요, 평서형)로 합니다."""


def call_llm(client, entries):
    """한 배치를 API로 보내 JSON 배열을 반환한다. 실패 시 예외."""
    user_msg = json.dumps(entries, ensure_ascii=False)
    with client.messages.stream(
        model=LLM_MODEL,
        max_tokens=32000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    ) as stream:
        response = stream.get_final_message()
    text = "".join(b.text for b in response.content if b.type == "text").strip()
    # 모델이 코드펜스를 붙였을 경우 제거
    text = re.sub(r"^```(json)?\s*|\s*```$", "", text)
    return json.loads(text)


def stage_llm(words, only_batch=None):
    """캐시에 없는 배치를 API로 생성한다. 재실행 시 이어서 진행된다."""
    try:
        import anthropic
    except ImportError:
        sys.exit("anthropic 패키지가 필요합니다: pip install anthropic")
    load_env()
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        sys.exit("ANTHROPIC_API_KEY가 .env 또는 환경 변수에 없습니다.")
    client = anthropic.Anthropic()
    out_dir = CACHE / "batches"
    out_dir.mkdir(parents=True, exist_ok=True)
    total = (len(words) + BATCH_SIZE - 1) // BATCH_SIZE
    for batch_no in range(1, total + 1):
        if only_batch and batch_no != only_batch:
            continue
        out_path = out_dir / f"batch_{batch_no:04d}.json"
        if out_path.exists() and not only_batch:
            continue  # 캐시 존재 → 건너뜀 (중단 후 재개)
        in_path = CACHE / "input" / f"batch_{batch_no:04d}.input.json"
        entries = json.loads(in_path.read_text(encoding="utf-8"))
        for attempt in range(1, 4):  # 배치당 최대 3회 재시도
            try:
                result = call_llm(client, entries)
                assert isinstance(result, list) and len(result) == len(entries), "결과 개수 불일치"
                out_path.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
                print(f"  배치 {batch_no}/{total} 완료 ({len(result)}단어)")
                break
            except Exception as e:
                print(f"  배치 {batch_no} 시도 {attempt} 실패: {e}")
                time.sleep(2 ** attempt)
        else:
            print(f"  !! 배치 {batch_no} 최종 실패 — 나중에 --batch {batch_no}로 재시도하세요")


# ---------------------------------------------------------------------------
# 단계 4: 병합 → words_enriched.json
# ---------------------------------------------------------------------------

def stage_merge(words):
    """IPA·LLM 캐시를 병합해 data/words_enriched.json을 만든다."""
    ipa_path = CACHE / "ipa.json"
    ipa_map = json.loads(ipa_path.read_text(encoding="utf-8")) if ipa_path.exists() else {}
    gen = {}
    for p in sorted((CACHE / "batches").glob("batch_*.json")):
        for e in json.loads(p.read_text(encoding="utf-8")):
            gen[e["id"]] = e
    merged = []
    missing_gen = []
    for w in words:
        g = gen.get(w["id"], {})
        if not g:
            missing_gen.append(w["word"])
        merged.append({
            "id": w["id"],
            "word": w["word"],
            "level": w["level"],
            "stars": w["stars"],
            "alt_spelling": w["alt_spelling"],
            "derived": w["derived"],
            "ipa": ipa_map.get(w["word"], ""),
            "pos": g.get("pos", []),
            "meanings": g.get("meanings", []),
            "examples": g.get("examples", []),
            "theme": g.get("theme", ""),
            "day": 0,  # 단계 B(assign_days.py)에서 배정
        })
    out = DATA / "words_enriched.json"
    out.write_text(json.dumps(merged, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"병합 완료: {len(merged)}단어 → {out}")
    if missing_gen:
        print(f"  !! LLM 데이터 누락 {len(missing_gen)}개: {missing_gen[:10]} ...")


# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="단어 데이터 보강 파이프라인")
    parser.add_argument("--stage", choices=["ipa", "prep", "llm", "merge"], help="특정 단계만 실행")
    parser.add_argument("--batch", type=int, help="llm 단계에서 특정 배치 번호만 재실행")
    args = parser.parse_args()

    CACHE.mkdir(exist_ok=True)
    words = load_words()
    print(f"단어 {len(words)}개 로드")

    stages = [args.stage] if args.stage else ["ipa", "prep", "llm", "merge"]
    if "ipa" in stages:
        stage_ipa(words)
    if "prep" in stages:
        stage_prep(words)
    if "llm" in stages:
        stage_llm(words, only_batch=args.batch)
    if "merge" in stages:
        stage_merge(words)


if __name__ == "__main__":
    main()
