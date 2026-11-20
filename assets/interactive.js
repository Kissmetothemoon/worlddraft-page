(() => {
  "use strict";
  const M=window.LexMetrics, D=window.LEXDATA, B=window.LEXBLOCK;
  const $=s=>document.querySelector(s);
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const names={en:"English",de:"German",fr:"French",es:"Spanish",ru:"Russian",zh:"Chinese",ja:"Japanese",ko:"Korean",ar:"Arabic",th:"Thai",sw:"Swahili",hi:"Hindi",bn:"Bengali",te:"Telugu",am:"Amharic","sr-Cyrl":"Serbian (Cyrillic)","sr-Latn":"Serbian (Latin)","hi-Latn":"Hindi (Latin)"};
  const meta={
    dpub:{name:"Original DFlash",note:"No extra multilingual training",tone:"base"},
    dpub_lex:{name:"Original DFlash + LexDraft",note:"Same drafter, add the prior",tone:"prior"},
    dml:{name:"Multilingual DFlash",note:"Multilingual training only",tone:"trained"},
    dml_lex:{name:"Multilingual DFlash + LexDraft",note:"Multilingual training + prior",tone:"combined"}
  };
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  let lang="te",concurrency="1",row,time=0,frame=null,startAt=0,startTime=0;
  let laneNodes={};
  for(const id of ["te","am","bn","en",...Object.keys(names).filter(k=>!["te","am","bn","en"].includes(k))]){
    const option=node("option","",names[id]);option.value=id;$("#race-language").append(option);
  }
  function stopRace(){
    if(frame!==null)cancelAnimationFrame(frame);frame=null;
    $("#race-start").textContent=reduced.matches?"Start at zero":"Play all four";
    $("#race-start").setAttribute("aria-pressed","false");
  }
  function renderTime(t){
    const state=M.raceSnapshot(row,t);time=state.time;
    $("#race-time").value=String(time);
    $("#race-time-value").textContent=time.toFixed(1);
    for(const lane of state.lanes){
      const refs=laneNodes[lane.key];
      refs.fill.style.transform="scaleX("+lane.progress+")";
      refs.percent.textContent=(lane.progress*100).toFixed(1)+"%";
      refs.progress.setAttribute("aria-valuenow",(lane.progress*100).toFixed(1));
      refs.state.textContent=lane.done?"Finished":time===0?"Ready":"Working";
      refs.root.classList.toggle("done",lane.done);
      const count=Math.floor(lane.progress*32+1e-8);
      refs.tiles.forEach((tile,i)=>tile.classList.toggle("complete",i<count));
    }
    const done=state.lanes.filter(l=>l.done), combined=state.lanes[3],baseline=state.lanes[0];
    let message;
    if(done.length===4)message="All four finish the same amount of work. Compare their finish times; the extra time used by the slower systems stays visible.";
    else if(combined.done)message="The combined system has finished. Original DFlash is "+(baseline.progress*100).toFixed(1)+"% complete at this same moment.";
    else if(done.length)message=done.map(l=>meta[l.key].name).join(" and ")+" finished first in this setting. The other systems are still working.";
    else if(time===0)message="All four start together. Play, drag the time slider, or jump directly to a finish.";
    else message="One shared clock. The four lanes have completed "+state.lanes.map(l=>(l.progress*100).toFixed(0)+"%").join(", ")+" of the same work.";
    $("#race-insight").textContent=message;
  }
  function buildRace(){
    stopRace();
    row=M.fourArmRows(D.speed,concurrency).find(r=>r.lang===lang);
    const host=$("#live-lanes");host.replaceChildren();laneNodes={};
    row.arms.forEach((arm,i)=>{
      const m=meta[arm.key],root=node("div","live-lane "+m.tone);
      root.dataset.system=arm.key;
      const label=node("div","live-label");label.append(node("strong","",m.name),node("span","",m.note));
      const body=node("div","live-body");
      const header=node("div","live-readout"),percent=node("strong","","0.0%"),state=node("span","","Ready");
      header.append(percent,state);
      const progress=node("div","work-progress");progress.setAttribute("role","progressbar");progress.setAttribute("aria-label",m.name+" illustrated work");progress.setAttribute("aria-valuemin","0");progress.setAttribute("aria-valuemax","100");
      const fill=node("div","work-fill "+m.tone);progress.append(fill);
      const tileRow=node("div","work-tiles");tileRow.setAttribute("aria-hidden","true");
      const tiles=Array.from({length:32},()=>{const tile=node("i");tileRow.append(tile);return tile;});
      body.append(header,progress,tileRow);
      const finish=node("button","finish-button");finish.type="button";
      finish.setAttribute("aria-label","Jump to "+m.name+" finish");
      finish.append(node("strong","",(100/arm.ratio).toFixed(1)),node("span","",arm.ratio.toFixed(2)+"× throughput"));
      finish.addEventListener("click",()=>{stopRace();renderTime(100/arm.ratio);});
      root.append(label,body,finish);host.append(root);
      laneNodes[arm.key]={root,fill,progress,percent,state,tiles};
    });
    const impact=$("#race-impact");impact.replaceChildren();
    for(const [title,value] of [["LexDraft on original",M.formatGain(row.priorGain)],["LexDraft on multilingual",M.formatGain(row.priorOnMultilingualGain)],["Combined vs original",row.arms[3].ratio.toFixed(2)+"×"]]){
      const box=node("p");box.append(node("span","",title),node("strong","",value));impact.append(box);
    }
    renderTime(100/row.arms[3].ratio);
  }
  function tick(now){
    renderTime(startTime+(now-startAt)/8000*M.RACE_END);
    if(time>=M.RACE_END){stopRace();return;}
    frame=requestAnimationFrame(tick);
  }
  $("#race-start").addEventListener("click",()=>{
    if(frame!==null){stopRace();return;}
    renderTime(0);
    if(reduced.matches)return;
    startAt=performance.now();startTime=0;
    $("#race-start").textContent="Pause";
    $("#race-start").setAttribute("aria-pressed","true");
    frame=requestAnimationFrame(tick);
  });
  $("#race-restart").addEventListener("click",()=>{stopRace();renderTime(0);});
  $("#race-time").addEventListener("input",e=>{stopRace();renderTime(e.target.value);});
  $("#race-language").addEventListener("change",e=>{lang=e.target.value;buildRace();});
  $("#race-concurrency").addEventListener("change",e=>{concurrency=e.target.value;buildRace();});
  $("#jump-combined").addEventListener("click",()=>{stopRace();renderTime(100/row.arms[3].ratio);});
  $("#jump-prior").addEventListener("click",()=>{stopRace();renderTime(100/row.arms[1].ratio);});
  $("#jump-all").addEventListener("click",()=>{stopRace();renderTime(Math.max(...row.arms.map(a=>100/a.ratio)));});
  buildRace();stopRace();

  // Actual proposal snapshots from trace_te.json, at a shared committed prefix.
  let blockIndex=6,phase=2,selected=1,blockTimer=null;
  B.rounds.forEach((r,i)=>{const opt=node("option","","Prefix "+(i+1)+" · "+r.accepted_plain+" vs "+r.accepted_lex+" accepted");opt.value=i;$("#block-round").append(opt);});
  $("#block-round").value=String(blockIndex);
  function stopBlock(){clearInterval(blockTimer);blockTimer=null;$("#block-play").textContent=reduced.matches?"Start at draft":"Replay block";}
  function tokenName(round,id){
    for(const position of round.positions)for(const entry of [...position.top,...position.lex])if(entry.t===id)return entry.v ? entry.p : "byte fragment "+entry.p;
    return "token "+id;
  }
  function renderInspector(){
    const r=B.rounds[blockIndex],host=$("#piece-inspector");host.replaceChildren();
    host.append(node("strong","","Position "+(selected+1)));
    host.append(node("span","","DFlash: "+tokenName(r,r.plain_pick[selected])));
    host.append(node("span","","After LexDraft: "+tokenName(r,r.lex_pick[selected])));
    const changed=r.plain_pick[selected]!==r.lex_pick[selected];
    host.append(node("span","",changed?"LexDraft changed this proposal.":"Both propose the same token here."));
  }
  function renderBlock(){
    const r=B.rounds[blockIndex],snapshot=M.blockSnapshot(r,phase),host=$("#block-rows");host.replaceChildren();
    for(const button of document.querySelectorAll(".block-steps button"))button.setAttribute("aria-pressed",String(Number(button.dataset.phase)===phase));
    for(const [key,title,accepted] of [["plain","DFlash proposal",r.accepted_plain],["lex","After LexDraft",r.accepted_lex]]){
      const line=node("div","block-row "+key);
      const label=node("div","block-row-label");label.append(node("strong","",title),node("span","",phase===2?accepted+" accepted":phase===0?"Neural proposals":"Before target verification"));
      const pieces=node("div","block-pieces");
      for(const p of snapshot[key]){
        const cell=node("button","block-cell "+p.state+(p.changed?" changed":"")+(selected===p.index?" selected":""));
        cell.type="button";cell.dataset.position=p.index;cell.dataset.state=p.state;
        cell.setAttribute("aria-pressed",String(selected===p.index));
        cell.setAttribute("aria-label",title+", position "+(p.index+1)+", "+p.state+(p.changed?", changed by prior":""));
        cell.append(node("span","cell-index",String(p.index+1)),node("span","cell-state",p.state==="accepted"?"✓":p.state==="rejected"?"×":p.state==="discarded"?"·":p.changed?"↺":"?"));
        cell.addEventListener("click",()=>{selected=p.index;renderBlock();});
        pieces.append(cell);
      }
      line.append(label,pieces);host.append(line);
    }
    let message;
    if(phase===0)message="One neural pass proposes every position. The second row is the same proposal before LexDraft is applied.";
    else if(phase===1)message="The prior changes "+snapshot.lex.filter(p=>p.changed).length+" proposals at this prefix. An outline marks a changed candidate; target acceptance is not shown yet.";
    else {
      const delta=r.accepted_lex-r.accepted_plain;
      message=delta>0?"The first mismatch moves later: "+r.accepted_plain+" accepted without LexDraft, "+r.accepted_lex+" with it. "+delta+" extra draft tokens survive this check.":delta===0?"Both accept "+r.accepted_plain+" draft tokens at this prefix. Changing candidates does not guarantee a gain every round.":"This recorded prefix accepts fewer proposals with LexDraft. Local results are not forced to improve.";
    }
    $("#block-verdict").textContent=message;renderInspector();
  }
  $(".block-steps").addEventListener("click",e=>{const b=e.target.closest("button");if(b){stopBlock();phase=Number(b.dataset.phase);renderBlock();}});
  $("#block-round").addEventListener("change",e=>{stopBlock();blockIndex=Number(e.target.value);selected=1;phase=2;renderBlock();});
  $("#block-play").addEventListener("click",()=>{
    if(blockTimer!==null){stopBlock();return;}
    phase=0;renderBlock();
    if(reduced.matches)return;
    $("#block-play").textContent="Pause";
    blockTimer=setInterval(()=>{phase++;renderBlock();if(phase===2)stopBlock();},1100);
  });
  renderBlock();stopBlock();
  reduced.addEventListener("change",()=>{stopRace();stopBlock();});
  document.addEventListener("visibilitychange",()=>{if(document.hidden){stopRace();stopBlock();}});
  document.documentElement.dataset.interactiveReady="true";
})();
