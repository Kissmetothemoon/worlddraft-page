import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {spawn} from "node:child_process";
import assert from "node:assert/strict";
import {fileURLToPath, pathToFileURL} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const out=path.join(root,"verification");
fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],failedRequests=[],httpFailures=[];
const log=s=>{checks.push(s);console.log(s);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  const file=path.resolve(root,"."+pathname+(pathname.endsWith("/")?"index.html":""));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,buf)=>{
    if(err){res.writeHead(404);res.end();return;}
    const type={".html":"text/html",".css":"text/css",".js":"application/javascript",".json":"application/json",".png":"image/png",".svg":"image/svg+xml"}[path.extname(file)]||"application/octet-stream";
    res.writeHead(200,{"Content-Type":type+"; charset=utf-8"});res.end(buf);
  });
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const url="http://127.0.0.1:"+server.address().port+"/";
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"worlddraft-cdp-"));
const chrome=spawn(process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",[
  "--headless=new","--disable-gpu","--disable-background-networking","--disable-extensions",
  "--no-first-run","--no-default-browser-check","--no-proxy-server","--remote-debugging-port=0",
  "--user-data-dir="+profile,"about:blank"
],{stdio:"ignore"});
let ws,seq=0;const pending=new Map();
function call(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++seq;
    const timeout=setTimeout(()=>{pending.delete(id);reject(new Error("CDP timeout: "+method));},15000);
    pending.set(id,{resolve:v=>{clearTimeout(timeout);resolve(v);},reject:e=>{clearTimeout(timeout);reject(e);}});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression){
  const r=await call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function stable(){await evaluate("document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))");}
async function shot(name,full=false){
  await stable();
  const options={format:"png",captureBeyondViewport:full};
  if(full){const m=await call("Page.getLayoutMetrics");options.clip={x:0,y:0,width:m.cssContentSize.width,height:m.cssContentSize.height,scale:1};}
  const image=await call("Page.captureScreenshot",options);
  fs.writeFileSync(path.join(out,name+".png"),Buffer.from(image.data,"base64"));
}
async function viewport(width,height,mobile=false){
  await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile});
  await stable();
}
async function sectionShot(selector,name){
  await stable();
  const clip=await evaluate(`(() => {
    const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return {x:r.x+scrollX-10,y:r.y+scrollY,width:r.width+20,height:r.height,scale:1};
  })()`);
  const image=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:true,clip});
  fs.writeFileSync(path.join(out,name+".png"),Buffer.from(image.data,"base64"));
}
async function click(selector){await evaluate("document.querySelector("+JSON.stringify(selector)+").click()");}
async function pointerClick(selector){
  await evaluate("document.querySelector("+JSON.stringify(selector)+").scrollIntoView({block:'center',behavior:'instant'})");
  await stable();
  const point=await evaluate("(()=>{const e=document.querySelector("+JSON.stringify(selector)+");const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await call("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...point});
  await call("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...point});
}
async function keyPress(key,code,virtual){
  await call("Input.dispatchKeyEvent",{type:"keyDown",key,code,windowsVirtualKeyCode:virtual,...(key==="Enter"?{text:"\r",unmodifiedText:"\r"}:{})});
  await call("Input.dispatchKeyEvent",{type:"keyUp",key,code,windowsVirtualKeyCode:virtual});
}
async function select(selector,value){await evaluate("(()=>{const e=document.querySelector("+JSON.stringify(selector)+");e.value="+JSON.stringify(value)+";e.dispatchEvent(new Event('change',{bubbles:true}));})()");}
async function slider(value){await evaluate("(()=>{const e=document.querySelector('#round-slider');e.value="+value+";e.dispatchEvent(new Event('input',{bubbles:true}));})()");}
async function text(selector){return evaluate("document.querySelector("+JSON.stringify(selector)+").textContent");}
try{
  let portFile=path.join(profile,"DevToolsActivePort");
  for(let i=0;i<200&&!fs.existsSync(portFile);i++)await wait(50);
  assert.ok(fs.existsSync(portFile),"Chrome debugging endpoint available");
  const port=fs.readFileSync(portFile,"utf8").split("\n")[0];
  const tabs=await fetch("http://127.0.0.1:"+port+"/json/list").then(r=>r.json());
  ws=new WebSocket(tabs.find(t=>t.type==="page").webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
  ws.addEventListener("message",event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}return;}
    if(m.method==="Runtime.exceptionThrown")errors.push(m.params.exceptionDetails);
    if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error")errors.push(m.params);
    if(m.method==="Network.loadingFailed")failedRequests.push(m.params);
    if(m.method==="Network.responseReceived"&&m.params.response.status>=400)httpFailures.push({url:m.params.response.url,status:m.params.response.status});
  });
  await call("Page.enable");await call("Runtime.enable");await call("Network.enable");
  await viewport(1440,1000);
  await call("Emulation.setEmulatedMedia",{features:[{name:"prefers-color-scheme",value:"light"},{name:"prefers-reduced-motion",value:"no-preference"}]});
  await call("Page.navigate",{url});
  for(let i=0;i<100;i++){if(await evaluate("document.documentElement.dataset.interactiveReady === 'true'"))break;await wait(50);}
  assert.equal(await evaluate("document.documentElement.dataset.interactiveReady"),"true");
  log("PASS initial load: four-lane interactive exhibit and recorded block inspector ready");
  assert.equal(await evaluate("document.querySelector('.atlas-figure').dataset.view"),"world");
  assert.equal(await text("#catalogue-name"),"Huli");
  assert.equal(await evaluate("WorldDraftGeography.entries.length-Object.keys(WorldDraftGeography.studyIds).length"),7669);
  assert.match(await text("#atlas-regions"),/Papunesia 2,133/);
  await click("#atlas-regions .area-5");
  assert.equal(await text("#catalogue-name"),"Warlpiri");
  assert.match(await text("#atlas-finding"),/Australia has 355 catalogue entries. None have a linked decoding benchmark/);
  assert.equal(await evaluate("document.querySelectorAll('.region-points.dimmed').length"),5);
  await click("#atlas-regions button:first-child");
  async function findLanguage(name){
    await evaluate(`(() => {const el=document.querySelector('#language-query');el.value=${JSON.stringify(name)};el.dispatchEvent(new Event('input'));})()`);
    await click("#language-hits button");
  }
  await findLanguage("airm1242");
  assert.match(await text("#catalogue-place"),/No mapped coordinates/);
  await findLanguage("quy");
  await click("#catalogue-evidence .condition-link");
  assert.equal(await evaluate("document.querySelector('#survey-condition').value"),"quy_Latn");
  const survey=JSON.parse(fs.readFileSync(path.join(root,"data/survey_summary.json"))).languages;
  assert.equal(await evaluate("document.querySelector('#survey-condition').options.length"),204);
  assert.equal(await evaluate("document.querySelectorAll('.survey-pin').length"),191);
  for(const row of survey){
    await select("#survey-condition",row.flores);
    assert.equal(await text("#survey-tpw"),row.tokens_per_word.toFixed(2));
  }
  await select("#survey-condition","zho_Hant");
  assert.match(await text("#survey-comparison"),/No exact ISO match/);
  await select("#survey-condition","sat_Olck");
  assert.match(await text("#survey-comparison"),/8.16×/);
  log("PASS global atlas: catalogue lookup, regional coverage, linked FLORES sample, 204 tokenizer values and unmapped entries");
  await sectionShot("#background","desktop-atlas-tokens");
  await click("#atlas-decoding");
  const speed=JSON.parse(fs.readFileSync(path.join(root,"data/speed.json"))).speed["32"];
  const fertility=JSON.parse(fs.readFileSync(path.join(root,"data/languages.json")));
  const slow=speed.filter(row=>row.dpub.speedup<1);
  assert.deepEqual([slow.length,new Set(slow.map(row=>row.lang.split("-")[0])).size],[9,7]);
  assert.equal(speed.filter(row=>row.dml.speedup<1).length,3);
  assert.ok(speed.every(row=>row.ar_draft.speedup>1));
  assert.deepEqual(await evaluate("[WorldDraftGeography.catalogue,WorldDraftGeography.dots.length,document.querySelectorAll('.atlas-pin').length,document.querySelectorAll('.atlas-pin.slower').length,document.querySelector('#atlas-condition').options.length]"),[7685,7683,16,7,18]);
  for(const row of speed){
    await select("#atlas-condition",row.lang);
    for(const [key,id] of [["dpub","public"],["dml","trained"],["ar_draft","ar"]])
      assert.equal(await text("#atlas-"+id),row[key].speedup.toFixed(2)+"×");
    assert.equal(await text("#atlas-fertility"),fertility.find(r=>r.lang===row.lang).tw.toFixed(2)+" tokens per word · Qwen3-8B");
    assert.equal(await evaluate("document.querySelector('.atlas-pin[aria-pressed=true]').dataset.lang"),row.lang.split("-")[0]);
  }
  await evaluate("document.querySelector('.atlas-pin[data-lang=en]').focus()");
  await keyPress("Enter","Enter",13);
  assert.equal(await text("#atlas-public"),"1.66×");
  await pointerClick(".atlas-pin[data-lang=te] .pin-core");
  assert.equal(await text("#atlas-public"),"0.72×");
  const examples=JSON.parse(fs.readFileSync(path.join(root,"data/tok_examples.json")));
  for(const lang of ["en","te"]){
    const expected=examples[lang].groups[0].p.map(p=>p.t);
    const pieces=await evaluate(`Array.from(document.querySelectorAll('#pieces-${lang} span'),s=>s.textContent.replaceAll(' ',''))`);
    assert.deepEqual(pieces,expected);
  }
  log("PASS atlas: 16 markers, 18 conditions, 54 throughput ratios, script selection, pointer and keyboard; word pieces match the recorded prompt");
  await evaluate("document.activeElement.blur()");
  await sectionShot("#background","desktop-atlas-speed");
  await click("#atlas-languages"); await click("#atlas-regions button:first-child");
  await sectionShot("#background","desktop-atlas");
  await sectionShot("#word-fragmentation","desktop-fragmentation");
  await evaluate("window.scrollTo({top:0,behavior:'instant'});document.activeElement.blur()");
  assert.equal(await evaluate("document.querySelectorAll('.feature-item').length"),4);
  assert.equal(await text('#hero-bars [data-lang="te"] .prior-gain'),"+50.0% on original");
  assert.equal(await text('#hero-bars [data-lang="en"] .prior-gain'),"−0.4% on original");
  assert.equal(await text("#base-tokens"),"481 / 512 tokens");
  assert.equal(await text("#lex-tokens"),"512 / 512 tokens");
  log("PASS default milestone: round 160, base 481/512, WorldDraft 512/512");
  const originalColors=await evaluate("({text:getComputedStyle(document.querySelector('.caption')).color,bg:getComputedStyle(document.body).backgroundColor})");
  fs.writeFileSync(path.join(out,"colors.json"),JSON.stringify(originalColors,null,2));
  await shot("desktop-hero");
  await shot("desktop-full",true);
  await evaluate("document.querySelector('#demo').scrollIntoView({behavior:'instant'})");
  await shot("desktop-demo");
  await evaluate("document.querySelector('#block-demo').scrollIntoView({behavior:'instant'})");
  await shot("desktop-block");
  await evaluate("document.querySelector('#results').scrollIntoView({behavior:'instant'})");
  await shot("desktop-results");
  const heroArms=await evaluate("Array.from(document.querySelectorAll('#hero-bars .feature-item')).map(el=>Array.from(el.querySelectorAll('[data-arm]')).map(e=>e.dataset.arm))");
  for(const order of heroArms)assert.deepEqual(order,["dpub","dpub_lex","dml","dml_lex"]);
  assert.equal(await evaluate("document.querySelectorAll('#hero-bars .bar-row').length"),16);
  assert.equal(await text('#hero-bars [data-lang="te"] [data-arm="dml"] .bar-value'),"2.07×");
  assert.equal(await text('#hero-bars [data-lang="te"] [data-arm="dml_lex"] .bar-value'),"2.43×");
  assert.equal(await text('#hero-bars [data-lang="te"] .trained-prior-gain'),"+17.0% on multilingual");
  log("PASS optional measurement chart retains all four systems in fixed order");

  assert.equal(await evaluate("document.querySelectorAll('#live-lanes .live-lane').length"),4);
  assert.equal(await evaluate("document.querySelector('#race-start').getBoundingClientRect().top < document.querySelector('#live-lanes').getBoundingClientRect().top"),true);
  const tickFraction=await evaluate("(()=>{const p=document.querySelector('.time-ticks'),t=p.children[2];return parseFloat(getComputedStyle(t).left)/p.getBoundingClientRect().width})()");
  assert.ok(Math.abs(tickFraction-100/110)<0.002);
  log("PASS playback controls precede lanes; normalized-time tick 100 is positioned at 100/110");
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#live-lanes .live-lane')).map(e=>e.dataset.system)"),["dpub","dpub_lex","dml","dml_lex"]);
  assert.equal(await text('#live-lanes [data-system="dpub"] .live-readout strong'),"41.2%");
  assert.equal(await text('#live-lanes [data-system="dml_lex"] .live-readout strong'),"100.0%");
  await click("#race-restart");
  assert.equal(await text("#race-time-value"),"0.0");
  await click("#race-start");await wait(250);assert.ok(Number(await text("#race-time-value"))>0);
  await click("#race-start");const raceStopped=await text("#race-time-value");await wait(150);assert.equal(await text("#race-time-value"),raceStopped);
  await click("#jump-prior");assert.equal(await text('#live-lanes [data-system="dpub_lex"] .live-readout strong'),"100.0%");
  await click("#jump-all");assert.equal(await evaluate("document.querySelectorAll('#live-lanes .done').length"),4);
  log("PASS four-lane playback: synchronized start, pause, reset and finish checkpoints");
  for(const c of ["1","8","32"]){
    await select("#race-concurrency",c);
    for(const lang of ["en","de","fr","es","ru","zh","ja","ko","ar","th","sw","hi","bn","te","am","sr-Cyrl","sr-Latn","hi-Latn"]){
      await select("#race-language",lang);
      const ok=await evaluate("(()=>{const row=LexMetrics.fourArmRows(LEXDATA.speed,document.querySelector('#race-concurrency').value).find(r=>r.lang===document.querySelector('#race-language').value);const state=LexMetrics.raceSnapshot(row,100/row.arms[3].ratio);const lanes=Array.from(document.querySelectorAll('#live-lanes .live-lane'));return lanes.every((el,i)=>el.dataset.system===state.lanes[i].key && el.querySelector('.live-readout strong').textContent===(state.lanes[i].progress*100).toFixed(1)+'%' && el.querySelector('.finish-button strong').textContent===state.lanes[i].finish.toFixed(1));})()");
      assert.equal(ok,true);
    }
  }
  await select("#race-concurrency","1");await select("#race-language","en");
  await click('[data-system="dml"] .finish-button');
  assert.equal(await evaluate("document.querySelector('[data-system=dml]').classList.contains('done')"),true);
  assert.equal(await evaluate("document.querySelector('[data-system=dml_lex]').classList.contains('done')"),false);
  await select("#race-language","te");
  log("PASS all 54 race settings: 216 progress/finish values match data; English does not force WorldDraft to win");
  assert.equal(await evaluate("document.querySelectorAll('.block-row.plain .accepted').length"),1);
  assert.equal(await evaluate("document.querySelectorAll('.block-row.lex .accepted').length"),3);
  await click('.block-steps [data-phase="0"]');
  assert.equal(await evaluate("document.querySelectorAll('.block-cell.accepted').length"),0);
  await click('.block-steps [data-phase="1"]');
  assert.ok(await evaluate("document.querySelectorAll('.block-row.lex .changed').length>0"));
  assert.equal(await evaluate("document.querySelectorAll('.block-cell.rejected').length"),0);
  await click('.block-steps [data-phase="2"]');
  await click('.block-row.lex [data-position="1"]');
  assert.ok((await text("#piece-inspector")).includes("WorldDraft changed"));
  for(let n=0;n<8;n++){
    await select("#block-round",String(n));
    const ok=await evaluate("(()=>{const r=LEXBLOCK.rounds[Number(document.querySelector('#block-round').value)];return document.querySelectorAll('.block-row.plain .accepted').length===r.accepted_plain && document.querySelectorAll('.block-row.lex .accepted').length===r.accepted_lex})()");
    assert.equal(ok,true);
  }
  await select("#block-round","6");
  await click("#block-play");assert.equal(await evaluate("document.querySelector('.block-steps button[aria-pressed=true]').dataset.phase"),"0");
  await wait(2400);assert.equal(await evaluate("document.querySelector('.block-steps button[aria-pressed=true]').dataset.phase"),"2");
  log("PASS real block interaction: draft/rescore/verify phases, clickable proposals, all 8 recorded prefixes");
  await call("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  await wait(50);await click("#race-start");await wait(150);assert.equal(await text("#race-time-value"),"0.0");
  await click("#block-play");await wait(150);assert.equal(await evaluate("document.querySelector('.block-steps button[aria-pressed=true]').dataset.phase"),"0");
  await click('.block-steps [data-phase="2"]');await click("#jump-combined");
  await call("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"no-preference"},{name:"prefers-color-scheme",value:"light"}]});
  log("PASS reduced-motion mode: race and block are manual, with no autoplay");
  await slider(15);assert.equal(await text("#base-tokens"),"38 / 512 tokens");assert.equal(await text("#lex-tokens"),"38 / 512 tokens");
  assert.ok((await text("#trace-message")).includes("Both runs"));
  const frac=await evaluate("document.querySelector('#base-fill').style.transform");
  assert.equal(frac,"scaleX(0.0742188)");
  await slider(170);
  assert.equal(await text("#base-rounds"),"170 rounds used");assert.equal(await text("#lex-rounds"),"160 rounds used");
  assert.equal(await evaluate("document.querySelector('#next-round').disabled"),true);
  await click("#finish-moment");
  assert.equal(await text("#round-output"),"160");
  log("PASS replay endpoints: tied round 15 is 7.4% progress; final rounds 170 vs 160");

  await click("#replay");await wait(350);
  assert.ok(Number(await text("#round-output"))>0);
  await click("#replay");const stopped=await text("#round-output");await wait(200);assert.equal(await text("#round-output"),stopped);
  await click("#next-round");assert.equal(Number(await text("#round-output")),Number(stopped)+1);
  log("PASS replay, pause and next-round controls");
  await call("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"},{name:"prefers-color-scheme",value:"light"}]});
  await wait(50);await click("#replay");await wait(250);assert.equal(await text("#round-output"),"0");assert.equal(await text("#replay"),"Restart");
  await click("#next-round");assert.equal(await text("#round-output"),"1");
  log("PASS reduced motion: no timed replay; manual stepping works");
  await call("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"no-preference"},{name:"prefers-color-scheme",value:"light"}]});
  await click("#finish-moment");

  for(const c of ["1","8","32"]){
    await select("#concurrency",c);
    assert.equal(await evaluate("document.querySelectorAll('.result-row').length"),18);
    assert.equal(await evaluate("document.querySelectorAll('#results-bars [data-arm]').length"),72);
    assert.equal(await evaluate("document.querySelectorAll('#engine-table tbody tr').length"),18);
    const correct=await evaluate("(()=>{const expected=LexMetrics.fourArmRows(LEXDATA.speed,"+JSON.stringify(c)+");return expected.every(r=>{const el=Array.from(document.querySelectorAll('#results-bars .result-row')).find(e=>e.dataset.lang===r.lang);const bars=Array.from(el.querySelectorAll('[data-arm]'));return bars.every((b,i)=>b.dataset.arm===r.arms[i].key && b.querySelector('.bar-value').textContent===r.arms[i].ratio.toFixed(2)+'×') && el.querySelector('.prior-gain').textContent===LexMetrics.formatGain(r.priorGain)+' on original' && el.querySelector('.trained-prior-gain').textContent===LexMetrics.formatGain(r.priorOnMultilingualGain)+' on multilingual';})})()");
    assert.equal(correct,true);
  }
  log("PASS 216 plotted values: 4 arms × 3 loads × 18 conditions; 108 matched prior gains checked");
  await select("#concurrency","1");
  await click("#engine-details > summary");assert.equal(await evaluate("document.querySelector('#engine-details').open"),true);
  await click("#engine-details > summary");
  assert.ok(await evaluate("document.querySelectorAll('#loop-table tbody tr').length>0"));
  log("PASS progressively disclosed engine and two-target loop tables");
  await click(".citation > summary");await click("#copy-bib");
  assert.ok((await text("#copy-status")).length>0);
  await click(".citation > summary");
  log("PASS citation copy reports copied or selected fallback");

  for(const [width,height,mobile] of [[1440,1000,false],[1024,900,false],[768,1000,true],[390,844,true],[320,800,true]]){
    await viewport(width,height,mobile);
    await evaluate("window.scrollTo({top:0,behavior:'instant'})");
    const dimensions=await evaluate("({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth})");
    assert.ok(dimensions.content<=dimensions.viewport+1,JSON.stringify({width,...dimensions}));
    log("PASS responsive width "+width+": no horizontal page overflow");
    if(width===390){await shot("mobile-hero");await shot("mobile-full",true);await evaluate("document.querySelector('#demo').scrollIntoView({behavior:'instant'})");await shot("mobile-demo");await evaluate("document.querySelector('#block-demo').scrollIntoView({behavior:'instant'})");await shot("mobile-comparison");}
  }
  await viewport(390,844,true);
  await sectionShot("#background","mobile-atlas");
  await click("#atlas-tokenization");await sectionShot("#background","mobile-atlas-tokens");await click("#atlas-languages");
  await sectionShot("#word-fragmentation","mobile-fragmentation");
  await pointerClick("#race-restart");assert.equal(await text("#race-time-value"),"0.0");
  await pointerClick("#race-time");const timeBefore=Number(await text("#race-time-value"));await keyPress("ArrowRight","ArrowRight",39);
  assert.ok(Number(await text("#race-time-value"))>=timeBefore);
  await pointerClick("#jump-combined");
  await pointerClick('.block-steps [data-phase="1"]');
  await pointerClick('.block-row.lex [data-position="1"]');
  assert.ok((await text("#piece-inspector")).includes("Position 2"));
  await pointerClick('.block-steps [data-phase="2"]');
  log("PASS mobile pointer/keyboard: shared time slider, finish jump, block phases and token inspection");
  await click("#recorded-trace > summary");
  await pointerClick("#finish-moment");
  assert.equal(await text("#round-output"),"160");
  await pointerClick("#next-round");
  assert.equal(await text("#round-output"),"161");
  await pointerClick("#round-slider");
  const beforeKey=Number(await text("#round-output"));
  await keyPress("ArrowRight","ArrowRight",39);
  assert.equal(Number(await text("#round-output")),Math.min(170,beforeKey+1));
  await pointerClick("#replay");
  assert.equal(await text("#replay"),"Pause");
  await keyPress("Enter","Enter",13);
  assert.equal(await text("#replay"),"Replay");
  await pointerClick("#finish-moment");
  log("PASS real pointer and keyboard input: replay, pause, next round and slider");
  for(const selector of ["#engine-details > summary","#loop-details > summary",".citation > summary"]){
    await pointerClick(selector);
    assert.equal(await evaluate("document.querySelector("+JSON.stringify(selector)+").parentElement.open"),true);
  }
  await pointerClick("#copy-bib");
  assert.ok((await text("#copy-status")).length>0);
  for(const width of [320,390]){
    await viewport(width,844,true);
    assert.equal(await evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth+1"),true);
    const contained=await evaluate("Array.from(document.querySelectorAll('.table-scroll')).every(e=>e.clientWidth<=document.documentElement.clientWidth&&getComputedStyle(e).overflowX==='auto')");
    assert.equal(contained,true);
  }
  await pointerClick("#engine-details .table-scroll");
  await keyPress("ArrowRight","ArrowRight",39);
  await wait(200);
  assert.ok(await evaluate("document.querySelector('#engine-details .table-scroll').scrollLeft>0"));
  log("PASS expanded 320/390px disclosures: no page overflow; table keyboard scrolling works");
  for(const selector of ["#engine-details > summary","#loop-details > summary",".citation > summary"])await pointerClick(selector);
  await click("#recorded-trace > summary");
  await viewport(1440,1000);await evaluate("window.scrollTo({top:0,behavior:'instant'})");
  await click("#theme-toggle");assert.equal(await evaluate("document.documentElement.dataset.theme"),"dark");
  await shot("desktop-dark");
  await sectionShot("#background","dark-atlas");
  await viewport(390,844,true);await shot("mobile-dark");
  await click("#theme-toggle");
  log("PASS manual dark/light theme switch and desktop/mobile captures");
  const links=await evaluate("Array.from(document.querySelectorAll('a[href]')).map(a=>a.getAttribute('href'))");
  for(const link of links){
    if(link.startsWith("#"))assert.equal(await evaluate("!!document.getElementById("+JSON.stringify(link.slice(1))+")"),true);
    else if(!link.startsWith("https:"))assert.equal((await fetch(url+link)).status,200);
  }
  log("PASS all internal anchors and local downloads resolve");
  assert.equal(await evaluate("document.images.length"),0);
  assert.equal(errors.length,0,JSON.stringify(errors));
  assert.equal(failedRequests.length,0,JSON.stringify(failedRequests));
  assert.equal(httpFailures.length,0,JSON.stringify(httpFailures));
  log("PASS browser console errors: 0; transport failures: 0; HTTP errors: 0; paper images: 0");
  await call("Page.navigate",{url:pathToFileURL(path.join(root,"index.html")).href});
  for(let i=0;i<100;i++){if(await evaluate("location.protocol==='file:' && document.documentElement.dataset.interactiveReady==='true'"))break;await wait(50);}
  assert.equal(await evaluate("location.protocol"),"file:");
  assert.equal(await evaluate("document.querySelectorAll('.atlas-pin').length"),16);
  assert.equal(await text("#atlas-public"),"0.72×");
  assert.equal(await evaluate("document.documentElement.dataset.ready"),"true");
  assert.equal(await text('#hero-bars [data-lang="te"] .prior-gain'),"+50.0% on original");
  assert.equal(errors.length,0);assert.equal(failedRequests.length,0);
  log("PASS offline file:// load: data, styles and scripts available without server");
  await call("Page.navigate",{url:url+"#atlas-tokenization"});
  for(let i=0;i<100;i++){if(await evaluate("document.querySelector('.atlas-figure')?.dataset.view==='tokens'"))break;await wait(50);}
  assert.equal(await text("#survey-tpw"),"10.12");
  await evaluate("location.hash='atlas-decoding'");
  await stable();
  assert.equal(await evaluate("document.querySelector('#speed-panel').hidden"),false);
  log("PASS public atlas deep links initialize and switch evidence layers");
  const locales=await evaluate("Array.from(document.querySelector('#site-locale').options,o=>o.value)");
  assert.equal(locales.length,18);
  assert.equal(locales[0],"en");
  assert.equal(locales.at(-1),"ar");
  assert.equal(await evaluate("document.documentElement.lang"),"en");
  const protectedText=await evaluate("['#bib','#pieces-en','#pieces-te'].map(s=>document.querySelector(s).textContent)");
  await select("#atlas-condition","sr-Latn");
  await select("#race-concurrency","8");
  await select("#block-round","4");
  async function waitLocale(code) {
    for(let i=0;i<200;i++){
      if(await evaluate("document.documentElement.lang==="+JSON.stringify(code)))return;
      await wait(25);
    }
    assert.fail("Locale did not load: "+code);
  }
  const localizedWidths=[320,390,768,1440];
  for(const code of locales.slice(1)){
    await select("#site-locale",code);await waitLocale(code);
    assert.notEqual(await text("#hero-title"),"What Slows Parallel Diffusion Drafters Across Languages?");
    assert.equal(await evaluate("document.documentElement.dir"),code==="ar"?"rtl":"ltr");
    assert.equal(await evaluate("document.querySelector('#atlas-condition').value"),"sr-Latn");
    assert.equal(await evaluate("document.querySelector('#race-concurrency').value"),"8");
    assert.equal(await evaluate("document.querySelector('#block-round').value"),"4");
    assert.equal(await text("#atlas-public"),"0.86×");
    assert.deepEqual(await evaluate("['#bib','#pieces-en','#pieces-te'].map(s=>document.querySelector(s).textContent)"),protectedText);
    await click("#atlas-tokenization");await select("#survey-condition","sat_Olck");
    assert.equal(await text("#survey-tpw"),"10.12");
    assert.notEqual(await text("#race-restart"),"Reset","reset label "+code);
    for(const width of localizedWidths){
      await viewport(width,900,width<769);
      const extra=await evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth");
      assert.ok(extra<=1,"horizontal overflow "+code+" "+width+" +"+extra);
    }
    if(code==="ar" || code==="zh-Hans" || code==="te"){
      await evaluate("window.scrollTo({top:0,behavior:'instant'});document.activeElement.blur()");
      await sectionShot("#background","locale-"+code);
    }
    await click("#atlas-decoding");
  }
  await select("#site-locale","ar");await waitLocale("ar");
  await call("Page.navigate",{url});await waitLocale("ar");
  // Text content alone cannot detect a fraction or interval drawn backwards by bidi layout.
  await click("#recorded-trace > summary");
  await click(".static-summary > summary");
  await click("#engine-details > summary");
  await click("#loop-details > summary");
  const numericRuns=[
    [".race-scrubber bdi",await text("#race-time-value")+" / 110"],
    ["#base-tokens","481 / 512"],[".scrubber bdi","160 / 170"],
    ["#engine-table tbody td:nth-child(3)",await text("#engine-table tbody td:nth-child(3)")],
    ["#loop-table tbody td:nth-child(4)",await text("#loop-table tbody td:nth-child(4)")],
    ["#hero-bars [data-lang=en] .prior-gain","−0.4%"]
  ];
  await click("#atlas-decoding");
  numericRuns.push(["#atlas-public","0.72×"]);
  for(const width of [320,1440]){
    await viewport(width,900,width===320);
    for(const [selector,run] of numericRuns){
      const increasing=await evaluate(`(() => {
        const host=document.querySelector(${JSON.stringify(selector)});
        const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);
        const rect=document.createRange(), centers=[];
        let content="",node;
        while(node=walker.nextNode()) for(let i=0;i<node.length;i++){
          rect.setStart(node,i);rect.setEnd(node,i+1);
          const box=rect.getBoundingClientRect();
          content+=node.data[i];centers.push(box.left+box.width/2);
        }
        const sample=${JSON.stringify(run)},start=content.indexOf(sample);
        return start>=0 && centers.slice(start+1,start+sample.length).every((x,i)=>x>centers[start+i]);
      })()`);
      assert.ok(increasing,"RTL visual order: "+selector+" "+run+" at "+width);
    }
    assert.equal(await evaluate("getComputedStyle(document.querySelector('#site-locale')).direction"),"ltr");
    assert.equal(await evaluate("document.querySelector('.nav-row .brand').getBoundingClientRect().right <= document.querySelector('#site-locale').getBoundingClientRect().left"),true);
  }
  await viewport(320,850,true);
  assert.ok(await evaluate("document.querySelector('.time-ticks > :last-child').getBoundingClientRect().left-document.querySelector('.time-ticks > :nth-child(3)').getBoundingClientRect().right >= 3"));
  log("PASS Arabic: consistent menu order and navigation; ratios, signed gains, intervals and mobile ticks render in visual order");
  await call("Page.navigate",{url:url+"?lang=zh-Hans#atlas-decoding"});await waitLocale("zh-Hans");
  assert.equal(await evaluate("document.querySelector('#speed-panel').hidden"),false);
  await select("#site-locale","en");await waitLocale("en");
  assert.equal(await text("#hero-title"),"What Slows Parallel Diffusion Drafters Across Languages?");
  assert.equal(await text("#race-restart"),"Reset");
  await call("Page.navigate",{url:pathToFileURL(path.join(root,"index.html")).href+"?lang=te#word-fragmentation"});
  await waitLocale("te");
  assert.equal(await text("#race-restart"),"మళ్లీ మొదలుపెట్టండి");
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(httpFailures.length,0,JSON.stringify(httpFailures));
  log("PASS 18 site locales: default, persistence, link override, RTL, four viewport widths and interaction state");
  const metadata={browser:await call("Browser.getVersion"),checks:checks.length,errors,failedRequests,httpFailures};
  fs.writeFileSync(path.join(out,"browser.json"),JSON.stringify(metadata,null,2));
  fs.writeFileSync(path.join(out,"browser.log"),checks.join("\n")+"\n");
  log("Browser validation complete: "+checks.length+" checks.");
}catch(error){
  console.error(error.stack);
  fs.writeFileSync(path.join(out,"browser-failure.log"),checks.join("\n")+"\n"+error.stack+"\n");
  if(ws&&ws.readyState===1){try{await shot("failure");}catch{}}
  process.exitCode=1;
}finally{
  const exited=new Promise(resolve=>{if(chrome.exitCode!==null)resolve();else chrome.once("exit",resolve);});
  if(ws && ws.readyState===1){
    try { await call("Browser.close"); } catch { chrome.kill("SIGTERM"); }
  } else { chrome.kill("SIGTERM"); }
  if(ws)ws.close();
  await exited;
  await fs.promises.rm(profile,{recursive:true,force:true,maxRetries:12,retryDelay:250});
  server.close();
}
