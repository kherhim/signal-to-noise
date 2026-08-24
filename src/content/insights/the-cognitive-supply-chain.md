---
title: "The cognitive supply chain"
date: 2026-08-24
excerpt: "Most firms have quietly acquired a critical supplier they don't manage — for the most important input they buy: thinking. Procurement solved this problem decades ago. It's time to apply the discipline to cognition."
seoDescription: "AI vendor risk management for CFOs: second-sourcing models, abstraction layers, evaluation suites and fallback plans — supply-chain discipline applied to AI dependency."
tags: ["cfo", "ai", "risk", "strategy", "procurement"]
draft: false
coverImage: /img/the-cognitive-supply-chain.webp
coverImageAlt: "A minimalist cover on a near-black canvas: a single solid cream circle on the left — a sole supplier — fans dozens of hairline dependency lines into a grid of small squares, some solid, some outlined, a few missing. Beneath the circle sits an empty dashed circle: the second source that does not exist. A fine rule runs along the bottom labelled 'Thinking, single-sourced' in spaced white capitals, with a small 'Fig. 02' mark top-left."
---

The message lands on a Tuesday. The model underpinning your contract-review workflow is due for retirement; you have ninety days. Its successor, the vendor says, performs better across most benchmarks — likely enough, but that reveals nothing about whether it handles the four particular tasks on which your workflow relies. No one in your organisation selected this. No one in your organisation was consulted.

Consider a physical-component supplier acting in the same manner. In the middle of a contract, it changes the part around which your production line was designed, emails notice, and makes the switch effective three months later. By Thursday, procurement would be in open conflict: contractual provisions triggered, substitutes being qualified, an executive boarding a flight. Yet when the supplier provides software, the message reaches IT and quietly expires in a renewal queue.

This imbalance is what this essay examines. During the last two years, most businesses have taken on a critical supplier they do not govern — for their most consequential purchased input: thought.

In [When cognition becomes metered](/insights/when-cognition-becomes-metered/), I contended that hired cognition forms a third reservoir of productive capacity alongside staff and software — except that, unlike either of those, it is capacity beyond your control. A vendor may alter its price, retire it, or modify its behaviour halfway through a quarter without your consent. That essay concluded with the appropriate framing: dependence on a sole supplier for a critical input, requiring governance on those terms. This essay considers what that governance means in practice.

(A note on the phrase. "Cognitive supply chain" already circulates in the trade press, meaning AI applied to running supply chains. I mean the reverse: supply-chain discipline applied to AI.)

## The single point of cognitive failure

Ask a plant manager what line components come from only one source and they can recite them, because that knowledge is part of the role — and because ignorance has, somewhere in their industry’s past, stopped a factory.

Ask instead a COO which company processes contain a model call. Which supplier provides it. Which model release is used. What follows if the output is quietly incorrect, the service becomes unavailable, or the model responsible for last quarter’s consistency is exchanged for one delivering this quarter’s surprises. In most organisations, the truthful response is a shrug. That is not due to negligence; rather, the dependency accumulated team by team and integration by integration, beneath any threshold that receives formal tracking.

Name the absent artefact the **cognitive bill of materials**: an inventory of every process consuming model output, the supplier and model serving each process, the failure blast radius, and the response plan when it changes. Security teams have begun assembling "AI bills of materials" — catalogues of the data and components within a particular AI system. This is the operational relative of that idea: it asks not what the model contains, but where your organisation contains the model. It is not an elaborate document. Most firms lack it entirely — and unseen concentration cannot be governed.

The exposure extends beyond availability. An outage makes itself known; a behavioural shift does not. Frontier models are retired on monthly rather than annual timetables, and altered still more frequently. Someone who has never observed your process is continually redesigning the component upon which that process depends.

## What procurement already knows

This is not a novel category of challenge. It is operations’ oldest challenge in unfamiliar dress, and the relevant discipline already exists — developed over decades and purchased through halted factories and lost quarters. Firms learned that essential inputs can fail, that sole sourcing remains inexpensive until it becomes ruinous, and — most recently, when semiconductor shortages stopped automotive plants on three continents — that efficiency and brittleness can be the same choice viewed in different years.

