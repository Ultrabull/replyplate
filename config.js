/* ═══════════════════════════════════════════════════════════════════════════
   EDIT THIS FILE. It is the only place your prices and payment links live.

   Every page reads from here, so a change here changes the whole site. Before
   this file existed the same settings were copied into four pages, which meant
   pasting a Stripe link into one page and leaving the other three quietly
   emailing people instead of charging them.

   STRIPE.md explains, step by step, how to make the payment links below.
   ═══════════════════════════════════════════════════════════════════════════ */
window.RP_CONFIG = {

  brand: "ReplyPlate",
  email: "hello@reply-plate.com",

  /* Prices shown on the site. Keep the $ and the comma, these are printed as
     written. Change one here and every page that mentions it changes with it. */
  price:      "$199",     // the monthly subscription
  webPrice:   "$1,200",   // building a website, charged once
  photoPrice: "$750",     // a professional photo shoot, charged once

  /* ── The stock and self-checkout add-on ───────────────────────────────────
     NOT BUILT YET. These numbers only appear on your own HQ page, never on
     the public site, because selling something that does not exist is how you
     end up owing a refund. Move them onto the site when it actually runs.

     Why $99: Square sells both halves and they do talk to each other, so do
     not claim otherwise. Theirs is $99 a month for stock tracking plus about
     $50 a month and $149 for a kiosk tablet, so roughly $149 a month all in.
     What you have on them is not features, it is fit: theirs only works if
     the restaurant runs entirely on Square, and it needs hardware. Yours runs
     on any till and on the customer's own phone. Checked August 2026, list
     prices, and they mostly quote by phone.                                */
  addonPrice: "$99",      // stock tracking + self checkout, every month
  addonSetup: "$300",     // menu, payment link, QR sign. Charged once, up front
  pilotPrice: "$49",      // first client only, six months, for being the guinea pig

  /* ── Stripe ───────────────────────────────────────────────────────────────
     Paste the Payment Link for the monthly plan here and every "Start for
     $199/mo" button on the site becomes a real checkout.

     Leave it "" and those buttons open an email to you instead. That is a
     working fallback, not a broken site, so an empty value is safe. It is just
     slower, and you have to chase the card details yourself.                */
  stripe: "https://buy.stripe.com/dRmaEXe5ZefY1akbz63AY00",

  /* The one-off website build. This one is not wired to a public button on
     purpose: you quote a website after seeing their place, you do not sell it
     off a page. Keep the link here so it is with everything else, and send it
     to a client once you have both agreed a price.                          */
  stripeWebsite: "",      // e.g. "https://buy.stripe.com/dR6cN4def456"

  /* The one-off photo shoot. Same idea as the website: you book a photographer
     in their town first, so what it costs you is known before you quote. Send
     this link once you have both agreed the number.                         */
  stripePhotos: "",       // e.g. "https://buy.stripe.com/00g5kGghi789"

  /* Stripe's own billing page, where a customer changes their card, reads
     receipts, or cancels without emailing you. Stripe → Settings → Billing →
     Customer portal. Leave "" and welcome.html hides that card rather than
     showing a button that goes nowhere.                                     */
  portal: "",             // e.g. "https://billing.stripe.com/p/login/xxxx"

  /* A booking link, if you ever want one. Leave "" and the "ask for five free
     replies" links open an email to you, which is what they do today.       */
  book: "",               // e.g. "https://calendly.com/you/15min"
};
