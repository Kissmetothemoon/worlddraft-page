const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const M=require("../assets/metrics.js");
const read=name=>JSON.parse(fs.readFileSync(path.join(root,"data",name+".json"),"utf8"));
const trace=read("seqs"),speed=read("speed");
test("recorded outputs match and every round count is accounted for",()=>assert.equal(M.validateTrace(trace),true));
test("round 15 really ties at 38: no fabricated gain",()=>{
  const s=M.snapshot(trace,15);assert.equal(s.base.tokens,38);assert.equal(s.lex.tokens,38);
  assert.equal(s.base.fraction,38/512);assert.equal(s.lex.fraction,38/512);
});
test("finish milestone shows 481 vs 512, using a fixed 512-token denominator",()=>{
  const s=M.snapshot(trace,160);assert.equal(s.base.tokens,481);assert.equal(s.lex.tokens,512);
  assert.equal(s.base.fraction,481/512);assert.equal(s.lex.fraction,1);
  assert.equal(s.base.done,false);assert.equal(s.lex.done,true);
});
test("full replay continues to round 170 and freezes the finished lane at 160",()=>{
  const s=M.snapshot(trace,170);assert.equal(s.base.tokens,512);assert.equal(s.lex.tokens,512);
  assert.equal(s.base.rounds,170);assert.equal(s.lex.rounds,160);
});
test("all 171 replay frames are bounded and monotone",()=>{
  let previous=M.snapshot(trace,0);
  for(let i=1;i<=170;i++){const s=M.snapshot(trace,i);for(const key of ["base","lex"]){assert.ok(s[key].tokens>=previous[key].tokens);assert.ok(s[key].fraction>=0&&s[key].fraction<=1);}previous=s;}
});
test("ten fewer rounds means 5.9%, not 50% throughput",()=>{
  assert.equal(trace.base.accs.length-trace.lex.accs.length,10);
  assert.equal(((1-trace.lex.accs.length/trace.base.accs.length)*100).toFixed(1),"5.9");
});
test("all 108 engine comparisons use the selected matched baseline",()=>{
  let count=0;for(const c of ["1","8","32"])for(const base of ["dpub","dml"]){
    const rows=M.engineRows(speed,c,base);assert.equal(rows.length,18);
    for(const row of rows){const source=speed.speed[c].find(x=>x.lang===row.lang);assert.equal(row.gain,(source[base+"_lex"].speedup/source[base].speedup-1)*100);count++;}
  }assert.equal(count,108);
});
test("featured values and counterexample are rounded consistently",()=>{
  const rows=M.engineRows(speed,1,"dpub");assert.equal(M.formatGain(rows.find(x=>x.lang==="te").gain),"+50.0%");
  assert.equal(M.formatGain(rows.find(x=>x.lang==="en").gain),"−0.4%");
  assert.equal(M.formatGain(-.001),"0.0%");
});
test("fixed gain domain covers every load and baseline",()=>{
  const d=M.gainDomain(speed);for(const c of ["1","8","32"])for(const b of ["dpub","dml"])for(const r of M.engineRows(speed,c,b))assert.ok(r.gain>=d.min&&r.gain<=d.max);
});
test("offline data bundle is byte-value equivalent to source JSON",()=>{
  const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,"assets/data.js"),"utf8"),context);
  for(const [key,name] of [["speed","speed"],["seqs","seqs"],["main","table_main"]])assert.equal(JSON.stringify(context.window.LEXDATA[key]),JSON.stringify(read(name)));
});
test("invalid traces do not silently claim identical output",()=>{
  const wrong=JSON.parse(JSON.stringify(trace));wrong.lex.seq[0]=-1;
  assert.throws(()=>M.validateTrace(wrong),/Paired outputs differ/);
});
test("HTML contains no paper-image gallery or fake publication links",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  assert.equal((html.match(/<img\b/g)||[]).length,0);assert.ok(!html.includes('href="#"'));assert.ok(!html.includes('inproceedings'));
});

