# Essay line — cover

Design and write the animated cover module for one essay, in the existing
system. Read `src/covers/_lib.ts` (header comments are the rules) and two
recent modules (`src/covers/the-ambidextrous-budget.ts`,
`src/covers/the-cognitive-supply-chain.ts`) before writing anything.

Rules
- Design from the argument of the essay (given in Input), not from the title.
  One abstract mechanism that embodies the essay's central move.
- Write `src/covers/<slug>.ts` exporting a `Cover` with `slug`, `fig`,
  `caption` in the form "NOUN, ADJECTIVE" (capitals, letters and spaces
  only — no hyphens or other punctuation), `still(alt)` built as a pure
  string (it runs in Node), `motion(svg)` returning Animations that loop
  over PERIOD and rest on the still (use `hold`), and `motionPx` = the largest
  displacement in canvas pixels; it must be at least 60.
- Cream on near-black only, using the palette constants. No text beyond the
  FIG mark and caption block.
- Write a `coverImageAlt` (British English, one paragraph, describes the
  still, ends with the caption in single quotes) to
  `_sources/staging-articles/<slug>/cover-alt.txt`.
- Do not touch any other file. Do not run the renderer; the stage does that.
