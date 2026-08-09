# Getting paid

This is the whole payment system. There is no server, no database, and no code
of ours that ever touches a card number. Stripe does all of it.

You have to make two links inside Stripe and paste them into `config.js`. That
is the entire job. It takes about twenty minutes once.

---

## Step 0: your account has two names, and they are not the same

This trips everybody, so do it before anything else.

**Account name** is a label for the account itself. It is the name at the top
of your dashboard, and the one you would use to tell two Stripe accounts apart.
Put **`ReplyPlate`** here. This is the account that takes ReplyPlate money.

**Your legal name** is a different box, and Stripe asks for it separately when
you activate the account. That one has to be your real name exactly as it
appears on your ID and your bank account, because it is how Stripe checks you
are a real person and how the money reaches you. If you have not registered a
company, pick **Individual** or **Sole proprietor** as the business type. You
are not pretending to be a company, and saying you are one when you are not is
the kind of mismatch that freezes a payout.

**Public business name** is the third one, under **Settings → Business →
Public details**. Set it to `ReplyPlate` and the statement descriptor to
`REPLYPLATE`. This is what a restaurant owner actually sees on their card
statement. Get it wrong and they see a name they do not recognise, do not
remember agreeing to, and charge back.

**Never leave a made-up company name on the account.** A name you invented
while testing can end up on a receipt, on a statement, or in front of a bank
during a dispute.

**Planning other products later?** Make a second Stripe account under the same
login rather than trying to make one account serve two brands. It is free, it
takes a minute, and the public name and statement descriptor are set per
account, so one account can only ever wear one name in front of customers.

---

## What a Payment Link is

A web address that charges people.

You make it once in Stripe. Anyone who opens it sees a proper checkout page with
your name on it, types their card in, and Stripe bills them $199 every month
from then on. You never see the card number and you never send an invoice.

Think of it as a card machine that lives at a web address instead of on your
counter.

---

## Step 1: make the monthly link

In Stripe, go to **Payment Links → New**.

| Setting | What to pick | Why |
|---|---|---|
| Product name | `ReplyPlate` | This is what shows on their bank statement. Keep it the same as the site or they will not recognise it and may charge it back. |
| Price | `199.00 USD` | |
| Billing | **Recurring, monthly** | Not "one time". This is the one people get wrong. |
| Free trial | **None** | The site says there is no free trial. Keep that true. |
| Quantity adjustable | **Off** | Nobody should buy two. |
| Collect phone number | **On** | You need it. Every reply goes to their phone. |
| Promotion codes | **On** | Costs nothing and lets you do a first-month deal later without rebuilding anything. |
| Tax | Leave off for now | See the tax note at the bottom. |

### Add two custom fields

Still on the same screen, under **Advanced → Custom fields**, add these:

1. `Restaurant name` — text, required
2. `Your Google listing link` — text, optional

Now the moment someone pays you know **who they are and where their reviews
live**, before they have filled anything else in. That is most of what you need
to start work.

### Point it back at the site

Under **After payment**, choose **Don't show confirmation page → Redirect to
your website** and put:

```
https://reply-plate.com/welcome.html
```

That page already exists. It tells them what happens next and pushes them into
the ten questions.

Copy the link Stripe gives you. It looks like `https://buy.stripe.com/aEU00abc123`.

---

## Step 2: paste it in

Open `config.js`. One line:

```js
stripe: "https://buy.stripe.com/aEU00abc123",
```

Save, push to `main`. Every **Start for $199/mo** button on every page is now a
real checkout. There is nothing else to change anywhere.

**Before you paste it, those buttons open an email to you instead.** That is
deliberate. An empty link is a slower site, not a broken one.

---

## Step 3: test it before you tell anyone

Flip Stripe to **Test mode** (top right), make the same link again, and pay
yourself with the fake card Stripe gives you for testing:

```
Card    4242 4242 4242 4242
Expiry  any future date
CVC     any 3 digits
ZIP     any 5 digits
```

Check three things happened:

1. You landed on the welcome page, not a Stripe confirmation screen.
2. A receipt arrived in your email.
3. The restaurant name you typed shows on the payment in Stripe.

