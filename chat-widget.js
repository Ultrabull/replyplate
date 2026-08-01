/* ReplyPlate website chat helper.
   Answers the questions a restaurant gets asked all day, and optionally takes a
   collection order that the customer sends from their own phone.

   DESIGN RULES, do not break them:

   1. No AI, no network requests. This widget can only ever return an answer the
      owner wrote. A guessed answer to "is this gluten free" is a hospital visit,
      not an embarrassment. Below the match threshold it says so and hands over a
      real way to ask.

   2. Ordering never takes money and never routes the order itself. The customer
      taps items, then sends the finished order from their own WhatsApp or texts.
      That means no card handling, no refunds, and no order sitting unseen in a
      dashboard nobody opens. It also verifies the customer for free, because the
      message arrives from their real number.

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
    var best = 0, phrasings = [].concat(entry.q || []);
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
    if (!qTokens.length) return null;
    var top = null, topScore = 0;
    C.answers.forEach(function (e) { var s = score(qTokens, qNorm, e); if (s > topScore) { topScore = s; top = e; } });
    return topScore >= THRESHOLD ? top : null;
  }

  var accent = C.accent || "#d1452b";
  var css = ''
    + '.rpc-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;background:' + accent + ';color:#fff;border:none;border-radius:999px;padding:13px 20px;font:600 15px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.22);cursor:pointer;display:flex;align-items:center;gap:8px}'
    + '.rpc-btn:hover{filter:brightness(.93)}'
    + '.rpc-panel{position:fixed;right:18px;bottom:18px;z-index:2147483001;width:min(370px,calc(100vw - 24px));height:min(580px,calc(100vh - 36px));background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1a1410}'
    + '.rpc-panel.open{display:flex}'
    + '.rpc-head{background:' + accent + ';color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex:0 0 auto}'
    + '.rpc-head b{font-size:15.5px}.rpc-head small{display:block;opacity:.9;font-size:12.5px;font-weight:400}'
    + '.rpc-x{background:none;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 2px}'
    + '.rpc-back{background:none;border:none;color:#fff;font:600 14px inherit;cursor:pointer;padding:0}'
    + '.rpc-view{flex:1;display:none;flex-direction:column;min-height:0}'
    + '.rpc-view.on{display:flex}'
    + '.rpc-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#fbf7f0}'
    + '.rpc-msg{max-width:88%;padding:10px 13px;border-radius:14px;font-size:14.5px;white-space:pre-wrap}'
    + '.rpc-bot{background:#fff;border:1px solid #eaddcd;align-self:flex-start;border-bottom-left-radius:5px}'
    + '.rpc-you{background:' + accent + ';color:#fff;align-self:flex-end;border-bottom-right-radius:5px}'
    + '.rpc-chips{display:flex;flex-wrap:wrap;gap:7px}'
    + '.rpc-chip{background:#fff;border:1px solid #eaddcd;color:' + accent + ';font:600 13px inherit;padding:7px 12px;border-radius:999px;cursor:pointer}'
    + '.rpc-chip:hover{background:#fbeee6}'
    + '.rpc-chip.go{background:' + accent + ';color:#fff;border-color:' + accent + '}'
    + '.rpc-form{display:flex;gap:8px;padding:11px;border-top:1px solid #eaddcd;background:#fff;flex:0 0 auto}'
    + '.rpc-in{flex:1;border:1px solid #eaddcd;border-radius:10px;padding:10px 12px;font:15px inherit;outline:none;min-width:0}'
    + '.rpc-in:focus{border-color:' + accent + '}'
    + '.rpc-send{background:' + accent + ';color:#fff;border:none;border-radius:10px;padding:0 16px;font:700 15px inherit;cursor:pointer}'
    + '.rpc-foot{font-size:11px;color:#8a7b6e;text-align:center;padding:0 0 9px;background:#fff;flex:0 0 auto}'
    /* order view */
    + '.rpc-menu{flex:1;overflow-y:auto;padding:12px 14px;background:#fbf7f0}'
    + '.rpc-sec{font:800 11px inherit;text-transform:uppercase;letter-spacing:.5px;color:#8a7b6e;margin:14px 0 7px}'
    + '.rpc-sec:first-child{margin-top:2px}'
    + '.rpc-item{background:#fff;border:1px solid #eaddcd;border-radius:11px;padding:10px 12px;margin-bottom:7px;display:flex;align-items:center;gap:10px}'
    + '.rpc-item .nm{flex:1;min-width:0;font-size:14.5px}'
    + '.rpc-item .nm em{display:block;color:#8a7b6e;font-size:12.5px;font-style:normal}'
    + '.rpc-item .pr{font-weight:700;font-size:14px;white-space:nowrap}'
    + '.rpc-add{background:' + accent + ';color:#fff;border:none;width:30px;height:30px;border-radius:8px;font:700 18px/1 inherit;cursor:pointer;flex:0 0 auto}'
    + '.rpc-qty{display:flex;align-items:center;gap:7px;flex:0 0 auto}'
    + '.rpc-qty button{background:#fbeee6;color:' + accent + ';border:none;width:28px;height:28px;border-radius:7px;font:700 16px/1 inherit;cursor:pointer}'
    + '.rpc-qty span{font-weight:700;min-width:14px;text-align:center}'
    + '.rpc-basket{border-top:1px solid #eaddcd;background:#fff;padding:11px 14px;flex:0 0 auto}'
    + '.rpc-tot{display:flex;justify-content:space-between;font-weight:700;margin-bottom:9px;font-size:15px}'
    + '.rpc-name{width:100%;border:1px solid #eaddcd;border-radius:10px;padding:9px 11px;font:14.5px inherit;outline:none;margin-bottom:8px}'
    + '.rpc-go{width:100%;background:' + accent + ';color:#fff;border:none;border-radius:11px;padding:12px;font:700 15px inherit;cursor:pointer}'
    + '.rpc-go:disabled{opacity:.45;cursor:default}'
    + '.rpc-hint{font-size:11.5px;color:#8a7b6e;text-align:center;margin-top:7px;line-height:1.45}'
    + '.rpc-embed{position:static;right:auto;bottom:auto;width:100%;height:min(620px,calc(100vh - 150px));display:flex;box-shadow:0 6px 24px rgba(0,0,0,.10);border:1px solid #eaddcd}'
    + '@media (max-width:420px){.rpc-panel{right:8px;left:8px;bottom:8px;width:auto;height:calc(100vh - 16px)}.rpc-btn{right:12px;bottom:12px}.rpc-embed{right:auto;left:auto;bottom:auto;height:min(620px,calc(100vh - 190px))}}';

  var style = document.createElement("style"); style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.className = "rpc-btn"; btn.type = "button";
  btn.setAttribute("aria-label", "Ask a question");
  btn.innerHTML = '<span aria-hidden="true">💬</span><span>' + esc(C.buttonText || "Ask us a question") + '</span>';

  var panel = document.createElement("div");
  panel.className = "rpc-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Ask " + (C.name || "us") + " a question");
  panel.innerHTML = ''
    + '<div class="rpc-head"><div><b id="rpcTitle">' + esc(C.name || "Ask us") + '</b><small id="rpcSub">' + esc(C.subtitle || "Quick answers, any time") + '</small></div>'
    + '<div style="display:flex;align-items:center;gap:12px"><button class="rpc-back" id="rpcBack" type="button" style="display:none">‹ Back</button>'
    + '<button class="rpc-x" type="button" aria-label="Close">&times;</button></div></div>'
    + '<div class="rpc-view on" id="rpcChatView">'
    + '  <div class="rpc-log" id="rpcLog"></div>'
    + '  <form class="rpc-form"><input class="rpc-in" id="rpcIn" placeholder="Type your question" autocomplete="off" /><button class="rpc-send" type="submit">Ask</button></form>'
    + '  <div class="rpc-foot">Answers written by ' + esc(C.name || "the restaurant") + '</div>'
    + '</div>'
    + '<div class="rpc-view" id="rpcOrderView">'
    + '  <div class="rpc-menu" id="rpcMenu"></div>'
    + '  <div class="rpc-basket">'
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
  function chips() {
    var wrap = document.createElement("div"); wrap.className = "rpc-chips";
    if (ORDER) {
      var o = document.createElement("button");
      o.className = "rpc-chip go"; o.type = "button";
      o.textContent = ORDER.chip || "Order for collection";
      o.addEventListener("click", showOrder);
      wrap.appendChild(o);
    }
    C.answers.slice(0, 4).forEach(function (e) {
      var label = (e.chip || (e.q && e.q[0]) || "").trim();
      if (!label) return;
      var c = document.createElement("button");
      c.className = "rpc-chip"; c.type = "button"; c.textContent = label;
      c.addEventListener("click", function () { ask(label); });
      wrap.appendChild(c);
    });
    log.appendChild(wrap); log.scrollTop = log.scrollHeight;
  }
  function fallback() {
    var lines = ["I'm not sure about that one, and I'd rather check than guess."];
    if (C.phone) lines.push("Give us a ring on " + C.phone + " and we'll tell you straight away.");
    else if (C.email) lines.push("Drop us a line at " + C.email + " and we'll come back to you.");
    return lines.join("\n\n");
  }
  function ask(q) {
    q = String(q || "").trim(); if (!q) return;
    bubble(q, "you"); input.value = "";
    var hit = findAnswer(q);
    setTimeout(function () { bubble(hit ? hit.a : fallback(), "bot"); }, 220);
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
  function orderText() {
    var lines = ["Order from your website:", ""];
    basketList().forEach(function (b) { lines.push(b.qty + " x " + b.name); });
    lines.push("", "Total: about " + money(total()));
    var who = panel.querySelector("#rpcWho").value.trim();
    if (who) lines.push("Name: " + who);
    if (ORDER.mode) lines.push(ORDER.mode);
    return lines.join("\n");
  }
  function sendOrder() {
    var num = String(ORDER.phone || "").replace(/[^0-9]/g, "");
    if (!num) return;
    var text = encodeURIComponent(orderText());
    var url = (ORDER.method === "sms") ? ("sms:" + ORDER.phone + "?&body=" + text) : ("https://wa.me/" + num + "?text=" + text);
    window.open(url, "_blank");
    showChat();
    bubble("Your order is ready to send in " + (ORDER.method === "sms" ? "your messages" : "WhatsApp") +
      ". Press send there and " + (C.name || "we") + " will confirm shortly.", "bot");
    basket = {}; refreshBasket();
    var m = panel.querySelector("#rpcMenu"); m.innerHTML = ""; buildMenu();
  }

  function showOrder() {
    buildMenu();
    chatView.classList.remove("on"); orderView.classList.add("on");
    backBtn.style.display = ""; title.textContent = ORDER.title || "Order for collection";
    sub.textContent = ORDER.subtitle || "Tap what you'd like";
    refreshBasket();
  }
  function showChat() {
    orderView.classList.remove("on"); chatView.classList.add("on");
    backBtn.style.display = "none"; title.textContent = C.name || "Ask us";
    sub.textContent = C.subtitle || "Quick answers, any time";
  }

  var opened = false;
  function open() {
    panel.classList.add("open"); if (!MOUNT) btn.style.display = "none";
    if (!opened) {
      opened = true;
      bubble(C.greeting || ("Hi! Ask me anything about " + (C.name || "us") + "."), "bot");
      chips();
    }
    if (chatView.classList.contains("on")) input.focus();
  }
  function close() { if (MOUNT) return; panel.classList.remove("open"); btn.style.display = "flex"; }

  btn.addEventListener("click", open);
  if (MOUNT) open();
  panel.querySelector(".rpc-x").addEventListener("click", close);
  backBtn.addEventListener("click", showChat);
  panel.querySelector(".rpc-form").addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
  panel.querySelector("#rpcGo").addEventListener("click", sendOrder);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !panel.classList.contains("open")) return;
    if (orderView.classList.contains("on")) showChat(); else close();
  });
})();
