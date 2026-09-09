---
name: essay-line-monday
description: The attended Monday session — health line, readout, peg board, then the LinkedIn edition and native post in Chrome with the owner watching. Trigger when the user says "Monday".
---
1. Health: tail ~/Library/Logs/signal2noise-*.log; report last run and last success of essay-line, metrics, substack-mirror; list any state.json with last_error or hold.
2. Readout: run `node scripts/metrics-pull.mjs --linkedin`; pull LinkedIn figures via the Chrome extension for every post in distribution/metrics/linkedin-posts.json with an activity id; fill the LEARNING-LOG week entry; commit.
3. Peg board: show distribution/line/peg-board.md; ask which native_post items to use.
4. Edition: draft the LinkedIn newsletter edition for the most recently published essay (distribution/linkedin-newsletter/), topical intro from the peg board, run the gate on it (`node scripts/line/gate.mjs`), then publish it in Chrome with the owner confirming.
5. Native post: number in the hook; gate it; schedule for 08:00 UK next Monday in Chrome; record its activity id in linkedin-posts.json.
6. British English everywhere; never Axi.
