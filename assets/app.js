(() => {
  "use strict";
  const {t} = window.WorldDraftI18n;
  const D = window.LEXDATA, M = window.LexMetrics;
  const $ = selector => document.querySelector(selector);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = t(text);
    return node;
  };
  const names = {en:"English",de:"German",fr:"French",es:"Spanish",ru:"Russian",zh:"Chinese",ja:"Japanese",ko:"Korean",ar:"Arabic",th:"Thai",sw:"Swahili",hi:"Hindi",bn:"Bengali",te:"Telugu",am:"Amharic","sr-Cyrl":"Serbian (Cyrillic)","sr-Latn":"Serbian (Latin)","hi-Latn":"Hindi (Latin)"};
  const mode = window.matchMedia("(prefers-color-scheme: dark)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let userTheme = null;
  try { userTheme = localStorage.getItem("worlddraft-theme"); } catch { /* Storage is optional. */ }
  const setTheme = theme => {
    document.documentElement.dataset.theme = theme;
    $("#theme-toggle").textContent = t(theme === "dark" ? "Light" : "Dark");
    $("#theme-toggle").setAttribute("aria-label", t(theme === "dark" ? "Switch to light theme" : "Switch to dark theme"));
  };
  setTheme(userTheme === "light" || userTheme === "dark" ? userTheme : mode.matches ? "dark" : "light");
  $("#theme-toggle").addEventListener("click", () => {
    userTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(userTheme);
    try { localStorage.setItem("worlddraft-theme",userTheme); } catch { /* Keep session choice. */ }
  });
  mode.addEventListener("change", () => { if (!userTheme) setTheme(mode.matches ? "dark" : "light"); });

  const ARM_META = {
    dpub: {tone:"base",label:"Original DFlash",short:"Original DFlash"},
    dpub_lex: {tone:"prior",label:"Original DFlash + WorldDraft",short:"+ WorldDraft"},
    dml: {tone:"trained",label:"Multilingual-trained DFlash",short:"Multilingual DFlash"},
    dml_lex: {tone:"combined",label:"Multilingual-trained DFlash + WorldDraft",short:"+ WorldDraft"}
  };
  // Four simultaneous arms; every denominator is public DFlash, never dml.
  function fourBars(row) {
    const bars=el("div","pair-bars four-bars");
    for(const arm of row.arms) {
      const meta=ARM_META[arm.key];
      const line=el("div","bar-row"); line.dataset.arm=arm.key;
      line.setAttribute("aria-label",t("{0}: {1} times original DFlash",t(meta.label),arm.ratio.toFixed(2)));
      const track=el("div","bar-track"),bar=el("div","bar "+meta.tone),reference=el("i","reference-mark");
      bar.style.transform="scaleX("+(arm.ratio/M.FOUR_ARM_MAX)+")";
      reference.style.left=(1/M.FOUR_ARM_MAX*100)+"%";
      track.append(bar,reference);
      line.append(el("span","arm-label",meta.short),track,el("span","bar-value",arm.ratio.toFixed(2)+"×"));
      bars.append(line);
    }
    return bars;
  }
  function renderHero() {
    const rows=M.fourArmRows(D.speed,1);
    const host=$("#hero-bars");host.replaceChildren();
    for(const lang of ["te","am","bn","en"]) {
      const row=rows.find(r=>r.lang===lang),item=el("div","feature-item");
      item.dataset.lang=lang;
      const label=el("div","feature-label");
      label.append(el("strong","",names[lang]),
        el("span","combined-gain",t("{0}× combined",row.arms[3].ratio.toFixed(2))));
      const gains=el("div","paired-gains");
      gains.append(el("span","prior-gain",t("{0} on original",M.formatGain(row.priorGain))),
        el("span","trained-prior-gain",t("{0} on multilingual",M.formatGain(row.priorOnMultilingualGain))));
      item.append(label,fourBars(row),gains);host.append(item);
    }
  }
  renderHero();

  // Trace counts are real committed-token counts, not reconstructed draft proposals.
  const trace = D.seqs;
  M.validateTrace(trace);
  const lastRound = Math.max(trace.base.accs.length,trace.lex.accs.length);
  const finishRound = trace.lex.accs.length;
  const goal = trace.base.seq.length;
  let round = finishRound, timer = null;
  $("#saved-rounds").textContent = (trace.base.accs.length-finishRound)+" fewer rounds";
  $("#saved-percent").textContent = ((1-finishRound/trace.base.accs.length)*100).toFixed(1)+"% reduction on this request";
  $("#identity").textContent = "✓ Final output verified: all "+goal+" token IDs match";
  $("#round-slider").max = lastRound;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = (tag,attrs,text) => {
    const n = document.createElementNS(svgNS,tag);
    for (const [k,v] of Object.entries(attrs||{})) n.setAttribute(k,String(v));
    if (text!==undefined) n.textContent=t(text);
    return n;
  };
  const chartX = r => 38 + r/lastRound*324;
  const chartY = tokens => 190 - tokens/goal*166;
  let cursor, baseDot, lexDot;
  function drawTraceChart() {
    const chart = svg("svg",{viewBox:"0 0 390 226",role:"img","aria-labelledby":"trace-svg-title"});
    chart.append(svg("title",{id:"trace-svg-title"},"Cumulative token progress: drafter 170 rounds, WorldDraft 160 rounds. Both finish at 512 tokens."));
    for (const tokens of [0,256,512]) {
      chart.append(svg("line",{x1:38,x2:362,y1:chartY(tokens),y2:chartY(tokens),class:"svg-grid"}));
      chart.append(svg("text",{x:30,y:chartY(tokens)+4,"text-anchor":"end",class:"svg-label"},String(tokens)));
    }
    for (const step of [0,40,80,120,170]) chart.append(svg("text",{x:chartX(step),y:210,"text-anchor":"middle",class:"svg-label"},String(step)));
    chart.append(svg("text",{x:38,y:12,class:"svg-label"},"tokens"));
    chart.append(svg("text",{x:362,y:224,"text-anchor":"end",class:"svg-label"},"verification rounds"));
    for (const key of ["base","lex"]) {
      const counts=M.cumulative(trace[key].accs);
      const path=counts.map((count,i)=>(i?"L":"M")+chartX(i).toFixed(2)+","+chartY(count).toFixed(2)).join(" ");
      chart.append(svg("path",{d:path,class:"trace-path "+key}));
    }
    cursor=svg("line",{y1:24,y2:190,class:"trace-cursor"});
    baseDot=svg("circle",{r:4,class:"trace-dot base"});
    lexDot=svg("circle",{r:4,class:"trace-dot lex"});
    chart.append(cursor,baseDot,lexDot);
    $("#trace-chart").replaceChildren(chart);
  }
  function renderRound(value) {
    const state=M.snapshot(trace,value); round=state.step;
    for (const key of ["base","lex"]) {
      const lane=state[key];
      $("#"+key+"-tokens").textContent=t("{0} / {1} tokens",lane.tokens,goal);
      $("#"+key+"-fill").style.transform="scaleX("+lane.fraction+")";
      $("#"+key+"-progress").setAttribute("aria-valuenow",lane.tokens);
      $("#"+key+"-rounds").textContent=t("{0} rounds used",lane.rounds);
      $("#"+key+"-status").textContent=t(lane.done?"Finished":round===0?"Ready":"Still decoding");
    }
    $("#round-slider").value=round;
    $("#round-output").textContent=round;
    $("#next-round").disabled=round>=lastRound;
    let message;
    if (state.base.done && state.lex.done) message="Same 512-token answer. WorldDraft used 160 rounds; the original drafter used 170.";
    else if (state.lex.done) message=t("WorldDraft has finished. The original drafter still has {0} tokens to go.",goal-state.base.tokens);
    else if (round===0) message="Same request, same target. Step through the measured decoding rounds.";
    else if (state.base.tokens===state.lex.tokens) message=t("Both runs have committed {0} tokens so far. The full-run outcome remains visible above.",state.base.tokens);
    else {
      const delta=state.lex.tokens-state.base.tokens;
      message=delta>0 ? t("After {0} rounds, WorldDraft has committed {1} more tokens.",round,delta) : t("At this round the original drafter is ahead by {0} tokens. Local leads can change.",Math.abs(delta));
    }
    $("#trace-message").textContent=t(message);
    cursor.setAttribute("x1",chartX(round)); cursor.setAttribute("x2",chartX(round));
    for (const [dot,lane] of [[baseDot,state.base],[lexDot,state.lex]]) {
      dot.setAttribute("cx",chartX(lane.rounds)); dot.setAttribute("cy",chartY(lane.tokens));
    }
  }
  function pause() {
    if (timer!==null) clearInterval(timer);
    timer=null;
    $("#replay").textContent=t(reduced.matches?"Restart":"Replay");
    $("#replay").setAttribute("aria-pressed","false");
  }
  $("#replay").addEventListener("click",()=>{
    if(timer!==null){pause();return;}
    renderRound(0);
    if(reduced.matches) return;
    $("#replay").textContent=t("Pause");
    $("#replay").setAttribute("aria-pressed","true");
    timer=setInterval(()=>{
      renderRound(round+1);
      if(round>=lastRound) pause();
    },100);
  });
  $("#next-round").addEventListener("click",()=>{pause();renderRound(round+1);});
  $("#round-slider").addEventListener("input",event=>{pause();renderRound(event.target.value);});
  $("#finish-moment").addEventListener("click",()=>{pause();renderRound(finishRound);});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)pause();});
  reduced.addEventListener("change",()=>pause());
  drawTraceChart(); renderRound(round); pause();

  // Same four systems at every concurrency. No hidden baseline toggle.
  let concurrency="1";
  function renderResults() {
    const rows=M.fourArmRows(D.speed,concurrency).sort((a,b)=>b.combinedGain-a.combinedGain);
    const host=$("#results-bars");host.replaceChildren();
    for(const row of rows) {
      const item=el("div","result-row");item.dataset.lang=row.lang;
      const head=el("div","result-header");
      head.append(el("span","result-name",names[row.lang]),
        el("span","combined-result",t("{0} combined",M.formatGain(row.combinedGain))));
      const paired=el("div","paired-gains");
      paired.append(el("span","prior-gain",t("{0} on original",M.formatGain(row.priorGain))),
        el("span","trained-prior-gain",t("{0} on multilingual",M.formatGain(row.priorOnMultilingualGain))));
      item.append(head,fourBars(row),paired);host.append(item);
    }
    renderEngine();
  }
  function tableHead(table,caption,labels) {
    table.replaceChildren();
    table.append(el("caption","",caption));
    const head=el("thead"),row=el("tr");
    for(const label of labels){const th=el("th","",label);th.scope="col";row.append(th);}
    head.append(row);table.append(head);
    const body=el("tbody");table.append(body);return body;
  }
  function renderEngine() {
    const table=$("#engine-table");
    const body=tableHead(table,t("Concurrency {0} · speedup (mean committed tokens per round)",concurrency),["Language","Target tok/s","AR drafter","EAGLE-3","Original DFlash","DFlash + WorldDraft","ML training only","ML + WorldDraft","Prior on original","Prior on ML"]);
    for(const row of D.speed.speed[concurrency]){
      const tr=el("tr");tr.append(el("td","",names[row.lang]),el("td","",String(row.ar_tok_s)));
      for(const key of ["ar_draft","eagle3","dpub","dpub_lex","dml","dml_lex"]){
        const cell=row[key];tr.append(el("td","",cell.speedup==null?"Not available":cell.speedup.toFixed(2)+"× ("+cell.tau.toFixed(2)+")"));
      }
      tr.append(el("td","",M.formatGain(M.gain(row.dpub.speedup,row.dpub_lex.speedup))),
        el("td","",M.formatGain(M.gain(row.dml.speedup,row.dml_lex.speedup))));
      body.append(tr);
    }
  }
  function renderLoop() {
    const body=tableHead($("#loop-table"),"Matched speculative loop · public DFlash = 1.00",["Task","Language","Target","Public + WorldDraft","Multilingual","Multilingual + WorldDraft"]);
    for(const row of D.main) for(const target of ["qwen","llama"]){
      const tr=el("tr");tr.append(el("td","",row.task),el("td","",names[row.lang]),el("td","",target==="qwen"?"Qwen3-8B":"Llama-3.1-8B"));
      for(const key of ["pub","ml","mllex"]){const v=row[target][key];tr.append(el("td","",v.v.toFixed(2)+" ± "+v.ci.toFixed(2)));}
      body.append(tr);
    }
  }
  $("#concurrency").addEventListener("change",e=>{concurrency=e.target.value;renderResults();});
  renderResults();renderLoop();
  $("#copy-bib").addEventListener("click",async()=>{
    try {
      await navigator.clipboard.writeText($("#bib").textContent);
      $("#copy-status").textContent=t("BibTeX copied.");
    } catch {
      const range=document.createRange();range.selectNodeContents($("#bib"));
      const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
      $("#copy-status").textContent=t("Citation selected. Use your browser’s Copy command.");
    }
  });
  document.addEventListener("worlddraft-locale",()=>{
    setTheme(document.documentElement.dataset.theme);
    renderHero();renderResults();renderLoop();drawTraceChart();renderRound(round);
    $("#replay").textContent=t(timer!==null?"Pause":reduced.matches?"Restart":"Replay");
    $("#saved-rounds").textContent=t("{0} fewer rounds",trace.base.accs.length-finishRound);
    $("#saved-percent").textContent=t("{0}% reduction on this request",((1-finishRound/trace.base.accs.length)*100).toFixed(1));
    $("#identity").textContent=t("✓ Final output verified: all {0} token IDs match",goal);
    $("#copy-status").textContent="";
  });
  document.documentElement.dataset.ready="true";
})();
