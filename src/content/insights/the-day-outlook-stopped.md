---
title: "The day Outlook stopped: What a 24-hour outage costs, and who pays"
date: 2026-12-02
excerpt: "On 12 November Outlook went down across the Americas and Microsoft apologised almost 24 hours later. The service credit covers a sliver of one line on the invoice. The rest of the bill stays with the customer, and few finance teams have ever priced it."
seoDescription: "Cost of a Microsoft 365 outage: a CFO model for lost hours, delayed revenue and recovery, and why SLA service credits cover so little of the loss."
tags: ["cfo", "risk", "technology", "operations"]
draft: true
---

On 12 November Microsoft [acknowledged](https://www.techradar.com/news/live/outlook-outage-nov-2026) that users in the Americas could not reach their Exchange Online mailboxes. Reports on Downdetector peaked above 131,000. Microsoft's apology came almost 24 hours after the problems started, and it put the cause down to "an issue during an earlier network capacity upgrade that surfaced following a recent network change". In the UK, Dorset and Hertfordshire police asked people with time-critical reports to phone 101.

It was the second long outage of the year. In January a Microsoft 365 failure [ran for nearly ten hours](https://www.theregister.com/2026/01/23/microsoft_365_outage/). Microsoft's own [published uptime](https://learn.microsoft.com/office365/servicedescriptions/office-365-platform-service-description/service-health-and-continuity) for the first quarter of 2026 was 99.526%, against 99.988% a year earlier.

Most finance teams will treat November as an IT incident. It belongs in the risk register with a number next to it, and building that number takes about an hour.

## Three buckets of cost

A day without email costs money in three ways, and each needs its own estimate.

- **Stalled time:** People keep working, but anything that needs an email, a calendar or a shared mailbox waits.
- **Delayed revenue:** Quotes, invoices, approvals and customer replies sit in queues. Most of this is timing. Some of it never comes back, such as the quote that expired or the customer who went elsewhere.
- **Recovery:** Catch-up hours, IT time, and the phishing wave that follows every big outage. TechRadar warned readers within hours to expect fake password-reset messages.

## Pricing the stalled time

Pay comes first. The ONS puts [median hourly earnings](https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/bulletins/annualsurveyofhoursandearnings/2025) for full-time UK employees at £19.67 in April 2025. A 7.5-hour day at that rate is about £148 per person, before employer costs.

Only a share of that day stalls, and the share is a judgement, and the honest answer varies by team. A sales desk that lives in Outlook loses most of the day. A warehouse loses little.

For an office of 1,000 people where a third of the day stalls, the arithmetic is £148 × 1,000 × one third, or about £49,000 in paid time that produced nothing. A real model uses the company's own payroll and its own share. The order of magnitude matters more than the precision, and it is larger than most people guess.

## Pricing the revenue and the recovery

Delayed revenue needs a different method. It is the average daily value of orders, invoices and customer replies that move by email, times the fraction that never comes back. For most businesses that fraction is small. For a business that quotes on short deadlines, it is the largest of the three buckets.

Recovery is easier to count. It is the overtime and contractor hours in the following week, the IT team's time on the incident and the cost of any phishing clean-up.

## What the service credit pays

Microsoft's service level agreement offers credits when uptime falls short. Its [guidance on claiming them](https://learn.microsoft.com/partner-center/billing/request-credit) sets out the terms:

- **Only the affected service:** A customer on an Office 365 suite that loses SharePoint gets a credit for SharePoint, not the whole plan.
- **Prorated by duration:** The credit scales with how long the outage lasted.
- **Claimed, not given:** Requests go in within one month of the end of the billing month, with the tenant ID, the incident ID and evidence that users were affected.

So a one-day Exchange outage returns a fraction of one month's fee for one service. The loss is measured in salaries. The refund is measured in licence fees. Those two numbers are not in the same order of magnitude, and no SLA is designed to close the gap.

The customer pays the rest. Insurance may help, depending on the wording. Microsoft said this outage was "not related to cyber", and a policy built around attacks or physical damage may not respond to a supplier's configuration error. The time to read the wording is before the next outage.

## What a CFO can do this quarter

Four steps cover most of it.

- **Put a number in the register:** Run the model above with real payroll and a realistic stalled share. Record the cost of one day and of three.
- **Claim the credit anyway:** The money is small. The process forces IT to log the incident ID, the hours and the users affected, and that record is what any later insurance or contract discussion will need.
- **Decide the fallback before it is needed:** Which customers get a phone call, who can approve payments without email, and where staff look for instructions when the mailbox is gone.
- **Ask the broker one question:** Does our cover respond to a non-malicious outage at a cloud supplier?

Microsoft extended its email timeout window to 48 hours during the outage, so most delayed messages arrived in the end. The cost of the day did not arrive anywhere. It stayed with the companies that lost it, mostly uncounted.