That education produced a toolkit so conventional it is nearly dull: dual sources for critical inputs. Written requirements defining what a component must deliver. Checks on incoming goods against those requirements. Contractual change-notice periods. Criticality tiers, focusing the discipline where a failure costs most.

Virtually none of this has been extended to cognition, because of a category mistake. Model output is regarded as a *tool* — something a team employs and whoever owns the budget renews each year. It ought instead to be seen as a *supplied component*: an element embedded in your process, whose breakdown is your breakdown, and whose specification remains your responsibility despite your not producing it. Components receive specifications, inspections and alternative sources. Tools receive invoices.

## Four disciplines, translated

Moving from physical supply chains to cognitive ones is almost a mechanical exercise. Four practices do most of the work.

**Second-sourcing.** Qualify a second model for every critical workflow — from another vendor or, at the least, another model family — and keep it warm. “Warm” is important: continuously direct a small proportion of live traffic to it, allowing you to confirm performance on your real case distribution rather than on a benchmark. A fallback never exercised is a fallback that fails when needed, precisely the day for which it exists.

**The abstraction layer.** Replacing a model should amount to changing configuration, not rebuilding a system. Architecturally, this is unglamorous — an internal interface separating your processes from whichever model serves them — yet it determines whether a retirement notice creates an operational task or a six-month programme. Its corollary is a lock-in rule: vendor-specific features are acceptable on convenience paths but hazardous on critical ones, since every proprietary feature on a critical path is a provision in a contract you never negotiated.

**Incoming inspection.** At a factory, arriving goods are sampled and tested against specification before reaching the line. Its cognitive counterpart is an evaluation suite: a fixed collection of your own genuine cases — contracts, forecasts, and edge cases that have caused trouble before — run against each supplier update and model alteration. You cannot prevent a vendor from changing its model. You can ensure that you learn what changed before your customers do. Without such a suite, your quality-control method is simply “wait for complaints”.

**Fallback paths.** Each critical workflow needs candid answers to three questions: what form does degraded service take, at what capacity, and with which staff? At times, the answer is a second model. At others, it is people operating at one-tenth the throughput and processing only cases that cannot wait. For certain workflows, the truthful answer is that work stops until service returns — entirely acceptable if determined in advance rather than discovered during an incident.

## Resilience costs margin

The objection is obvious: this all has a cost. Dual integrations, maintained evaluation suites, and warm second sources that are redundant on most days. The earlier essay argued that dependable outcomes already cost multiples of the token price; this practice expands that line still further. Why pay for insurance against a supplier that, at present, is inexpensive, rapid and improving?

Procurement’s answer is the same: tiering rather than maximalism. Categorise workflows as suppliers are categorised: the meeting-summary tier may appropriately have one source and no fallback, because resilience there is waste. The tier affecting customers, cash or compliance is another matter — concentration in that tier is not efficiency but negligence with attractive quarterly optics. For most firms now, perhaps five processes warrant the full discipline. The discipline lies in identifying those five.

That is why the issue belongs with the CFO and procurement, rather than IT alone. Metered cognition is quietly becoming a top-ten supplier expense, and it should enter supplier governance accordingly. Three questions carry most of the board-level burden. Do we possess the cognitive bill of materials? Which tier-one processes rely on one supplier? When did we most recently test a fallback — rather than merely review it?

## The supplier that changes its mind

Companies spent thirty years discovering that supply chains break and that resilience merits reduced margin. The learning was costly: dormant plants, lost quarters, and in the end the recognition that just-in-time had silently become no-margin-for-error. From this emerged an established understanding — no one operates a production line using a single-sourced critical component without a specification, inspection or second supplier. This is no longer debated. It is simply the way serious operations function.

The same lesson is now owed to an input more important than any component has ever been: judgement itself. Firms that continue to regard rented cognition as a software subscription will learn it again as the previous generation did — in real time, at considerable cost, on a Tuesday.

Firms that regard thinking as a supply chain will continue thinking when their supplier changes its mind.
