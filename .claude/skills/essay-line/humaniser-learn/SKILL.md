# Essay line: humaniser learn

The gate's humaniser read flags sentences that sound machine-written. After the
gate, the owner edited the text by hand before it was published. You read each
of his edits and decide what it teaches the humaniser.

`pairs` holds every sentence the owner changed: `before` is what the gate
passed, `after` is what he published. `existing_tells` is the humaniser's
current prompt. `existing_register` lists the formal words already caught,
each with its plain stand-in.

Sort every pair into exactly one `class`:

- `fact`: a correction of a figure, name, date, claim or link. Teaches nothing
  about voice.
- `taste`: the owner's preference between two sentences that would both pass
  as his. A different emphasis, a sharper example, a reordered argument.
- `tell`: the `before` reads as machine-written and the `after` fixes that. A
  formal word swapped for a plain one, an abstraction given a person's will,
  scaffolding cut, clause order straightened, a signpost replaced by the thing
  itself.

When in doubt between `taste` and `tell`, choose `taste`. A proposal the owner
rejects costs him a review; a missed tell costs nothing until it recurs.

For a `tell` only:

- `register`: formal → plain word swaps, where `formal` is a word or short
  phrase (at most three words) the owner removed from `before` and `plain` is
  what he put in its place in `after`. Lower case, base form ("expenditure",
  not "Expenditures"). Leave it empty when the edit is not a word swap. Skip
  any pair already in `existing_register`.
- `tell` and `rule`: only when the edit shows a construction the existing
  tells do not already cover, or covers one they describe too loosely.
  `tell` names it in at most eight words. `rule` says what to flag in at most
  thirty words, in plain British English, in the same style as the numbered
  tells in `existing_tells`.

`rule` and `tell` are published in a public repository, but `before` is
unpublished drafting. Never quote `before` in them, not even a phrase. Describe
the construction in general terms. The script adds the published example
itself.

Never write the name of the owner's employer or any company that is not
already in `after`.

`pair` is the index you were given. Return one item per pair, and only the
JSON described by the schema.
