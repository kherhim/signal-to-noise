# Signal to Noise — Edition 3

**Title:** The verification premium

**PUBLISHED Wed 16 Sep 2026** via Claude in Chrome (gated version, cover = FIG. 51 OG image): https://www.linkedin.com/pulse/verification-premium-himanshu-kher-7sl8e/ — activity 7505924088490749952. Commentary in `_sources/linkedin-hooks/the-verification-premium-edition-03.md`.

*Publish ~1 week after the site + Substack versions (site Wed 16 Sep, Substack
Fri 18 Sep, so this lands Mon 21 Sep). Links here are safe — the newsletter is
exempt from the feed link penalty. Be online for the first 90 minutes to reply
to comments. Topical intro drawn from the 15 Sep peg board; check it is still
true on the day.*

---

Anthropic is reported to be lining up a mid-October Nasdaq listing, and the
prospectus chatter is all about how cheap intelligence has become. It has. The
price of running a frontier model has fallen roughly a thousandfold in three
years. This edition is about the price that hasn't moved at all.

Here is a number to hold on to. When OpenAI built
[GDPval](https://arxiv.org/abs/2510.04374), its benchmark of real professional
work, it paid industry experts to do the tasks, then paid other experts to
assess what the models produced. On the 220-task gold subset, an expert took
404 minutes on average to do a task, at a cost of $361. Assessing the model's
attempt at the same task took 109 minutes and cost $86.

Most people see a saving of three-quarters in those figures, and they are
right. I want to look at them from the other end. The $361 is disappearing;
that is what the models are for. The $86 is staying. That $86 is the
verification premium: what it costs to find out whether the machine's work is
right. It is now the number that governs the economics of AI inside a firm, and
most budgets are pointed at the wrong one.

## Two prices moving in opposite directions

The price everyone watches is the token. Guido Appenzeller of a16z named the
collapse *LLMflation* and
[put a figure on it](https://a16z.com/llmflation-llm-inference-cost/): a model
of GPT-3 quality cost $60 per million tokens in November 2021 and $0.06 by late
2024. Ten times cheaper a year.

The other price is 109 minutes of a professional's time at a professional's
rate. That is a labour cost, and labour costs do not fall ten times a year.
Nothing made the review cheaper between 2021 and 2024, and nothing will over
the next three years unless somebody redesigns how the review is done.

So a piece of AI work has two prices moving in opposite directions. One is
falling towards zero. A day rate holds the other in place. A budget that tracks
the first and overlooks the second gets the trend right and the total wrong.

## Why checking does not compound

Generation is a compute task, so its cost floor is the marginal cost of a
cluster. Verification is a judgement task, so its floor is the hourly rate of
someone qualified to make the judgement.

Divide the GDPval figures through and you can see it. Doing a task cost about
$54 an hour; reviewing one, about $47 an hour. Checking is cheaper than doing
because it takes a quarter of the time, not because the hour is cheaper. It is
the same kind of person. A junior cannot check a senior's work and make it
verified, and the model cannot verify itself.

The labs have done this arithmetic and published it against themselves. In
GDPval's own scenario, the model tries once and an expert reviews, fixing the
work if it falls short. With GPT-5 winning or tying under half the time, the
paper's result is a task done 1.12 times faster and 1.18 times cheaper than an
expert alone. Not a hundred times. Eighteen per cent. And as the win rate
rises, only the rework term shrinks. The review is paid on every task, because
until you look you cannot tell which 10% you are holding.

## A third of the headline

Anthropic's economists reached the same place from the macro end. Their
[Economic Index research](https://www.anthropic.com/research/economic-index-primitives)
estimates AI could add 1.8 percentage points a year to US productivity growth.
Then they weight the time saved by the probability the task actually succeeded,
and, in Anthropic's own words on that page, the estimate "falls by about
one-third". The success rates underneath, from the same Anthropic page: 66%
on tasks requiring a degree, 70% on tasks requiring less than a high-school
education. The model's own numbers, from its own maker.

That third is the verification premium expressed as a discount rate.

## What an unchecked error costs

There is a reason the premium is worth paying. EY's
[Responsible AI Pulse survey](https://www.ey.com/en_gl/newsroom/2025/10/ey-survey-companies-advancing-responsible-ai-governance-linked-to-better-business-outcomes)
of 975 C-suite leaders found that 99% of organisations had reported financial
losses from AI-related risks, 64% of them above $1m, with an average loss of
$4.4m that EY calls conservative.

Set the two figures side by side. Reviewing a task: $86. Not reviewing it, on
the occasion it goes wrong: seven figures, often enough that two-thirds of a
large sample have already paid. Verification is not overhead on the AI
programme. It is the insurance line, and like all insurance the premium looks
expensive right up until the claim.

## Budget for the check, not the token

Four moves follow for the finance function.

- **Price per verified output, not per token.** The unit that matters is a piece
  of work the firm is prepared to act on: model call plus review plus expected
  rework. Only the first is on the vendor's invoice.
- **Book the reviewer's hours.** In most firms the 109 minutes land on whoever
  is nearest as unpaid attention, which is how a paper productivity gain becomes
  a longer week. Put them in the model at the rate of the person doing them.
- **Add a verification line to the cognitive bill of materials.** For every
  process that consumes model output: who checks it, how long it takes, what a
  miss would cost. Large miss, thin check: that is where the $4.4m comes from.
- **Spend engineering money on the check.** The token price falls without your
  help. The review cost falls only if someone redesigns the review: structured
  outputs reconciled mechanically, a second model that flags disagreement,
  sampled review where errors are cheap and full review where they are not.

---

The firms treating AI as a token-cost problem are optimising a term that is
heading to zero on its own, and the market will hand next year's price cut to
everyone. The firms treating it as a verification-cost problem are working on
the term that stays, and every hour they take out of the review is theirs to
keep.

The $361 was always going to fall. The $86 is the number worth managing.

**[Read the full essay at signal-to-noise.co →](https://signal-to-noise.co/insights/the-verification-premium/?utm_source=linkedin&utm_medium=newsletter&utm_campaign=the-verification-premium)**

*If this is useful, subscribe — a new essay lands here every week now. And tell
me in the comments: does anyone in your firm book the hours spent checking AI
output, or does it just land on whoever is nearest?*
