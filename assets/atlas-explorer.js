(() => {
  "use strict";
  const {t} = window.WorldDraftI18n;
  const geo = window.WorldDraftGeography;
  const get = id => document.getElementById(id);
  const canvas = get("atlas-svg");
  const highlight = get("explorer-highlight");
  const query = get("language-query");
  const modes = Array.from(document.querySelectorAll(".atlas-modes button"));
  const worldPaths = [], regionButtons = [];
  const humanCount = n => n.toLocaleString("en-US");
  const norm = s => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const places = geo.entries.map(([id, name, iso, mask], i) => ({
    id, name, iso, mask, point: geo.dots[i], key: norm(name+" "+iso+" "+id)
  }));
  const entryById = new Map(places.map(r=>[r.id,r]));
  const sampleByCode = new Map(geo.survey.map(row=>[row[0],row]));
  const sampleByEntry = new Map();
  for (const row of geo.survey) {
    if (!row[4]) continue;
    if (!sampleByEntry.has(row[4])) sampleByEntry.set(row[4],[]);
    sampleByEntry.get(row[4]).push(row);
  }
  const examples = [
    ["kabi1261","dizi1235","hosa1249"],["huli1244","bari1298","east2516"],
    ["lazz1240","ainu1240","basq1248"],["tlin1245","wich1260","tuni1252"],
    ["mapu1245","mats1244","cham1315"],["warl1254","tiwi1244","dyaa1249"]
  ];
  let mode, region = -1, activePlace = entryById.get("huli1244"), surveyCode = "sat_Olck", hits = [];
  const activeRegion = r => region < 0 || Boolean(r.mask & (1<<region));
  function svg(tag, attrs, content) {
    const el=document.createElementNS("http://www.w3.org/2000/svg",tag);
    for (const [k,v] of Object.entries(attrs)) el.setAttribute(k,v);
    if(content!==undefined) el.textContent=content;
    return el;
  }
  function button(label, action) {
    const b=document.createElement("button");
    b.type="button"; b.textContent=t(label); b.addEventListener("click",action);
    return b;
  }
  function mark(point, name) {
    highlight.replaceChildren();
    if (!point) return;
    const [x,y]=point;
    const labelX=Math.max(60,Math.min(652,x));
    const labelY=y<30?y+25:y-12;
    highlight.append(svg("circle",{cx:x,cy:y,r:6.5,class:"location-ring"}),
      svg("text",{x:labelX,y:labelY,"text-anchor":labelX<110?"start":labelX>605?"end":"middle"},name));
  }
  function offerJump(say, destination, code) {
    const b=button(say,()=>{
      activateMode(destination);
      const selector=get(destination==="tokens"?"survey-condition":"atlas-condition");
      selector.value=code; selector.dispatchEvent(new Event("change")); selector.focus();
    });
    b.className="condition-link";
    get("catalogue-evidence").append(" ",b);
  }
  function showPlace(record) {
    activePlace=record;
    mark(record.point,record.name);
    get("catalogue-name").textContent=record.name;
    const regions=geo.regions.filter((_,i)=>record.mask&(1<<i));
    get("catalogue-place").textContent=[regions.map(r=>t(r)).join(" / ")||t("Region unassigned"),record.iso.toUpperCase(),record.point?"":t("No mapped coordinates")].filter(Boolean).join(" · ");
    const survey=sampleByEntry.get(record.id), speed=geo.studyIds[record.id];
    const evidence=get("catalogue-evidence");
    evidence.textContent=t(speed?"A decoding benchmark is linked to this catalogue entry.":"No decoding speed measurement in this study.");
    if (speed) offerJump("See speedups","speed",speed==="sr"?"sr-Cyrl":speed);
    if (survey) offerJump("See tokenization","tokens",survey[0][0]);
    else if (!speed) evidence.append(" "+t("No FLORES-200 sample is linked to this catalogue entry."));
    get("catalogue-source").href="https://glottolog.org/resource/languoid/id/"+record.id;
  }
  function suggestions(){
    const term=norm(query.value.trim());
    if (term) {
      hits=places.filter(r=>activeRegion(r)&&r.key.includes(term))
        .sort((a,b)=>Number(norm(b.name).startsWith(term))-Number(norm(a.name).startsWith(term))||a.name.localeCompare(b.name,"en")).slice(0,6);
    } else {
      const ids=region<0?["huli1244","warl1254","mapu1245"]:examples[region];
      hits=ids.map(id=>entryById.get(id)).filter(r=>r&&activeRegion(r));
      if (hits.length<3) hits.push(...places.filter(r=>activeRegion(r)&&!hits.includes(r)).slice(0,3-hits.length));
    }
    const box=get("language-hits");
    box.replaceChildren(...hits.map(r=>button(r.name,()=>showPlace(r))));
    if(!hits.length) box.textContent=t("No matches in this region.");
  }
  function selectRegion(index) {
    region=index;
    query.value="";
    query.setAttribute("aria-label",region<0?t("Find a language in the entire catalogue"):t("Find a language in {0}",t(geo.regions[region])));
    worldPaths.forEach((p,i)=>p.classList.toggle("dimmed",region>=0 && i!==region));
    regionButtons.forEach((b,i)=>b.setAttribute("aria-pressed",String(i-1===region)));
    suggestions();
    if(hits.length) showPlace(hits[0]);
    if(mode==="world") get("atlas-finding").textContent=worldFinding();
  }
  const reset=button("All regions",()=>selectRegion(-1));
  regionButtons.push(reset);get("atlas-regions").append(reset);
  for(const [i,name] of geo.regions.entries()){
    const members=places.filter(r=>r.mask&(1<<i));
    const d=members.filter(r=>r.point).map(r=>"M"+r.point.join(" ")+"h.01").join("");
    const p=svg("path",{d,class:"region-points area-"+i});worldPaths.push(p);get("catalogue-regions").append(p);
    const b=button(name+" "+humanCount(members.length),()=>selectRegion(i));
    b.className="region-key area-"+i;regionButtons.push(b);get("atlas-regions").append(b);
  }
  query.addEventListener("input",suggestions);
  query.addEventListener("keydown",e=>{if(e.key==="Enter"&&hits.length){e.preventDefault();showPlace(hits[0]);}});
  canvas.addEventListener("click",e=>{
    if(mode!=="world") return;
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(canvas.getScreenCTM().inverse());
    let nearest, best=12*12;
    for(const r of places){
      if(!r.point||!activeRegion(r)) continue;
      const d=(p.x-r.point[0])**2+(p.y-r.point[1])**2;
      if(d<best){best=d;nearest=r;}
    }
    if(nearest) showPlace(nearest);
  });

  const selectSurvey=get("survey-condition");
  const scripts=new Intl.DisplayNames(["en"],{type:"script"});
  const sampleName=row=>window.WorldDraftI18n.name(row[0].split("_")[0],row[1]);
  const optionLabel=row=>{
    const script=row[0].split("_")[1];
    return sampleName(row)+" · "+window.WorldDraftI18n.name(script,scripts.of(script),"script");
  };
  for(const row of [...geo.survey].sort((a,b)=>optionLabel(a).localeCompare(optionLabel(b),"en")))
    selectSurvey.add(new Option(optionLabel(row),row[0]));
  const isoPins=new Map();
  for(const row of geo.survey){
    if(!row[3]) continue;
    const iso=row[0].split("_")[0];
    if(isoPins.has(iso)) continue;
    const [cx,cy]=row[3];
    const pin=svg("circle",{cx,cy,r:3.4,class:"survey-pin",tabindex:"-1",role:"button","aria-label":row[1]+", tokenizer measurement"});
    pin.append(svg("title",{},row[1]));
    pin.addEventListener("click",()=>showSample(row[0]));
    isoPins.set(iso,pin);get("survey-markers").append(pin);
  }

  const plot=get("survey-distribution"), plotX=v=>14+Math.log2(v)/5*250;
  const groups=Array(30).fill(0);
  for(const r of geo.survey) groups[Math.min(groups.length-1,Math.floor(Math.log2(r[2])/5*groups.length))]++;
  const maxGroup=Math.max(...groups);
  groups.forEach((count,i)=>{
    const height=38*count/maxGroup;
    plot.append(svg("rect",{x:14+i*250/groups.length,y:54-height,width:250/groups.length-1,height,class:"survey-bin"}));
  });
  for(const v of [1,2,4,8,16,32])
    plot.append(svg("text",{x:plotX(v),y:73,"text-anchor":"middle"},String(v)));
  const indicator=svg("line",{y1:8,y2:56,class:"survey-indicator"});
  plot.append(indicator);
  const english=sampleByCode.get("eng_Latn")[2];
  function showSample(code){
    surveyCode=code; selectSurvey.value=code;
    const [,name,value,point]=sampleByCode.get(code);
    get("survey-tpw").textContent=value.toFixed(2);
    get("survey-comparison").textContent=t("{0}× the English rate ({1} tokens per word).",(value/english).toFixed(2),english.toFixed(2))+(point?"":" "+t("No exact ISO match with coordinates on this map."));
    indicator.setAttribute("x1",plotX(value));indicator.setAttribute("x2",plotX(value));
    plot.setAttribute("aria-label",t("Histogram of 204 samples on a log scale. The selected sample, {0}, uses {1} tokens per word.",sampleName(sampleByCode.get(code)),value.toFixed(2)));
    mark(point,sampleName(sampleByCode.get(code)));
  }
  selectSurvey.addEventListener("change",()=>showSample(selectSurvey.value));
  const captions={
    world:"Select a region or a dot to explore. A dot marks one language’s reference location.",
    tokens:"Blue points locate surveyed languages. Use the selector to compare all 204 language–script samples, including those without mapped coordinates.",
    speed:"Select a colored marker to compare measured throughput. Other dots mark catalogue languages."
  };
  const findings={
    world:"Africa alone has 2,213 catalogue languages. Papunesia, the region around New Guinea and the Pacific islands, has 2,133. Our speed benchmark includes no language from Papunesia.",
    tokens:"On the same translated FLORES-200 passages, 203 of 204 language–script samples needed more Qwen tokens per word than English. This measures fragmentation. Decoding speed requires a separate inference run.",
    speed:"At 32 concurrent requests, public DFlash reached 1.66× in English and 0.72× in Telugu. It slowed decoding in 7 of 16 languages (9 of 18 conditions). After multilingual training, Korean, Latin-script Hindi and Latin-script Serbian still ran slower than direct decoding. The AR drafter sped up all 18 conditions."
  };
  function worldFinding(){
    if(region<0) return t(findings.world);
    const members=places.filter(activeRegion);
    const linkedSpeed=members.filter(r=>geo.studyIds[r.id]).length;
    const linkedSurvey=members.filter(r=>sampleByEntry.has(r.id)).length;
    if(window.WorldDraftI18n.locale!=="en") return t("{0} has {1} catalogue entries. Linked decoding benchmarks: {2}. Linked FLORES-200 tokenizer samples: {3}.",t(geo.regions[region]),humanCount(members.length),linkedSpeed,linkedSurvey);
    return geo.regions[region]+" has "+humanCount(members.length)+" catalogue entries. "+
      (linkedSpeed===0?"None have":linkedSpeed===1?"One has":linkedSpeed+" have")+
      " a linked decoding benchmark. "+(linkedSurvey===0?"None have":linkedSurvey===1?"One has":linkedSurvey+" have")+
      " a linked FLORES-200 tokenizer sample.";
  }
  function setMode(next){
    mode=next; document.querySelector(".atlas-figure").dataset.view=mode;
    for(const b of modes) b.setAttribute("aria-pressed",String(b.dataset.mode===mode));
    for(const [id,on] of [["catalogue-panel","world"],["atlas-regions","world"],["survey-panel","tokens"],["token-legend","tokens"],["speed-panel","speed"],["speed-legend","speed"]])
      get(id).hidden=mode!==on;
    for(const [id,on] of [["atlas-markers","speed"],["atlas-label","speed"],["survey-markers","tokens"],["catalogue-regions","world"]])
      get(id).style.display=mode===on?"":"none";
    get("atlas-locations").style.display=mode==="world"?"none":"";
    get("atlas-caption").textContent=t(captions[mode]);get("atlas-finding").textContent=mode==="world"?worldFinding():t(findings[mode]);
    canvas.setAttribute("aria-label",t("Language atlas. {0}",t(captions[mode])));
    highlight.replaceChildren();
    if(mode==="world") showPlace(activePlace);
    if(mode==="tokens") showSample(surveyCode);
  }
  function modeFromLink(){
    const linked=modes.find(b=>"#"+b.id===location.hash);
    if(linked) setMode(linked.dataset.mode);
    else if(location.hash==="#background") setMode("world");
  }
  function activateMode(next){
    setMode(next);
    const target=modes.find(b=>b.dataset.mode===next);
    if(location.protocol!=="file:") history.replaceState(null,"","#"+target.id);
  }
  modes.forEach(b=>b.addEventListener("click",()=>activateMode(b.dataset.mode)));
  window.addEventListener("hashchange",modeFromLink);
  document.addEventListener("worlddraft-locale",()=>{
    reset.textContent=t("All regions");
    for(const [i,r] of geo.regions.entries()){
      const count=places.filter(p=>p.mask&(1<<i)).length;
      regionButtons[i+1].textContent=t(r)+" "+humanCount(count);
    }
    query.setAttribute("aria-label",region<0?t("Find a language in the entire catalogue"):t("Find a language in {0}",t(geo.regions[region])));
    for(const opt of selectSurvey.options) opt.textContent=optionLabel(sampleByCode.get(opt.value));
    for(const [iso,pin] of isoPins){
      const row=geo.survey.find(r=>r[0].startsWith(iso+"_"));
      pin.setAttribute("aria-label",t("{0}, tokenizer measurement",sampleName(row)));
      pin.querySelector("title").textContent=sampleName(row);
    }
    suggestions();setMode(mode);
  });
  selectRegion(-1);setMode("world");modeFromLink();
})();
