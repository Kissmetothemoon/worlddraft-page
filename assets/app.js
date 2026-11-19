/* LexDraft project page.
   Everything is drawn from files exported off the real models: token pieces,
   candidate lists, and per-round acceptance counts. */

(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const D = window.LEXDATA || {};
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (t, a = {}) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const LANG = { en:"English", de:"German", fr:"French", es:"Spanish", sw:"Swahili", ru:"Russian", zh:"Chinese",
    ja:"Japanese", th:"Thai", bn:"Bengali", te:"Telugu", ar:"Arabic", hi:"Hindi", am:"Amharic", ko:"Korean",
    "sr-Cyrl":"Serbian (Cyrillic)", "sr-Latn":"Serbian (Latin)", "hi-Latn":"Hindi (Latin)" };

  /* ---------------- tooltip ---------------- */
  const tip = $("#tooltip");
  function showTip(ev, title, rows) {
    tip.replaceChildren();
    tip.appendChild(h("div", "tt-title", title));
    rows.forEach((r) => {
      const d = h("div", "tt-row"), k = h("span", "tt-key");
      if (r.color) { const i = h("i"); i.style.background = r.color; k.appendChild(i); }
      k.appendChild(document.createTextNode(r.key));
      d.append(k, h("span", "tt-val", r.val));
      tip.appendChild(d);
    });
    tip.style.left = Math.min(innerWidth - 100, Math.max(100, ev.clientX)) + "px";
    tip.style.top = ev.clientY - 14 + "px";
    tip.classList.add("show");
  }
  const hideTip = () => tip.classList.remove("show");
  addEventListener("scroll", hideTip, { passive: true });

  /* ---------------- theme ---------------- */
  const root = document.documentElement;
  const saved = localStorage.getItem("lexdraft-theme");
  if (saved) root.dataset.theme = saved;
  $("#theme-toggle").addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    localStorage.setItem("lexdraft-theme", next);
    drawGain(); drawReach();
  });

  /* ---------------- TOC spy ---------------- */
  const navLinks = $$(".toc a");
  const secs = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    navLinks.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-40% 0px -55% 0px" });
  secs.forEach((s) => io.observe(s));

  /* ================= 01a: the word strip ================= */
  const WORD = D.word && D.word.words ? D.word.words[0] : null;
  let selPos = 1;
  const isFrag = (p) => /^[0-9A-F]{4,}$/.test(p) || p.indexOf("�") >= 0;

  function renderStrip() {
    const host = $("#word-strip");
    host.replaceChildren();
    if (!WORD) { host.textContent = "word data missing"; return; }
    const probe = h("div", "word-probe");
    WORD.pieces.forEach((p, k) => {
      const b = h("button", "piece" + (isFrag(p) ? " frag" : "") + (k === selPos ? " sel" : ""));
      b.type = "button";
      b.setAttribute("aria-pressed", String(k === selPos));
      b.appendChild(h("span", "ptxt", p));
      b.appendChild(h("span", "pidx", k === 0 ? "start" : "k=" + k));
      b.addEventListener("click", () => { selPos = k; renderStrip(); renderDetail(); });
      probe.appendChild(b);
      if (k < WORD.pieces.length - 1) probe.appendChild(h("span", "arrow", "→"));
    });
    host.appendChild(probe);
    const nf = WORD.pieces.filter(isFrag).length;
    host.appendChild(h("p", "chart-note",
      `${WORD.pieces.length} pieces; ${nf} of them are byte fragments that cannot be decoded on their own.`));
    const words = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
    $("#word-ntok").textContent = words[WORD.pieces.length] || String(WORD.pieces.length);
  }

  function renderDetail() {
    const host = $("#word-detail");
    host.replaceChildren();
    if (!WORD) return;
    const pos = WORD.positions.find((p) => p.k === selPos) || WORD.positions[0];
    const box = h("div", "detail-grid");

    const left = h("div", "detail-col");
    left.appendChild(h("div", "detail-label", "the block drafter, at this position"));
    left.appendChild(candList(pos.top, pos.gold));
    left.appendChild(h("p", "detail-foot",
      pos.drafter_rank == null ? "The right piece is not in the drafter's top 5."
        : `The right piece is rank ${pos.drafter_rank + 1}.`));

    const right = h("div", "detail-col");
    right.appendChild(h("div", "detail-label", "the prior, at this position"));
    if (pos.lex && pos.lex.length) {
      right.appendChild(candList(pos.lex, pos.gold));
      right.appendChild(h("p", "detail-foot",
        `counted from the ${pos.prior_ctx} preceding piece${pos.prior_ctx > 1 ? "s" : ""} of this word`));
    } else {
      right.appendChild(h("p", "detail-foot", "word start — the prior abstains, the drafter decides"));
    }
    box.append(left, right);
    host.appendChild(box);
  }

  function candList(items, gold) {
    const wrap = h("div", "cand");
    if (!items || !items.length) { wrap.appendChild(h("div", "cand-empty", "—")); return wrap; }
    const max = Math.max(...items.map((x) => Math.exp(x.lp)), 0.02);
    items.forEach((x) => {
      const row = h("div", "cand-row" + (x.p === gold ? " gold" : "") + (x.d ? "" : " bad"));
      const bar = h("i", "cand-bar");
      bar.style.width = Math.max(3, (Math.exp(x.lp) / max) * 100) + "%";
      row.appendChild(bar);
      row.appendChild(h("span", "cand-p", x.p));
      const p = Math.exp(x.lp);
      row.appendChild(h("span", "cand-v", (p * 100).toFixed(p < 0.01 ? 2 : 0) + "%"));
      wrap.appendChild(row);
    });
    return wrap;
  }

  /* ================= 01b: the race ================= */
  const SEQ = D.seqs || null;
  const PIECES = D.pieces || {};
  // rebuild readable text from token ids, joining the byte fragments of one character
  function decode(ids) {
    const bytes = [];
    (ids || []).forEach((i) => {
      const p = PIECES[String(i)];
      if (!p) bytes.push(0x3f);
      else if (p.v) { const enc = new TextEncoder().encode(p.t); enc.forEach((b) => bytes.push(b)); }
      else p.t.match(/../g).forEach((hx) => bytes.push(parseInt(hx, 16)));
    });
    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
  }
  // first round where the two lanes stop agreeing
  const FIRST_DIFF = (() => {
    if (!SEQ) return 0;
    const n = Math.min(SEQ.base.accs.length, SEQ.lex.accs.length);
    for (let i = 0; i < n; i++) if (SEQ.base.accs[i] !== SEQ.lex.accs[i]) return i;
    return n - 1;
  })();
  const LAST = SEQ ? Math.min(FIRST_DIFF + 9, Math.min(SEQ.base.accs.length, SEQ.lex.accs.length) - 1) : 0;
  let raceTimer = null, raceStep = 0, playing = false;
  function drawRace(step) {
    if (!SEQ) return;
    const b = SEQ.base.accs, l = SEQ.lex.accs;
    const nb = b.slice(0, step).reduce((x, y) => x + y, 0);
    const nl = l.slice(0, step).reduce((x, y) => x + y, 0);
    const denom = Math.max(SEQ.base.seq.length, SEQ.lex.seq.length, 1);
    // bars show distance covered; the shorter lane is always ahead for the same round index
    const widest = Math.max(nb, nl, 1);
    $("#fill-base").style.width = (nb / widest) * 100 + "%";
    $("#fill-lex").style.width = (nl / widest) * 100 + "%";
    $("#num-base").textContent = nb;
    $("#num-lex").textContent = nl;
    $("#rounds-base").textContent = Math.min(step, b.length);
    $("#rounds-lex").textContent = Math.min(step, l.length);
    const log = $("#race-log");
    log.replaceChildren();
    for (let i = Math.max(0, step - 5); i < step; i++) {
      const row = h("div", "log-row" + ((b[i] ?? 0) !== (l[i] ?? 0) ? " differs" : ""));
      row.appendChild(h("span", "log-i", "round " + (i + 1)));
      row.appendChild(h("span", "log-d", "+" + (b[i] ?? 0)));
      row.appendChild(h("span", "log-d lex", "+" + (l[i] ?? 0)));
      log.appendChild(row);
    }
    // show what the two lanes just committed
    const rt = $("#race-text");
    if (rt) {
      rt.replaceChildren();
      const tokB = SEQ.base.seq.slice(0, nb);
      const tokL = SEQ.lex.seq.slice(0, nl);
      const shown = Math.min(tokB.length, 60);
      rt.appendChild(h("span", "rt-label", "same prefix, both lanes:"));
      rt.appendChild(h("code", "rt-text", decode(tokB.slice(Math.max(0, shown - 40), shown))));
      rt.title = "first " + nb + " of " + SEQ.base.seq.length + " tokens";
    }
    const v = $("#race-verdict");
    v.replaceChildren();
    if (step === 0) v.appendChild(h("span", "", "Both lanes are about to decode the identical 512-token answer."));
    else if (step <= FIRST_DIFF) v.appendChild(h("span", "", "Through the first rounds the two lanes agree exactly — the prior is not allowed to change the output."));
    else {
      v.appendChild(h("b", "", "Now they diverge: LexDraft keeps more of every block"));
      v.appendChild(document.createTextNode(" and lands on the same 512-token answer in fewer rounds."));
    }
    if (step >= LAST) {
      v.replaceChildren();
      const done = h("div", "race-done");
      const row = h("div", "rd-row");
      row.appendChild(h("b", "", "Full run: "));
      row.appendChild(document.createTextNode(SEQ.base.accs.length + " rounds alone vs " + SEQ.lex.accs.length + " with LexDraft"));
      const row2 = h("div", "rd-row");
      row2.appendChild(h("b", "", "Acceptance length: "));
      row2.appendChild(document.createTextNode((SEQ.base.seq.length / SEQ.base.accs.length).toFixed(2) + " → " + (SEQ.lex.seq.length / SEQ.lex.accs.length).toFixed(2)));
      const row3 = h("div", "rd-row");
      row3.appendChild(h("b", "", "Output: "));
      row3.appendChild(document.createTextNode("byte-identical, all " + SEQ.base.seq.length + " tokens"));
      done.append(row, row2, row3);
      v.appendChild(done);
      v.appendChild(h("span", "rd-note", "Replay to the first divergence, then the aggregate. Full-run figures from the paper's sd_lex.py on the same prompt."));
    }
  }
  function startRace() {
    if (playing || !SEQ) return;
    playing = true;
    $("#race-play span").textContent = "Pause";
    raceTimer = setInterval(() => {
      if (raceStep >= LAST) { stopRace(); return; }
      raceStep += 1;
      drawRace(raceStep);
    }, 110);
  }
  function stopRace() { playing = false; clearInterval(raceTimer); $("#race-play span").textContent = "Play"; }
  $("#race-play").addEventListener("click", () => (playing ? stopRace() : startRace()));
  $("#race-reset").addEventListener("click", () => { stopRace(); raceStep = 0; drawRace(0); });
  // play once when the lanes scroll into view
  if (SEQ) {
    const ro = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      ro.disconnect();
      setTimeout(() => { raceStep = 0; drawRace(0); startRace(); }, 400);
    }), { threshold: 0.4 });
    ro.observe($("#race"));
  }

  /* ================= 02: reach ================= */
  const SURVEY = D.survey || null;
  function renderReach() {
    const host = $("#reach-panel");
    host.replaceChildren();
    if (!SURVEY) { host.appendChild(h("p", "body", "Survey data not available in this build.")); return; }
    $("#reach-n").textContent = String(SURVEY.n_languages);
    const share = $("#reach-share");
    if (share) share.textContent = String(SURVEY.n_affected);
    const k = h("div", "kpis reach-kpis");
    [["languages measured", SURVEY.n_languages, "FLORES parallel text, one tokenizer"],
     ["≥ 1.5× English", SURVEY.n_affected, "words split into more pieces than English"],
     ["≥ 2× English", SURVEY.n_strong, "exposed to the slowdown Telugu shows"],
     ["script families", SURVEY.n_scripts, "the effect is not tied to one writing system"]]
      .forEach(([label, value, note]) => {
        const c = h("div", "kpi");
        c.appendChild(h("div", "k-label", label));
        c.appendChild(h("div", "k-value", String(value)));
        c.appendChild(h("div", "k-note", note));
        k.appendChild(c);
      });
    host.appendChild(k);
  }
  function drawReach() {
    const host = $("#reach-chart");
    host.replaceChildren();
    if (!SURVEY || !SURVEY.languages) return;
    const L = SURVEY.languages;
    const ref = SURVEY.english_reference.tokens_per_word;
    const bins = [
      { a: 1, b: 1.5, label: "< 1.5×", tone: "var(--seq-300)" },
      { a: 1.5, b: 2, label: "1.5–2×", tone: "var(--seq-400)" },
      { a: 2, b: 3, label: "2–3×", tone: "var(--series-1)" },
      { a: 3, b: 5, label: "3–5×", tone: "var(--series-2)" },
      { a: 5, b: 10, label: "5–10×", tone: "var(--series-2)" },
      { a: 10, b: 1e9, label: "> 10×", tone: "var(--series-2)" },
    ];
    bins.forEach((b) => { b.n = L.filter((r) => { const q = r.tokens_per_word / ref; return q >= b.a && q < b.b; }).length; });

    const W = host.clientWidth || 900, H = 250, padL = 44, padR = 12, padB = 52, padT = 22;
    const maxN = Math.max(...bins.map((b) => b.n));
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Distribution of tokens-per-word relative to English" });
    for (let i = 0; i <= 3; i++) {
      const v = (maxN / 3) * i;
      const y = H - padB - (v / maxN) * (H - padB - padT);
      svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, class: "gridline" }));
      const t = svgEl("text", { x: padL - 8, y: y + 3, class: "ticklabel", "text-anchor": "end" });
      t.textContent = Math.round(v);
      svg.appendChild(t);
    }
    const bw = (W - padL - padR) / bins.length;
    bins.forEach((b, i) => {
      const bx = padL + i * bw + bw * 0.18, bwd = bw * 0.64;
      const y = H - padB - (b.n / maxN) * (H - padB - padT);
      const g = svgEl("g", { tabindex: 0 });
      g.appendChild(svgEl("rect", { x: bx, y, width: bwd, height: H - padB - y, rx: 4, fill: b.tone, "fill-opacity": i === 0 ? 1 : 0.92 }));
      const vv = svgEl("text", { x: bx + bwd / 2, y: y - 7, class: "vallabel", "text-anchor": "middle" });
      vv.textContent = String(b.n);
      g.appendChild(vv);
      const lb = svgEl("text", { x: bx + bwd / 2, y: H - padB + 17, class: "catlabel", "text-anchor": "middle" });
      lb.textContent = b.label;
      g.appendChild(lb);
      const p = [{ key: "languages", val: String(b.n) }, { key: "share", val: Math.round((b.n / L.length) * 100) + "%" }];
      g.addEventListener("pointermove", (e) => showTip(e, b.label + " English tokens per word", p));
      g.addEventListener("pointerleave", hideTip);
      svg.appendChild(g);
    });
    const ax = svgEl("text", { x: W / 2, y: H - 6, class: "ticklabel", "text-anchor": "middle" });
    ax.textContent = "tokens per word, relative to English (" + ref.toFixed(2) + " tokens/word)";
    svg.appendChild(ax);
    host.appendChild(svg);

    // worst offenders
    const worst = L.slice().sort((a, b) => b.tokens_per_word - a.tokens_per_word).slice(0, 10);
    const list = h("div", "worst");
    list.appendChild(h("div", "worst-title", "Most fragmented in the sample"));
    const ol = h("ol", "worst-list");
    worst.forEach((r) => {
      const li = h("li");
      li.appendChild(h("span", "w-name", r.name));
      li.appendChild(h("span", "w-script", r.script));
      li.appendChild(h("b", "w-val", (r.tokens_per_word / ref).toFixed(1) + "×"));
      ol.appendChild(li);
    });
    list.appendChild(ol);
    host.appendChild(list);
  }

  /* ================= 04: side-by-side ranks ================= */
  function renderCompare() {
    const host = $("#word-compare");
    host.replaceChildren();
    if (!WORD) return;
    const table = h("div", "cmp");
    const head = h("div", "cmp-row head");
    ["position", "drafter", "prior", "gold"].forEach((t) => head.appendChild(h("span", "", t)));
    table.appendChild(head);
    WORD.positions.forEach((p) => {
      const r = h("div", "cmp-row");
      r.appendChild(h("code", "cmp-k", "k=" + p.k));
      r.appendChild(rankCell(p.drafter_rank));
      r.appendChild(rankCell(p.prior_rank));
      r.appendChild(h("code", "cmp-gold" + (isFrag(p.gold) ? " frag" : ""), p.gold));
      table.appendChild(r);
    });
    host.appendChild(table);
    host.appendChild(h("p", "chart-note",
      "Rank of the correct piece in each list (— not present). The prior puts it first exactly where the drafter loses it."));
  }
  function rankCell(rank) {
    const c = h("span", "cmp-rank");
    if (rank == null) { c.textContent = "—"; c.className += " miss"; }
    else { c.textContent = "#" + (rank + 1); if (rank === 0) c.className += " hit"; }
    return c;
  }

  /* ================= 05: gain bars ================= */
  let gainBase = "dpub";
  function drawGain() {
    const host = $("#gain-chart");
    if (!D.speed) return;
    const rows = D.speed.speed["1"].map((r) => ({
      lang: r.lang,
      g: ((r[gainBase + "_lex"].speedup / r[gainBase].speedup) - 1) * 100,
      before: r[gainBase].speedup, after: r[gainBase + "_lex"].speedup,
    })).sort((a, b) => b.g - a.g);
    const W = host.clientWidth || 900, labelW = 110, right = 64, top = 26, rowH = 23, barH = 11;
    const H = top + rows.length * rowH + 28;
    const lo = Math.min(-4, Math.floor(Math.min(...rows.map((r) => r.g)) - 1));
    const hi = Math.ceil(Math.max(...rows.map((r) => r.g)) + 2);
    const x = (v) => labelW + ((v - lo) / (hi - lo)) * (W - labelW - right);
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Throughput gain from LexDraft by language" });
    for (let v = 0; v <= hi; v += 10) {
      svg.appendChild(svgEl("line", { x1: x(v), x2: x(v), y1: top - 8, y2: H - 24, class: "gridline" }));
      const t = svgEl("text", { x: x(v), y: H - 8, class: "ticklabel", "text-anchor": "middle" });
      t.textContent = (v ? "+" : "") + v + "%";
      svg.appendChild(t);
    }
    svg.appendChild(svgEl("line", { x1: x(0), x2: x(0), y1: top - 10, y2: H - 24, class: "baseline" }));
    rows.forEach((r, i) => {
      const y = top + i * rowH;
      const lab = svgEl("text", { x: labelW - 10, y: y + barH - 1, class: "catlabel", "text-anchor": "end" });
      lab.textContent = LANG[r.lang] || r.lang;
      svg.appendChild(lab);
      const x0 = x(0), x1 = x(r.g);
      const g = svgEl("g", { tabindex: 0 });
      g.appendChild(svgEl("rect", { x: Math.min(x0, x1), y, width: Math.max(1.5, Math.abs(x1 - x0)), height: barH, rx: 3,
        fill: r.g >= 0 ? "var(--series-2)" : "var(--text-muted)" }));
      const vl = svgEl("text", { x: r.g >= 0 ? x1 + 7 : x1 - 7, y: y + barH - 1, class: "vallabel",
        "text-anchor": r.g >= 0 ? "start" : "end" });
      vl.textContent = (r.g >= 0 ? "+" : "") + r.g.toFixed(1) + "%";
      g.appendChild(vl);
      const p = [{ key: "without prior", val: r.before.toFixed(2) + "×" },
                 { key: "with LexDraft", val: r.after.toFixed(2) + "×", color: "var(--series-2)" }];
      g.addEventListener("pointermove", (e) => showTip(e, LANG[r.lang] || r.lang, p));
      g.addEventListener("pointerleave", hideTip);
      g.addEventListener("focus", () => { const b = g.getBoundingClientRect(); showTip({ clientX: b.left + b.width / 2, clientY: b.top }, LANG[r.lang], p); });
      g.addEventListener("blur", hideTip);
      svg.appendChild(g);
    });
    host.replaceChildren(svg);
  }

  /* ================= 05: tables ================= */
  let conc = "1", model = "qwen";
  function drawEngine() {
    if (!D.speed) return;
    const host = $("#engine-table");
    const table = h("table", "data"), thead = h("thead"), tr = h("tr");
    ["Language", "target tok/s", "AR drafter", "EAGLE-3", "DFlash public", "+ LexDraft", "DFlash ml", "ml + LexDraft", "LexDraft gain"]
      .forEach((t) => tr.appendChild(h("th", "", t)));
    thead.appendChild(tr); table.appendChild(thead);
    const tb = h("tbody");
    D.speed.speed[conc].forEach((r) => {
      const row = h("tr");
      row.appendChild(h("td", "", LANG[r.lang] || r.lang));
      row.appendChild(h("td", "", String(r.ar_tok_s)));
      ["ar_draft", "eagle3", "dpub", "dpub_lex", "dml", "dml_lex"].forEach((k) => {
        const v = r[k];
        row.appendChild(h("td", "", v.speedup == null ? "—" : v.speedup.toFixed(2) + "× (" + v.tau.toFixed(2) + ")"));
      });
      const gp = ((r.dpub_lex.speedup / r.dpub.speedup) - 1) * 100;
      const gm = ((r.dml_lex.speedup / r.dml.speedup) - 1) * 100;
      row.appendChild(h("td", gp >= 0.5 || gm >= 0.5 ? "gain-pos" : "gain-neg",
        (gp >= 0 ? "+" : "") + gp.toFixed(1) + " / " + (gm >= 0 ? "+" : "") + gm.toFixed(1) + "%"));
      tb.appendChild(row);
    });
    table.appendChild(tb);
    host.replaceChildren(table);
  }
  function drawLoop() {
    if (!D.main) return;
    const host = $("#loop-table");
    const table = h("table", "data"), thead = h("thead"), tr = h("tr");
    ["Task", "Lang.", "Pub + Lex", "ML", "ML + Lex"].forEach((t) => tr.appendChild(h("th", "", t)));
    thead.appendChild(tr); table.appendChild(thead);
    const tb = h("tbody");
    let task = null;
    D.main.forEach((r) => {
      if (r.task !== task) {
        if (task !== null) { const g = h("tr", "group"); const td = h("td", "", r.task); td.colSpan = 5; g.appendChild(td); tb.appendChild(g); }
        task = r.task;
      }
      const row = h("tr");
      row.append(h("td", "", r.task), h("td", "", LANG[r.lang] || r.lang));
      ["pub", "ml", "mllex"].forEach((k) => {
        const c = r[model][k];
        row.appendChild(h("td", c.best ? "best" : "", c.v.toFixed(2) + " ± " + c.ci.toFixed(2)));
      });
      tb.appendChild(row);
    });
    table.appendChild(tb);
    host.replaceChildren(table);
  }

  /* ================= controls & boot ================= */
  $$("#gain-base button").forEach((b) => b.addEventListener("click", () => {
    gainBase = b.dataset.b;
    $$("#gain-base button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    drawGain();
  }));
  $$("#conc button").forEach((b) => b.addEventListener("click", () => {
    conc = b.dataset.c;
    $$("#conc button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    drawEngine();
  }));
  $$("#tbl-model button").forEach((b) => b.addEventListener("click", () => {
    model = b.dataset.m;
    $$("#tbl-model button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    drawLoop();
  }));
  $("#copy-bib").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#bib").textContent); $("#copy-bib").textContent = "Copied"; }
    catch { $("#copy-bib").textContent = "⌘C"; }
    setTimeout(() => ($("#copy-bib").textContent = "Copy"), 1600);
  });
  $$('a[data-pending="paper"]').forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault(); a.setAttribute("aria-disabled", "true"); a.title = "Preprint link on publication";
  }));

  renderStrip(); renderDetail();
  renderReach(); drawReach();
  renderCompare();
  drawGain(); drawEngine(); drawLoop();
  drawRace(0);
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { drawGain(); drawReach(); }, 150); });
})();
