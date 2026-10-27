#!/usr/bin/env bash
# Creates the narration venv. Safe to run twice.
set -euo pipefail
ROOT="${S2N_AUDIO_DIR:-$HOME/Documents/s2n-audio}"
mkdir -p "$ROOT"
[ -x "$ROOT/.venv/bin/python" ] || uv venv --python 3.11 "$ROOT/.venv"
uv pip install --python "$ROOT/.venv/bin/python" chatterbox-tts "setuptools<81" openai-whisper pytest
echo "venv ready: $ROOT/.venv"
