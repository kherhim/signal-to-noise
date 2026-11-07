---
name: whats-next
description: Remind the owner of the open steps from docs/plans/NEXT-STEPS.md and walk through them. Trigger when the user says "what's next", "whats next", "next steps" or "what's left".
---
1. Read `docs/plans/NEXT-STEPS.md`. Give today's date, then list the unchecked (`- [ ]`) items grouped under their headings, in file order. Leave out ticked items, and say how many are done out of the total.
2. Point to the first open item as "Next up" and say in one or two lines what it involves. Offer to do the parts Claude can do from here, such as running the build or tests, reading the PR, or drafting a command. Steps that need the dashboards, the VM or a browser are the owner's.
3. Before listing, quickly check what can be checked from the repo, for example whether PR #46 is merged (`git log origin/main`). Mention anything that looks done but is still unticked, and ask before ticking it.
4. When the owner says an item is done, change it to `- [x]`, append ` (done DD Mon YYYY)`, and commit just that file with a short message. Never tick an item they haven't confirmed.
5. Items under "Later" carry a date. Before that date, show them as one line ("Later: ...") rather than as next up.
6. When every item is ticked, say so and ask if there is a new list to start.
7. Keep it short. Use British English.
