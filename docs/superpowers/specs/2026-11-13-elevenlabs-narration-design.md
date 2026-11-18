# Essay narration in the owner's voice (ElevenLabs): design

Date: 13 November 2026. Status: draft for the owner's approval. It changes the essay audio design of 27 October (`2026-10-27-essay-audio-design.md`), which chose Chatterbox's built-in voice and listed "the author's own or cloned voice" as a non-goal. On 13 November the owner reversed that and asked for every essay to be narrated in his own voice through ElevenLabs.

## Intent

Readers hear the essays in the owner's voice, with a short music sting at the start and end so the audio sounds produced, not generated. Everything else about the player stays as it is.

Why now: the 27 October test of a cloned voice used a quick, instant clone. ElevenLabs' Professional Voice Clone, trained on one to three hours of clean recording, is a different class of result. The owner wants the voice to be his.

## What the owner decided (13 November)

- **Provider:** ElevenLabs, Professional Voice Clone of the owner's voice.
- **Plan path:** Creator ($22 a month, $11 the first month) to record, train and test on three or four essays. If he likes it, Pro ($99) for one month to narrate the whole back catalogue, then back to Creator for weekly essays. Staying on Creator throughout is the cheaper fallback (about four months for the back catalogue).
- **Recording:** a USB microphone or the iPhone's Voice Memos on lossless, in a soft-furnished room, same set-up every session, reading his own essays. Training is done on elevenlabs.io (the app cannot make a Professional clone).
- **Music:** a short licensed sting under the title and at the close, never under the whole essay.

## Goals

1. Every published essay can be narrated in the owner's cloned voice, with the same accuracy check as today.
2. Switching an essay to the new voice is deliberate and budgeted: the pipeline never spends more credits than the owner set for the month.
3. New essays are narrated the evening before publish, by the Tuesday job, which is installed and watched by the scheduled-jobs watchdog.
4. The owner hears samples (with and without music) and approves the voice before any published essay changes.
5. Audio levels are consistent from essay to essay.

## Non-goals

- A choice of voices for readers.
- Music under the body of the essay.
- A podcast feed (still its own roadmap item).
- Narrating letters, Buffett pages or trackers.
- Recording or training the voice: the owner does that on elevenlabs.io.

## Anti-goals (failure even if it works)

- A credit bill the owner didn't expect. Every run states its character cost before it starts and stops at the monthly budget.
- Audio that says something different from the page (unchanged from the 27 October design).
- Music, or the voice clone's training audio, in the public git repo. A licensed track is not ours to redistribute.
- The site going live with the new voice on some essays and the old on others without the owner choosing it. Mixed narrators are only ever a result of the owner's own pacing.
- A player that misplaces its section markers because the intro shifted the timings.

## Constraints

