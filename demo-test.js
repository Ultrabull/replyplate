/* ReplyPlate demo test bench.

   Turns the demo restaurant into something you can actually prove works, rather
   than something you can only describe. Add ?test to the URL:

       chat-demo.html?test

   Without it this file adds nothing to the page. No panel, no listeners, no
   styles, nothing in the DOM. A restaurant owner who lands on chat-demo.html
   sees exactly what they saw before.

   WHY IT EXISTS. chat-demo.html ships with order.demo = true, so tapping Send
   draws a picture of a text message instead of sending one. That is correct for
   a public demo, and it also means you have never once watched a real order land
   on a real phone. This lets you, with your own number, in about ten seconds.

   THE ONE THING TO KNOW. chat-demo.html is public on GitHub Pages. While the
   bench is armed with your number, that number is in this browser only, never
   saved and never in the URL. Nothing you type here is written to disk or shared,
   and it is gone the moment you reload.

   IT MUST LOAD BEFORE chat-widget.js. The widget grabs its order settings once,
   as it boots, so the switches here have to be in place first. Both tags are
   deferred, so the order they appear in the HTML is the order they run in. */
(function () {
  "use strict";
  if (!/(^|[?&])test(=|&|$)/.test(location.search)) return;

  var CFG = window.RP_CHAT;
  if (!CFG) return;

  /* Anything the demo puts in storage is namespaced rpdemo.*, never rp.*.
     rp.* is the business: rp.key is the OpenRouter key, rp.clients, rp.leads,
     rp.queue, rp.seen and rp.work are real records with no backup anywhere.
     The console watches rp.queue and reloads its feed the moment it changes, so
     a fake review written there would appear in the real approval feed. */
  var DEMO_QUEUE = "rpdemo.queue";

  var armed = false;              // held in memory only, deliberately
  var realPhone = "";

  /* ── styles ───────────────────────────────────────────────────────────
     Bottom LEFT. The chat widget owns the bottom right at a z-index near the
     maximum, and the bench must never sit on top of the thing it is testing. */
  var css = document.createElement("style");
  css.textContent =
    '.tb{position:fixed;left:12px;bottom:12px;bottom:max(12px,env(safe-area-inset-bottom));' +
      'z-index:2147482000;width:310px;max-width:calc(100vw - 24px);font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
      'background:#15110e;color:#f2e9da;border:1px solid #4a3a26;border-radius:14px;' +
      'box-shadow:0 24px 60px -18px rgba(0,0,0,.9);overflow:hidden}' +
    '.tb.armed{border-color:#e0705a;box-shadow:0 0 0 1px #e0705a,0 24px 60px -18px rgba(0,0,0,.9)}' +
    '.tb h4{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#c9a24d;' +
      'padding:11px 14px;border-bottom:1px solid #2e2419;display:flex;align-items:center;gap:8px;margin:0}' +
    '.tb h4 button{margin-left:auto;background:none;border:none;color:#8d7e66;font:inherit;' +
      'font-size:17px;line-height:1;cursor:pointer;padding:2px 4px}' +
    '.tb .bd{padding:12px 14px;max-height:min(66vh,560px);overflow:auto}' +
    '.tb section{border-top:1px solid #2e2419;padding-top:12px;margin-top:12px}' +
    '.tb section:first-child{border-top:none;padding-top:0;margin-top:0}' +
    '.tb b.lbl{display:block;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:#a2937a;margin-bottom:7px}' +
    '.tb input[type=tel],.tb textarea,.tb select{width:100%;background:#0e0b09;color:#f2e9da;' +
      'border:1px solid #3b2f21;border-radius:8px;padding:9px 10px;font:inherit;outline:none}' +
    '.tb input:focus,.tb textarea:focus,.tb select:focus{border-color:#c9a24d}' +
    '.tb textarea{min-height:64px;resize:vertical}' +
    '.tb .row{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap}' +
    '.tb button.b{flex:1;min-width:96px;min-height:38px;background:#c9a24d;color:#1a1204;border:none;' +
      'border-radius:8px;font:inherit;font-weight:700;cursor:pointer;padding:9px 10px}' +
    '.tb button.b.g{background:transparent;color:#c9a24d;border:1px solid #4a3a26}' +
    '.tb button.b.r{background:#b8412c;color:#fff}' +
    '.tb button.b:disabled{opacity:.45;cursor:not-allowed}' +
    '.tb a.b{display:block;color:#c9a24d;text-decoration:none;padding:7px 0;border-bottom:1px solid #241c14;font-size:13px}' +
    '.tb a.b:last-child{border-bottom:none}' +
    '.tb .msg{margin-top:9px;font-size:12.5px;color:#a2937a;line-height:1.5}' +
    '.tb .msg.ok{color:#7ad3a4}.tb .msg.bad{color:#e0705a}' +
    '.tb ul.res{list-style:none;margin:9px 0 0;padding:0;font-size:12.5px}' +
    '.tb ul.res li{padding:6px 0;border-bottom:1px solid #241c14;display:flex;gap:8px;align-items:flex-start}' +
    '.tb ul.res li:last-child{border-bottom:none}' +
    '.tb ul.res i{font-style:normal;flex:0 0 auto;font-weight:800}' +
    '.tb ul.res i.y{color:#7ad3a4}.tb ul.res i.n{color:#e0705a}' +
    '.tb ul.res span{color:#a2937a;display:block;font-size:11.5px}' +
    '.tb .warn{background:#3a1a12;border:1px solid #b8412c;color:#ffd8cd;border-radius:8px;' +
      'padding:9px 10px;font-size:12.5px;margin-top:9px;line-height:1.5}' +
    '.tbopen{position:fixed;left:12px;bottom:12px;bottom:max(12px,env(safe-area-inset-bottom));' +
      'z-index:2147482000;background:#15110e;color:#c9a24d;border:1px solid #4a3a26;border-radius:999px;' +
      'padding:11px 17px;font:700 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;' +
      'cursor:pointer;min-height:42px}' +
    '@media (max-width:520px){.tb{width:calc(100vw - 24px);' +
      /* clear of the chat launcher, which owns the bottom right corner */
      'bottom:76px;bottom:calc(76px + env(safe-area-inset-bottom))}}';
  document.head.appendChild(css);

  function h(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function say(node, text, kind) {
    node.textContent = text;
    node.className = "msg" + (kind ? " " + kind : "");
  }

  var panel = h("div", "tb");
  var opener = h("button", "tbopen", "Test bench");
  opener.type = "button";
  opener.hidden = true;

  var head = h("h4", null, "Test bench");
  var hide = h("button", null, "×");
  hide.type = "button";
  hide.title = "Hide";
  head.appendChild(hide);
  panel.appendChild(head);
  var body = h("div", "bd");
  panel.appendChild(body);

  hide.addEventListener("click", function () { panel.style.display = "none"; opener.hidden = false; });
  opener.addEventListener("click", function () { panel.style.display = ""; opener.hidden = true; });

  /* ── 1. Send a real order to a real phone ─────────────────────────────
     The whole reason this file exists. Everything else here is a convenience. */
  (function () {
    var s = h("section");
    s.appendChild(h("b", "lbl", "1. Send a real order to your phone"));

    var tel = document.createElement("input");
    tel.type = "tel";
    tel.placeholder = "+1 415 555 0199";
    tel.autocomplete = "off";
    s.appendChild(tel);

    var how = document.createElement("select");
    [["sms", "Send as a text message"], ["whatsapp", "Send by WhatsApp"]].forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o[0]; opt.textContent = o[1];
      how.appendChild(opt);
    });
    how.style.marginTop = "8px";
    s.appendChild(how);

    var row = h("div", "row");
    var arm = h("button", "b", "Arm it");
    arm.type = "button";
    var order = h("button", "b g", "Open the order screen");
    order.type = "button";
    row.appendChild(arm); row.appendChild(order);
    s.appendChild(row);

    var msg = h("p", "msg");
    say(msg, "The demo normally draws a picture of the text instead of sending one. Put your own number in, arm it, and the next order really goes.");
    s.appendChild(msg);

    var warn = h("div", "warn");
    warn.hidden = true;
    s.appendChild(warn);

    function disarm() {
      armed = false;
      CFG.order.demo = true;
      CFG.order.phone = "+1 (555) 010-2288";
      CFG.order.method = "sms";
      panel.classList.remove("armed");
      arm.textContent = "Arm it";
      arm.className = "b";
      warn.hidden = true;
      say(msg, "Back to demo mode. Orders draw a picture again and nothing is sent.");
    }

    arm.addEventListener("click", function () {
      if (armed) return disarm();
      var digits = tel.value.replace(/[^0-9]/g, "");
      if (digits.length < 10) {
        say(msg, "That does not look like a full number. Include the country code, for example +1 415 555 0199.", "bad");
        return;
      }
      realPhone = tel.value.trim();
      armed = true;
      CFG.order.demo = false;
      CFG.order.phone = realPhone;
      CFG.order.method = how.value;
      panel.classList.add("armed");
      arm.textContent = "Disarm";
      arm.className = "b r";
      warn.hidden = false;
      warn.textContent = "Armed. Orders now go to " + realPhone + " for real. Your number is only in this browser tab, never saved and never in the address bar, and it is gone when you reload.";
      say(msg, "Open the order screen, add something, hit send. Your phone should offer to send the message.", "ok");
    });

    order.addEventListener("click", function () {
      if (window.RPChat) window.RPChat.openOrder();
    });

    body.appendChild(s);
  })();

  /* ── 2. Ask the chat everything a diner would ─────────────────────────
     Uses the widget's own matcher through RPChat.findAnswer. Never a copy of
     the scoring rules: a copy drifts, and a drifted copy reports a question as
     answered when it is not. The widget's own note on this is that a guessed
     answer to "is this gluten free" is a hospital visit. */
  (function () {
    var s = h("section");
    s.appendChild(h("b", "lbl", "2. Find the questions it cannot answer"));

    var ta = document.createElement("textarea");
    ta.value = [
      "are you open on christmas day",
      "do you have gluten free bases",
      "is there wheelchair access",
      "do you take american express",
      "can i pay cash",
      "how long is the wait right now",
      "do you have highchairs",
      "is there outdoor seating",
      "do you do gift cards",
      "can i bring my own wine",
      "do you have nut allergies covered",
      "is parking free"
    ].join("\n");
    s.appendChild(ta);

    var row = h("div", "row");
    var go = h("button", "b", "Run them");
    go.type = "button";
    row.appendChild(go);
    s.appendChild(row);

    var msg = h("p", "msg");
    say(msg, "One question a line. Anything it cannot answer is a gap the owner needs to fill in.");
    s.appendChild(msg);
    var out = h("ul", "res");
    s.appendChild(out);

    go.addEventListener("click", function () {
      out.innerHTML = "";
      if (!window.RPChat || !window.RPChat.findAnswer) {
        say(msg, "The chat has not finished loading. Give it a second and try again.", "bad");
        return;
      }
      var qs = ta.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      var missed = 0;
      qs.forEach(function (q) {
        var hit = window.RPChat.findAnswer(q);
        if (!hit) missed++;
        var li = document.createElement("li");
        var mark = h("i", hit ? "y" : "n", hit ? "✓" : "✕");
        var wrap = document.createElement("div");
        wrap.appendChild(document.createTextNode(q));
        wrap.appendChild(h("span", null, hit ? "answered by: " + (hit.chip || (hit.q && hit.q[0]) || "an entry")
                                             : "no answer, it would hand out the phone number"));
        li.appendChild(mark); li.appendChild(wrap);
        out.appendChild(li);
      });
      say(msg, missed
        ? missed + " of " + qs.length + " have no answer. Each one is a real diner who gets told to call instead."
        : "All " + qs.length + " answered.", missed ? "bad" : "ok");
    });

    body.appendChild(s);
  })();

  /* ── 3. The approval screen, with fake reviews ────────────────────────
     Seeded into rpdemo.queue, never rp.queue. approve.html?q=rpdemo.queue reads
     that key instead, so the real feed is untouched. */
  (function () {
    var s = h("section");
    s.appendChild(h("b", "lbl", "3. The owner's approval screen"));

    var row = h("div", "row");
    var seed = h("button", "b", "Put 3 reviews in");
    seed.type = "button";
    var open = h("button", "b g", "Open it");
    open.type = "button";
    row.appendChild(seed); row.appendChild(open);
    s.appendChild(row);

    var msg = h("p", "msg");
    say(msg, "Fake reviews, kept in their own store. Your real approval feed is not touched.");
    s.appendChild(msg);

    /* Field names match exactly what console.js writes into the real queue, so
       what you walk an owner through is the same screen they will really get.
       The two-star one is deliberate: its first sentence is warm praise and the
       rest is anger. That is the review that breaks any pipeline reading only
       the snippet out of Google's notification email. */
    var SAMPLES = [
      { source: "google", author: "Dani R.", rating: 5,
        text: "Best margherita in the city and the staff actually seemed pleased to see us. We will be back on Friday.",
        reply: "Thank you Dani, that means a lot. The margherita is the one we fuss over most, so it is good to hear. See you Friday.",
        cls: { sentiment: "positive", risk: "low", reason: "Praise, nothing to resolve" } },
      { source: "google", author: "M. Whitfield", rating: 2,
        text: "Food was genuinely excellent, best carbonara I have had in months. Then our server rolled her eyes at my wife, forgot the second round, and charged us for a bottle we never opened. Three of us walked out angry.",
        reply: "I am sorry. Being charged for something you did not order, on top of feeling talked down to, is not how anyone should end an evening here. I have refunded the bottle and I am speaking to the team about the rest myself. If you will let me, I would like to have you back as my guests.",
        cls: { sentiment: "negative", risk: "high", reason: "Billing error and a complaint about staff. Opens warmly, so read all of it" } },
      { source: "google", author: "Priya S.", rating: 4,
        text: "Lovely food, only gripe is the wait at 8pm on a Saturday. Worth it though.",
        reply: "Thanks Priya, and fair point. Saturday at eight is the busiest the one oven gets. If you ever want to skip the wait, you can order ahead on our site and pick up.",
        cls: { sentiment: "mixed", risk: "medium", reason: "Happy overall, one fixable gripe" } }
    ];

    seed.addEventListener("click", function () {
      try {
        var now = Date.now();
        localStorage.setItem(DEMO_QUEUE, JSON.stringify(SAMPLES.map(function (r, i) {
          return {
            id: "demo" + i, client: "The Olive Table", added: now - i * 3600000,
            source: r.source, author: r.author, rating: r.rating,
            text: r.text, reply: r.reply, cls: r.cls, status: "pending"
          };
        })));
        say(msg, "Three in. The two-star one is the interesting one: read the whole review, not the first sentence.", "ok");
      } catch (e) {
        say(msg, "Could not write to storage: " + e.message, "bad");
      }
    });

    open.addEventListener("click", function () {
      window.open("./approve.html?q=" + encodeURIComponent(DEMO_QUEUE), "_blank", "noopener");
    });

    body.appendChild(s);
  })();

  /* ── 4. The rest of the surface ───────────────────────────────────────
     Deliberately no link to console.html. chat-demo.html carries a noindex tag,
     console.html does not, and there is no robots.txt. On GitHub Pages there is
     no password to put on it, so the only thing keeping the operator console
     unfound is that nothing anywhere links to it. Keep it that way. */
  (function () {
    var s = h("section");
    s.appendChild(h("b", "lbl", "4. The other pieces"));
    [["./how.html", "The walkthrough that plays itself"],
     ["./qr-code.html", "The QR code maker"],
     ["./r.html?c=demo", "The one-link version, for owners with no website"],
     ["./websites.html", "The websites page"]
    ].forEach(function (l) {
      var a = h("a", "b", l[1]);
      a.href = l[0]; a.target = "_blank"; a.rel = "noopener";
      s.appendChild(a);
    });
    body.appendChild(s);
  })();

  /* ── 5. Clean up, rpdemo.* only ───────────────────────────────────────
     Scoped on purpose. There is no "wipe everything" here and there should not
     be: rp.* holds every client, every lead and the timing log the price rests
     on, and until the console's backup button has been used there is no copy of
     any of it. */
  (function () {
    var s = h("section");
    s.appendChild(h("b", "lbl", "5. Clean up"));
    var row = h("div", "row");
    var clr = h("button", "b g", "Clear the demo data");
    clr.type = "button";
    row.appendChild(clr);
    s.appendChild(row);
    var msg = h("p", "msg");
    say(msg, "Removes the fake reviews only. Nothing of yours is touched.");
    s.appendChild(msg);
    clr.addEventListener("click", function () {
      var n = 0;
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf("rpdemo.") === 0) { localStorage.removeItem(k); n++; }
      });
      say(msg, n ? "Cleared " + n + " demo item(s)." : "There was nothing to clear.", "ok");
    });
    body.appendChild(s);
  })();

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(panel);
    document.body.appendChild(opener);
    /* Say out loud, at the top of the page, that this is not the normal demo. */
    var bar = document.querySelector(".demobar");
    if (bar) {
      bar.style.background = "#b8412c";
      bar.style.color = "#fff";
      bar.textContent = "TEST BENCH. This is the demo with the test panel open, bottom left. Drop the ?test from the address to get the normal page back.";
    }
  });
})();
