# When a client cancels

Work through this the same day they tell you. It takes about ten minutes.

The rule behind all of it: **they keep everything you made, and you take away
nothing but your own access.** A restaurant that leaves on good terms sends you
the one down the road. A restaurant whose website breaks the week after they
cancel tells that story to everybody.

Nothing here is a retention tactic. Do not use the cancellation email to sell.
Ask one question, do the work, and get out of the way.

---

## The same day

**1. Reply within the hour, and do not pitch.**

> Sorry to see you go, and thanks for giving it a run.
>
> It stops at the end of the month, so you are covered until then, and there is
> nothing for you to cancel at your end.
>
> Everything we made is yours and stays working. I have listed it below so
> nothing surprises you.
>
> If you have a minute, what was the thing that did not work? One line is
> plenty, and it is the only thing I will ask.

That last question is the most valuable thing you get out of a cancellation.
Ask it once. If they do not answer, let it go.

**2. Take yourself off their Google Business Profile.**

Business Profile settings → People and access → remove your account. Do this
before you do anything else, because it is the thing they are quietest about
worrying over. Then say it is done, by email, in writing.

**3. Take yourself off Facebook and Instagram**, if they connected them. Meta
Business Suite → the Page → People, remove yourself. Instagram access goes with
the Page.

**4. Stop the payment at your end.** Cancel the subscription in Stripe so it
cannot bill again by accident. A charge that lands after somebody cancelled is a
chargeback and a bad review, in that order.

---

## What you leave alone, deliberately

| Thing | Do this | Why |
|---|---|---|
| Replies you posted | **Nothing.** Leave every one up | They are on the restaurant's profile, in the restaurant's name. Removing them would strip the profile of its answers and make the place look worse than before you arrived |
| Their QR code and printed cards | **Nothing.** They keep working | The code points at Google, not at you. This costs you nothing and it is a real thing to promise on the way in |
| The chat on their website | **Keep serving it** | `chat-widget.js` is a static file with no network calls and no runtime cost. Their answers live on their own page. Pulling it breaks a website you no longer support, which is the worst possible last impression |
| Their menu and answers | Hand them over if asked | They dictated it. It is theirs |

---

## The one that needs doing, not leaving

**The hosted link version, `reply-plate.com/r/theirname`.**

That one is on your domain, and it may be printed on their bags and table cards.
If you delete it, everything they printed becomes a dead end.

Instead, retire it. In `r/theirname.json`:

```json
{
  "name": "The Olive Table",
  "phone": "(555) 010-2288",
  "retired": true,
  "retiredUrl": "https://maps.google.com/?q=The+Olive+Table"
}
```

`r.html` reads `retired` and shows a signpost instead of the chat: the
restaurant's name, their phone number, and a button to their Google listing.
Anybody scanning an old code still gets somewhere useful.

Keep it that way for **at least 60 days**, and there is no strong reason ever to
delete it. A one-line JSON file costs nothing to keep.

---

## Then clean up your side

- Delete the client from the console. That clears their menu, their answers,
  their review history and their photo checklist from local storage.
- Delete their photos and any files they sent you.
- Keep the invoices. You need those for tax, and nothing else.
- If they ask you to delete everything, do it and confirm in writing. Some US
  states give them that right and it is a two-minute job either way.

---

## Write down why

One line per cancellation, in a file you actually reread:

```
2026-08 · The Olive Table · 2 months · "Never saw enough happening"
```

Three of those with the same reason is not bad luck, it is a product problem.
The two you should expect early:

- **"I did not see it working."** Your visible work arrived too late. See the
  sequencing note below.
- **"Too expensive for what it is."** Either the wrong client, or the monthly
  report is not showing them what they got.

---

## The one thing to change before it happens again

**Your work is front-loaded. Your money is monthly.** Setup is the expensive
part: learning their voice, writing the chat answers, entering the menu, making
the code, clearing the backlog. A client who leaves after three weeks got all of
it for one month.

Do not fix that with a setup fee or a minimum term. Both cost more in lost sales
than they save, and both contradict what the site promises.

The console measures this for you. The **Workload** tab logs every reply you copy
and how long you took, and turns the median into a ceiling: two hours a month
divided by your real minutes per reply. Do not put a number in an agreement until
that tab has ten measured replies in it.

Fix the front-loading with the order you work in:

| When | Do | Why |
|---|---|---|
| Days 1 to 3 | Google access, start replying, clear the backlog | Cheap for you, and they see something happen almost immediately |
| Week 2 | Review code, listing offers, photos | Still cheap, still visible |
| Week 3 | Chat answers, menu entry | The expensive part, done once they have stayed |

Most early cancellations happen because nothing visible occurred, not because
something went wrong. Put the visible work first and the expensive work last,
and both problems get smaller at once.

---

## The refund question

They cancelled on day five of a month they already paid for.

You do not owe them a refund. The site says it stops at the end of the month and
that is what they agreed to.

Offer one anyway when they have had almost nothing from you. It costs one month
and it buys the difference between somebody who says "did not work out" and
somebody who says "he took my money". At the volume you are working at, that
difference is worth more than $199.

Do not offer it when they have had a full month of work. That is not generosity,
it is teaching yourself that your work is optional.
