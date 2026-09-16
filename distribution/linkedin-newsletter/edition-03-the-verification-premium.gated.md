# Signal to Noise — Edition 3

**Title:** The verification premium

**PUBLISHED Wed 16 Sep 2026** via Claude in Chrome (gated version, cover = FIG. 51 OG image): https://www.linkedin.com/pulse/verification-premium-himanshu-kher-7sl8e/ — activity 7505924088490749952. Commentary in `_sources/linkedin-hooks/the-verification-premium-edition-03.md`.

*Publish on Wed 16 Sep, the same day as the site (owner's rule, 15 Sep); Substack
follows Fri 18 Sep. Links here are safe — the newsletter is
exempt from the feed link penalty. Be online for the first 90 minutes to reply
to comments. Topical intro drawn from the 15 Sep peg board; check it is still
true on the day.*

---

Reports suggest Anthropic is preparing for a mid-October Nasdaq listing, while
the prospectus chatter centres on how cheap intelligence has become. It has.
Over three years, the price of running a frontier model has dropped roughly a
thousandfold. This edition looks at the price that has not moved at all.

Keep this number in mind. To build
[GDPval](https://arxiv.org/abs/2510.04374), its benchmark of real professional
work, OpenAI paid industry experts to complete the tasks and other experts to
judge the models' output. Within the 220-task gold subset, completing a task
took an expert an average of 404 minutes and cost $361. Reviewing the model's
attempt at that task took 109 minutes, at a cost of $86.

Those figures show a saving of three-quarters. Most people read them that way,
correctly. I want to start at the other end. The $361 is going away; that is the
point of the models. The $86 remains. That $86 is the verification premium:
the cost of establishing whether the machine's work is right. This is now the
number governing the economics of AI within a firm. Most budgets still focus
on the wrong one.

## Two prices moving in opposite directions

Everyone watches the token price. Guido Appenzeller of a16z called its
collapse *LLMflation* and
[put a figure on it](https://a16z.com/llmflation-llm-inference-cost/): in
November 2021, a model of GPT-3 quality cost $60 per million tokens; by late
2024, it cost $0.06. Ten times cheaper a year.

Then there is the other price: 109 minutes of a professional's time, charged
at a professional's rate. Labour costs do not fall ten times a year, and this
is a labour cost. Between 2021 and 2024, nothing made the review cheaper.
Over the next three years, nothing will unless somebody changes how the
review is done.

AI work therefore carries two prices moving in opposite directions. One is
heading towards zero; the other is held in place by a day rate. Track the
first in your budget and overlook the second, and you will get the trend
right but the total wrong.

## Why checking does not compound

The marginal cost of a cluster sets the cost floor for generation, because
generation is a compute task. For verification, a judgement task, the floor
is the hourly rate of someone qualified to exercise that judgement.

You can see this by dividing through the GDPval figures. A task cost about
$54 an hour to do and about $47 an hour to review. The saving from checking
comes from taking a quarter of the time, not from a cheaper hour. The kind
of person required is the same. Having a junior check a senior's work does
not make it verified. Nor can the model verify itself.

The labs have run these sums and published the results against themselves.
GDPval's own scenario gives the model a single attempt, followed by an expert
review and fixes wherever the work falls short. GPT-5 wins or ties under half
the time. The paper's result: a task completed 1.12 times faster and 1.18 times
cheaper than an expert working alone. Not a hundred times. Eighteen per cent.
As the win rate improves, the rework term alone gets smaller. Every task
still incurs the review cost. You cannot know which 10% you are holding
until you look.

## A third of the headline

From the macro end, Anthropic's economists arrived at the same place. Their
[Economic Index research](https://www.anthropic.com/research/economic-index-primitives)
puts AI's potential addition to US productivity growth at 1.8 percentage
points a year. Weight the time saved by the probability that the task actually
succeeded, however, and the estimate, in Anthropic's own words on that page,
"falls by about one-third". The same Anthropic page gives the underlying
success rates: 66% on tasks requiring a degree and 70% on tasks requiring
less than a high-school education. These are the model's own numbers,
published by its own maker.

Expressed as a discount rate, that third is the verification premium.

## What an unchecked error costs

The premium is worth paying for a reason. In EY's
[Responsible AI Pulse survey](https://www.ey.com/en_gl/newsroom/2025/10/ey-survey-companies-advancing-responsible-ai-governance-linked-to-better-business-outcomes)
of 975 C-suite leaders, 99% of organisations reported financial losses from
AI-related risks. For 64% of them, losses exceeded $1m. The average was
$4.4m, a figure EY describes as conservative.

Put those figures next to each other. A task review costs $86. Leave it
unchecked and, when it goes wrong, the cost is seven figures — often enough
for two-thirds of a large sample to have paid already. Verification belongs
on the AI programme's insurance line, rather than in overhead. As with all
insurance, the premium seems expensive until the claim arrives.

## Budget for the check, not the token

For the finance function, this leads to four moves.

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

Treat AI as a token-cost problem and you are optimising a term already heading
to zero by itself. Everyone will receive next year's price cut from the market.
Treat it as a verification-cost problem and you are working on the term that
remains. Every hour a firm removes from the review is an hour it gets to keep.

A fall in the $361 was always coming. The number worth managing is the $86.

**[Read the full essay at signal-to-noise.co →](https://signal-to-noise.co/insights/the-verification-premium/?utm_source=linkedin&utm_medium=newsletter&utm_campaign=the-verification-premium)**

*Subscribe if this is useful — a new essay now lands here every week. And tell
me in the comments: does anyone at your firm book the hours spent checking AI
output, or do they fall to whoever happens to be nearest?*
