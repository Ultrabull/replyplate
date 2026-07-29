# ReplyPlate — Restaurant reputation & social kit

A ready-to-run, done-for-you service kit for restaurants: answer every Google
review, invite all diners to review, and post to social — powered by your
OpenRouter key. 100% client-side, hosted free on GitHub Pages.

Reviews are Google-only by design: Meta retired Page reviews/ratings, so no tool
can reply to them. Facebook & Instagram are handled as posts and comments.
See `BACKEND-PLAN.md` for the always-on version.

Two pages:
- **`index.html`** — the **landing page** you send to restaurant owners (public).
- **`console.html`** — your private **operator console** (deliver the service + find clients).

Live once deployed:
- Landing: `https://ultrabull.github.io/replyplate/`
- Console: `https://ultrabull.github.io/replyplate/console.html`

## Set it up (5 minutes)

### 1. Make the landing page yours
Open `index.html`, find the **`CONFIG` block** near the bottom, and edit:
```js
const CONFIG = {
  brand: "ReplyPlate",     // your business name
  price: "$199",           // your monthly price
  stripe: "",              // your Stripe Payment Link (see below)
  book:   "",              // your Calendly link (optional)
  email:  "hello@example.com", // where prospects reach you
};
```

### 2. Get paid — Stripe Payment Link (no code)
1. Create a free account at [stripe.com](https://stripe.com).
2. Dashboard → **Payment Links** → **New** → recurring, set your monthly price.
3. Copy the link (looks like `https://buy.stripe.com/xxxx`) into `CONFIG.stripe`.
That's it — the "Start now" buttons now take customers straight to checkout.
(Until you add it, buttons fall back to emailing you.)

### 3. Add your API key (console)
Open `console.html` → the Settings (⚙) opens automatically → paste your
**OpenRouter key** ([openrouter.ai/keys](https://openrouter.ai/keys)) and pick a
model. **Claude 3.5 Sonnet** writes the best replies; free models are fine for testing.

## Deliver the service (console)
1. **Clients** — add each restaurant (name, cuisine, voice, Google review link).
2. **Autopilot** — the always-on engine (see below).
3. **Reply to reviews** — paste a review → 3 safe, on-brand replies → copy.
4. **Get reviews** — generate SMS/email/table-card asking **every** diner to review.
   (Never only the happy ones — Google prohibits it and penalises the restaurant.)
5. **Social posts** — enter a special/dish → a batch of captions + hashtags.
6. **Find clients** — write a personalised pitch and track your pipeline.

## Autopilot (prototype)
The "give us the handle, we handle everything" experience. Press **Check for
new reviews** and Autopilot will, for each incoming review:
- **draft a safe, on-brand reply** and **classify** it (sentiment + risk) — real AI;
- **auto-post** positive, low-risk reviews (4–5★); and
- **hold** anything negative, low-rated, or risky for the owner.

The owner opens **`approve.html`** (a clean mobile screen) and taps **Approve &
post / Edit / Skip** — that's their entire job. Everything else is invisible.

What's real vs. stubbed today:
- **Real:** the AI drafting + triage (your OpenRouter key) and the full
  approve/auto-post decision + owner workflow.
- **Stubbed (demo mode):** the review *source* (a sample feed) and the *posting*
  step. These sit behind a `Connectors` object in `console.js` (`fetchNewReviews`
  / `postReply`) — the single place the **Google Business Profile** and **Meta
  Graph** APIs slot in. Going fully live also needs a small backend to poll on a
  schedule and shared storage so the owner's approvals sync across devices
  (today the console and `approve.html` share the browser's localStorage).

## Get your first clients
1. Open Google Maps, search "restaurants near me".
2. Note ones with few reviews or no replies — they need this most.
3. Add them under **Find clients**, generate a pitch, reach out.
4. Aim for your first 3 free trials → convert to paid.

## Honest notes
- **Payments** use Stripe Payment Links (safe, no backend). For automatic
  onboarding/cancellations you'd later want a small backend — ask Claude to build it.
- **Lead lists** are built by hand from Google Maps (no scraping). A Google
  Places API integration can be added later.
- Everything (keys, clients, leads) is stored **only in your browser**.
- The work is real but not fully hands-off — you still approve output and do outreach.