Then switch back to **Live mode** and use the live link. Test and live links are
different addresses. Pasting a test link on the real site takes fake money
forever and looks completely normal, so check this one twice.

---

## Step 4: the billing page

Stripe → **Settings → Billing → Customer portal**. Turn it on, allow **cancel
subscription** and **update card**, and copy the login link.

```js
portal: "https://billing.stripe.com/p/login/xxxx",
```

Now a customer can cancel without emailing you, and the welcome page shows a
**Manage your billing** button. Leave it blank and that card stays hidden.

**Should you let people cancel themselves?** Yes. The site promises "any month,
no notice, no cancellation call". A cancel button is that promise kept. Making
someone email you to leave is how you earn a bad review from someone who was
otherwise neutral about you.

---

## Step 5: the website build link

Same as step 1, but **one time**, not recurring, at `$1,200`.

```js
stripeWebsite: "https://buy.stripe.com/dR6cN4def456",
```

This one is **not wired to any button on the site**, on purpose. You quote a
website after you have seen their place. You do not sell it off a page. Keep
the link here with everything else and send it to a client once you have both
agreed a price.

---

## Step 6: the photo shoot link

Same again, one time, at `$750`.

```js
stripePhotos: "https://buy.stripe.com/00g5kGghi789",
```

Also not wired to a button. **Ring the photographer before you send this one.**
The price on the site is what the restaurant pays you. What you keep is that
minus the photographer, and a half day in San Francisco is not a half day in
Tulsa. If a local shooter wants $600, either charge more than $750 or say no to
that one. Quoting first and finding out after is how a $750 job pays you $80.

One-off payments are the same fee as a subscription card payment, without the
extra 0.5% that recurring billing adds. So $750 costs you about $22, and you
keep roughly $728 before the photographer.

---

## What Stripe takes

On each $199 payment, in the US:

| | |
|---|---|
| Card fee | 2.9% + $0.30 = **$6.07** |
| Subscription fee | 0.5% = **$1.00** |
| **Stripe keeps** | **about $7.07** |
| **You get** | **about $191.93** |

So roughly **3.6%**. At ten clients that is about $71 a month. At twenty, about
$141.

Two things worth knowing:

- The 0.5% is only on recurring payments. A one-off like the website build is
  just 2.9% + 30¢, so $1,200 costs you about $35.10.
- Rates change. Check [stripe.com/pricing](https://stripe.com/pricing) before you
  quote these numbers to anyone.

---

## The bits people forget

**Payouts.** Stripe holds your first payment for about 7 days, then pays into
your bank every 2 days. Do not panic on day one when the money is not there.

**A failed card.** Stripe retries on its own for a couple of weeks and emails
them. You do nothing. Turn on **Settings → Billing → Revenue recovery** so it
also emails them a link to fix their card.

**Someone cancels.** Stripe emails you. They stay live until the end of the
month they paid for. Follow `OFFBOARDING.md`, which already covers taking
yourself off their Google profile the same day.

**A chargeback.** Someone disputes a charge. It costs $15 whether you win or
lose. The defence is the boring one: a clear name on the statement, a real
receipt, and replying to emails. All three are already true here.

**Tax.** Below roughly $100k in sales you almost certainly do not need Stripe
Tax. Ask an accountant once, not the internet every week. If you do turn it on
later it is a toggle on the same Payment Link, and no code changes.

---

## What this system cannot do

Worth being straight about, because it shapes what you can promise.

- **The site cannot tell who has paid.** There is no server, so no page can
  check. `welcome.html` is a thank-you note, not proof. If someone bookmarks it
  they see it again without paying, and that is fine, because it gives nothing
  away.
- **Nothing is automatic after the payment.** Stripe emails you, and you start
  the work. There is no robot creating their account. With a handful of clients
  that is genuinely fine, and it is also exactly what the site says happens.
- **Do not put a Stripe secret key in any file here.** Everything in this repo
  is public. Payment Links need no key, which is precisely why they are the
  right tool for a site with no server.