- The pipeline stays where it is: Node CLI (`scripts/audio/audio.mjs`) driving Python (`narrate.py`) on the owner's Mac, audio uploaded to the VM over IAP, metadata JSON committed to the repo. The tests already inject `narrate` and `upload`, so a new engine slots in behind `narrate`.
- Secrets live in `.env` (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`), never in the repo or a plist. The Tuesday job reads them the same way the essay line reads its credentials.
- The repo is public, so nothing prints the key or the voice id in logs.
- British English in every owner-facing string; no em dashes; never the word "ledger".
- Work goes through small PRs with CI, and the site deploys after each merge that changes it.

## How it works

### Engine choice per essay

- A new setting `engine` in `scripts/audio/config.json`: `"chatterbox"` (today) or `"elevenlabs"`. The CLI also takes `--engine` for one-off runs and samples.
- **Two hashes, kept apart (assistant's call):**
  - The **text hash** stays exactly what the site build checks today (`scriptHash` of the narration script). The site never needs the engine, the voice id (a secret) or the music. Flipping `engine` therefore does not hide any player; every essay keeps playing its current audio until it is re-narrated.
  - "Stale for this engine" is worked out only in the CLI (`planWork`), by comparing the audio JSON's stored `engine`, `voice` (a short fingerprint, never the id) and `music` fields with `config.json`. Switching engine queues every essay for re-narration, but re-narrating stays an explicit, budgeted command.
  - The **file id** in the audio file name (`<slug>.<id8>.m4a`) is a hash of the text hash plus engine, voice fingerprint and music version, so a new narration of unchanged text always gets a new file name and never collides in the Cloudflare or browser cache.
- **Pronunciations in the hash (assistant's call):** the site picks the pronunciation set by the entry's own `engine` field when recomputing the text hash (Chatterbox respellings for Chatterbox entries; for ElevenLabs entries the text is hashed without respellings, since its fixes live in the ElevenLabs dictionary).

### The ElevenLabs engine

- Calls the text-to-speech API one paragraph at a time, not one sentence. Each request passes the previous and next paragraph as context so the voice carries across joins. Headings are their own short requests.
- Model: ElevenLabs' current highest-quality narration model on the owner's plan. Builder confirms the exact model id and output format against the docs at build time; record both in the audio JSON (as `engine` and `voice` are today).
- Output: the highest-quality format the plan allows (44.1 kHz PCM on Pro; on Creator, the best MP3 or PCM option available), converted to the same mono working format the pipeline uses today.
- `say_numbers` (a Chatterbox workaround) is skipped for ElevenLabs. The spoken-form rules in `src/lib/narration.mjs` stay, because they decide what is said, not how.
- Pronunciation: `pronunciations.json` becomes per engine. The current respellings ("Cap-ex", "ab-straction") were tuned for Chatterbox. ElevenLabs entries are kept as a pronunciation dictionary (alias rules) uploaded to ElevenLabs and referenced by id, so fixes don't distort the text.

### Accuracy check

- Whisper still transcribes every paragraph and compares it with the text (same `check.py`, same 0.85 threshold, applied per paragraph).
- On a miss: one retry only for ElevenLabs (credits cost money), then the essay fails as today and is listed with the paragraph that failed. Chatterbox keeps its three retries.

### Music

- One licensed sting, chosen by the owner, stored outside the repo (`~/Documents/s2n-audio/music/`), with its licence note alongside. Its file name and a short hash go in `config.json` as the music version.
- Layout: sting starts, the title is spoken over it with the music ducked, the music fades out before the first paragraph; at the close, a short tail after the last sentence. Builder picks exact timings within: intro music no longer than 8 seconds, ducked at least 15 dB under the voice.
- **What is spoken at the start and end (assistant's call; the owner hears it in the samples and can change it):** the essay title alone, as the first item of the narration script for ElevenLabs entries, spoken over the sting. No byline (the voice is his) and no spoken outro, only the music tail. The title counts in the Whisper check like any paragraph.
- **Mixing source:** always the raw WAV assembled from the engine's output, never a re-encode of an existing m4a.
- **Chapters:** the "Opening" chapter starts at 0 (over the sting); every later chapter is shifted by the measured intro length of that file. Peaks are computed on the final mix.
- **Existing audio:** loudness and music apply to audio made from now on. The 67 existing Chatterbox files are left as they are; they are replaced when each essay is re-narrated in the owner's voice. (This corrects an earlier line in this draft that said PR 1 would fix today's levels.)
- **Per-paragraph cache (assistant's call):** every paid paragraph is saved under `~/Documents/s2n-audio/cache/`, keyed on the paragraph text, voice, model, dictionary version and context. A re-run after a failure, or a re-narration after a small edit, pays only for paragraphs that changed.
- Mixing and loudness use ffmpeg (added to `setup.sh` and the Tuesday plist's PATH). The whole file is loudness-normalised to a podcast-style target (around -16 LUFS integrated, true peak below -1 dB). This also fixes the current audio, which has no normalisation.
- Section start times and the waveform peaks are computed on the final mixed file, so the player's markers and waveform line up with what is heard.

### Budget

- Before any ElevenLabs run, the CLI prints the characters it will send, per essay and in total, and the credits left this month (from ElevenLabs' subscription endpoint).
- A monthly budget in `config.json` (characters). The run refuses to start if the estimate exceeds what is left of the budget or of the plan, and says by how much. `--max-chars N` narrates as many stale essays as fit, oldest first, so the back catalogue can be spread over months on Creator.
- Retries count against the estimate (one retry per paragraph at most). Cached paragraphs cost nothing and are left out of the estimate.
- **What the budget is measured against (assistant's call):** both checks must pass. (1) The account's remaining credits, read from ElevenLabs before every run, which also counts the owner's own testing on elevenlabs.io. (2) A local spend log in `~/Documents/s2n-audio/spend.json` of what this pipeline sent, against the owner's monthly budget. The "month" follows the plan's renewal date reported by ElevenLabs, not the calendar month.
- If the chosen model bills more than one credit per character, the estimate uses the real rate. The builder confirms the rate, and that the Professional Voice Clone supports the chosen model, before building the guard.
- Secrets and state for scheduled runs: the Tuesday job runs in a temporary worktree, so it reads `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` from the main checkout's `.env` the same way the essay line does (`scripts/line/env.mjs`), and keeps the spend log and cache in `~/Documents/s2n-audio/`.

### Samples (the mockup)

- `node scripts/audio/audio.mjs sample <slug> --engine elevenlabs [--no-music]` narrates one essay to a local file without uploading or touching the repo.
- First step after the owner's voice is trained: three essays, each with and without music, played to the owner in the browser on the dev server's essay page (local file), same as reviewing drafts. Nothing changes on the live site until he approves.

### Player label

- Today the pill reads "AI-narrated" with the tooltip "Read aloud by a synthetic voice generated by AI from the published text." With a clone of the owner's voice, that tooltip is no longer accurate. **Owner to choose the wording** (see Open questions).
- The label follows each essay's own `engine` (assistant's call): Chatterbox essays keep today's wording, owner-voice essays get the new one, in all three places it appears (pill, tooltip and aria-label, and the slim bar). The catalogue will be mixed for a while, and neither label may claim something untrue about the other kind.

### Tuesday job and scheduling

- The Tuesday 19:00 audio job (`infra/co.signal-to-noise.essay-audio.plist`) is not installed on the Mac today. This build installs it, adds it to `ops/jobs.json` (weekly, Tuesday, Mac, heartbeat variable `HEARTBEAT_ESSAY_AUDIO`, through `runWithHeartbeat` with `--scheduled`) and adds its env line to the watchdog workflow.
- Its failure email (Zoho SMTP) is replaced by the watchdog issue, in line with the scheduled-jobs design's "no email alerts" rule.
- It narrates only the next day's essay plus any stale essays that fit the monthly budget, so the weekly bill stays predictable.
- **Publish-day flow is unchanged (assistant's call):** Tuesday's job prepares the next essay's audio locally; on Wednesday the publish process runs `publish` (upload, audio JSON, PR) as today. If the text changed after Tuesday, `publish` re-narrates only the changed paragraphs (cache) and states the cost first, and the budget counts both runs.

## Proposed PR split

1. **Loudness and music on the current engine.** Add ffmpeg, the music layer (behind a setting, off by default), loudness normalisation, chapter and peak offsets, the separate file id. Tests for the offsets and the mix order. Shippable on its own: new audio gets consistent levels.
2. **ElevenLabs engine behind the setting.** Paragraph requests with context, per-engine pronunciations, one-retry check, the hash salt, the budget guard and `sample`. Off by default; no essay changes.
3. **Samples for the owner.** Run once his voice is trained. Owner listens and approves the voice, the music and the label wording.
4. **Switch and back catalogue.** Set `engine: elevenlabs`, narrate the back catalogue within the budget (one Pro month, or spread on Creator), PRs of the audio JSON, deploy.
5. **Tuesday job installed and watched.** Registry entry, heartbeat, watchdog env line, plist installed, email alert removed.

## Left to the builder

- Exact ElevenLabs model id, output format and request-stitching parameters, confirmed against the live docs.
- Exact sting timings within the limits above.
- How the per-engine pronunciation file is laid out.
- Whether the budget guard reads credits before every essay or once per run.

## Open questions for the owner

1. **Label wording** for the player in his own cloned voice. Options: keep "AI-narrated" with a new tooltip such as "Read aloud by an AI voice trained on Himanshu's own voice"; or "Narrated in Himanshu's voice (AI)". A label that implies he recorded it himself would mislead listeners, so some honest wording is needed; which form is his call.
2. **The music track:** which library or track (Epidemic Sound, Artlist, a one-off licence, or ElevenLabs' own music generator if its commercial terms cover it).
3. **Monthly character budget** to start with (suggested: 100,000 characters on Creator, which covers weekly essays plus about 70,000 of back catalogue a month).
