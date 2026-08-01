/* ReplyPlate website chat helper.
   Answers the handful of questions a restaurant gets asked all day.

   DESIGN RULE, do not break it: this widget contains no AI and makes no network
   requests. It can only ever return an answer the owner wrote. That is what makes
   it safe to put on a restaurant's site, because a guessed answer to "is this
   gluten free" is a hospital visit, not an embarrassment. If nothing matches well
   enough, it says so and hands the customer a real way to ask.

   Usage:
     <script>window.RP_CHAT = { name:"...", phone:"...", answers:[...] };</script>
     <script src="https://reply-plate.com/chat-widget.js" defer></script>
*/
(function () {
  "use strict";
  var C = window.RP_CHAT;
  if (!C || !C.answers || !C.answers.length) return;

  var STOP = "a an and are as at be but by can could do does for from get had has have how i if in is it its me my of on or our so than that the their them there they this to was we what when where which who will with would you your".split(" ");
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });

  function norm(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function tokens(s) {
    return norm(s).split(" ").filter(function (w) { return w && !STOPSET[w] && w.length > 1; });
  }

  // Score a query against one answer entry. Returns 0..1.
  function score(qTokens, qNorm, entry) {
    var best = 0;
    var phrasings = [].concat(entry.q || []);
    for (var i = 0; i < phrasings.length; i++) {
      var p = phrasings[i];
      var pNorm = norm(p);
      if (!pNorm) continue;
      // Whole-phrase containment is a strong signal both ways.
      if (qNorm && (qNorm.indexOf(pNorm) !== -1 || pNorm.indexOf(qNorm) !== -1)) { best = Math.max(best, 0.95); continue; }
      var pt = tokens(p);
      if (!pt.length || !qTokens.length) continue;
      var hit = 0;
      for (var j = 0; j < qTokens.length; j++) {
        for (var k = 0; k < pt.length; k++) {
          if (qTokens[j] === pt[k] || (qTokens[j].length > 4 && pt[k].indexOf(qTokens[j]) === 0) || (pt[k].length > 4 && qTokens[j].indexOf(pt[k]) === 0)) { hit++; break; }
        }
      }
      // Balance recall against precision so a one-word query can't match everything.
      var recall = hit / qTokens.length, precision = hit / pt.length;
      best = Math.max(best, (recall * 0.65) + (precision * 0.35));
    }
    return best;
  }

  var THRESHOLD = 0.45;
  function findAnswer(q) {
    var qTokens = tokens(q), qNorm = norm(q);
    if (!qTokens.length) return null;
    var top = null, topScore = 0;
    C.answers.forEach(function (e) {
      var s = score(qTokens, qNorm, e);
      if (s > topScore) { topScore = s; top = e; }
    });
    return topScore >= THRESHOLD ? top : null;
  }

  var accent = C.accent || "#d1452b";
  var css = ''
    + '.rpc-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;background:' + accent + ';color:#fff;border:none;border-radius:999px;padding:13px 20px;font:600 15px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.22);cursor:pointer;display:flex;align-items:center;gap:8px}'
    + '.rpc-btn:hover{filter:brightness(.93)}'
    + '.rpc-panel{position:fixed;right:18px;bottom:18px;z-index:2147483001;width:min(370px,calc(100vw - 24px));max-height:min(560px,calc(100vh - 36px));background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1a1410}'
    + '.rpc-panel.open{display:flex}'
    + '.rpc-head{background:' + accent + ';color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}'
    + '.rpc-head b{font-size:15.5px}.rpc-head small{display:block;opacity:.9;font-size:12.5px;font-weight:400}'
    + '.rpc-x{background:none;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 2px}'
    + '.rpc-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#fbf7f0}'
    + '.rpc-msg{max-width:88%;padding:10px 13px;border-radius:14px;font-size:14.5px;white-space:pre-wrap}'
    + '.rpc-bot{background:#fff;border:1px solid #eaddcd;align-self:flex-start;border-bottom-left-radius:5px}'
    + '.rpc-you{background:' + accent + ';color:#fff;align-self:flex-end;border-bottom-right-radius:5px}'
    + '.rpc-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:2px}'
    + '.rpc-chip{background:#fff;border:1px solid #eaddcd;color:' + accent + ';font:600 13px inherit;padding:7px 12px;border-radius:999px;cursor:pointer}'
    + '.rpc-chip:hover{background:#fbeee6}'
    + '.rpc-form{display:flex;gap:8px;padding:11px;border-top:1px solid #eaddcd;background:#fff}'
    + '.rpc-in{flex:1;border:1px solid #eaddcd;border-radius:10px;padding:10px 12px;font:15px inherit;outline:none;min-width:0}'
    + '.rpc-in:focus{border-color:' + accent + '}'
    + '.rpc-send{background:' + accent + ';color:#fff;border:none;border-radius:10px;padding:0 16px;font:700 15px inherit;cursor:pointer}'
    + '.rpc-foot{font-size:11px;color:#8a7b6e;text-align:center;padding:0 0 9px;background:#fff}'
    + '.rpc-foot a{color:#8a7b6e}'
    + '@media (max-width:420px){.rpc-panel{right:8px;left:8px;bottom:8px;width:auto}.rpc-btn{right:12px;bottom:12px}}';

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
    + '<div class="rpc-head"><div><b>' + esc(C.name || "Ask us") + '</b><small>' + esc(C.subtitle || "Quick answers, any time") + '</small></div>'
    + '<button class="rpc-x" type="button" aria-label="Close">&times;</button></div>'
    + '<div class="rpc-log" id="rpcLog"></div>'
    + '<form class="rpc-form"><input class="rpc-in" id="rpcIn" placeholder="Type your question" autocomplete="off" /><button class="rpc-send" type="submit">Ask</button></form>'
    + '<div class="rpc-foot">Answers written by ' + esc(C.name || "the restaurant") + '</div>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var log = panel.querySelector("#rpcLog");
  var input = panel.querySelector("#rpcIn");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function bubble(text, who) {
    var d = document.createElement("div");
    d.className = "rpc-msg " + (who === "you" ? "rpc-you" : "rpc-bot");
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function chips() {
    var picks = C.answers.slice(0, 4);
    if (!picks.length) return;
    var wrap = document.createElement("div"); wrap.className = "rpc-chips";
    picks.forEach(function (e) {
      var label = (e.chip || (e.q && e.q[0]) || "").trim();
      if (!label) return;
      var c = document.createElement("button");
      c.className = "rpc-chip"; c.type = "button"; c.textContent = label;
      c.addEventListener("click", function () { ask(label); });
      wrap.appendChild(c);
    });
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }
  function fallback() {
    var lines = ["I'm not sure about that one, and I'd rather check than guess."];
    if (C.phone) lines.push("Give us a ring on " + C.phone + " and we'll tell you straight away.");
    else if (C.email) lines.push("Drop us a line at " + C.email + " and we'll come back to you.");
    return lines.join("\n\n");
  }
  function ask(q) {
    q = String(q || "").trim(); if (!q) return;
    bubble(q, "you");
    input.value = "";
    var hit = findAnswer(q);
    setTimeout(function () { bubble(hit ? hit.a : fallback(), "bot"); }, 220);
  }

  var opened = false;
  function open() {
    panel.classList.add("open"); btn.style.display = "none";
    if (!opened) {
      opened = true;
      bubble(C.greeting || ("Hi! Ask me anything about " + (C.name || "us") + "."), "bot");
      chips();
    }
    input.focus();
  }
  function close() { panel.classList.remove("open"); btn.style.display = "flex"; }

  btn.addEventListener("click", open);
  panel.querySelector(".rpc-x").addEventListener("click", close);
  panel.querySelector(".rpc-form").addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("open")) close(); });
})();
