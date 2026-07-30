# Working with the owner of this project

## How to write answers (important)

Use **simple, plain words** and **always give examples**. The owner is building
a business, not reading a technical document.

Do this:
- **Keep answers short.** Say the thing, show one example, stop. Do not write
  an essay when five lines will do. No long lists of options.
- Short sentences. One idea per sentence.
- Explain any technical word the moment you use it, or don't use it.
- Give a concrete example for every point. Show a real scenario, a sample
  message, a small table, or a before/after.
- Use analogies to everyday things where they help.
- Lead with the answer, then explain it.

Avoid this:
- Jargon without explanation: "OAuth", "webhook", "idempotent", "deterministic
  rails", "agentic". If a concept like this matters, describe what it *does*
  in plain words.
- Long unbroken paragraphs.
- Listing options without a recommendation.

Example of the right style:

> **Bad:** "Self-serve onboarding requires OAuth verification, which gates
> the acquisition funnel behind a second approval process."
>
> **Good:** "Owners will click a 'Sign in with Google' button, like signing
> into any app. Google has to check and approve your app before that button
> works for the public. That's a second approval, on top of the one you're
> already waiting for."

## About the project

ReplyPlate: a service for restaurants. It answers their Google reviews, asks
their diners to leave reviews, and posts to their social media. $199/month.
Run by one person, based in the US.

- `index.html` is the public landing page.
- `console.html` / `console.js` / `console.css` is the private operator console.
- `approve.html` is the screen a restaurant owner uses to approve replies.
- `BACKEND-PLAN.md` is the plan for making it run automatically.
- Everything is plain HTML/CSS/JS. No build step. Hosted on GitHub Pages.
  Pushing to `main` publishes the site.

## Rules the copy must follow

These were fixed for real legal and policy reasons. Do not undo them.

- **Never ask only happy diners for reviews.** Google bans this and punishes
  the restaurant. Always "every diner".
- **Never promise a rating will improve.** Nobody can promise that.
- **Reviews means Google reviews only.** Facebook retired reviews, so no tool
  can reply to them.
- **Never say the product is fully automatic or hands-off.** It isn't yet, and
  negative reviews always wait for the owner's approval. Banned words include
  "24/7", "autopilot", "never forgets", "without lifting a finger".
- **Never use the phrase "AI employee" or give the AI a human name.** Podium
  sells a product called exactly that, with a persona named Avery.
- **Cost comparisons must stay conservative** and clearly marked as estimates.
- **No em-dashes in the landing page copy.** They read as an AI tell.