test("four arms are present in the requested fixed order for all 54 conditions",()=>{
  let n=0;
  for(const c of ["1","8","32"])for(const row of M.fourArmRows(speed,c)){
    assert.deepEqual(row.arms.map(a=>a.key),["dpub","dpub_lex","dml","dml_lex"]);
    const src=speed.speed[c].find(r=>r.lang===row.lang);
    for(const arm of row.arms){assert.equal(arm.ratio,src[arm.key].speedup/src.dpub.speedup);n++;}
  }
  assert.equal(n,216);
});
test("training-only control is visible data, not folded into the combined gain",()=>{
  const te=M.fourArmRows(speed,1).find(r=>r.lang==="te");
  assert.deepEqual(te.arms.map(a=>a.ratio.toFixed(2)),["1.00","1.50","2.07","2.43"]);
  assert.equal(te.arms[2].absolute,2.24);
});
test("paired LexDraft increments use original and multilingual denominators respectively",()=>{
  const te=M.fourArmRows(speed,1).find(r=>r.lang==="te");
  assert.equal(M.formatGain(te.priorGain),"+50.0%");
  assert.equal(M.formatGain(te.priorOnMultilingualGain),"+17.0%");
  assert.equal(M.formatGain(te.combinedGain),"+142.6%");
});
test("English retains both slightly negative matched gains",()=>{
  const en=M.fourArmRows(speed,1).find(r=>r.lang==="en");
  assert.equal(M.formatGain(en.priorGain),"−0.4%");
  assert.equal(M.formatGain(en.priorOnMultilingualGain),"−0.7%");
});
test("all four normalized series fit the fixed zero-based scale",()=>{
  for(const c of ["1","8","32"])for(const row of M.fourArmRows(speed,c))for(const arm of row.arms)assert.ok(arm.ratio>0&&arm.ratio<=M.FOUR_ARM_MAX);
});
test("no control hides the multilingual-only arm",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  assert.ok(!html.includes('id="hero-base"'));assert.ok(!html.includes('id="results-base"'));
  assert.ok(html.includes("All four systems stay visible"));
});

const blocks=read("trace_te").rounds;
test("race uses inverse measured throughput for normalized finish times",()=>{
  const row=M.fourArmRows(speed,1).find(r=>r.lang==="te");
  const s=M.raceSnapshot(row,100/row.arms[3].ratio);
  assert.equal(s.lanes[3].done,true);
  assert.equal(s.lanes[3].progress,1);
  assert.equal(s.lanes[0].progress.toFixed(3),"0.412");
  assert.equal(s.lanes[1].progress.toFixed(3),"0.618");
  assert.equal(s.lanes[2].progress.toFixed(3),"0.855");
});
test("all four lanes start at zero and finish within 110 across all measurements",()=>{
  for(const c of ["1","8","32"])for(const row of M.fourArmRows(speed,c)){
    for(const lane of M.raceSnapshot(row,0).lanes)assert.equal(lane.progress,0);
    for(const lane of M.raceSnapshot(row,110).lanes){assert.equal(lane.progress,1);assert.equal(lane.done,true);}
  }
});
test("work progress is bounded and monotonic over the whole interactive timeline",()=>{
  for(const c of ["1","8","32"])for(const row of M.fourArmRows(speed,c)){
    let old=[0,0,0,0];
    for(let t=0;t<=110;t++){const s=M.raceSnapshot(row,t);s.lanes.forEach((l,i)=>{assert.ok(l.progress>=old[i]&&l.progress<=1);old[i]=l.progress;});}
  }
});
test("English does not force the combined system to win",()=>{
  const row=M.fourArmRows(speed,1).find(r=>r.lang==="en"),s=M.raceSnapshot(row,100/row.arms[2].ratio);
  assert.equal(s.lanes[2].done,true);assert.equal(s.lanes[3].done,false);
});
test("real prefix 7 verifies one vs three accepted draft positions",()=>{
  const s=M.blockSnapshot(blocks[6],2);
  assert.equal(s.plain.filter(x=>x.state==="accepted").length,1);
  assert.equal(s.lex.filter(x=>x.state==="accepted").length,3);
  assert.equal(s.plain[1].state,"rejected");assert.equal(s.lex[3].state,"rejected");
});
test("block phases show real candidate changes before revealing acceptance",()=>{
  for(const b of blocks){
    const draft=M.blockSnapshot(b,0),rescore=M.blockSnapshot(b,1),verify=M.blockSnapshot(b,2);
    assert.deepEqual(draft.plain.map(p=>p.id),draft.lex.map(p=>p.id));
    assert.deepEqual(rescore.lex.map(p=>p.id),b.lex_pick);
    assert.ok(rescore.lex.every(p=>p.state==="proposed"));
    assert.equal(verify.plain.filter(p=>p.state==="accepted").length,b.accepted_plain);
    assert.equal(verify.lex.filter(p=>p.state==="accepted").length,b.accepted_lex);
    assert.ok(verify.lex.slice(b.accepted_lex+1).every(p=>p.state==="discarded"));
  }
});
test("block data bundle matches the original exported snapshot JSON",()=>{
  const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,"assets/block-data.js"),"utf8"),context);
  assert.equal(JSON.stringify(context.window.LEXBLOCK),JSON.stringify(read("trace_te")));
});
