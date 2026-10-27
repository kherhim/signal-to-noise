#!/usr/bin/env python
"""Narrate a script JSON with Chatterbox, verify each sentence with Whisper.

Usage: python narrate.py <script.json> <out.m4a>
Input:  {"slug": str, "items": [{"kind": "heading"|"p"|..., "text": str, "sentences": [str]}]}
Stdout (one JSON line):
  {"ok": true, "duration": s, "chapters": [[title, s]], "peaks": [200 floats]}
  {"ok": false, "failed": [sentence, ...]}   (exit code 2)
All other output goes to stderr.
"""
import os
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import json
import subprocess
import sys
import tempfile

import numpy as np

from check import THRESHOLD, match_score

SR = 24000
GAP_SENTENCE, GAP_PARAGRAPH, GAP_HEADING = 0.25, 0.55, 0.8
RETRIES = 3
PEAKS = 200


def is_heading(item):
    return (item.get("kind") or "").lower() in ("h", "heading")


def silence(seconds):
    return np.zeros(int(SR * seconds), dtype=np.float32)


def main():
    script_path, out_path = sys.argv[1], sys.argv[2]
    script = json.load(open(script_path))
    items = script["items"]
    if not any(s.strip() for it in items for s in it.get("sentences", [])):
        print(json.dumps({"ok": False, "failed": [], "error": "empty script"}))
        sys.exit(2)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)

    real_stdout = sys.stdout
    sys.stdout = sys.stderr  # keep library chatter off the JSON channel

    import torch
    import torchaudio.functional as AF
    import whisper
    from chatterbox.tts import ChatterboxTTS

    tts = ChatterboxTTS.from_pretrained(device="mps")
    asr = whisper.load_model("base.en", device="cpu")

    def speak(sentence):
        wav = tts.generate(sentence, exaggeration=0.4, cfg_weight=0.5)
        return wav.squeeze(0).cpu().numpy().astype(np.float32)

    def hear(audio):
        a16 = AF.resample(torch.from_numpy(audio), tts.sr, 16000).numpy()
        return asr.transcribe(a16, language="en", fp16=False)["text"]

    first = next((i for i in items if i.get("sentences")), None)
    chunks, failed, t = [], [], 0.0
    chapters = [] if first is not None and is_heading(first) else [["Opening", 0.0]]

    def add(a):
        nonlocal t
        chunks.append(a)
        t += len(a) / SR

    for idx, item in enumerate(items):
        sentences = [s for s in item.get("sentences", []) if s.strip()]
        if not sentences:
            continue
        if is_heading(item):
            chapters.append([item["text"], round(t, 2)])
        for k, sent in enumerate(sentences):
            best, best_score = None, -1.0
            for attempt in range(1 + RETRIES):
                clip = speak(sent)
                score = match_score(sent, hear(clip))
                print(f"[{idx}.{k}] try {attempt + 1} score {score:.2f}", file=sys.stderr)
                if score > best_score:
                    best, best_score = clip, score
                if score >= THRESHOLD:
                    break
            if best_score < THRESHOLD:
                failed.append(sent)
            add(best)
            if k < len(sentences) - 1:
                add(silence(GAP_SENTENCE))
        nxt = next((n for n in items[idx + 1:] if n.get("sentences")), None)
        if nxt is not None:
            add(silence(GAP_HEADING if is_heading(nxt) else GAP_PARAGRAPH))

    if failed:
        real_stdout.write(json.dumps({"ok": False, "failed": failed}) + "\n")
        sys.exit(2)

    wav = np.concatenate(chunks)
    import soundfile as sf
    fd, tmp = tempfile.mkstemp(suffix=".wav", dir=os.path.dirname(os.path.abspath(out_path)))
    os.close(fd)
    try:
        sf.write(tmp, wav, SR)
        if os.path.exists(out_path):
            os.remove(out_path)
        try:
            subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000", tmp, out_path], check=True, stdout=sys.stderr)
        except Exception:
            if os.path.exists(out_path):
                os.remove(out_path)
            raise
    finally:
        os.remove(tmp)

    seg = max(1, len(wav) // PEAKS)
    peaks = [float(np.abs(wav[i * seg:(i + 1) * seg]).max()) if i * seg < len(wav) else 0.0 for i in range(PEAKS)]
    top = max(peaks) or 1.0
    peaks = [round(p / top, 3) for p in peaks]
    real_stdout.write(json.dumps({"ok": True, "duration": round(len(wav) / SR, 2), "chapters": chapters, "peaks": peaks}) + "\n")


if __name__ == "__main__":
    main()
