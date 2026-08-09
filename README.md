# ReplyPlate

A done-for-you service for US restaurants: every Google review answered in the
owner's voice, every diner asked, pickup orders taken by text, posts written,
one monthly report. $199 a month. Run by one person.

Everything is plain HTML/CSS/JS, no build step, hosted on GitHub Pages.
**Pushing to `main` publishes the site at [reply-plate.com](https://reply-plate.com).**

Reviews mean Google reviews only, by design: Facebook retired page reviews, so
no tool can reply to them. Facebook and Instagram are handled as posts.

## The one file to edit

**`config.js`** holds the brand, the email, every price and every Stripe link.
Each page carries a fallback copy of its own settings, so a page still works if
config.js fails to load, but config.js wins wherever it sets a value. Change a
price there and the whole site changes.

`STRIPE.md` walks through making the payment links.

## The pages

**Public, for restaurant owners:**

| Page | What it does |
|---|---|
| `index.html` | The landing page |
| `details.html` | Costs and the long FAQ, including what costs extra |
| `maps-demo.html` | Their Google listing, before and after, and what the apps cost |
| `chat-demo.html` | The Olive Table, a made-up restaurant with the chat and ordering live |
| `report-demo.html` | The monthly report, built from fourteen reviews |
| `social-demo.html` | A month of posts from one owner text |
| `websites.html` | The $1,200 website build |
| `qr-code.html` | Their review code, printed: table cards, stickers, a counter sign |
| `start.html` | The ten questions a new client answers |
| `connect.html` | How a client adds us to their Google profile |
| `welcome.html` | Where Stripe sends them after paying |

**Private, for the operator:** `hq.html` (every link in one place, save it to
your phone), `console.html` (the console: clients, replies, posts, reports),
`approve.html` (what an owner sees when a reply needs their OK), `r.html`
(the hosted ordering page for restaurants with no website).

The private pages hold no secrets: the console keeps its data in the browser
it runs in, and no key is ever in this repo. `robots.txt` deliberately does
not name them.

## The guides

- `STRIPE.md` — payments: the $199 subscription, the $1,200 website, the $750 photo shoot
- `INSTALL-TEST.md` — testing the chat widget on a real Wix site
- `NO-CODE.md` — what to offer when a restaurant's website cannot take code
- `OFFBOARDING.md` — what happens when a client leaves
- `BACKEND-PLAN.md` — the plan for making the service run without hand-work
- `assets/README.md` — every picture on the demo restaurant, and the prompt that made it

## Rules the copy follows

They are in `CLAUDE.md`, and they exist for legal and policy reasons: never
ask only happy diners for reviews, never promise a rating will improve, never
claim the service is fully automatic, keep cost comparisons conservative and
marked as estimates.
