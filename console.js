/* ReplyPlate operator console — restaurant reputation & social, done-for-you.
   Client-side only. Uses your OpenRouter key. Data stays on this device. */
(() => {
  "use strict";
  const ENDPOINT = "https://openrouter.ai/api/v1";
  const S = {
    key: "rp.key", model: "rp.model",
    clients: "rp.clients", active: "rp.active", leads: "rp.leads",
    queue: "rp.queue", seen: "rp.seen", photos: "rp.photos", work: "rp.work", wcfg: "rp.wcfg",
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
    photos: load(S.photos, {}),
    /* work[clientId] = [{t: when, s: seconds spent}] — one entry per reply used */
    work: load(S.work, {}),
    wcfg: load(S.wcfg, { postSecs: 60, hoursPerClient: 2 }),
  };

  const dom = {
    clientSelect: $("clientSelect"), settingsBtn: $("settingsBtn"),
    settingsModal: $("settingsModal"), settingsClose: $("settingsClose"), settingsSave: $("settingsSave"),
    apiKey: $("apiKey"), modelSel: $("modelSel"),
    modelRefresh: $("modelRefresh"), modelTest: $("modelTest"), modelMsg: $("modelMsg"),
    dataExport: $("dataExport"), dataImport: $("dataImport"), dataFile: $("dataFile"), dataMsg: $("dataMsg"),
    clientsList: $("clientsList"),
    cName: $("cName"), cCuisine: $("cCuisine"), cTone: $("cTone"), cReview: $("cReview"), cCity: $("cCity"),
    cPhone: $("cPhone"), cEmail: $("cEmail"),
    qzPaste: $("qzPaste"), qzGo: $("qzGo"), qzMsg: $("qzMsg"),
    cSave: $("cSave"), cClear: $("cClear"),
    rvStars: $("rvStars"), rvText: $("rvText"), rvGo: $("rvGo"), rvOut: $("rvOut"),
    grGo: $("grGo"), grOut: $("grOut"),
    soTopic: $("soTopic"), soCount: $("soCount"), soGo: $("soGo"), soOut: $("soOut"),
    gpType: $("gpType"), gpCta: $("gpCta"), gpTopic: $("gpTopic"), gpGo: $("gpGo"), gpOut: $("gpOut"),
    gpCheck: $("gpCheck"), gpVerdict: $("gpVerdict"), gpPhotos: $("gpPhotos"),
    glSlug: $("glSlug"), glMake: $("glMake"), glOut: $("glOut"),
    cRev90: $("cRev90"),
    /* The seven answers that used to have nowhere to live. Six of them were
       being dropped into the shared chNotes box on the Website chat tab, which
       is a plain textarea with no storage behind it: they vanished on reload,
       and because that box is not per-client they could ship one restaurant's
       hours on another restaurant's website. */
    cOwner: $("cOwner"), cNever: $("cNever"), cFaq: $("cFaq"), cPickup: $("cPickup"),
    cOrders: $("cOrders"), cDirect: $("cDirect"), cHours: $("cHours"), cNotes: $("cNotes"),
    wlNumber: $("wlNumber"), wlPost: $("wlPost"), wlHours: $("wlHours"), wlCap: $("wlCap"),
    wlClients: $("wlClients"), wlManual: $("wlManual"), wlAdd: $("wlAdd"), wlUndo: $("wlUndo"),
    ocName: $("ocName"), ocCity: $("ocCity"), ocCuisine: $("ocCuisine"), ocRating: $("ocRating"),
    ocCount: $("ocCount"), ocUnanswered: $("ocUnanswered"), ocLastReply: $("ocLastReply"),
    ocLastPost: $("ocLastPost"), ocReview: $("ocReview"), ocChannel: $("ocChannel"),
    ocGo: $("ocGo"), ocOut: $("ocOut"),
    chPrepay: $("chPrepay"), chNotes: $("chNotes"), chPhone: $("chPhone"), chGo: $("chGo"), chOut: $("chOut"),
    chMenu: $("chMenu"), chOrderPhone: $("chOrderPhone"), chMethod: $("chMethod"), chCurrency: $("chCurrency"),
    chLoyEvery: $("chLoyEvery"), chLoyReward: $("chLoyReward"),
    chOffText: $("chOffText"), chOffSub: $("chOffSub"), chOffDays: $("chOffDays"),
    chOffFrom: $("chOffFrom"), chOffTo: $("chOffTo"), chOffUntil: $("chOffUntil"),
    rpPeriod: $("rpPeriod"), rpLoad: $("rpLoad"), rpText: $("rpText"), rpGo: $("rpGo"), rpOut: $("rpOut"),
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
  function renderResults(container, blocks, onUse, forOwner) {
    container.innerHTML = "";
    blocks.forEach((b) => {
      const card = el("div", "result");
      const t = el("div", "txt"); t.textContent = b;
      const bar = el("div", "bar");
      const cp = el("button", "copy"); cp.type = "button"; cp.textContent = "Copy";
      cp.addEventListener("click", () => { copy(b, cp); if (onUse) onUse(); });
      bar.appendChild(cp);
      /* Only review replies get these. A social post has no owner to approve it. */
      if (forOwner) {
        const tx = el("button", "copy"); tx.type = "button"; tx.textContent = "Text the owner";
        tx.addEventListener("click", () => { if (sendToOwner("sms", forOwner.review, forOwner.stars, b) && onUse) onUse(); });
        const em = el("button", "copy"); em.type = "button"; em.textContent = "Email instead";
        em.addEventListener("click", () => { if (sendToOwner("email", forOwner.review, forOwner.stars, b) && onUse) onUse(); });
        bar.appendChild(tx); bar.appendChild(em);
      }
      card.appendChild(t); card.appendChild(bar);
      container.appendChild(card);
    });
  }

  /* ---------- sending a draft to the owner ------------------------------
     You press send on your own phone. That matters: a person texting their own
     paying customer is person-to-person, so none of the carrier registration
     that applies to software sending texts applies here. The console never
     sends anything itself. It only opens your messaging app with the message
     already typed, exactly the way the ordering chat hands a diner's order to
     their own phone.

     Keep the text short. An owner reads this standing on the floor during
     service, and a 600 character wall of text gets left for later, which is
     the one thing a bad review cannot afford. */
  function ownerNote(client, review, stars, reply) {
    var star = "★".repeat(Math.max(0, Math.min(5, +stars || 0)));
    var short = review.length > 240 ? review.slice(0, 237).trim() + "…" : review;
    /* The owner gives their first name in question 2. Not using it meant asking
       someone to approve a reply to a one star review without ever addressing
       them. */
    var hi = client.ownerName ? "Hi " + client.ownerName : "Hi";
    return hi + ", one to OK for " + (client.name || "you") + ".\n\n"
      + star + " review:\n\"" + short + "\"\n\n"
      + "My reply:\n\"" + reply + "\"\n\n"
      + "Reply YES and I'll post it, or send me changes.";
  }

  function sendToOwner(how, review, stars, reply) {
    const c = activeClient();
    if (!c) { toast("Pick a client first"); return false; }
    const body = ownerNote(c, review, stars, reply);
    if (how === "sms") {
      /* The owner's number the way a person types it: maybe "415-555-0199",
         maybe "+1 (415) 555 0199". Stripping to digits and gluing "+" on the
         front turns the first one into +4155550199, which is Switzerland. So:
         a leading + is trusted, a bare 10-digit number is treated as US, and
         an 11-digit one starting 1 gets its plus back. */
      const str = String(c.ownerPhone || "").trim();
      const digits = str.replace(/[^0-9]/g, "");
      if (digits.length < 10) {
        toast("Add the owner's mobile on the Clients tab first");
        return false;
      }
      const full = str.charAt(0) === "+" ? "+" + digits
        : digits.length === 10 ? "+1" + digits
        : "+" + digits;
      window.open("sms:" + full + "?&body=" + encodeURIComponent(body), "_blank");
      toast("Opening your messages. Press send there.");
      return true;
    }
    if (!c.ownerEmail) { toast("Add the owner's email on the Clients tab first"); return false; }
    window.open("mailto:" + encodeURIComponent(c.ownerEmail)
      + "?subject=" + encodeURIComponent("One to OK: " + (stars || "") + "-star review")
      + "&body=" + encodeURIComponent(body), "_blank");
    toast("Opening your email. Press send there.");
    return true;
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

  /* The owner's red lines, and their name. These are kept out of clientContext
     on purpose. A prohibition is not a description, and it must not arrive as
     one more clause in a sentence about what the restaurant is like: it goes
     into the system prompt as a rule, where the model treats it as binding. */
  function ownerRules() {
    const c = activeClient();
    if (!c) return "";
    const out = [];
    if (c.neverSay) {
      out.push(`Hard rules from the owner. Never break these, even if the brand voice suggests otherwise:\n${c.neverSay}`);
    }
    /* start.html offers "Sign off with my first name" as a tap-to-answer chip,
       so the model was being told to sign with a name nobody had given it. It
       would invent one, which is exactly the thing this product must not do. */
    if (c.ownerName) out.push(`If a reply is signed off, the owner's name is ${c.ownerName}. Never use any other name.`);
    else out.push(`Never sign a reply with a personal name, and never invent one.`);
    return out.join("\n\n");
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
      use.addEventListener("click", () => { state.activeId = c.id; save(S.active, c.id); renderClients(); renderClientSelect(); renderPhotos(); });
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
    dom.cReview.value = c.reviewLink || ""; dom.cCity.value = c.city || ""; dom.cRev90.value = c.rev90 || "";
    dom.cPhone.value = c.ownerPhone || ""; dom.cEmail.value = c.ownerEmail || "";
    dom.cOwner.value = c.ownerName || ""; dom.cNever.value = c.neverSay || "";
    dom.cFaq.value = c.faq || ""; dom.cPickup.value = c.pickup || "";
    dom.cOrders.value = c.orderPhone || ""; dom.cDirect.value = c.directOffer || "";
    dom.cHours.value = c.hours || ""; dom.cNotes.value = c.ownerNotes || "";
    dom.cName.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function clearClientForm() {
    editingClientId = null;
    [dom.cName, dom.cCuisine, dom.cTone, dom.cReview, dom.cCity, dom.cRev90,
     dom.cPhone, dom.cEmail, dom.cOwner, dom.cNever, dom.cFaq, dom.cPickup,
     dom.cOrders, dom.cDirect, dom.cHours, dom.cNotes].forEach((i) => i.value = "");
  }
  function saveClient() {
    const name = dom.cName.value.trim();
    if (!name) { toast("Give the restaurant a name"); return; }
    const data = { name, cuisine: dom.cCuisine.value.trim(), tone: dom.cTone.value.trim(), reviewLink: dom.cReview.value.trim(), city: dom.cCity.value.trim(), rev90: dom.cRev90.value.trim(),
      ownerPhone: dom.cPhone.value.trim(), ownerEmail: dom.cEmail.value.trim(),
      ownerName: dom.cOwner.value.trim(), neverSay: dom.cNever.value.trim(),
      faq: dom.cFaq.value.trim(), pickup: dom.cPickup.value,
      orderPhone: dom.cOrders.value.trim(), directOffer: dom.cDirect.value.trim(),
      hours: dom.cHours.value.trim(), ownerNotes: dom.cNotes.value.trim() };
    if (editingClientId) {
      const c = state.clients.find((x) => x.id === editingClientId);
      if (c) Object.assign(c, data);
    } else {
      const c = { id: uid(), ...data };
      state.clients.push(c);
      if (!state.activeId) state.activeId = c.id;
    }
    save(S.clients, state.clients); save(S.active, state.activeId);
    clearClientForm(); renderClients(); renderClientSelect(); renderPhotos(); renderWorkload();
    toast("Saved");
  }

  /* ---------- reading a filled-in questionnaire -------------------------
     start.html puts a one-line JSON block at the bottom of the email it writes.
     Paste the email in here and the client form fills itself, including the
     things that would otherwise be retyped: the voice, the red lines, the
     questions diners ask, and the hours.

     It reads the block if it is there and falls back to reading the numbered
     answers if the owner deleted it, because owners delete things. */
  /* The ten question headings exactly as start.html prints them above each
     block of answers. Used only to tell a heading apart from an owner's own
     numbered line further down an answer. */
  const QZ_HEADINGS = [
    "What is the place called, and where is it?",
    "Who are we dealing with?",
    "What do you sell, in your own words?",
    "How should a reply sound?",
    "What must we never say?",
    "Your Google listing",
    "What do people ask you all day?",
    "Do you want pickup ordering on your site?",
    "Your opening hours",
    "Anything coming up, or anything sore?",
  ];

  const QZ_KEYS = ["Restaurant", "Where", "Your name", "Mobile", "Email", "What you sell",
    "Voice", "More on the voice", "Never say", "Google listing", "Questions you get asked",
    "Pickup ordering", "Orders go to", "For ordering direct", "Hours", "Anything else"];

  function parseQuestionnaire(raw) {
    /* Forwarded and replied-to mail arrives quoted, every line prefixed with
       "> ". That prefix used to break both paths at once: the machine block no
       longer matched, and every fallback key came back as "> Restaurant", which
       matches nothing. The import reported success and filled in nothing. */
    const text = String(raw || "").replace(/^[ \t]*>+[ \t]?/gm, "");

    const m = text.match(/RP1:\s*(\{[\s\S]*?\})\s*(?:\n\s*-|$)/);
    if (m) { try { return JSON.parse(m[1]); } catch (e) { /* fall through */ } }

    /* No block, so read the labelled lines the owner can see. Answers here run
       over several lines: opening hours are one line per day, and the never-say
       list is one rule per line. Only the first line of each carries a "Name: "
       prefix, so anything that is not itself a new known answer belongs to the
       answer above it. Keeping only prefixed lines used to silently reduce the
       hours to "Mon closed" and the red lines to whichever rule came first. */
    const known = {};
    QZ_KEYS.forEach((k) => { known[k.toLowerCase()] = k; });
    const out = {};
    let current = null;
    text.split("\n").forEach((line) => {
      const p = line.indexOf(":");
      const head = p > 0 ? known[line.slice(0, p).trim().toLowerCase()] : null;
      if (head) {
        current = head;
        const v = line.slice(p + 1).trim();
        if (v) out[head] = out[head] ? out[head] + "\n" + v : v;
        return;
      }
      const t = line.trim();
      /* Blank lines, the rule above the machine block, and "(skipped)" all end
         an answer. So does a question heading, but only a real one: matching
         any "N. " line would swallow an owner who numbered their own opening
         hours or listed dishes, and dropping their text is worse than keeping
         a stray heading. The ten headings are known, so check against them. */
      if (!t || /^-{3,}/.test(t) || t === "(skipped)") { current = null; return; }
      const num = t.match(/^(\d{1,2})\.\s+(.+)$/);
      if (num && QZ_HEADINGS.some((h) => h.toLowerCase() === num[2].trim().toLowerCase())) { current = null; return; }
      if (current) out[current] = out[current] ? out[current] + "\n" + t : t;
    });
    return Object.keys(out).length ? out : null;
  }

  function applyQuestionnaire(raw) {
    const d = parseQuestionnaire(raw);
    if (!d) { dom.qzMsg.textContent = "Could not find any answers in that. Paste the whole email."; return; }

    /* Every answer now goes to the box that asks the same question, because the
       form below is the same ten questions in the same order. Nothing is
       merged, so nothing has to be pulled apart again later.

       Answers are only written into empty boxes: a paste must never silently
       overwrite something already typed. What was skipped is counted and
       reported, because the old message said "Read 16 answers" whether or not
       a single one of them landed anywhere. */
    let landed = 0, skipped = 0;
    const put = (el, val) => {
      if (!val || !el) return;
      if (el.value.trim()) { skipped++; return; }
      el.value = val; landed++;
    };

    put(dom.cName,    d["Restaurant"]);
    put(dom.cCity,    d["Where"]);
    put(dom.cOwner,   d["Your name"]);
    put(dom.cPhone,   d["Mobile"]);
    put(dom.cEmail,   d["Email"]);
    put(dom.cCuisine, d["What you sell"]);
    /* Voice only. The never-say list used to be glued on the end of this with a
       "Never: " prefix, which handed the one safety rule in the questionnaire
       to the model as a style hint, mid sentence, inside a description of the
       restaurant. It has its own field and its own place in the prompt now. */
    put(dom.cTone,    [d["Voice"], d["More on the voice"]].filter(Boolean).join(". "));
    put(dom.cNever,   d["Never say"]);
    put(dom.cReview,  d["Google listing"]);
    put(dom.cFaq,     d["Questions you get asked"]);
    put(dom.cPickup,  d["Pickup ordering"]);
    put(dom.cOrders,  d["Orders go to"]);
    put(dom.cDirect,  d["For ordering direct"]);
    put(dom.cHours,   d["Hours"]);
    put(dom.cNotes,   d["Anything else"]);

    /* The owner was told their mobile is where approvals go. It used to be
       copied into the Website chat tab as well, and that box is published in
       the snippet pasted onto the restaurant's own website, so their personal
       number went public without anyone deciding it should. Orders have their
       own number now, and it is the only one that travels. */

    const msg = [];
    msg.push(landed + (landed === 1 ? " answer went in." : " answers went in."));
    if (skipped) msg.push(skipped + (skipped === 1 ? " box already had something in it and was left alone."
                                                   : " boxes already had something in them and were left alone."));
    if (!landed && skipped === 0) {
      msg.length = 0;
      msg.push("Found the answers but could not read them. If you forwarded the email, "
             + "paste just the RP1 block from the bottom instead.");
    } else {
      msg.push("Check it, then press Save client.");
    }
    /* A street address here prints on their table cards and bag stickers, and
       question 6 explicitly invites one, so say so before 500 get printed. */
    const link = dom.cReview.value.trim();
    if (link && !/^https?:\/\//i.test(link)) {
      msg.push("Heads up: the Google listing is not a link, so it will print as written on their review cards.");
    }
    dom.qzMsg.textContent = msg.join(" ");
    dom.cName.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function deleteClient(id) {
    delete state.photos[id]; save(S.photos, state.photos);
    delete state.work[id]; save(S.work, state.work);
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
    /* The clock starts when you ask for the drafts and stops when you take one.
       That covers reading the review and choosing, which is the part that varies.
       It cannot see you pasting into Google, so a fixed allowance is added for
       that in the Workload tab and the tab says so. */
    const startedAt = Date.now();
    const forClient = state.activeId;
    let logged = false;
    try {
      const sys = `You write review replies for restaurants. Rules: be warm, specific, and human; match the brand voice; keep each reply 2-4 sentences; thank by name only if the reviewer gave one; for negative reviews, apologize sincerely, take it offline (invite them to contact the restaurant), and never argue or make excuses; NEVER invent facts or confirm private details. Output exactly 3 distinct reply options, numbered 1-3, nothing else.`;
      const rules = ownerRules();
      const sysR = rules ? sys + "\n\n" + rules : sys;
      const prompt = `Write 3 reply options for this ${stars}-star review of ${clientContext()}.\n\nReview:\n"""${review}"""`;
      renderResults(dom.rvOut, splitBlocks(await generate(prompt, sysR)), () => {
        /* Copying a second option from the same review is still one reply. */
        if (logged) return;
        logged = true;
        logReply(forClient, Math.round((Date.now() - startedAt) / 1000));
        toast("Logged. " + repliesThisMonth(forClient) + " this month");
      }, { review, stars });
    } catch (e) { setError(dom.rvOut, e); } finally { dom.rvGo.disabled = false; }
  }

  /* ---------- workload ----------

     The point of this is not admin. It is that you cannot honestly set a fair
     use ceiling until you know how long a reply actually takes you, and nobody
     remembers accurately. So it measures rather than asks.

     The median is used rather than the mean. One reply where you got up to
     serve a customer will drag a mean into nonsense; the median ignores it. */

  const MONTH = () => new Date().toISOString().slice(0, 7);

  function logReply(clientId, secs, when) {
    if (!clientId) return;
    const list = state.work[clientId] || (state.work[clientId] = []);
    /* Bin anything absurd: you walked away mid-reply, not spent an hour on it. */
    const s = (secs > 0 && secs < 1800) ? secs : null;
    list.push({ t: when || Date.now(), s: s });
    save(S.work, state.work);
  }
  function repliesThisMonth(clientId) {
    const m = MONTH();
    return (state.work[clientId] || []).filter((r) => new Date(r.t).toISOString().slice(0, 7) === m).length;
  }
  function allTimings() {
    const out = [];
    Object.keys(state.work).forEach((k) => (state.work[k] || []).forEach((r) => { if (r.s) out.push(r.s); }));
    return out.sort((a, b) => a - b);
  }
  function median(list) {
    if (!list.length) return null;
    const mid = Math.floor(list.length / 2);
    return list.length % 2 ? list[mid] : Math.round((list[mid - 1] + list[mid]) / 2);
  }
  function fmtMins(secs) {
    if (secs == null) return "not measured yet";
    const m = Math.floor(secs / 60), s = secs % 60;
    return m ? (m + "m " + (s ? s + "s" : "").trim()).trim() : s + "s";
  }

  async function doGetReviews() {
    if (!requireClient(dom.grOut)) return;
    const c = activeClient();
    const link = c.reviewLink || "[your Google review link]";
    setLoading(dom.grOut); dom.grGo.disabled = true;
    try {
      const sys = `You write the wording a restaurant puts in front of EVERY diner to ask for a Google review. Warm, no guilt-trips, easy, and short enough to read while paying. Always include the review link exactly as given. Match the brand voice. CRITICAL: never screen for satisfaction first, never target only happy customers, never offer an incentive — Google prohibits selectively soliciting positive reviews and penalises the restaurant for it. Never write an SMS to diners: the restaurant has no consent from walk-ins and US law charges per message.`;
      const rules = ownerRules();
      const sysR = rules ? sys + "\n\n" + rules : sys;
      const prompt = `For ${clientContext()}, write these, clearly labelled: 1) a receipt footer line (one sentence, fits on a printed receipt), 2) a table card / QR card (a heading of 4 to 6 words plus one line underneath), 3) a takeout bag sticker line (under 12 words), 4) an email for diners whose address the restaurant already holds from bookings or online orders (subject + body). Use this review link: ${link}`;
      renderResults(dom.grOut, splitBlocks(await generate(prompt, sysR)));
    } catch (e) { setError(dom.grOut, e); } finally { dom.grGo.disabled = false; }
  }

  /* ---------- Google listing: posts and photos ----------

     Worth knowing why this exists. Being a Manager on the client's Business
     Profile was arranged so we could answer reviews. The same access lets us
     post offers and add photos, and hardly any restaurant does either, so it is
     free ground.

     The checks below are the ones Google actually rejects posts for, not style
     preferences. A phone number in the body is the big one: it gets the post
     refused, and you find out days later. */

  var GP_LIMIT = 1500;           // summary hard limit
  var GP_SWEET = 300;            // past this, the reader stops

  var PHOTO_JOBS = [
    { id: "exterior", label: "The front of the building", why: "So somebody walking up recognises it. This is the one most listings are missing." },
    { id: "interior", label: "The room, with people in it", why: "An empty dining room reads as a dead restaurant. Shoot it during service." },
    { id: "food3", label: "Three dishes they actually sell", why: "Their food, not stock. A stock photo of food they do not serve is a complaint waiting to happen." },
    { id: "team", label: "The team, or the owner", why: "Faces do more for a family place than another plate of pasta." },
    { id: "menu", label: "The menu, readable", why: "People check the prices before they leave the house." },
    { id: "drink", label: "The bar or the coffee", why: "Catches the search that is not about dinner." }
  ];

  /* Deterministic checks, run in plain code. Never ask the model whether its own
     post is allowed. */
  function checkPost(text, type) {
    var t = String(text || "");
    var issues = [];
    var n = t.trim().length;

    if (!n) return { issues: [], empty: true };

    // Google rejects posts with a phone number in the description.
    var phone = t.match(/(\+?\d[\d\s().-]{8,}\d)/);
    if (phone && phone[0].replace(/\D/g, "").length >= 10) {
      issues.push({ level: "stop", msg: "There is a phone number in the body. Google rejects posts for this. Use the Call now button instead.", found: phone[0].trim() });
    }
    if (n > GP_LIMIT) {
      issues.push({ level: "stop", msg: "Too long. The limit is " + GP_LIMIT + " characters and this is " + n + "." });
    }
    if (n > GP_SWEET && n <= GP_LIMIT) {
      issues.push({ level: "warn", msg: n + " characters. It will publish, but Google truncates the preview, so put the offer in the first sentence." });
    }
    var caps = t.replace(/[^A-Za-z]/g, "");
    if (caps.length > 12 && (t.match(/[A-Z]/g) || []).length / caps.length > 0.5) {
      issues.push({ level: "warn", msg: "Mostly capitals. Google's content policy calls this out and it reads as shouting." });
    }
    if (/[!?]{2,}/.test(t)) {
      issues.push({ level: "warn", msg: "Repeated punctuation. Google lists extra characters as a reason to reject." });
    }
    if (/\b(?:https?:\/\/|www\.)\S+/i.test(t)) {
      issues.push({ level: "warn", msg: "There is a link in the body. Put it on the button instead, where it is clickable." });
    }
    if ((type === "OFFER" || type === "EVENT") && !/\b(mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|today|tonight|this week|\d{1,2}(st|nd|rd|th)?\b)/i.test(t)) {
      issues.push({ level: "warn", msg: "No date or day in the text. " + (type === "OFFER" ? "Offers" : "Events") + " need start and end dates in Google's form, and saying it in the words too helps." });
    }
    if (/\b(best|cheapest|number one|#1|guaranteed)\b/i.test(t)) {
      issues.push({ level: "warn", msg: "A superlative claim. Keep it to what the restaurant can stand behind." });
    }
    return { issues: issues, chars: n, empty: false };
  }

  function renderVerdict() {
    var r = checkPost(dom.gpCheck.value, dom.gpType.value);
    var box = dom.gpVerdict;
    if (r.empty) { box.innerHTML = ""; return; }
    var stops = r.issues.filter(function (i) { return i.level === "stop"; });
    var warns = r.issues.filter(function (i) { return i.level === "warn"; });
    var head = stops.length
      ? '<div class="gp-head bad">Do not post this yet</div>'
      : (warns.length ? '<div class="gp-head warn">It will publish, but read these</div>'
                      : '<div class="gp-head ok">Nothing here that Google rejects on</div>');
    var list = r.issues.map(function (i) {
      return '<li class="' + i.level + '">' + i.msg + (i.found ? ' <code>' + i.found + '</code>' : "") + "</li>";
    }).join("");
    box.innerHTML = '<div class="gp-verdict">' + head +
      '<div class="gp-count">' + r.chars + " of " + GP_LIMIT + " characters</div>" +
      (list ? "<ul>" + list + "</ul>" : "") + "</div>";
  }

  async function doGooglePost() {
    if (!requireClient(dom.gpOut)) return;
    var topic = dom.gpTopic.value.trim();
    if (!topic) { toast("What is the post about?"); return; }
    var type = dom.gpType.value, cta = dom.gpCta.value;
    var typeWord = type === "OFFER" ? "Offer" : type === "EVENT" ? "Event" : "Update";
    setLoading(dom.gpOut); dom.gpGo.disabled = true;
    try {
      var sys = "You write Google Business Profile posts for restaurants. Rules, all hard: " +
        "keep the whole post under 300 characters, because Google truncates the preview; " +
        "put the offer or the news in the FIRST sentence; " +
        "NEVER include a phone number, Google rejects posts that contain one; " +
        "never include a URL in the body, the button carries the link; " +
        "no ALL CAPS, no repeated punctuation, no hashtags; " +
        "no superlatives like best or number one; " +
        "write in the restaurant's own voice, plain and specific, naming the actual dish or deal. " +
        "Never invent a price, a date or a dish that was not given to you. " +
        "Output exactly 3 options, numbered 1-3, nothing else.";
      /* A Google post is published in the restaurant's name, so it carries the
         owner's red lines like every other piece of public copy. */
      var rules = ownerRules();
      var sysR = rules ? sys + "\n\n" + rules : sys;
      var prompt = "For " + clientContext() + ", write a Google " + typeWord + " post about: " + topic +
        (cta ? ("\n\nThere will be a \"" + cta.replace(/_/g, " ").toLowerCase() + "\" button under it, so end in a way that leads into it, without naming the button.") : "") +
        (type === "OFFER" ? "\n\nThis is an Offer post, so Google will ask separately for start and end dates and an optional coupon code. Mention the days it runs in the words." : "") +
        (type === "EVENT" ? "\n\nThis is an Event post, so Google will ask separately for a title and start and end dates. Mention when it is in the words." : "");
      var blocks = splitBlocks(await generate(prompt, sysR));
      renderResults(dom.gpOut, blocks);
      /* Run every option through the same checks the operator would, so a bad one
         cannot get pasted in by accident. */
      var cards = dom.gpOut.querySelectorAll(".result");
      blocks.forEach(function (b, i) {
        var r = checkPost(b, type);
        if (!r.issues.length || !cards[i]) return;
        var flag = el("div", "gp-flags");
        flag.innerHTML = r.issues.map(function (x) {
          return '<span class="' + x.level + '">' + (x.level === "stop" ? "Blocked: " : "Check: ") + x.msg + "</span>";
        }).join("");
        cards[i].appendChild(flag);
      });
    } catch (e) { setError(dom.gpOut, e); } finally { dom.gpGo.disabled = false; }
  }

  function renderPhotos() {
    var c = activeClient();
    dom.gpPhotos.innerHTML = "";
    if (!c) {
      var e = el("div", "empty"); e.textContent = "Pick a client to track their photos."; dom.gpPhotos.appendChild(e); return;
    }
    var got = state.photos[c.id] || {};
    PHOTO_JOBS.forEach(function (j) {
      var row = el("label", "gp-photo" + (got[j.id] ? " done" : ""));
      var box = el("input"); box.type = "checkbox"; box.checked = !!got[j.id];
      box.addEventListener("change", function () {
        var m = state.photos[c.id] || (state.photos[c.id] = {});
        if (box.checked) m[j.id] = Date.now(); else delete m[j.id];
        save(S.photos, state.photos);
        renderPhotos();
      });
      var txt = el("div");
      txt.innerHTML = "<b>" + j.label + "</b><em>" + j.why + "</em>" +
        (got[j.id] ? '<span class="when">Added ' + new Date(got[j.id]).toLocaleDateString() + "</span>" : "");
      row.appendChild(box); row.appendChild(txt);
      dom.gpPhotos.appendChild(row);
    });
    var done = PHOTO_JOBS.filter(function (j) { return got[j.id]; }).length;
    var bar = el("div", "gp-progress");
    bar.textContent = done + " of " + PHOTO_JOBS.length + " done for " + c.name;
    dom.gpPhotos.appendChild(bar);
  }

  async function doSocial() {
    if (!requireClient(dom.soOut)) return;
    const topic = dom.soTopic.value.trim();
    if (!topic) { toast("What's the post about?"); return; }
    const n = dom.soCount.value;
    setLoading(dom.soOut); dom.soGo.disabled = true;
    try {
      const sys = `You are a social media writer for restaurants. Write scroll-stopping Instagram/Facebook captions: appetising, on-brand, 1-3 short lines, 1-2 tasteful emojis, and 3-6 relevant hashtags at the end. Each post distinct. Output ${n} posts, numbered.`;
      const rules = ownerRules();
      const sysR = rules ? sys + "\n\n" + rules : sys;
      const prompt = `Write ${n} social posts for ${clientContext()}.\nTopic: ${topic}`;
      renderResults(dom.soOut, splitBlocks(await generate(prompt, sysR)));
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
      const sys = `You write cold outreach for a service that answers restaurants' Google reviews, supplies the card and QR code that asks every diner for a review, and writes their social posts, for $199/mo with no contract. Never claim we message diners directly: we do not have walk-ins' contact details.

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

      /* Deliberately plain sys. Outreach writes a cold pitch to a restaurant
         that is not a client, while ownerRules() reads the currently selected
         client, so carrying the rules here would put one restaurant's private
         never-say list into an email aimed at a different restaurant. */
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

  /* ---------- website chat helper ---------- */
  // AI writes the answers here, at build time, from what the owner actually said.
  // The widget that ships to the restaurant contains no AI at all, so it cannot
  // invent an answer to an allergy question on their site.
  let chatKB = null;

  // Menu is parsed in code, never by the model. A hallucinated price is a
  // customer arriving expecting to pay less than the till says.
  function parseMenu(raw) {
    const out = [];
    let sec = null;
    String(raw || "").split(/\n/).forEach((line) => {
      const t = line.trim();
      if (!t) return;
      if (t.indexOf("|") === -1) { sec = { section: t, items: [] }; out.push(sec); return; }
      const bits = t.split("|").map((s) => s.trim());
      const price = parseFloat(String(bits[1] || "").replace(/[^0-9.]/g, ""));
      if (!bits[0] || isNaN(price)) return;
      if (!sec) { sec = { section: "", items: [] }; out.push(sec); }
      const item = { name: bits[0], price: price };
      if (bits[2]) item.note = bits[2];
      sec.items.push(item);
    });
    return out.filter((s) => s.items.length);
  }

  function chatSnippet(kb, client) {
    const phone = dom.chPhone.value.trim();
    const menu = parseMenu(dom.chMenu.value);
    const orderPhone = dom.chOrderPhone.value.trim();
    const ordering = menu.length && orderPhone;
    const cfg = {
      name: client.name,
      // Say ordering out loud on the button, or diners never find it.
      subtitle: ordering ? "Order pickup, or ask us anything" : "Answers, day or night",
      phone: phone || "",
      greeting: ordering
        ? `Hello! Tap "${"Order for pickup"}" above to order, or ask me anything about ${client.name}. I'll only tell you things the team has actually confirmed.`
        : `Hello! Ask me anything about ${client.name}. I'll only tell you things the team has actually confirmed.`,
      buttonText: ordering ? "Order food or ask us" : "Ask us a question",
      answers: kb,
    };
    if (ordering) {
      cfg.menu = menu;
      cfg.order = {
        enabled: true,
        method: dom.chMethod.value,
        phone: orderPhone,
        currency: dom.chCurrency.value.trim() || "$",
        chip: "Order for pickup",
        title: "Order for pickup",
        subtitle: "Tap what you'd like",
        barNote: "Tap the menu, pay when you pick up",
        mode: "For pickup",
        note: `You'll send this as a text from your own phone, to ${client.name}'s number. Nothing is paid here, and they'll confirm before you come.`,
      };
      /* The card only exists when the owner has set both halves of it. A
         threshold with no reward, or a reward with no threshold, is a promise
         nobody can keep. */
      /* Only ever present when the owner typed one. An absent key means pay on
         arrival, which is what every restaurant gets unless they ask otherwise. */
      const prepay = (dom.chPrepay ? dom.chPrepay.value : "").trim();
      if (/^https:\/\/\S+$/.test(prepay)) cfg.order.prepay = prepay;

      const every = parseInt(dom.chLoyEvery.value, 10) || 0;
      const reward = dom.chLoyReward.value.trim();
      if (every > 1 && reward) {
        cfg.loyalty = { enabled: true, every, reward };
      }
    }
    /* Offers are not tied to ordering: a place with no menu online still wants
       to tell people about Tuesday. */
    const offer = offerFromForm();
    if (offer) cfg.offers = [offer];
    return `<!-- ${client.name} chat helper. Paste both lines just before </body> -->\n` +
      `<script>window.RP_CHAT = ${JSON.stringify(cfg, null, 2)};<\/script>\n` +
      `<script src="https://reply-plate.com/chat-widget.js" defer><\/script>`;
  }

  function renderChat(container, kb) {
    container.innerHTML = "";
    const c = activeClient();
    const intro = el("div", "hint");
    intro.innerHTML = `<b>${kb.length} answers.</b> Read every one before it goes live. If the owner didn't confirm it, delete it. A wrong answer here lands on them, not you.`;
    container.appendChild(intro);

    kb.forEach((entry, i) => {
      const card = el("div", "result");
      const lb = el("div", "reslabel"); lb.textContent = entry.chip || `Answer ${i + 1}`;
      const qs = el("div", "chat-qs"); qs.textContent = "Matches: " + (entry.q || []).join(" · ");
      const ta = el("textarea", "ta"); ta.rows = 3; ta.value = entry.a || "";
      ta.addEventListener("input", () => { entry.a = ta.value; });
      const bar = el("div", "bar");
      const del = el("button", "copy"); del.type = "button"; del.textContent = "Delete";
      del.addEventListener("click", () => {
        const idx = chatKB.indexOf(entry);
        if (idx > -1) { chatKB.splice(idx, 1); renderChat(container, chatKB); }
      });
      bar.appendChild(del);
      card.appendChild(lb); card.appendChild(qs); card.appendChild(ta); card.appendChild(bar);
      container.appendChild(card);
    });

    const out = el("div", "card form");
    const menuN = parseMenu(dom.chMenu.value).reduce((a, sct) => a + sct.items.length, 0);
    const ordOn = menuN && dom.chOrderPhone.value.trim();
    out.innerHTML = "<h3>3. The code they paste in</h3><p class='hint'>Two lines, just before &lt;/body&gt; on their website.<br>" +
      (ordOn ? "<b>Ordering is on</b> with " + menuN + " items." : menuN ? "<b>Ordering is off</b> \u2014 add the order phone number to switch it on." : "Ordering is off. Add a menu to switch it on.") + "</p>";
    const code = el("textarea", "ta mono"); code.rows = 7; code.readOnly = true;
    code.value = chatSnippet(chatKB, c);
    const row = el("div", "row");
    const cp = el("button", "btn sm"); cp.type = "button"; cp.textContent = "Copy the code";
    cp.addEventListener("click", () => { code.value = chatSnippet(chatKB, c); copy(code.value, cp); });
    row.appendChild(cp);
    out.appendChild(code); out.appendChild(row);
    container.appendChild(out);

    // The no-website route: their own page, one link, one QR code.
    const link = el("div", "card form");
    const slug = slugify(c.name);
    const url = `https://reply-plate.com/r.html?c=${slug}`;
    link.innerHTML = "<h3>Or: no code at all</h3><p class='hint'>For owners who can't get into their website, or don't really have one. " +
      "This is their own page. It goes in an Instagram bio, on their Google listing, or on a QR sticker for the tables.</p>";
    const urlBox = el("input", "in"); urlBox.readOnly = true; urlBox.value = url;
    const cfgBox = el("textarea", "ta mono"); cfgBox.rows = 6; cfgBox.readOnly = true;
    cfgBox.value = JSON.stringify(pageConfig(chatKB, c), null, 2);
    const lrow = el("div", "row");
    const cu = el("button", "btn sm"); cu.type = "button"; cu.textContent = "Copy the link";
    cu.addEventListener("click", () => copy(url, cu));
    const cq = el("a", "btn sm ghost"); cq.textContent = "Make a QR code";
    cq.href = "./qr-code.html"; cq.target = "_blank"; cq.rel = "noopener";
    cq.style.textDecoration = "none"; cq.style.display = "inline-block";
    const cc = el("button", "btn sm ghost"); cc.type = "button"; cc.textContent = "Copy the page file";
    cc.addEventListener("click", () => { cfgBox.value = JSON.stringify(pageConfig(chatKB, c), null, 2); copy(cfgBox.value, cc); });
    lrow.appendChild(cu); lrow.appendChild(cq); lrow.appendChild(cc);
    const note = el("p", "hint");
    note.innerHTML = `<b>To switch it on:</b> send me the page file below and I'll add <code>r/${slug}.json</code> to the site. The link works from then on.`;
    link.appendChild(urlBox); link.appendChild(lrow); link.appendChild(note); link.appendChild(cfgBox);
    container.appendChild(link);
  }

  function slugify(s) {
    return String(s || "restaurant").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "restaurant";
  }

  function pageConfig(kb, client) {
    const cfg = JSON.parse(chatSnippet(kb, client).match(/window\.RP_CHAT = ([\s\S]*?);<\/script>/)[1]);
    cfg.pageSub = "Questions answered, and order for pickup.";
    return cfg;
  }

  /* What the website chat is allowed to know. Everything here is public by
     definition: it ends up as answers on the restaurant's own site.

     Question 10 is deliberately absent. That is where the owner writes what is
     sore, and start.html's own example for it is a one star they do not want
     dragged up. It used to go in with the rest, into the prompt that writes
     their public FAQ, under a rule that says "ONLY use facts in the notes",
     which invites the model to treat a grievance as a fact it may repeat. */
  function chatNotes(c) {
    if (!c) return dom.chNotes.value.trim();
    const parts = [
      c.hours ? "Hours:\n" + c.hours : "",
      c.faq ? "They get asked about:\n" + c.faq : "",
      c.pickup === "Yes" && c.orderPhone ? "Pickup orders go to " + c.orderPhone : "",
      c.pickup === "Yes" && c.directOffer ? "For ordering direct: " + c.directOffer : "",
      dom.chNotes.value.trim(),   /* anything typed straight into the tab */
    ].filter(Boolean);
    return parts.join("\n\n");
  }

  async function doChat() {
    if (!requireClient(dom.chOut)) return;
    const notes = chatNotes(activeClient());
    if (!notes) { toast("Fill in their hours and their questions on the Clients tab first"); return; }
    setLoading(dom.chOut); dom.chGo.disabled = true;
    try {
      const sys = `You turn a restaurant owner's rough notes into answers for a chat helper on their website.

Rules:
- ONLY use facts in the notes. Never add an opening time, a price, a policy or a dietary claim that is not there. If the notes don't cover something, leave it out entirely.
- Write each answer as the restaurant speaking to a customer. Warm, short, plain. Two or three sentences.
- For anything about allergies or intolerances, the answer must tell the customer to confirm with staff on the day. Never state a dish is free of an allergen.
- Give each entry several ways a real person might ask it, including short, sloppy and misspelled phrasings. Lowercase, no punctuation needed.
- "chip" is a two or three word label for a button, like "Opening hours".
- Order them with the most commonly asked first.
- Aim for 5 to 9 entries. Fewer good ones beats padding.

Return ONLY minified JSON, no markdown: {"answers":[{"chip":"","q":["",""],"a":""}]}`;
      const rules = ownerRules();
      const sysR = rules ? sys + "\n\n" + rules : sys;
      const prompt = `Restaurant: ${clientContext()}\n\nThe owner's notes:\n"""${notes}"""`;
      const raw = await generate(prompt, sysR);
      let t = String(raw).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const a = t.indexOf("{"), z = t.lastIndexOf("}");
      if (a !== -1 && z !== -1) t = t.slice(a, z + 1);
      const o = JSON.parse(t);
      chatKB = (o.answers || []).filter((e) => e && e.a && e.q && e.q.length);
      if (!chatKB.length) throw new Error("No usable answers came back. Try adding more detail to the notes.");
      renderChat(dom.chOut, chatKB);
    } catch (e) { setError(dom.chOut, e); } finally { dom.chGo.disabled = false; }
  }

  /* ---------- monthly report ---------- */
  // Stats are computed in code, never asked of the model. The AI reads themes;
  // arithmetic it might get wrong stays out of its hands.
  function parseReviews(raw) {
    const chunks = /\n\s*\n/.test(raw) ? raw.split(/\n\s*\n/) : raw.split(/\n/);
    return chunks.map((s) => s.trim()).filter(Boolean).map((line) => {
      const m = line.match(/^\s*([1-5])\s*(?:stars?|★+)?\s*[|:,\-–—]?\s*(.+)$/is);
      return m ? { rating: +m[1], text: m[2].trim() } : { rating: null, text: line };
    });
  }

  function reviewStats(list) {
    const rated = list.filter((r) => r.rating);
    const sum = rated.reduce((a, r) => a + r.rating, 0);
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rated.forEach((r) => dist[r.rating]++);
    return {
      total: list.length,
      rated: rated.length,
      avg: rated.length ? (sum / rated.length) : null,
      dist,
      negative: dist[1] + dist[2] + dist[3],
    };
  }

  function renderWorkload() {
    if (!dom.wlNumber) return;
    const cfg = state.wcfg;
    dom.wlPost.value = cfg.postSecs;
    dom.wlHours.value = cfg.hoursPerClient;

    const times = allTimings();
    const med = median(times);
    const allIn = med == null ? null : med + (+cfg.postSecs || 0);

    /* Under about ten samples the median moves a lot, so say so rather than
       letting a number that will change next week look settled. */
    let head;
    if (!times.length) {
      head = '<div class="wl-big">Nothing measured yet</div>' +
        '<p class="hint">Write a few replies on the <b>Reply to reviews</b> tab. Copying one logs it, and the timing starts when you ask for the drafts.</p>';
    } else {
      head = '<div class="wl-big">' + fmtMins(allIn) + ' <small>a reply, all in</small></div>' +
        '<p class="hint">' + fmtMins(med) + ' measured, from asking for the drafts to taking one, plus ' +
        cfg.postSecs + 's for pasting it into Google. From ' + times.length +
        (times.length === 1 ? ' reply' : ' replies') + '.' +
        (times.length < 10 ? ' <b>Too few to trust yet.</b> Ten is where it settles down.' : '') +
        '</p>';
    }
    dom.wlNumber.innerHTML = head;

    if (allIn == null) { dom.wlCap.innerHTML = ""; }
    else {
      const budget = (+cfg.hoursPerClient || 2) * 3600;
      const cap = Math.max(1, Math.floor(budget / allIn));
      const rounded = cap >= 20 ? Math.round(cap / 5) * 5 : cap;
      dom.wlCap.innerHTML = '<div class="wl-cap"><b>Your ceiling looks like about ' + rounded + ' replies a month.</b>' +
        '<span>That is ' + cfg.hoursPerClient + ' hours divided by ' + fmtMins(allIn) + ' each. ' +
        (times.length < 10 ? 'Come back once you have measured ten before you put it in an agreement.'
                           : 'Anything past it is where the fair-use conversation belongs, and negative reviews are never part of that count.') +
        '</span></div>';
    }

    /* Per client, this month */
    dom.wlClients.innerHTML = "";
    if (!state.clients.length) {
      const e = el("div", "empty"); e.textContent = "No clients yet."; dom.wlClients.appendChild(e); return;
    }
    const capNow = allIn ? Math.floor(((+cfg.hoursPerClient || 2) * 3600) / allIn) : null;
    let monthTotal = 0;
    state.clients.forEach((c) => {
      const n = repliesThisMonth(c.id);
      monthTotal += n;
      const row = el("div", "wl-row");
      const pct = capNow ? Math.min(100, Math.round((n / capNow) * 100)) : 0;
      const near = capNow && n >= capNow * 0.8;
      const base = c.rev90 ? Math.round(+c.rev90 / 3) : null;
      row.innerHTML =
        '<div class="wl-nm"><b>' + c.name + '</b>' +
          '<small>' + (base != null ? 'about ' + base + ' reviews a month when they joined' : 'no baseline recorded') + '</small></div>' +
        '<div class="wl-n' + (near ? ' near' : '') + '">' + n + '<small>this month</small></div>' +
        '<div class="wl-bar"><i style="width:' + pct + '%"></i></div>';
      dom.wlClients.appendChild(row);
    });
    const foot = el("div", "wl-foot");
    foot.innerHTML = monthTotal + (monthTotal === 1 ? " reply" : " replies") + " logged this month" +
      (allIn ? ", roughly " + (Math.round((monthTotal * allIn) / 360) / 10) + " hours" : "") + ".";
    dom.wlClients.appendChild(foot);
  }

  function loadFromAutopilot() {
    const c = activeClient();
    if (!c) { toast("Pick a client first"); return; }
    const mine = state.queue.filter((q) => q.clientId === c.id);
    if (!mine.length) { toast("No reviews in Autopilot for this client yet"); return; }
    dom.rpText.value = mine.map((q) => `${q.rating} | ${q.text}`).join("\n");
    toast(`Loaded ${mine.length}`);
  }

  function renderReport(container, o, stats, client, period) {
    container.innerHTML = "";
    const card = el("div", "report");
    const bits = [];
    bits.push(`<div class="rp-head"><h3>${escapeHtml(client)}</h3><div class="rp-period">${escapeHtml(period || "This month")}</div></div>`);

    bits.push(`<div class="rp-stats">
      <div class="rp-stat"><b>${stats.total}</b><span>reviews</span></div>
      ${stats.avg ? `<div class="rp-stat"><b>${stats.avg.toFixed(1)}★</b><span>average</span></div>` : ""}
      <div class="rp-stat"><b>${stats.dist[5] + stats.dist[4]}</b><span>4 and 5 star</span></div>
      <div class="rp-stat"><b>${stats.negative}</b><span>3 star or below</span></div>
    </div>`);

    if (o.headline) bits.push(`<p class="rp-headline">${escapeHtml(o.headline)}</p>`);

    const list = (title, items, fmt) => {
      if (!items || !items.length) return "";
      return `<div class="rp-sec"><h4>${title}</h4><ul>` +
        items.map(fmt).join("") + `</ul></div>`;
    };

    bits.push(list("What people loved", o.loved, (t) =>
      `<li><b>${escapeHtml(t.theme)}</b>${t.count ? ` <span class="rp-n">${t.count}×</span>` : ""}${t.quote ? `<em>“${escapeHtml(t.quote)}”</em>` : ""}</li>`));

    bits.push(list("What came up as a problem", o.problems, (t) =>
      `<li><b>${escapeHtml(t.theme)}</b>${t.count ? ` <span class="rp-n">${t.count}×</span>` : ""}${t.pattern ? ` <span class="rp-pat">${escapeHtml(t.pattern)}</span>` : ""}${t.quote ? `<em>“${escapeHtml(t.quote)}”</em>` : ""}</li>`));

    bits.push(list("Your team, mentioned by name", o.people, (t) =>
      `<li><b>${escapeHtml(t.name)}</b>${t.count ? ` <span class="rp-n">${t.count}×</span>` : ""}${t.note ? `<em>${escapeHtml(t.note)}</em>` : ""}</li>`));

    bits.push(list("Dishes people talked about", o.dishes, (t) =>
      `<li><b>${escapeHtml(t.name)}</b>${t.count ? ` <span class="rp-n">${t.count}×</span>` : ""}${t.sentiment ? ` <span class="rp-pat">${escapeHtml(t.sentiment)}</span>` : ""}</li>`));

    if (o.actions && o.actions.length) {
      bits.push(`<div class="rp-sec rp-actions"><h4>Worth a look this month</h4><ol>` +
        o.actions.map((a) => `<li>${escapeHtml(a)}</li>`).join("") + `</ol></div>`);
    }

    bits.push(`<p class="rp-foot">Based on ${stats.total} review${stats.total === 1 ? "" : "s"} in this period. Counts are exact. The themes are read from what people wrote.</p>`);

    card.innerHTML = bits.join("");
    container.appendChild(card);

    const bar = el("div", "row"); bar.style.marginTop = "14px";
    const pr = el("button", "btn sm"); pr.type = "button"; pr.textContent = "Print / Save as PDF";
    pr.addEventListener("click", () => window.print());
    const cp = el("button", "btn sm ghost"); cp.type = "button"; cp.textContent = "Copy as text";
    cp.addEventListener("click", () => copy(card.innerText, cp));
    bar.appendChild(pr); bar.appendChild(cp);
    container.appendChild(bar);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  async function doReport() {
    if (!requireClient(dom.rpOut)) return;
    const raw = dom.rpText.value.trim();
    if (!raw) { toast("Paste this month's reviews, or load them from Autopilot"); return; }
    const list = parseReviews(raw);
    const stats = reviewStats(list);
    const period = dom.rpPeriod.value.trim();
    setLoading(dom.rpOut); dom.rpGo.disabled = true;
    try {
      const sys = `You read a month of restaurant reviews and tell the owner what they actually say. You are writing for a busy restaurant owner, not an analyst.

Rules:
- Only report what is genuinely in the reviews. Never invent a theme, a name, a dish or a number.
- Count honestly. If something came up twice, say twice. Do not inflate.
- Look for PATTERNS, not just topics: which day, which time, front of house or kitchen, new or repeat customers. A pattern is the valuable part.
- Name staff only if a reviewer named them.
- Suggested actions must be specific and small enough to actually do. No strategy essays.
- Never predict or promise a rating will improve. Never suggest asking only happy customers for reviews.
- Plain words. No management jargon.
- If there is too little to say, say less. Empty arrays are fine.

Return ONLY minified JSON, no markdown, with exactly these keys:
{"headline":"2-3 plain sentences the owner reads first","loved":[{"theme":"","count":0,"quote":""}],"problems":[{"theme":"","count":0,"pattern":"","quote":""}],"people":[{"name":"","count":0,"note":""}],"dishes":[{"name":"","count":0,"sentiment":"positive|mixed|negative"}],"actions":[""]}`;

      const prompt = `Reviews for ${clientContext()}${period ? `, period: ${period}` : ""}.\n` +
        `Computed already, do not recount: ${stats.total} reviews` +
        (stats.avg ? `, average ${stats.avg.toFixed(1)} stars` : "") +
        `, ${stats.dist[5] + stats.dist[4]} at 4-5 stars, ${stats.negative} at 3 or below.\n\n` +
        list.map((r, i) => `${i + 1}. ${r.rating ? r.rating + "★ " : ""}${r.text}`).join("\n");

      const rawOut = await generate(prompt, sys);
      let t = String(rawOut).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const a = t.indexOf("{"), z = t.lastIndexOf("}");
      if (a !== -1 && z !== -1) t = t.slice(a, z + 1);
      let o;
      try { o = JSON.parse(t); } catch { o = { headline: String(rawOut).trim() }; }
      renderReport(dom.rpOut, o, stats, activeClient().name, period);
    } catch (e) { setError(dom.rpOut, e); } finally { dom.rpGo.disabled = false; }
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
    const rules = ownerRules();
    const sysR = rules ? sys + "\n\n" + rules : sys;
    const prompt = `Review of ${clientContext()} — ${review.rating}★ from ${review.author} on ${review.source}:\n"""${review.text}"""`;
    const raw = await generate(prompt, sysR);
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


  /* ---------- models, loaded from OpenRouter rather than typed in here ----------
     Models get retired. A hard-coded name in a dropdown works right up until the
     day it does not, and then every draft this console writes fails at the exact
     moment you are sitting in front of a restaurant owner. So ask OpenRouter what
     exists. The list endpoint needs no key, so this works before you have one.

     A short fallback list is kept for the offline case only, and it is deliberately
     not treated as the truth. */
  const MODEL_FALLBACK = [
    { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o mini" },
  ];
  const MODEL_PICKS = [
    { match: /^anthropic\/claude.*(sonnet|opus)/i, note: "best replies" },
    { match: /^openai\/gpt.*mini/i, note: "cheap" },
    { match: /:free$/, note: "free, fine for testing" },
  ];
  let modelCache = null;

  function fillModels(list, chosen) {
    dom.modelSel.innerHTML = "";
    list.forEach((m) => {
      const o = el("option");
      o.value = m.id;
      o.textContent = m.name + (m.note ? " (" + m.note + ")" : "");
      dom.modelSel.appendChild(o);
    });
    // Keep whatever was saved even if it is no longer offered, so nothing is
    // silently switched underneath the operator without them seeing it.
    if (chosen && !list.some((m) => m.id === chosen)) {
      const o = el("option");
      o.value = chosen;
      o.textContent = chosen + " (saved, no longer listed)";
      dom.modelSel.appendChild(o);
    }
    if (chosen) dom.modelSel.value = chosen;
  }

  async function loadModels(force) {
    if (modelCache && !force) { fillModels(modelCache, state.model); return; }
    dom.modelMsg.textContent = "Asking OpenRouter what it has…";
    try {
      const res = await fetch(ENDPOINT + "/models");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const all = ((await res.json()).data || []);
      const picked = [];
      const seen = new Set();
      MODEL_PICKS.forEach((rule) => {
        all.filter((m) => rule.match.test(m.id)).slice(0, 4).forEach((m) => {
          if (seen.has(m.id)) return;
          seen.add(m.id);
          picked.push({ id: m.id, name: m.name || m.id, note: rule.note });
        });
      });
      if (!picked.length) throw new Error("nothing matched");
      modelCache = picked;
      fillModels(picked, state.model);
      const stillThere = all.some((m) => m.id === state.model);
      dom.modelMsg.textContent = stillThere
        ? picked.length + " models loaded. Your saved model still exists."
        : "Careful: \"" + state.model + "\" is not on OpenRouter any more. Pick another one and save.";
    } catch (e) {
      fillModels(MODEL_FALLBACK, state.model);
      dom.modelMsg.textContent = "Could not reach OpenRouter (" + e.message + "). Showing a short list from memory, which may be out of date.";
    }
  }

  /* Proves the key and the model together, which is the only thing that matters.
     Two minutes here beats finding out mid-demo. */
  async function testModel() {
    const model = dom.modelSel.value || state.model, key = dom.apiKey.value.trim() || state.key;
    if (!model) { dom.modelMsg.textContent = "Pick a model first."; return; }
    if (!key) { dom.modelMsg.textContent = "Put your OpenRouter key in first."; return; }
    dom.modelMsg.textContent = "Writing a test reply with " + model + "…";
    try {
      const res = await fetch(ENDPOINT + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Title": "ReplyPlate" },
        body: JSON.stringify({ model, max_tokens: 40, messages: [{ role: "user", content: 'Reply to this 5-star review in one short sentence: "Lovely pizza, quick service."' }] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = (j && j.error && j.error.message) || ("HTTP " + res.status);
        dom.modelMsg.textContent = res.status === 401 ? "The key was rejected (401)."
          : res.status === 402 ? "Out of credits (402). Add credits or choose a free model."
          : res.status === 404 ? "That model does not exist any more (404). Reload the list and pick another."
          : "Failed: " + d;
        return;
      }
      const out = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
      dom.modelMsg.textContent = out ? "Working. It wrote: " + out.trim().slice(0, 90) : "Answered, but empty. Try another model.";
    } catch (e) {
      dom.modelMsg.textContent = "Could not reach OpenRouter: " + e.message;
    }
  }

  /* ---------- backup ----------------------------------------------------
     Everything this console knows lives in this browser and nowhere else:
     every client, every lead, the review history, and rp.work, which is the
     timing the whole price is worked out from. Clearing site data takes all
     of it, and Safari drops script-written storage after seven days without
     a visit. There was no way to get a copy out until now. */
  function exportData() {
    const out = { app: "replyplate", version: 1, exported: new Date().toISOString(), data: {} };
    Object.values(S).forEach((k) => {
      const v = localStorage.getItem(k);
      if (v != null) out.data[k] = v;
    });
    // The API key is money. Never write it into a file that ends up in Downloads.
    delete out.data[S.key];
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = "replyplate-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    const n = Object.keys(out.data).length;
    dom.dataMsg.textContent = "Saved " + n + " sets of data. Your API key is deliberately not in the file, so type it back in after a restore.";
  }

  function importData(file) {
    const rd = new FileReader();
    rd.onload = () => {
      let j;
      try { j = JSON.parse(rd.result); } catch { dom.dataMsg.textContent = "That is not a backup file."; return; }
      if (!j || j.app !== "replyplate" || !j.data) { dom.dataMsg.textContent = "That is not a ReplyPlate backup."; return; }
      const keys = Object.keys(j.data).filter((k) => Object.values(S).includes(k));
      if (!keys.length) { dom.dataMsg.textContent = "There is nothing in that file to restore."; return; }
      const clients = (() => { try { return (JSON.parse(j.data[S.clients] || "[]") || []).length; } catch { return 0; } })();
      if (!confirm("Restore " + clients + " client(s) from " + (j.exported || "").slice(0, 10) +
                   "?\n\nThis replaces what is in this browser now. Download a backup of the current data first if you are not sure.")) return;
      keys.forEach((k) => localStorage.setItem(k, j.data[k]));
      dom.dataMsg.textContent = "Restored. Reloading…";
      setTimeout(() => location.reload(), 700);
    };
    rd.readAsText(file);
  }


  /* ---------- the ordering link that goes in Google Maps ----------------
     Google lets a restaurant add its own "Order online" link to its listing and
     mark it preferred, which puts it above DoorDash and Grubhub in the sheet a
     diner sees. Ours is the hosted page, opened straight on the menu with
     ?order so nobody has to hunt for it after tapping a button that said Order. */
  function buildOrderLink() {
    const slug = (dom.glSlug.value || "").trim().toLowerCase();
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) {
      dom.glOut.textContent = "Use lowercase letters, numbers and dashes only, the same slug as their r/<slug>.json file.";
      return;
    }
    const url = "https://reply-plate.com/r.html?c=" + slug + "&order";
    dom.glOut.innerHTML = "";
    const code = el("code");
    code.textContent = url;
    code.style.cssText = "display:block;word-break:break-all;margin-bottom:8px";
    const b = el("button", "btn ghost");
    b.type = "button"; b.textContent = "Copy";
    b.addEventListener("click", () => copy(url, b));
    dom.glOut.appendChild(code); dom.glOut.appendChild(b);
  }


  /* ---------- tonight's offer -------------------------------------------
     Seven day toggles, built rather than typed out, so the markup stays short
     and the values cannot drift from what the widget expects (0 Sunday to 6). */
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function buildDayToggles() {
    if (!dom.chOffDays || dom.chOffDays.childNodes.length) return;
    DAYS.forEach((d, i) => {
      const b = el("button", "btn ghost sm");
      b.type = "button";
      b.textContent = d;
      b.dataset.day = i;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        const on = b.getAttribute("aria-pressed") === "true";
        b.setAttribute("aria-pressed", on ? "false" : "true");
        b.classList.toggle("on", !on);
      });
      dom.chOffDays.appendChild(b);
    });
  }
  function offerFromForm() {
    const text = (dom.chOffText.value || "").trim();
    if (!text) return null;
    const days = [].slice.call(dom.chOffDays.querySelectorAll('[aria-pressed="true"]'))
      .map((b) => +b.dataset.day);
    const o = { text };
    const sub = (dom.chOffSub.value || "").trim();
    if (sub) o.sub = sub;
    if (days.length && days.length < 7) o.days = days;   // all seven is the same as none
    if (dom.chOffFrom.value) o.from = dom.chOffFrom.value;
    if (dom.chOffTo.value) o.to = dom.chOffTo.value;
    if (dom.chOffUntil.value) o.until = dom.chOffUntil.value;
    return o;
  }

  /* ---------- settings ---------- */
  function openSettings() { dom.apiKey.value = state.key || ""; dom.settingsModal.hidden = false; loadModels(false); }
  function closeSettings() { dom.settingsModal.hidden = true; }
  function saveSettings() {
    state.key = dom.apiKey.value.trim(); save(S.key, state.key);
    /* The model list loads async. Saving before it arrives must never write
       an empty model over a working one. */
    state.model = dom.modelSel.value || state.model; save(S.model, state.model);
    closeSettings(); toast("Settings saved");
  }

  /* ---------- wire ---------- */
  function wire() {
    initTabs();
    dom.gpGo.addEventListener("click", doGooglePost);
    dom.glMake.addEventListener("click", buildOrderLink);
    dom.wlPost.addEventListener("input", () => {
      state.wcfg.postSecs = Math.max(0, Math.min(600, +dom.wlPost.value || 0));
      save(S.wcfg, state.wcfg); renderWorkload();
    });
    dom.wlHours.addEventListener("input", () => {
      state.wcfg.hoursPerClient = Math.max(0.5, Math.min(20, +dom.wlHours.value || 2));
      save(S.wcfg, state.wcfg); renderWorkload();
    });
    dom.wlAdd.addEventListener("click", () => {
      const c = activeClient();
      if (!c) { toast("Pick a client first"); return; }
      const n = Math.max(1, Math.min(200, parseInt(dom.wlManual.value, 10) || 0));
      if (!n) { toast("How many?"); return; }
      /* No seconds: these were not measured, so they must not move the median. */
      for (let i = 0; i < n; i++) logReply(c.id, null);
      dom.wlManual.value = "";
      renderWorkload();
      toast("Added " + n + " to " + c.name);
    });
    dom.wlUndo.addEventListener("click", () => {
      const c = activeClient();
      if (!c || !(state.work[c.id] || []).length) { toast("Nothing to undo"); return; }
      state.work[c.id].pop(); save(S.work, state.work);
      renderWorkload(); toast("Removed the last one");
    });
    renderWorkload();
    dom.gpCheck.addEventListener("input", renderVerdict);
    dom.gpType.addEventListener("change", renderVerdict);
    renderPhotos();
    dom.clientSelect.addEventListener("change", () => { state.activeId = dom.clientSelect.value || null; save(S.active, state.activeId); renderClients(); renderPhotos(); renderWorkload(); });
    dom.settingsBtn.addEventListener("click", openSettings);
    dom.settingsClose.addEventListener("click", closeSettings);
    dom.settingsSave.addEventListener("click", saveSettings);
    dom.modelRefresh.addEventListener("click", () => loadModels(true));
    dom.modelTest.addEventListener("click", testModel);
    dom.dataExport.addEventListener("click", exportData);
    dom.dataImport.addEventListener("click", () => dom.dataFile.click());
    dom.dataFile.addEventListener("change", (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; });
    dom.settingsModal.addEventListener("click", (e) => { if (e.target === dom.settingsModal) closeSettings(); });
    dom.cSave.addEventListener("click", saveClient);
    dom.qzGo.addEventListener("click", () => applyQuestionnaire(dom.qzPaste.value));
    dom.cClear.addEventListener("click", clearClientForm);
    dom.rvGo.addEventListener("click", doReplies);
    dom.grGo.addEventListener("click", doGetReviews);
    dom.soGo.addEventListener("click", doSocial);
    dom.ocGo.addEventListener("click", doOutreach);
    dom.rpGo.addEventListener("click", doReport);
    dom.chGo.addEventListener("click", doChat);
    buildDayToggles();
    dom.rpLoad.addEventListener("click", loadFromAutopilot);
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
