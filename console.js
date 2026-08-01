/* ReplyPlate operator console — restaurant reputation & social, done-for-you.
   Client-side only. Uses your OpenRouter key. Data stays on this device. */
(() => {
  "use strict";
  const ENDPOINT = "https://openrouter.ai/api/v1";
  const S = {
    key: "rp.key", model: "rp.model",
    clients: "rp.clients", active: "rp.active", leads: "rp.leads",
    queue: "rp.queue", seen: "rp.seen",
  };
  const $ = (id) => document.getElementById(id);
  const el = (t, c) => { const n = document.createElement(t); if (c) n.className = c; return n; };
  const load = (k, f) => { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch { return f; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  let state = {
    key: load(S.key, ""),
    model: load(S.model, "anthropic/claude-3.5-sonnet"),
    clients: load(S.clients, []),
    activeId: load(S.active, null),
    leads: load(S.leads, []),
    queue: load(S.queue, []),
    seen: load(S.seen, []),
  };

  const dom = {
    clientSelect: $("clientSelect"), settingsBtn: $("settingsBtn"),
    settingsModal: $("settingsModal"), settingsClose: $("settingsClose"), settingsSave: $("settingsSave"),
    apiKey: $("apiKey"), modelSel: $("modelSel"),
    clientsList: $("clientsList"),
    cName: $("cName"), cCuisine: $("cCuisine"), cTone: $("cTone"), cReview: $("cReview"), cCity: $("cCity"),
    cSave: $("cSave"), cClear: $("cClear"),
    rvStars: $("rvStars"), rvText: $("rvText"), rvGo: $("rvGo"), rvOut: $("rvOut"),
    grGo: $("grGo"), grOut: $("grOut"),
    soTopic: $("soTopic"), soCount: $("soCount"), soGo: $("soGo"), soOut: $("soOut"),
    ocName: $("ocName"), ocCity: $("ocCity"), ocCuisine: $("ocCuisine"), ocRating: $("ocRating"),
    ocCount: $("ocCount"), ocUnanswered: $("ocUnanswered"), ocLastReply: $("ocLastReply"),
    ocLastPost: $("ocLastPost"), ocReview: $("ocReview"), ocChannel: $("ocChannel"),
    ocGo: $("ocGo"), ocOut: $("ocOut"),
    leadName: $("leadName"), leadAdd: $("leadAdd"), leadsList: $("leadsList"),
    apCheck: $("apCheck"), apApprove: $("apApprove"), apClear: $("apClear"), apPending: $("apPending"), apFeed: $("apFeed"),
    toast: $("toast"),
  };

  let editingClientId = null;

  /* ---------- helpers ---------- */
  let toastT;
  function toast(m) { dom.toast.textContent = m; dom.toast.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => dom.toast.hidden = true, 2000); }
  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = el("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {} ta.remove();
    }
    if (btn) { const p = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => btn.textContent = p, 1200); }
  }
  const activeClient = () => state.clients.find((c) => c.id === state.activeId) || null;

  async function generate(prompt, system) {
    if (!state.key) { openSettings(); throw new Error("Add your OpenRouter API key in Settings first."); }
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });
    const res = await fetch(ENDPOINT + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.key}`, "X-Title": "ReplyPlate" },
      body: JSON.stringify({ model: state.model, messages }),
    });
    if (!res.ok) {
      let d = ""; try { const j = await res.json(); d = j?.error?.message || ""; } catch {}
      if (res.status === 401) throw new Error("Invalid API key (401).");
      if (res.status === 402) throw new Error("Out of credits (402) — add credits or pick a free model in Settings.");
      throw new Error(d || `Request failed (${res.status}).`);
    }
    const j = await res.json();
    return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
  }

  // Split a numbered/blocked AI response into separate result cards.
  function splitBlocks(text) {
    const parts = text.split(/\n(?=\s*(?:\d+[\.\)]|Option\s*\d|["“]))/i)
      .map((s) => s.replace(/^\s*(?:\d+[\.\)]|Option\s*\d[:.]?)\s*/i, "").trim())
      .filter((s) => s.length > 2);
    return parts.length ? parts : [text.trim()];
  }
  function renderResults(container, blocks) {
    container.innerHTML = "";
    blocks.forEach((b) => {
      const card = el("div", "result");
      const t = el("div", "txt"); t.textContent = b;
      const bar = el("div", "bar");
      const cp = el("button", "copy"); cp.type = "button"; cp.textContent = "Copy";
      cp.addEventListener("click", () => copy(b, cp));
      bar.appendChild(cp);
      card.appendChild(t); card.appendChild(bar);
      container.appendChild(card);
    });
  }
  function setLoading(container) { container.innerHTML = '<div class="loading">Working…</div>'; }
  function setError(container, e) { container.innerHTML = `<div class="loading" style="color:var(--accent)">⚠️ ${e.message || e}</div>`; }

  function clientContext() {
    const c = activeClient();
    if (!c) return "a restaurant";
    let s = `the restaurant "${c.name}"`;
    if (c.cuisine) s += `, described as: ${c.cuisine}`;
    if (c.tone) s += `. Brand voice: ${c.tone}`;
    if (c.city) s += `. Located in ${c.city}`;
    return s;
  }
  function requireClient(container) {
    if (!activeClient()) { setError(container, { message: "Add a client on the Clients tab first." }); return false; }
    return true;
  }

  /* ---------- tabs ---------- */
  function initTabs() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        $("panel-" + tab.dataset.tab).classList.add("active");
      });
    });
  }

  /* ---------- clients ---------- */
  function renderClientSelect() {
    dom.clientSelect.innerHTML = "";
    if (!state.clients.length) {
      const o = el("option"); o.textContent = "— no clients —"; o.value = ""; dom.clientSelect.appendChild(o);
      return;
    }
    state.clients.forEach((c) => { const o = el("option"); o.value = c.id; o.textContent = c.name; dom.clientSelect.appendChild(o); });
    if (state.activeId) dom.clientSelect.value = state.activeId;
  }
  function renderClients() {
    dom.clientsList.innerHTML = "";
    if (!state.clients.length) {
      const e = el("div", "empty"); e.textContent = "No clients yet. Add your first restaurant below."; dom.clientsList.appendChild(e); return;
    }
    state.clients.forEach((c) => {
      const row = el("div", "client-row" + (c.id === state.activeId ? " active" : ""));
      const nm = el("div", "nm"); nm.innerHTML = `${c.name}<small>${[c.cuisine, c.city].filter(Boolean).join(" · ") || "—"}</small>`;
      const use = el("button"); use.type = "button"; use.textContent = c.id === state.activeId ? "✓ Active" : "Use";
      use.addEventListener("click", () => { state.activeId = c.id; save(S.active, c.id); renderClients(); renderClientSelect(); });
      const edit = el("button"); edit.type = "button"; edit.textContent = "Edit";
      edit.addEventListener("click", () => fillClientForm(c));
      const del = el("button"); del.type = "button"; del.textContent = "Delete";
      del.addEventListener("click", () => { if (confirm("Delete " + c.name + "?")) deleteClient(c.id); });
      row.appendChild(nm); row.appendChild(use); row.appendChild(edit); row.appendChild(del);
      dom.clientsList.appendChild(row);
    });
  }
  function fillClientForm(c) {
    editingClientId = c.id;
    dom.cName.value = c.name || ""; dom.cCuisine.value = c.cuisine || ""; dom.cTone.value = c.tone || "";
    dom.cReview.value = c.reviewLink || ""; dom.cCity.value = c.city || "";
    dom.cName.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function clearClientForm() {
    editingClientId = null;
    [dom.cName, dom.cCuisine, dom.cTone, dom.cReview, dom.cCity].forEach((i) => i.value = "");
  }
  function saveClient() {
    const name = dom.cName.value.trim();
    if (!name) { toast("Give the restaurant a name"); return; }
    const data = { name, cuisine: dom.cCuisine.value.trim(), tone: dom.cTone.value.trim(), reviewLink: dom.cReview.value.trim(), city: dom.cCity.value.trim() };
    if (editingClientId) {
      const c = state.clients.find((x) => x.id === editingClientId);
      if (c) Object.assign(c, data);
    } else {
      const c = { id: uid(), ...data };
      state.clients.push(c);
      if (!state.activeId) state.activeId = c.id;
    }
    save(S.clients, state.clients); save(S.active, state.activeId);
    clearClientForm(); renderClients(); renderClientSelect();
    toast("Saved");
  }
  function deleteClient(id) {
    state.clients = state.clients.filter((c) => c.id !== id);
    if (state.activeId === id) state.activeId = state.clients[0] ? state.clients[0].id : null;
    save(S.clients, state.clients); save(S.active, state.activeId);
    renderClients(); renderClientSelect();
  }

  /* ---------- tools ---------- */
  async function doReplies() {
    if (!requireClient(dom.rvOut)) return;
    const review = dom.rvText.value.trim();
    if (!review) { toast("Paste a review first"); return; }
    const stars = dom.rvStars.value;
    setLoading(dom.rvOut); dom.rvGo.disabled = true;
    try {
      const sys = `You write review replies for restaurants. Rules: be warm, specific, and human; match the brand voice; keep each reply 2-4 sentences; thank by name only if the reviewer gave one; for negative reviews, apologize sincerely, take it offline (invite them to contact the restaurant), and never argue or make excuses; NEVER invent facts or confirm private details. Output exactly 3 distinct reply options, numbered 1-3, nothing else.`;
      const prompt = `Write 3 reply options for this ${stars}-star review of ${clientContext()}.\n\nReview:\n"""${review}"""`;
      renderResults(dom.rvOut, splitBlocks(await generate(prompt, sys)));
    } catch (e) { setError(dom.rvOut, e); } finally { dom.rvGo.disabled = false; }
  }

  async function doGetReviews() {
    if (!requireClient(dom.grOut)) return;
    const c = activeClient();
    const link = c.reviewLink || "[your Google review link]";
    setLoading(dom.grOut); dom.grGo.disabled = true;
    try {
      const sys = `You write short, friendly messages a restaurant sends ALL its customers to request a Google review. Warm, no guilt-trips, easy. Always include the review link exactly as given. Match the brand voice. CRITICAL: never write anything that screens for satisfaction first, targets only happy customers, or offers an incentive — Google prohibits selectively soliciting positive reviews and penalises the restaurant for it.`;
      const prompt = `For ${clientContext()}, write these, clearly labelled: 1) a text/SMS (under 320 chars), 2) an email (subject + body), 3) a short table-card / receipt line. Use this review link: ${link}`;
      renderResults(dom.grOut, splitBlocks(await generate(prompt, sys)));
    } catch (e) { setError(dom.grOut, e); } finally { dom.grGo.disabled = false; }
  }

  async function doSocial() {
    if (!requireClient(dom.soOut)) return;
    const topic = dom.soTopic.value.trim();
    if (!topic) { toast("What's the post about?"); return; }
    const n = dom.soCount.value;
    setLoading(dom.soOut); dom.soGo.disabled = true;
    try {
      const sys = `You are a social media writer for restaurants. Write scroll-stopping Instagram/Facebook captions: appetising, on-brand, 1-3 short lines, 1-2 tasteful emojis, and 3-6 relevant hashtags at the end. Each post distinct. Output ${n} posts, numbered.`;
      const prompt = `Write ${n} social posts for ${clientContext()}.\nTopic: ${topic}`;
      renderResults(dom.soOut, splitBlocks(await generate(prompt, sys)));
    } catch (e) { setError(dom.soOut, e); } finally { dom.soGo.disabled = false; }
  }

  // Outreach agent: turns 60 seconds of research into a pitch that proves you looked,
  // plus a free sample reply to their own review — the offer the landing page makes.
  function outreachBrief() {
    const g = (el) => el.value.trim();
    const b = [];
    if (g(dom.ocCity)) b.push(`Area: ${g(dom.ocCity)}`);
    if (g(dom.ocCuisine)) b.push(`Cuisine: ${g(dom.ocCuisine)}`);
    if (g(dom.ocRating)) b.push(`Rating: ${g(dom.ocRating)} stars`);
    if (g(dom.ocCount)) b.push(`Review count: ${g(dom.ocCount)}`);
    b.push(`Recent reviews with no owner reply: ${dom.ocUnanswered.value}`);
    if (g(dom.ocLastReply)) b.push(`Owner's most recent reply: ${g(dom.ocLastReply)}`);
    if (g(dom.ocLastPost)) b.push(`Last social post: ${g(dom.ocLastPost)}`);
    return b.join("\n");
  }

  function renderOutreach(container, o) {
    container.innerHTML = "";
    const blocks = [
      ["Why this angle", o.angle, false],
      o.subject ? ["Subject line", o.subject, true] : null,
      ["Message", o.message, true],
      o.sampleReply ? ["Free sample reply to send them", o.sampleReply, true] : null,
      o.followUp1 ? ["Follow-up, about 3 days later", o.followUp1, true] : null,
      o.followUp2 ? ["Follow-up, about a week later", o.followUp2, true] : null,
    ].filter(Boolean);
    blocks.forEach(([label, text, copyable]) => {
      const card = el("div", "result");
      const lb = el("div", "reslabel"); lb.textContent = label;
      const t = el("div", "txt"); t.textContent = text;
      card.appendChild(lb); card.appendChild(t);
      if (copyable) {
        const bar = el("div", "bar");
        const cp = el("button", "copy"); cp.type = "button"; cp.textContent = "Copy";
        cp.addEventListener("click", () => copy(text, cp));
        bar.appendChild(cp); card.appendChild(bar);
      }
      container.appendChild(card);
    });
    const saveBtn = el("button", "btn sm"); saveBtn.type = "button"; saveBtn.textContent = "+ Save as lead";
    saveBtn.style.marginTop = "4px";
    saveBtn.addEventListener("click", () => {
      const name = dom.ocName.value.trim(); if (!name) return;
      state.leads.push({ id: uid(), name, stage: 0 });
      save(S.leads, state.leads); renderLeads();
      saveBtn.textContent = "Saved ✓"; saveBtn.disabled = true;
    });
    container.appendChild(saveBtn);
  }

  async function doOutreach() {
    const name = dom.ocName.value.trim();
    if (!name) { toast("Restaurant name first"); return; }
    const channel = dom.ocChannel.value;
    const review = dom.ocReview.value.trim();
    setLoading(dom.ocOut); dom.ocGo.disabled = true;
    try {
      const sys = `You write cold outreach for a service that answers restaurants' Google reviews, invites every diner to leave a review, and writes their social posts, for $199/mo with no contract.

How to write it:
- Lead with something SPECIFIC and TRUE from the research. Generic outreach gets deleted.
- Sound like one person who actually looked at their listing, not a company doing a mail merge.
- Short. An email is 5 sentences at most. A DM is 3. A walk-in or phone script is what you'd really say out loud.
- Offer the free sample: you'll answer a few of their reviews so they can judge the writing. No card, no call.
- One easy ask at the end.

Never do these:
- Never promise their rating will go up, or a number of reviews. Nobody can promise that.
- Never suggest asking only happy customers for reviews. Google prohibits it and it gets the restaurant penalised.
- Never claim it is fully automatic or hands off. A person checks the work.
- No flattery openers, no "I hope this finds you well", no "I noticed you're crushing it", no fake urgency.

Return ONLY minified JSON, no markdown, with exactly these keys:
{"angle":"one sentence on why you led with this, for the sender not the prospect","subject":"email subject line, or empty string for non-email channels","message":"the outreach message","sampleReply":"if a review was supplied, a warm on-brand reply to it they could paste straight into Google; otherwise empty string","followUp1":"short nudge about 3 days later","followUp2":"final short nudge about a week later"}`;

      const prompt = `Channel: ${channel}\nRestaurant: ${name}\n${outreachBrief()}` +
        (review ? `\n\nOne of their actual reviews:\n"""${review}"""` : "\n\n(No review supplied, so leave sampleReply empty.)");

      const raw = await generate(prompt, sys);
      let t = String(raw).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const a = t.indexOf("{"), z = t.lastIndexOf("}");
      if (a !== -1 && z !== -1) t = t.slice(a, z + 1);
      let o;
      try { o = JSON.parse(t); }
      catch { o = { angle: "Could not parse the model's JSON, so here is the raw output.", message: String(raw).trim() }; }
      renderOutreach(dom.ocOut, o);
    } catch (e) { setError(dom.ocOut, e); } finally { dom.ocGo.disabled = false; }
  }

  /* ---------- autopilot ---------- */
  /* Connectors: the swap-in point for the live product. In production,
     fetchNewReviews() polls the Google Business Profile / Meta Graph APIs and
     postReply() posts back through them. For this prototype they use a local
     sample feed and simulate posting, so the whole loop runs with no backend. */
  const SAMPLE_REVIEWS = [
    { source: "google", author: "Marcus T.", rating: 5, text: "Absolutely stunning meal. The pasta was fresh and the service made us feel like regulars on our first visit. Already booked to come back!" },
    { source: "google", author: "Priya S.", rating: 5, text: "Best brunch in the neighbourhood. The staff remembered our little one's name from last time — such a warm place." },
    { source: "google", author: "Dan R.", rating: 4, text: "Really good food and cosy vibe. Only note is it got a bit loud when it filled up, but we'd happily return." },
    { source: "google", author: "Helen W.", rating: 3, text: "Food was tasty but we waited nearly 40 minutes for mains on a quiet Tuesday. Nice flavours, slow kitchen." },
    { source: "google", author: "Anon", rating: 1, text: "Found a hair in my risotto and the waiter argued with me about it. Manager never came over. Won't be back and telling my friends." },
    { source: "google", author: "Jordan K.", rating: 2, text: "Overpriced for what it is and my order came out wrong twice. Staff were apologetic at least, but not a great night." },
    { source: "google", author: "Sofia L.", rating: 5, text: "The tasting menu was a highlight of our trip. Every course was thoughtful. Cannot recommend enough." },
    { source: "google", author: "Anon", rating: 1, text: "I think I got food poisoning after eating here Saturday. Sick all night. Be careful." },
  ];

  const Connectors = {
    // LIVE: GET reviews.list from Google Business Profile / Meta Graph since last poll.
    // DEMO: return a small batch of unseen sample reviews.
    async fetchNewReviews() {
      const seen = new Set(state.seen);
      const fresh = SAMPLE_REVIEWS.filter((r) => !seen.has(r.author + "|" + r.text));
      // Deliver 1–2 at a time to feel like a real trickle; reset once exhausted.
      if (!fresh.length) { state.seen = []; save(S.seen, state.seen); return Connectors.fetchNewReviews(); }
      const batch = fresh.slice(0, Math.min(2, fresh.length));
      batch.forEach((r) => state.seen.push(r.author + "|" + r.text));
      save(S.seen, state.seen);
      return batch.map((r) => ({ ...r }));
    },
    // LIVE: POST the reply back through the source's API.
    // DEMO: simulate a successful post.
    async postReply(item) {
      return { posted: true, at: Date.now() };
    },
  };

  // Decide whether a review is safe to auto-post or must go to the owner.
  function autoPostAllowed(rating, cls) {
    return rating >= 4 && cls.sentiment !== "negative" && cls.risk === "low";
  }

  // One AI call: draft a safe reply AND classify sentiment/risk. Returns JSON.
  async function classifyAndDraft(review) {
    const sys = `You handle a restaurant's public review replies. For the given review you must:
1) Draft ONE reply in the brand voice — warm, specific, human, 2-4 sentences. Thank the reviewer by name only if given. For anything negative: apologise sincerely, do NOT argue or make excuses, and take it offline (invite them to contact the restaurant directly). Never invent facts or confirm private details.
2) Classify it so a routing system knows whether it is safe to auto-post.
Return ONLY minified JSON, no markdown, with exactly these keys:
{"sentiment":"positive|neutral|negative","risk":"low|medium|high","reason":"<=12 word reason","reply":"the drafted reply"}
Mark risk "high" for anything mentioning illness/food poisoning, legal threats, discrimination, injury, or staff conduct — these always need a human.`;
    const prompt = `Review of ${clientContext()} — ${review.rating}★ from ${review.author} on ${review.source}:\n"""${review.text}"""`;
    const raw = await generate(prompt, sys);
    return parseTriage(raw);
  }

  function parseTriage(raw) {
    let t = String(raw).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
    try {
      const o = JSON.parse(t);
      const sentiment = ["positive", "neutral", "negative"].includes(o.sentiment) ? o.sentiment : "neutral";
      const risk = ["low", "medium", "high"].includes(o.risk) ? o.risk : "medium";
      return { sentiment, risk, reason: String(o.reason || "").slice(0, 80), reply: String(o.reply || "").trim() };
    } catch {
      // Safe fallback: if we can't parse, treat it as needing a human.
      return { sentiment: "neutral", risk: "medium", reason: "could not auto-classify", reply: String(raw).trim() };
    }
  }

  const STAR = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
  const SRC_LABEL = { google: "Google", facebook: "Facebook" };

  function reloadQueue() { state.queue = load(S.queue, []); }

  function updatePendingBadge() {
    const n = state.queue.filter((q) => q.status === "pending").length;
    if (dom.apPending) dom.apPending.textContent = n ? " (" + n + ")" : "";
  }

  function renderAutopilot() {
    updatePendingBadge();
    const feed = dom.apFeed;
    feed.innerHTML = "";
    if (!state.queue.length) {
      const e = el("div", "ap-empty");
      e.textContent = "No reviews processed yet. Add a client, then press “Check for new reviews”.";
      feed.appendChild(e);
      return;
    }
    [...state.queue].reverse().forEach((q) => {
      const item = el("div", "ap-item " + q.status);
      const head = el("div", "ap-head");
      head.innerHTML = `<span class="ap-src">${SRC_LABEL[q.source] || q.source}</span><span class="ap-stars">${STAR(q.rating)}</span><span>${q.author}</span>`;
      const rv = el("div", "ap-review"); rv.textContent = q.text;
      const rep = el("div", "ap-reply");
      const lbl = el("span", "ap-reply-lbl"); lbl.textContent = "AI reply" + (q.status === "posted" ? " · posted" : q.status === "pending" ? " · draft, awaiting owner" : "");
      rep.appendChild(lbl); rep.appendChild(document.createTextNode(q.reply));
      const foot = el("div", "ap-foot");
      let badge;
      if (q.status === "posted") { badge = el("span", "badge ok"); badge.textContent = q.postedBy === "owner" ? "✓ Approved & posted" : "✓ Auto-posted"; }
      else if (q.status === "pending") { badge = el("span", "badge hold"); badge.textContent = "✎ Held for owner"; }
      else { badge = el("span", "badge skip"); badge.textContent = "Skipped"; }
      const cls = el("span", "ap-class"); cls.textContent = `${q.cls.sentiment} · ${q.cls.risk} risk — ${q.cls.reason}`;
      foot.appendChild(badge); foot.appendChild(cls);
      item.appendChild(head); item.appendChild(rv); item.appendChild(rep); item.appendChild(foot);
      feed.appendChild(item);
    });
  }

  async function checkForReviews() {
    if (!activeClient()) { toast("Add and select a client first"); return; }
    dom.apCheck.disabled = true; const prev = dom.apCheck.textContent; dom.apCheck.textContent = "Checking…";
    try {
      const reviews = await Connectors.fetchNewReviews();
      for (const r of reviews) {
        let cls;
        try { cls = await classifyAndDraft(r); }
        catch (e) { toast(e.message || "AI error"); break; }
        const auto = autoPostAllowed(r.rating, cls);
        const item = {
          id: uid(), clientId: state.activeId, clientName: activeClient().name,
          source: r.source, author: r.author, rating: r.rating, text: r.text,
          reply: cls.reply, cls: { sentiment: cls.sentiment, risk: cls.risk, reason: cls.reason },
          status: auto ? "posted" : "pending", postedBy: auto ? "auto" : null,
          createdAt: Date.now(),
        };
        if (auto) { await Connectors.postReply(item); item.postedAt = Date.now(); }
        state.queue.push(item); save(S.queue, state.queue);
        renderAutopilot();
      }
      const held = reviews.length && state.queue.filter((q) => q.status === "pending").length;
      toast(reviews.length ? `Processed ${reviews.length} — ${held} awaiting owner` : "No new reviews");
    } catch (e) { toast(e.message || "Error"); }
    finally { dom.apCheck.disabled = false; dom.apCheck.textContent = prev; }
  }

  function clearFeed() {
    if (!state.queue.length) return;
    if (!confirm("Clear the Autopilot feed and reset the demo review pool?")) return;
    state.queue = []; state.seen = [];
    save(S.queue, state.queue); save(S.seen, state.seen);
    renderAutopilot();
  }

  /* ---------- leads ---------- */
  const STAGES = ["To contact", "Contacted", "Replied", "Client 🎉"];
  function renderLeads() {
    dom.leadsList.innerHTML = "";
    if (!state.leads.length) { const e = el("div", "empty"); e.textContent = "No leads yet. Add restaurants to work through."; dom.leadsList.appendChild(e); return; }
    state.leads.forEach((ld) => {
      const row = el("div", "lead" + (ld.stage === 3 ? " client-won" : ld.stage === 1 ? " done" : ""));
      const nm = el("div", "lnm"); nm.textContent = ld.name;
      const sel = el("select");
      STAGES.forEach((s, i) => { const o = el("option"); o.value = i; o.textContent = s; sel.appendChild(o); });
      sel.value = ld.stage;
      sel.addEventListener("change", () => { ld.stage = +sel.value; save(S.leads, state.leads); renderLeads(); });
      const del = el("button", "del"); del.type = "button"; del.textContent = "✕";
      del.addEventListener("click", () => { state.leads = state.leads.filter((x) => x.id !== ld.id); save(S.leads, state.leads); renderLeads(); });
      row.appendChild(nm); row.appendChild(sel); row.appendChild(del);
      dom.leadsList.appendChild(row);
    });
  }
  function addLead() {
    const name = dom.leadName.value.trim(); if (!name) return;
    state.leads.push({ id: uid(), name, stage: 0 });
    save(S.leads, state.leads); dom.leadName.value = ""; renderLeads();
  }

  /* ---------- settings ---------- */
  function openSettings() { dom.apiKey.value = state.key || ""; dom.modelSel.value = state.model; dom.settingsModal.hidden = false; }
  function closeSettings() { dom.settingsModal.hidden = true; }
  function saveSettings() {
    state.key = dom.apiKey.value.trim(); save(S.key, state.key);
    state.model = dom.modelSel.value; save(S.model, state.model);
    closeSettings(); toast("Settings saved");
  }

  /* ---------- wire ---------- */
  function wire() {
    initTabs();
    dom.clientSelect.addEventListener("change", () => { state.activeId = dom.clientSelect.value || null; save(S.active, state.activeId); renderClients(); });
    dom.settingsBtn.addEventListener("click", openSettings);
    dom.settingsClose.addEventListener("click", closeSettings);
    dom.settingsSave.addEventListener("click", saveSettings);
    dom.settingsModal.addEventListener("click", (e) => { if (e.target === dom.settingsModal) closeSettings(); });
    dom.cSave.addEventListener("click", saveClient);
    dom.cClear.addEventListener("click", clearClientForm);
    dom.rvGo.addEventListener("click", doReplies);
    dom.grGo.addEventListener("click", doGetReviews);
    dom.soGo.addEventListener("click", doSocial);
    dom.ocGo.addEventListener("click", doOutreach);
    dom.leadAdd.addEventListener("click", addLead);
    dom.leadName.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addLead(); } });
    dom.apCheck.addEventListener("click", checkForReviews);
    dom.apClear.addEventListener("click", clearFeed);
    // Reflect approvals made on the owner screen (other tab / on return).
    window.addEventListener("storage", (e) => { if (e.key === S.queue) { reloadQueue(); renderAutopilot(); } });
    window.addEventListener("focus", () => { reloadQueue(); renderAutopilot(); });
  }

  function init() {
    wire();
    renderClients(); renderClientSelect(); renderLeads(); renderAutopilot();
    if (!state.key) setTimeout(openSettings, 400);
  }
  document.addEventListener("DOMContentLoaded", init);
})();
