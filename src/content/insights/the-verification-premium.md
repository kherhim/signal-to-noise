---
title: "The verification premium"
date: 2026-09-16
excerpt: "Reviewing a piece of AI work costs $86, compared with $361 to do it yourself. It looks like a saving of three-quarters, and it is, but that $86 is priced in expert hours and has stayed the same even as the cost of generating the work has dropped a thousandfold."
seoDescription: "AI made work nearly free to produce, yet checking it still costs expert hours. CFOs should budget for AI as a verification-cost problem rather than a token-cost one."
tags: ["cfo", "ai", "cost-structure", "strategy", "risk"]
draft: false
coverImage: /img/the-verification-premium.webp
coverImageAlt: "Seven columns form a row across the frame against a near-black background. Each stands on a solid cream plinth of equal height, with an ash block above it. The ash blocks drop sharply in height from left to right, from a tall first block to a sliver at the end, but never meet the baseline because the cream row below stays the same height throughout. A dashed hairline extends the top of the plinths beyond the last column towards the right-hand edge. The lower rule reads 'JUDGEMENT, UNDISCOUNTED'."
coverAnimation: the-verification-premium
---

Here is a number to hold on to. To build [GDPval](https://arxiv.org/abs/2510.04374), its benchmark of real professional work, OpenAI paid industry experts to carry out the tasks, then paid other experts to assess the models' output. Across the 220-task gold subset, an expert took an average of 404 minutes to complete a task, at a cost of $361. Assessing the model's attempt at that same task took 109 minutes and cost $86.

Most people see a saving of three-quarters in those figures, and they are right. I want to look at them from the other end. The $361 is disappearing; that is the point of the models. The $86 is staying, untouched by the current round of price cuts. That $86 is the verification premium: what it costs to establish whether the machine's work is right. My argument is that this is now the number governing the economics of AI within a firm. Most budgets are focused on the wrong figure.

## Two prices moving in opposite directions

Begin with the price that gets all the attention. Guido Appenzeller of Andreessen Horowitz (a16z) named the collapse in inference cost *LLMflation* and [put a figure on it](https://a16z.com/llmflation-llm-inference-cost/): in November 2021, a model of GPT-3 quality cost $60 per million tokens; by late 2024, it cost $0.06. That is a factor of a thousand over three years, or roughly ten times a year at the rate a16z measured. As Appenzeller notes, the fall outpaced both PC costs during the PC revolution and bandwidth costs during the dotcom era.

Consider the other price now. For $86, you get 109 minutes of a professional's time, charged at a professional's rate. This is a labour cost rather than a compute cost. Labour costs do not fall by ten times a year. Between 2021 and 2024, nothing made the review cheaper. Over the next three years, nothing will make it cheaper either unless somebody changes the way it is done. A reviewer must still open the deliverable, read it, understand the task, judge whether the work meets the bar and, where it does not, do the work themselves.

The cost of a piece of AI work therefore comprises two prices moving in opposite directions. One is falling towards zero; a day rate holds the other in place. A budget that tracks the first while overlooking the second will get the trend right and the total wrong.

## Why checking does not compound

One sentence is enough to explain the mechanism. Because generation is a compute task, its cost floor is the marginal cost of running a cluster; because verification is a judgement task, its floor is the hourly charge of someone qualified to make that judgement.

Divide through the GDPval figures and the distinction becomes clear. Completing a task cost about $54 an hour, against about $47 an hour for reviewing it. Checking costs less than doing because it takes a quarter of the time, rather than because the hour costs less. With the same kind of person involved, the rates are nearly identical. A junior cannot check a senior's work and make it verified. Nor can the model verify its work by checking itself. Knowing whether the task was done requires the expertise needed to do it.

This explains where the saving runs out. For output that passes, the model removes 295 of the 404 minutes. The remaining time belongs to a person judging whether to trust it. If the output fails, the 404 return. I described hired cognition in [When cognition becomes metered](/insights/when-cognition-becomes-metered/) as a third pool of capacity alongside staff and software, priced by the unit. That pool exists. Every unit taken from it, though, needs checking by someone in the first pool, whose price is still set the old way.

## The arithmetic the labs publish against themselves

The frontier labs make this argument straightforward: they have calculated the numbers and published them. In GDPval's scenario, the model makes one attempt at the task before an expert fixes it. The expert reviews the output and, if it falls short, does the job themselves. Expected cost equals the model's cost, plus the review cost, plus the human cost multiplied by the probability of model failure.

Once written out, the problem's shape is clear. Only the first term is falling ten times a year; expert hours make up the second and third. For GPT-5, with a win-or-tie rate below half, the paper's own calculation for this scenario produces a task completed about 1.12 times faster and 1.18 times cheaper than an expert alone. Not a hundred times. Not ten. Eighteen per cent.

As models win more often, that figure will improve, as it should: a higher win rate reduces the third term. It leaves the second term untouched. Even when a model is right 90% of the time, it still requires the 109 minutes of review. Until you look, you cannot tell which 10% you have in front of you. Every task incurs review cost; only failures incur rework cost. With improving models, the premium comes to account for everything that remains.

## A third of the headline is the probability it was wrong

Coming from the opposite direction, Anthropic's economists have arrived at the same point. According to their [Economic Index research](https://www.anthropic.com/research/economic-index-primitives), widespread AI adoption could add 1.8 percentage points a year to US productivity growth over a decade. They then apply a discount. Weight the time saved on each task by its probability of actually succeeding, and the estimate "falls by about one-third": to 1.2 points for tasks completed on the consumer product and 1.0 for the typically harder tasks completed through the API.

It is worth pausing over the success rates underlying that discount. In the same research, Claude completes tasks requiring a college degree 66% of the time, compared with 70% for tasks requiring less than a high-school education. These are figures for the model published by its own maker. By the lab's own reckoning, a third of the productivity story rests on the possibility that the output was wrong and somebody had to spot it.

Expressed as a discount rate, that third is the verification premium. From the macro end, we are looking at the same $86.

## What an unchecked error costs

The other side of the ledger explains why this premium is worth paying. The authors of GDPval point out that their scenario assumes review catches failures. It excludes catastrophic mistakes, whose cost is disproportionate in some domains. For the CFO, that caveat is the point of interest.

Among 975 C-suite leaders across 21 countries, EY's [Responsible AI Pulse survey](https://www.ey.com/en_gl/newsroom/2025/10/ey-survey-companies-advancing-responsible-ai-governance-linked-to-better-business-outcomes) found that 99% of organisations reported financial losses from AI-related risks; 64% had lost more than $1m. For companies experiencing such risks, EY estimates an average loss of $4.4m and describes that estimate as conservative.

Put the figures side by side. A task review: $86. Leaving it unchecked when it goes wrong: a seven-figure outcome, frequent enough that two-thirds of a large sample have already paid one. Verification belongs on the insurance line, rather than under overhead on the AI programme. As with any insurance, the premium seems expensive until the claim arrives.

## Budget for the check, not the token

With the cost now sitting in the premium, finance needs to price and manage it instead of allowing it to stay hidden. That calls for four moves.

- **Price per verified output, not per token:** The unit that matters is a piece of work the firm is prepared to act on. Its cost is the model call plus the review plus the expected rework, and only the first of those is on the vendor's invoice. A workflow that looks cheap on the token line and expensive on the reviewer's timesheet is expensive.
- **Count the reviewer's hours as a cost of the workflow:** In most firms the 109 minutes are not booked anywhere. They land on whichever professional is nearest as unpaid attention, which is how a productivity gain on paper becomes a longer week in practice. Put the hours in the model, at the rate of the person doing them.
- **Put the verification line in the cognitive bill of materials:** In [The cognitive supply chain](/insights/the-cognitive-supply-chain/) I argued for an inventory of every process that consumes model output. Each entry should also record who checks it, how long that takes, and what a miss would cost. The processes where that last figure is large and the check is thin are where the $4.4m comes from.
- **Spend engineering money on the check, not the call:** The token price is falling without any help from you. The review cost falls only if someone redesigns the review: structured outputs that can be reconciled mechanically, a second model that flags disagreement rather than rubber-stamping, sampled review where the error cost is low and full review where it is not. That is where an engineering budget earns its keep.

## Where the advantage compounds

Treating AI as a token-cost problem means optimising a term already heading towards zero by itself. This year's inference savings will be handed to everyone by the market next year: the vendor owns the price cut, not the firm. Buying a cheaper commodity creates no moat.

Treating AI as a verification-cost problem means working on the term that remains. An hour removed from review, a class of error caught mechanically instead of by an expert's eye, a process in which the firm learns exactly how much checking an output warrants: each delivers a cost reduction that nobody else receives for free. The advantage compounds because it belongs to the firm.

A fall in the $361 was always coming. The number to manage is the $86. Measured in your people's hours and absent from anyone's budget, it explains why AI's headline gains keep turning up a third smaller than promised.
