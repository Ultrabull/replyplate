# Testing the chat on somebody else's website

Most restaurants who say yes already have a website. Somebody else built it, on
a platform you do not control, and your two lines have to survive being pasted
into it. This is how to find out whether they do, before a paying client is the
one finding out.

---

## What the client actually pastes

Two lines, from the console's Website chat tab, just before `</body>`:

```html
<script>window.RP_CHAT = { ...their menu, hours and answers... };</script>
<script src="https://reply-plate.com/chat-widget.js" defer></script>
```

The first line is their restaurant. The second is the code. Nothing else, no
account, no plugin.

---

## Which platforms will take it

This is the part worth knowing before you sell, because on some platforms the
answer is no and no amount of trying changes it.

| Their website is on | Can they paste it? | Where |
|---|---|---|
| **Wix**, paid plan with a domain | **Yes** | Settings → Custom Code → Body - end |
| **Wix**, free plan | **No** | Custom code needs a paid plan |
| **Squarespace**, Business plan or above | **Yes** | Settings → Advanced → Code Injection → Footer |
| **Squarespace**, Personal plan | **No** | Code injection starts at Business |
| **WordPress**, self hosted | **Yes** | Theme footer, or any "insert headers and footers" plugin |
| **WordPress.com**, free or Personal | **No** | Custom code starts at Business |
| **Squarespace / Wix / Shopify** stores | Yes on the paid tiers | Theme code |
| **Square Online** | Yes on paid plans | Website → Embed code |
| **Weebly** | Yes | Embed Code element, or theme footer |
| **GoDaddy Website Builder** | Usually not | No sitewide script slot |
| **Canva Websites** | **No** | Canva does not run custom JavaScript at all |
| **Just an Instagram page** | **No website to paste into** | |

**Read the "No" rows again.** A real share of small independent restaurants sit
in them: a free Wix site, a Canva page, or nothing but Instagram. Those are
exactly the places that most need what you sell.

**They are not lost customers.** They get the hosted page instead:

```
reply-plate.com/r.html?c=their-name
```

Same chat, same ordering, same everything, at an address you host. It goes in
their Instagram bio, on their Google listing, and on a QR sticker for the
tables. This is why that page exists, and it covers every row in that table.

---

## Setting up the test

You need one real third-party site to test against. **Use Wix on a paid plan.**
It is the most common platform your prospects will be on, and it is the one
that supports custom code.

1. Build a fake restaurant site on Wix, using the picture prompts you already
   have.
2. Upgrade to the cheapest paid plan and connect any domain. Custom code will
   not appear until you do.
3. In the console, open **Website chat**, pick the client, and press **Copy the
   code**.
4. In Wix: **Settings → Custom Code → Add Code → Body - end → All pages**.
5. Paste, save, publish.

**Do not test on Canva.** It cannot run the code, so a failure there tells you
nothing except that Canva is on the "No" list, which you already know.

---

## The checklist

Work through this on your phone, not a laptop. Your prospects will.

### It arrived at all

- [ ] The button appears in the bottom right corner
- [ ] It is on **every** page, not only the home page
- [ ] It says the right thing: "Order food or ask us" when ordering is on
- [ ] The restaurant's name is right in the greeting

### It does not fight the site it is living on

- [ ] The button is not hidden behind anything, and does not cover their own
      buttons or a cookie banner
- [ ] Their fonts and colours have not leaked into the chat panel, and the
      chat has not leaked into their page
- [ ] Their page still scrolls normally with the chat open
- [ ] The site does not feel slower to load

### It answers

- [ ] Ask three questions the way a real diner would type them: lowercase, no
      punctuation, a spelling mistake in one
- [ ] Ask something it was never given, and check it says so rather than
      inventing an answer
- [ ] Tap each of the suggested chips
- [ ] It never says anything the owner did not confirm

### It takes an order

- [ ] Tap the menu open, add three things, change a quantity
- [ ] The total is right
- [ ] Type a name and send
- [ ] **Your own messages app opens with the order already typed**
- [ ] Press send, and check the text really lands on the phone you set as the
      order number
- [ ] The message reads clearly: items, quantities, total, name, pickup

### The come-back features

- [ ] Order five times and check the loyalty card counts and announces the
      reward
- [ ] Set an offer for today and check it shows
- [ ] Set one for a different day and check it does **not** show
- [ ] Set an end date in the past and check it takes itself down

### The Google listing route

- [ ] Open `reply-plate.com/r.html?c=slug&order` and check the menu opens
      straight away
- [ ] Put that link in a real Google Business Profile and check it appears
      under Order online

### It survives the owner

- [ ] Edit something on the Wix site and republish, then check the chat is
      still there. **This is the one that catches people out.** Some platforms
      drop custom code when a template changes.
- [ ] Add a page and check the chat appears on it too

---

## What to write down

For every failure, note three things: which platform, what you did, what
happened instead. A bug that only appears on Wix mobile is a real bug, and it
is invisible from anywhere else.

Send that list over and it gets fixed.

---

## The bigger thing this test tells you

Whether the code works is the small question. The large one is which platforms
are worth saying yes to.

If the chat behaves perfectly on Wix and Squarespace and WordPress, that is
most of the market covered, and every other restaurant gets the hosted link
instead. That is a complete answer to "will this work on my website", and you
will be able to give it in one sentence on a phone call instead of promising to
find out.
