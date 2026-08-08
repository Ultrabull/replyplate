/* ReplyPlate website chat helper.
   Answers the questions a restaurant gets asked all day, and optionally takes a
   pickup order that the customer sends from their own phone.

   DESIGN RULES, do not break them:

   1. No AI, no network requests. This widget can only ever return an answer the
      owner wrote. A guessed answer to "is this gluten free" is a hospital visit,
      not an embarrassment. Below the match threshold it says so and hands over a
      real way to ask.

   2. Ordering never takes money and never routes the order itself. The customer
      taps items, then sends the finished order from their own phone to the
      restaurant's phone number. A text message by default, because that is what
      a US restaurant already has; set method:"whatsapp" for the ones that live
      in it instead. That means no card handling, no refunds, and no order
      sitting unseen in a dashboard nobody opens. It also verifies the customer
      for free, because the message arrives from their real number.

   3. Prices are only ever what the owner typed. Totals are computed here in
      plain arithmetic, never inferred.

   Usage:
     <script>window.RP_CHAT = { name:"...", phone:"...", answers:[...], menu:[...], order:{...} };</script>
     <script src="https://reply-plate.com/chat-widget.js" defer></script>
*/
(function () {
  "use strict";
  var C = window.RP_CHAT;
  if (!C || !C.answers || !C.answers.length) return;

  var ORDER = C.order && C.order.enabled && C.menu && C.menu.length ? C.order : null;
  // Embed mode: render inline on a page of its own instead of floating over a
  // restaurant's site. Used by r.html, the link-and-QR version for owners who
  // cannot or will not paste code into their website.
  var MOUNT = C.embed ? document.getElementById(C.embed) : null;
  var CUR = (ORDER && ORDER.currency) || "$";

  var STOP = "a an and are as at be but by can could do does for from get had has have how i if in is it its me my of on or our so than that the their them there they this to was we what when where which who will with would you your".split(" ");
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
  function tokens(s) { return norm(s).split(" ").filter(function (w) { return w && !STOPSET[w] && w.length > 1; }); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) { return CUR + n.toFixed(2); }

  function score(qTokens, qNorm, entry) {
    /* The chip label counts as a phrasing: people type what they saw on the button. */
    var best = 0, phrasings = [].concat(entry.q || []);
    if (entry.chip) phrasings.push(entry.chip);
    for (var i = 0; i < phrasings.length; i++) {
      var pNorm = norm(phrasings[i]);
      if (!pNorm) continue;
      if (qNorm && (qNorm.indexOf(pNorm) !== -1 || pNorm.indexOf(qNorm) !== -1)) { best = Math.max(best, 0.95); continue; }
      var pt = tokens(phrasings[i]);
      if (!pt.length || !qTokens.length) continue;
      var hit = 0;
      for (var j = 0; j < qTokens.length; j++) {
        for (var k = 0; k < pt.length; k++) {
          if (qTokens[j] === pt[k] || (qTokens[j].length > 4 && pt[k].indexOf(qTokens[j]) === 0) || (pt[k].length > 4 && qTokens[j].indexOf(pt[k]) === 0)) { hit++; break; }
        }
      }
      best = Math.max(best, ((hit / qTokens.length) * 0.65) + ((hit / pt.length) * 0.35));
    }
    return best;
  }

  var THRESHOLD = 0.45;
  function findAnswer(q) {
    var qTokens = tokens(q), qNorm = norm(q);
    if (!qTokens.length) {
      /* Every word was a common one, as in "what do i get". Keep them rather than
         giving up: whole-phrase matching still works, and these are the questions
         people ask most. */
      qTokens = qNorm.split(" ").filter(function (w) { return w.length > 1; });
    }
    if (!qTokens.length) return null;
    var top = null, topScore = 0;
    C.answers.forEach(function (e) { var s = score(qTokens, qNorm, e); if (s > topScore) { topScore = s; top = e; } });
    return topScore >= THRESHOLD ? top : null;
  }

  var accent = C.accent || "#b03d29";
  var css = ''
    + '.rpc-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;background:' + accent + ';color:#fff;border:none;border-radius:999px;padding:13px 20px;font:600 15px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.22);cursor:pointer;display:flex;align-items:center;gap:8px}'
    + '.rpc-btn:hover{filter:brightness(.93)}'
    + '.rpc-panel{position:fixed;right:18px;bottom:18px;z-index:2147483001;width:min(370px,calc(100vw - 24px));height:min(580px,calc(100vh - 36px));height:min(580px,calc(100dvh - 36px));background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;overscroll-behavior:contain;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1c1613}'
    + '.rpc-panel.open{display:flex}'
    + '.rpc-head{background:' + accent + ';color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex:0 0 auto}'
    + '.rpc-head b{font-size:15.5px}.rpc-head small{display:block;opacity:.9;font-size:12.5px;font-weight:400}'
    + '.rpc-x{background:none;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 2px}'
    + '.rpc-back{background:none;border:none;color:#fff;font:600 14px inherit;cursor:pointer;padding:0}'
    + '.rpc-view{flex:1;display:none;flex-direction:column;min-height:0}'
    + '.rpc-view.on{display:flex}'
    + '.rpc-log{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f8f5ef}'
    + '.rpc-msg{max-width:88%;padding:10px 13px;border-radius:14px;font-size:14.5px;white-space:pre-wrap}'
    + '.rpc-bot{background:#fff;border:1px solid #e6ddd1;align-self:flex-start;border-bottom-left-radius:5px}'
    + '.rpc-you{background:' + accent + ';color:#fff;align-self:flex-end;border-bottom-right-radius:5px}'
    + '.rpc-chips{display:flex;flex-wrap:wrap;gap:7px}'
    + '.rpc-chip{background:#fff;border:1px solid #e6ddd1;color:' + accent + ';font:600 13px inherit;padding:7px 12px;border-radius:999px;cursor:pointer}'
    + '.rpc-chip:hover{background:#f7ece4}'
    + '.rpc-chip.more{border-style:dashed;color:#8a7b6e}'
    + '.rpc-chip.go{background:' + accent + ';color:#fff;border-color:' + accent + '}'
    + '.rpc-form{display:flex;gap:8px;padding:11px;border-top:1px solid #e6ddd1;background:#fff;flex:0 0 auto}'
    + '.rpc-in{flex:1;border:1px solid #e6ddd1;border-radius:10px;padding:10px 12px;font:15px inherit;outline:none;min-width:0;background:#fff;color:#1c1613;-webkit-appearance:none;appearance:none;box-shadow:none;margin:0;letter-spacing:normal;text-transform:none}'
    + '.rpc-in:focus{border-color:' + accent + '}'
    + '.rpc-send{background:' + accent + ';color:#fff;border:none;border-radius:10px;padding:0 16px;font:700 15px inherit;cursor:pointer}'
    + '.rpc-foot{font-size:11px;color:#8a7b6e;text-align:center;padding:0 0 9px;background:#fff;flex:0 0 auto}'
    /* Ordering has to be visible the whole time, not a chip that scrolls away. */
    + '.rpc-orderbar{flex:0 0 auto;display:flex;align-items:center;gap:10px;width:100%;text-align:left;'
    +   'background:#fff;border:none;border-bottom:1px solid #e6ddd1;padding:12px 14px;min-height:52px;cursor:pointer;font:inherit;color:#1c1613}'
    + '.rpc-orderbar:hover{background:#faf5ee}'
    + '.rpc-orderbar .ic{width:30px;height:30px;border-radius:9px;background:' + accent + ';color:#fff;flex:0 0 auto;'
    +   'display:flex;align-items:center;justify-content:center;font-size:16px}'
    + '.rpc-orderbar .tx{flex:1;min-width:0}'
    + '.rpc-orderbar .tx b{display:block;font-size:14.5px;font-weight:700}'
    + '.rpc-orderbar .tx span{display:block;font-size:12.5px;color:#8a7b6e}'
    + '.rpc-orderbar .ar{color:' + accent + ';font-weight:700;flex:0 0 auto}'
    /* order view */
    + '.rpc-menu{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:12px 14px;background:#f8f5ef}'
    + '.rpc-sec{font:800 11px inherit;text-transform:uppercase;letter-spacing:.5px;color:#8a7b6e;margin:14px 0 7px}'
    + '.rpc-sec:first-child{margin-top:2px}'
    + '.rpc-offer{background:#fff5e2;border-bottom:1px solid #e8d5ad;padding:10px 14px;font-size:13px;line-height:1.35;color:#6a4f14}'
    + '.rpc-offer b{display:block;font-weight:800;color:#4d390b}'
    + '.rpc-offer span{display:block;color:#8a7038;font-size:12px;margin-top:1px}'
    + '.rpc-view .rpc-offer{border-bottom:1px solid #e8d5ad;border-top:none}'
    + '.rpc-btn.hasoffer::after{content:"";position:absolute;top:6px;right:8px;width:9px;height:9px;border-radius:50%;background:#ffd979;box-shadow:0 0 0 2px rgba(0,0,0,.18)}'
    + '.rpc-loy{background:#f3ece1;border:1px dashed #cbb79b;border-radius:9px;padding:8px 11px;margin-bottom:8px;font-size:12.5px;color:#6b5c48;line-height:1.4}'
    + '.rpc-loy.due{background:#eaf6ef;border-color:#7fbf9b;color:#1f6a45;font-weight:700;border-style:solid}'
    + '.rpc-item{background:#fff;border:1px solid #e6ddd1;border-radius:11px;padding:10px 12px;margin-bottom:7px;display:flex;align-items:center;gap:10px}'
    + '.rpc-item .nm{flex:1;min-width:0;font-size:14.5px}'
    + '.rpc-item .nm em{display:block;color:#8a7b6e;font-size:12.5px;font-style:normal}'
    + '.rpc-item .pr{font-weight:700;font-size:14px;white-space:nowrap}'
    + '.rpc-add{background:' + accent + ';color:#fff;border:none;width:30px;height:30px;border-radius:8px;font:700 18px/1 inherit;cursor:pointer;flex:0 0 auto}'
    + '.rpc-qty{display:flex;align-items:center;gap:7px;flex:0 0 auto}'
    + '.rpc-qty button{background:#f7ece4;color:' + accent + ';border:none;width:28px;height:28px;border-radius:7px;font:700 16px/1 inherit;cursor:pointer}'
    + '.rpc-qty span{font-weight:700;min-width:14px;text-align:center}'
    + '.rpc-basket{border-top:1px solid #e6ddd1;background:#fff;padding:11px 14px;flex:0 0 auto}'
    + '.rpc-tot{display:flex;justify-content:space-between;font-weight:700;margin-bottom:9px;font-size:15px}'
    + '.rpc-name{width:100%;border:1px solid #e6ddd1;border-radius:10px;padding:9px 11px;font:14.5px inherit;outline:none;margin-bottom:8px;background:#fff;color:#1c1613;-webkit-appearance:none;appearance:none;box-shadow:none;letter-spacing:normal;text-transform:none}'
    + '.rpc-go{width:100%;background:' + accent + ';color:#fff;border:none;border-radius:11px;padding:12px;font:700 15px inherit;cursor:pointer}'
    + '.rpc-go:disabled{opacity:.45;cursor:default}'
    + '.rpc-hint{font-size:11.5px;color:#8a7b6e;text-align:center;margin-top:7px;line-height:1.45}'
    /* what the owner's phone shows, used by the demo and after a real send */
    /* flex:0 0 auto, or the log's flex column squashes the message and clips it */
    + '.rpc-wa{flex:0 0 auto;background:#fff;border:1px solid #e6ddd1;border-radius:14px;margin:2px 0 4px;overflow:hidden;max-width:100%}'
    + '.rpc-wa .hd{background:#075e54;color:#fff;padding:9px 12px;font:700 12.5px inherit;display:flex;align-items:center;gap:7px}'
    + '.rpc-wa .hd i{width:8px;height:8px;border-radius:50%;background:#25d366;font-style:normal;flex:0 0 auto}'
    + '.rpc-wa .bd{padding:11px 12px;background:#ece5dd}'
    + '.rpc-wa pre{background:#fff;border-radius:9px;padding:10px 11px;margin:0;font-family:inherit;font-size:13.5px;line-height:1.5;'
    +   'white-space:pre-wrap;word-break:break-word;color:#22201d;box-shadow:0 1px 1px rgba(0,0,0,.08)}'
    + '.rpc-embed{position:static;right:auto;bottom:auto;width:100%;height:min(620px,calc(100vh - 150px));display:flex;box-shadow:0 6px 24px rgba(0,0,0,.10);border:1px solid #e6ddd1}'
    /* On a phone, pin the panel by its edges. Never size it with 100vh: iOS reports
       the URL-bar-hidden height, so a vh panel is taller than the screen and its
       header hides underneath Safari's bar. Insets resolve against what you can see. */
    + '@media (max-width:420px){'
    +   '.rpc-panel{left:8px;right:8px;width:auto;height:auto;'
    +     'top:8px;top:max(8px,env(safe-area-inset-top));'
    +     'bottom:8px;bottom:max(8px,env(safe-area-inset-bottom))}'
    +   '.rpc-btn{right:12px;bottom:12px;bottom:max(12px,env(safe-area-inset-bottom))}'
    +   '.rpc-embed{position:static;top:auto;right:auto;left:auto;bottom:auto;height:min(620px,calc(100dvh - 190px))}'
    + '}';

  var style = document.createElement("style"); style.textContent = css;
  document.head.appendChild(style);

  /* The launcher has to say ordering is here, or nobody finds it. */
  var launchText = C.buttonText || (ORDER ? "Order food or ask us" : "Ask us a question");
  var btn = document.createElement("button");
  btn.className = "rpc-btn"; btn.type = "button";
  btn.setAttribute("aria-label", launchText);
  btn.innerHTML = '<span aria-hidden="true">' + (ORDER ? "🍽" : "💬") + '</span><span>' + esc(launchText) + '</span>';

  var panel = document.createElement("div");
  panel.className = "rpc-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Ask " + (C.name || "us") + " a question");
  panel.innerHTML = ''
    + '<div class="rpc-head"><div><b id="rpcTitle">' + esc(C.name || "Ask us") + '</b><small id="rpcSub">' + esc(C.subtitle || (ORDER ? "Order pickup, or ask us anything" : "Quick answers, any time")) + '</small></div>'
    + '<div style="display:flex;align-items:center;gap:12px"><button class="rpc-back" id="rpcBack" type="button" style="display:none">‹ Back</button>'
    + '<button class="rpc-x" type="button" aria-label="Close">&times;</button></div></div>'
    + '<div class="rpc-view on" id="rpcChatView">'
    + (ORDER
        ? '  <button class="rpc-orderbar" id="rpcOrderBar" type="button">'
        +   '<span class="ic" aria-hidden="true">🍽</span>'
        +   '<span class="tx"><b>' + esc(ORDER.chip || "Order for pickup") + '</b>'
        +   '<span>' + esc(ORDER.barNote || "Tap the menu, pay when you pick up") + '</span></span>'
        +   '<span class="ar" aria-hidden="true">›</span></button>'
        : '')
    + '  <div class="rpc-offer" hidden></div>'
    + '  <div class="rpc-log" id="rpcLog"></div>'
    + '  <form class="rpc-form"><input class="rpc-in" id="rpcIn" placeholder="Type your question" autocomplete="off" /><button class="rpc-send" type="submit">Ask</button></form>'
    + '  <div class="rpc-foot">Answers written by ' + esc(C.name || "the restaurant") + '</div>'
    + '</div>'
    + '<div class="rpc-view" id="rpcOrderView">'
    + '  <div class="rpc-offer" hidden></div>'
    + '  <div class="rpc-menu" id="rpcMenu"></div>'
    + '  <div class="rpc-basket">'
    + '    <div class="rpc-loy" id="rpcLoy" hidden></div>'
    + '    <div class="rpc-tot"><span id="rpcCount">Nothing yet</span><span id="rpcTotal"></span></div>'
    + '    <input class="rpc-name" id="rpcWho" placeholder="Your name" autocomplete="name" />'
    + '    <button class="rpc-go" id="rpcGo" type="button" disabled>Send this order</button>'
    + '    <div class="rpc-hint" id="rpcHint"></div>'
    + '  </div>'
    + '</div>';

  if (MOUNT) {
    panel.classList.add("rpc-embed", "open");
    panel.querySelector(".rpc-x").style.display = "none";
    MOUNT.appendChild(panel);
  } else {
    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  var log = panel.querySelector("#rpcLog"), input = panel.querySelector("#rpcIn");
  var chatView = panel.querySelector("#rpcChatView"), orderView = panel.querySelector("#rpcOrderView");
  var backBtn = panel.querySelector("#rpcBack"), title = panel.querySelector("#rpcTitle"), sub = panel.querySelector("#rpcSub");

  function bubble(text, who) {
    var d = document.createElement("div");
    d.className = "rpc-msg " + (who === "you" ? "rpc-you" : "rpc-bot");
    d.textContent = text;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
  }
  /* How many topics to show before the "more" chip. Showing four out of
     seventeen made the helper look like it barely knew anything, which is the
     opposite of the truth and the opposite of what it is for. */
  var CHIPS_SHOWN = 6;

  function chipFor(e, wrap) {
    var label = (e.chip || (e.q && e.q[0]) || "").trim();
    if (!label) return null;
    var c = document.createElement("button");
    c.className = "rpc-chip"; c.type = "button"; c.textContent = label;
    /* A chip already knows its answer, so hand it over. Never search for it:
       the chip label is a heading, not one of the phrasings, so "What it costs"
       could score below the threshold and fall back on its own answer. */
    c.addEventListener("click", function () { ask(label, e); });
    wrap.appendChild(c);
    return c;
  }

  function chips() {
    var wrap = document.createElement("div"); wrap.className = "rpc-chips";
    var shown = C.answers.slice(0, CHIPS_SHOWN);
    var rest = C.answers.slice(CHIPS_SHOWN);
    shown.forEach(function (e) { chipFor(e, wrap); });

    if (rest.length) {
      var more = document.createElement("button");
      more.className = "rpc-chip more"; more.type = "button";
      more.textContent = "+ " + rest.length + " more";
      more.addEventListener("click", function () {
        more.remove();
        rest.forEach(function (e) { chipFor(e, wrap); });
        log.scrollTop = log.scrollHeight;
      });
      wrap.appendChild(more);
    }
    log.appendChild(wrap); log.scrollTop = log.scrollHeight;
  }
  function fallback() {
    var lines = ["I'm not sure about that one, and I'd rather check than guess."];
    if (C.phone) lines.push("Give us a ring on " + C.phone + " and we'll tell you straight away.");
    else if (C.email) lines.push("Drop us a line at " + C.email + " and we'll come back to you.");
    return lines.join("\n\n");
  }
  function ask(q, known) {
    q = String(q || "").trim(); if (!q) return;
    bubble(q, "you"); input.value = "";
    var hit = known || findAnswer(q);
    setTimeout(function () {
      bubble(hit ? hit.a : fallback(), "bot");
      /* A miss should not be a dead end. Put the things it does know back on screen. */
      if (!hit) chips();
    }, 220);
  }

  /* ---- ordering ---- */
  var basket = {};   // key -> {name, price, qty}

  function basketList() {
    return Object.keys(basket).map(function (k) { return basket[k]; }).filter(function (b) { return b.qty > 0; });
  }
  function total() {
    return basketList().reduce(function (a, b) { return a + (b.price * b.qty); }, 0);
  }
  function refreshBasket() {
    var list = basketList();
    var n = list.reduce(function (a, b) { return a + b.qty; }, 0);
    panel.querySelector("#rpcCount").textContent = n ? (n + (n === 1 ? " item" : " items")) : "Nothing yet";
    panel.querySelector("#rpcTotal").textContent = n ? money(total()) : "";
    panel.querySelector("#rpcGo").disabled = !n;
    var card = panel.querySelector("#rpcLoy");
    if (card) {
      var line = loyLine();
      card.textContent = line;
      card.hidden = !line;
      card.className = "rpc-loy" + (loyDue() ? " due" : "");
    }
  }
  function itemRow(it) {
    var key = it.name;
    var row = document.createElement("div"); row.className = "rpc-item";
    var nm = document.createElement("div"); nm.className = "nm";
    nm.innerHTML = esc(it.name) + (it.note ? "<em>" + esc(it.note) + "</em>" : "");
    var pr = document.createElement("div"); pr.className = "pr"; pr.textContent = money(it.price);
    var ctl = document.createElement("div");
    function render() {
      ctl.innerHTML = "";
      var cur = basket[key] ? basket[key].qty : 0;
      if (!cur) {
        var add = document.createElement("button");
        add.className = "rpc-add"; add.type = "button"; add.textContent = "+";
        add.setAttribute("aria-label", "Add " + it.name);
        add.addEventListener("click", function () { basket[key] = { name: it.name, price: it.price, qty: 1 }; render(); refreshBasket(); });
        ctl.appendChild(add);
      } else {
        var q = document.createElement("div"); q.className = "rpc-qty";
        var minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−";
        minus.setAttribute("aria-label", "Remove one " + it.name);
        minus.addEventListener("click", function () { basket[key].qty--; if (basket[key].qty <= 0) delete basket[key]; render(); refreshBasket(); });
        var span = document.createElement("span"); span.textContent = cur;
        var plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+";
        plus.setAttribute("aria-label", "Add another " + it.name);
        plus.addEventListener("click", function () { basket[key].qty++; render(); refreshBasket(); });
        q.appendChild(minus); q.appendChild(span); q.appendChild(plus);
        ctl.appendChild(q);
      }
    }
    render();
    row.appendChild(nm); row.appendChild(pr); row.appendChild(ctl);
    return row;
  }
  function buildMenu() {
    var m = panel.querySelector("#rpcMenu");
    if (m.childNodes.length) return;
    C.menu.forEach(function (sec) {
      if (sec.section) {
        var h = document.createElement("div"); h.className = "rpc-sec"; h.textContent = sec.section;
        m.appendChild(h);
      }
      (sec.items || []).forEach(function (it) { if (it && it.name) m.appendChild(itemRow(it)); });
    });
    panel.querySelector("#rpcHint").textContent = ORDER.note ||
      "You'll send this from your own phone. Nothing is paid here, and " + (C.name || "the restaurant") + " will confirm before you come.";
  }

  /* ── The loyalty card ──────────────────────────────────────────────────
     Order five times, the sixth garlic bread is free. The oldest trick in
     hospitality, and the only one on this page aimed at getting somebody back
     rather than getting them in.

     It is kept on the diner's own phone, because this widget has no server and
     never will. So yes, somebody could clear their browser and start again, or
     count up on a second phone.

     That is fine, and it is worth saying why. A paper stamp card is forgeable
     with a rubber stamp off the internet, and restaurants have used them for a
     hundred years anyway, because the habit it builds is worth more than the
     occasional free coffee it loses. The ceiling on this fraud is one free side.

     The owner is still the last check: the claim is written into the order text
     they receive, so they see it before they give anything away.

     Nothing here identifies anybody. No name, no number, no tracking, just a
     count against this restaurant on this device. */
  var LOY = C.loyalty && C.loyalty.enabled && +C.loyalty.every > 1 ? C.loyalty : null;
  var LOY_KEY = "rpc.loy." + norm(C.name || "x").replace(/\s+/g, "-");

  function loyGet() {
    if (!LOY) return 0;
    try { return Math.max(0, parseInt(localStorage.getItem(LOY_KEY), 10) || 0); }
    catch (e) { return 0; }   /* private mode, or storage refused. Silent. */
  }
  function loySet(n) {
    if (!LOY) return;
    try { localStorage.setItem(LOY_KEY, String(n)); } catch (e) {}
  }
  function loyDue() { return LOY ? loyGet() + 1 >= +LOY.every : false; }

  /* The line a diner reads. It has to be honest about where the count lives,
     without turning a free side into a paragraph about browser storage. */
  function loyLine() {
    if (!LOY) return "";
    var have = loyGet(), need = +LOY.every, left = need - have;
    var reward = LOY.reward || "something on the house";
    if (left <= 1) return "This one earns you " + reward + ". Mention it when you pick up.";
    return have === 0
      ? "Order " + need + " times and get " + reward + "."
      : have + " of " + need + ". " + (left - 1 === 0 ? "Next one" : left - 1 + " more") + " and you get " + reward + ".";
  }


  /* ── Tonight's offer ───────────────────────────────────────────────────
     A restaurant's problem is rarely Saturday. It is Tuesday. So an offer that
     shows itself only on the nights that need filling, and takes itself down
     again, without the owner having to remember either.

     Config, all fields but text optional:

       offers: [{
         text:  "Two for one on pizzas",
         sub:   "Tuesday and Wednesday, 5pm to 9pm",
         days:  [2, 3],            // 0 Sunday to 6 Saturday. Omit for every day
         from:  "17:00", to: "21:00",
         until: "2026-12-31"       // hard stop, see below
       }]

     THE until DATE IS THE IMPORTANT ONE. The way an offer system fails is never
     the showing, it is the taking down. A Christmas deal still up in March makes
     a restaurant look abandoned, and it is the owner's phone that rings about
     it. So an offer past its date does not render at all, whatever else matches.

     Times come off the diner's own device clock, which for somebody deciding
     where to eat nearby is the restaurant's clock too. */
  var OFFERS = [].concat(C.offers || []).filter(function (o) { return o && o.text; });

  function mins(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function offerOn(o, now) {
    if (o.until) {
      /* Parsed as a local date, not UTC, so an offer ending "today" survives
         today wherever the diner is standing. */
      var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(o.until));
      if (p) {
        var end = new Date(+p[1], +p[2] - 1, +p[3], 23, 59, 59);
        if (now > end) return false;
      }
    }
    if (o.days && o.days.length && o.days.indexOf(now.getDay()) === -1) return false;
    var t = now.getHours() * 60 + now.getMinutes();
    var a = mins(o.from), b = mins(o.to);
    if (a !== null && t < a) return false;
    if (b !== null && t > b) return false;
    return true;
  }
  /* First match wins. Predictable beats clever when an owner is trying to work
     out why the wrong thing is on their website. */
  function liveOffer() {
    if (!OFFERS.length) return null;
    var now = new Date();
    for (var i = 0; i < OFFERS.length; i++) if (offerOn(OFFERS[i], now)) return OFFERS[i];
    return null;
  }
  function paintOffer() {
    var o = liveOffer();
    [].slice.call(panel.querySelectorAll(".rpc-offer")).forEach(function (n) {
      n.innerHTML = "";
      n.hidden = !o;
      if (!o) return;
      var b = document.createElement("b"); b.textContent = o.text;
      n.appendChild(b);
      if (o.sub) { var s = document.createElement("span"); s.textContent = o.sub; n.appendChild(s); }
    });
    if (btn) btn.classList.toggle("hasoffer", !!o);
  }

  function orderText() {
    var lines = ["Order from your website:", ""];
    basketList().forEach(function (b) { lines.push(b.qty + " x " + b.name); });
    lines.push("", "Total: about " + money(total()));
    var who = panel.querySelector("#rpcWho").value.trim();
    if (who) lines.push("Name: " + who);
    if (ORDER.mode) lines.push(ORDER.mode);
    /* The owner is the last check on the card, so the claim has to be in the
       message they read, not only on the diner's screen. */
    if (LOY && loyDue()) {
      lines.push("", "*** " + (LOY.reward || "A free item") + " earned, order " + LOY.every + " of " + LOY.every + " ***");
    }
    /* Say the offer was on screen, never that a discount was applied. Prices
       here are only ever the ones the owner typed, so the till is still theirs. */
    var off = liveOffer();
    if (off) lines.push("", "Offer showing: " + off.text);
    return lines.join("\n");
  }
  /* Orders go by text. Every US restaurant already has a number that receives
     them, far fewer run WhatsApp, and an order that needs an app the diner has
     not installed is an order lost. Nothing in the console or on any page offers
     WhatsApp any more; this branch survives only for a config hand-written with
     method:"whatsapp", which no US client has needed. */
  function isWa() { return ORDER.method === "whatsapp"; }

  /* Turn whatever the owner typed into +<country><number>. The dangerous case
     is a US number typed without its +1: stripping "415-555-0199" to digits and
     gluing a "+" on the front makes +4155550199, which is a Swiss number. So a
     bare 10-digit number is treated as US, an 11-digit one starting 1 gets its
     plus back, and anything already carrying a + is trusted as typed. */
  function e164(raw) {
    var str = String(raw || "").trim();
    var d = str.replace(/[^0-9]/g, "");
    if (!d) return "";
    if (str.charAt(0) === "+") return "+" + d;
    if (d.length === 10) return "+1" + d;
    if (d.length === 11 && d.charAt(0) === "1") return "+" + d;
    return "+" + d;
  }

  /* Shows what lands on the owner's phone. In demo mode this replaces opening
     WhatsApp, because a demo restaurant has no real number to open. */
  function phonePreview(text) {
    var app = isWa() ? "WhatsApp" : "Messages";
    var d = document.createElement("div");
    d.className = "rpc-wa";
    var hd = document.createElement("div"); hd.className = "hd";
    var dot = document.createElement("i"); hd.appendChild(dot);
    hd.appendChild(document.createTextNode(app + " · " + (ORDER.phone || "the restaurant")));
    var bd = document.createElement("div"); bd.className = "bd";
    var pre = document.createElement("pre"); pre.textContent = text;
    bd.appendChild(pre);
    d.appendChild(hd); d.appendChild(bd);
    log.appendChild(d); log.scrollTop = log.scrollHeight;
  }
  function clearBasket() {
    basket = {}; refreshBasket();
    var m = panel.querySelector("#rpcMenu"); m.innerHTML = ""; buildMenu();
  }
  /* Handing a link to the phone's own app. An anchor that gets clicked is the
     reliable way to do it from inside a tap: window.open with _blank leaves a
     stray blank tab sitting behind Messages on iOS Safari, and on a desktop it
     hands back a perfectly truthy window for a link nothing can handle. */
  function openLink(url) {
    var a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    /* WhatsApp is a web address, so it needs its own tab or the restaurant's
       page is the thing that disappears. sms: is not: giving it a target is
       what leaves a blank tab sitting behind Messages on iOS. */
    if (url.indexOf("http") === 0) a.target = "_blank";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 0);
  }

  function sendOrder() {
    var app = isWa() ? "WhatsApp" : "Messages";
    var text = orderText();

    var full = e164(ORDER.phone);
    if (!full) return;
    var enc = encodeURIComponent(text);
    /* wa.me wants bare digits, sms: wants the + form. Neither tolerates the
       spaces and brackets of a raw "+1 (555) 010-2288". */
    var url = isWa() ? ("https://wa.me/" + full.slice(1) + "?text=" + enc)
                     : ("sms:" + full + "?&body=" + enc);
    openLink(url);
    showChat();

    /* The demo opens the phone for real, same line of code as a paying
       client's site. It used to stop short and show a drawing of a text
       message instead, which asks a restaurant owner to take our word for the
       one part of the product they most need to believe. The demo number is an
       unassigned 555 one, so a message sent to it goes nowhere, and the bubble
       below says so before anybody presses send. */
    if (ORDER.demo) {
      bubble(app + " should have opened on your phone with the order already typed. On a computer " +
        "nothing opens, which is normal.", "bot");
      phonePreview(text);
      bubble("Do not press send: " + (ORDER.phone || "that number") + " is made up for this demo. On your own " +
        "restaurant it is your number, and the order arrives like a text from any other customer, with theirs " +
        "attached. Nothing is paid here.", "bot");
      clearBasket();
      return;   /* a demo order must never earn a stamp on a real card */
    }

    /* Do not branch on whether the link opened. On a desktop an sms: link
       silently does nothing, so "ready to send" would print to somebody who saw
       nothing happen. Say it plainly and always show the order, which is right
       on every device and needs no browser sniffing. */
    bubble("Your order is ready to send in " + app + ". Press send there and " +
      (C.name || "we") + " will confirm shortly.\n\nIf nothing opened, here it is to copy and send to " +
      (ORDER.phone || "us") + " yourself.", "bot");
    phonePreview(text);
    /* Count it only once the order has really been handed to the phone. An
       order that never left the panel must never earn a stamp. */
    if (LOY) {
      var was = loyGet();
      loySet(was + 1 >= +LOY.every ? 0 : was + 1);
      if (was + 1 >= +LOY.every) {
        bubble("That is your card filled. " + (LOY.reward || "Your free item") +
          " is on this order, and it starts again from your next one.", "bot");
      }
    }
    clearBasket();
  }

  function showOrder() {
    paintOffer();
    buildMenu();
    chatView.classList.remove("on"); orderView.classList.add("on");
    backBtn.style.display = ""; title.textContent = ORDER.title || "Order for pickup";
    sub.textContent = ORDER.subtitle || "Tap what you'd like";
    refreshBasket();
  }
  function showChat() {
    orderView.classList.remove("on"); chatView.classList.add("on");
    backBtn.style.display = "none"; title.textContent = C.name || "Ask us";
    sub.textContent = C.subtitle || (ORDER ? "Order pickup, or ask us anything" : "Quick answers, any time");
  }

  /* Hold the page still behind the panel. iOS ignores overflow:hidden on body, so
     the page has to be pinned with position:fixed and put back on close. */
  var lockedAt = 0, locked = false;
  function lockPage() {
    if (locked || MOUNT) return;
    locked = true;
    lockedAt = window.pageYOffset || document.documentElement.scrollTop || 0;
    var s = document.body.style;
    s.position = "fixed"; s.top = -lockedAt + "px"; s.left = "0"; s.right = "0"; s.width = "100%";
    s.overflow = "hidden";
  }
  function unlockPage() {
    if (!locked) return;
    locked = false;
    var s = document.body.style;
    s.position = ""; s.top = ""; s.left = ""; s.right = ""; s.width = ""; s.overflow = "";
    window.scrollTo(0, lockedAt);
  }

  var opened = false;
  function open() {
    paintOffer();
    panel.classList.add("open"); if (!MOUNT) btn.style.display = "none";
    lockPage();
    if (!opened) {
      opened = true;
      bubble(C.greeting || ("Hi! Ask me anything about " + (C.name || "us") + "."), "bot");
      chips();
    }
    /* Never autofocus on a phone: the keyboard springs up over the panel. */
    if (chatView.classList.contains("on") && window.innerWidth > 640) input.focus();
  }
  function close() {
    if (MOUNT) return;
    panel.classList.remove("open"); btn.style.display = "flex";
    unlockPage();
  }

  btn.addEventListener("click", open);
  /* Google Maps lets a restaurant post its own "Order online" link. Somebody
     arriving from that button pressed Order, so land them on the menu rather
     than on the chat and make them find it. openOrder=true in the config, or
     ?order in the address, both do it. */
  if (MOUNT) {
    open();
    var wantsOrder = C.openOrder === true ||
      (typeof location !== "undefined" && /(^|[?&])order(=|&|$)/.test(location.search));
    if (wantsOrder && ORDER) showOrder();
  }

  /* The launcher is fixed, so it floats over whatever is at the bottom of the
     page. On this site that was the footer: seven links and the email address
     sat underneath it and could not be tapped at all. The widget puts the button
     there, so the widget reserves the room for it.

     The padding goes on the last real block rather than on <body>, so it extends
     that element's own background instead of leaving a strip of a different
     colour under a coloured footer. */
  function reserveRoom() {
    if (MOUNT) return;                       // embedded, nothing floats
    var kids = [].slice.call(document.body.children).filter(function (n) {
      if (n === btn || n === panel) return false;
      var tag = n.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK" || tag === "TEMPLATE") return false;
      return n.getBoundingClientRect().height > 0;
    });
    var last = kids[kids.length - 1];
    if (!last) return;
    if (last.dataset.rpcPad === undefined) {
      last.dataset.rpcPad = parseFloat(getComputedStyle(last).paddingBottom) || 0;
    }
    var base = parseFloat(last.dataset.rpcPad) || 0;
    var need = btn.offsetHeight + 34;        // button, plus its own bottom offset and a gap
    if (base < need) last.style.paddingBottom = need + "px";
  }
  /* Re-measure when the button wraps to two lines or the page reflows. */
  if (window.ResizeObserver) {
    try { new ResizeObserver(reserveRoom).observe(btn); } catch (e) {}
  }
  window.addEventListener("resize", reserveRoom);
  if (document.readyState === "complete") reserveRoom();
  else window.addEventListener("load", reserveRoom);
  reserveRoom();
  paintOffer();

  // Public hooks, so a page can drive the widget from its own buttons.
  window.RPChat = {
    open: function () { open(); showChat(); },
    openOrder: function () { if (!ORDER) return open(); open(); showOrder(); },
    close: close,
    /* Read-only, for testing a knowledge base before it goes live. Always use
       these rather than a copy of the scoring rules: a copy that drifts tells
       you a question is answered when it is not. */
    threshold: THRESHOLD,
    findAnswer: findAnswer,
    score: function (q, entry) { return score(tokens(q), norm(q), entry); }
  };
  document.addEventListener("click", function (e) {
    var o = e.target.closest("[data-rp-order]");
    if (o) { e.preventDefault(); window.RPChat.openOrder(); return; }
    var c = e.target.closest("[data-rp-chat]");
    if (c) { e.preventDefault(); window.RPChat.open(); }
  });
  panel.querySelector(".rpc-x").addEventListener("click", close);
  backBtn.addEventListener("click", showChat);
  var orderBar = panel.querySelector("#rpcOrderBar");
  if (orderBar) orderBar.addEventListener("click", showOrder);
  panel.querySelector(".rpc-form").addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
  panel.querySelector("#rpcGo").addEventListener("click", sendOrder);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !panel.classList.contains("open")) return;
    if (orderView.classList.contains("on")) showChat(); else close();
  });
})();
