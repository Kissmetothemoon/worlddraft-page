/* Shared arithmetic: browser rendering and node regression tests use the same code. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LexMetrics = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  function gain(before, after) {
    if (!(before > 0) || !Number.isFinite(after)) throw new Error("Invalid speedup pair");
    return (after / before - 1) * 100;
  }
  function formatGain(value) {
    const rounded = Math.round(value * 10) / 10;
    if (Object.is(rounded, -0) || rounded === 0) return "0.0%";
    return (rounded > 0 ? "+" : "−") + Math.abs(rounded).toFixed(1) + "%";
  }
  function validateTrace(trace) {
    for (const key of ["base", "lex"]) {
      const lane = trace[key];
      if (!lane || !lane.accs.length || lane.accs.some(n => !Number.isInteger(n) || n < 0)) throw new Error("Invalid round counts");
      if (lane.accs.reduce((a,b) => a+b,0) !== lane.seq.length) throw new Error("Counts do not sum to sequence length");
    }
    if (trace.base.seq.length !== trace.lex.seq.length || trace.base.seq.some((t,i) => t !== trace.lex.seq[i])) throw new Error("Paired outputs differ");
    return true;
  }
  function cumulative(counts) {
    const out = [0];
    for (const count of counts) out.push(out[out.length - 1] + count);
    return out;
  }
  function snapshot(trace, round) {
    const maxRound = Math.max(trace.base.accs.length, trace.lex.accs.length);
    const step = Math.min(maxRound, Math.max(0, Math.trunc(Number(round) || 0)));
    const goal = trace.base.seq.length;
    const lane = key => {
      const rounds = Math.min(step, trace[key].accs.length);
      const tokens = trace[key].accs.slice(0,rounds).reduce((a,b) => a+b,0);
      return {rounds, tokens, fraction: tokens / goal, done: rounds === trace[key].accs.length};
    };
    return {step, goal, maxRound, base: lane("base"), lex: lane("lex")};
  }
  function engineRows(data, concurrency, base) {
    if (!["dpub","dml"].includes(base)) throw new Error("Unknown drafter");
    return data.speed[String(concurrency)].map(row => ({
      lang: row.lang, before: row[base].speedup, after: row[base+"_lex"].speedup,
      gain: gain(row[base].speedup, row[base+"_lex"].speedup)
    }));
  }
  function gainDomain(data) {
    const all = Object.keys(data.speed).flatMap(c => ["dpub","dml"].flatMap(b => engineRows(data,c,b).map(r=>r.gain)));
    return {min: Math.min(-10,Math.floor(Math.min(...all)/10)*10), max: Math.max(60,Math.ceil(Math.max(...all)/10)*10)};
  }
  // Every arm is normalized to the original public DFlash at the same load.
  function fourArmRows(data, concurrency) {
    return data.speed[String(concurrency)].map(row => {
      const base = row.dpub.speedup;
      return {
        lang: row.lang,
        arms: [
          {key:"dpub", ratio:1, absolute:base},
          {key:"dpub_lex", ratio:row.dpub_lex.speedup/base, absolute:row.dpub_lex.speedup},
          {key:"dml", ratio:row.dml.speedup/base, absolute:row.dml.speedup},
          {key:"dml_lex", ratio:row.dml_lex.speedup/base, absolute:row.dml_lex.speedup}
        ],
        priorGain: gain(base,row.dpub_lex.speedup),
        combinedGain: gain(base,row.dml_lex.speedup),
        trainingOnly: row.dml.speedup/base,
        priorOnMultilingualGain: gain(row.dml.speedup,row.dml_lex.speedup)
      };
    });
  }
  const FOUR_ARM_MAX = 2.5; // Covers every exported condition; zero is never truncated.

  const RACE_END = 110;
  function raceSnapshot(row, elapsed) {
    const time = Math.min(RACE_END, Math.max(0, Number(elapsed) || 0));
    return {
      time,
      lanes: row.arms.map(arm => {
        const finish = 100 / arm.ratio;
        return {...arm, finish, progress:Math.min(1,time/finish), done:time+1e-8>=finish};
      })
    };
  }
  function blockSnapshot(round, phase) {
    const stage = Math.min(2,Math.max(0,Math.trunc(Number(phase)||0)));
    const makeLane = (key, actual, accepted) => {
      const picks = key==="lex" && stage===0 ? round.plain_pick : actual;
      return picks.map((id,index)=>({
        id,index,changed:key==="lex"&&stage>=1&&id!==round.plain_pick[index],
        state:stage<2?"proposed":index<accepted?"accepted":index===accepted?"rejected":"discarded"
      }));
    };
    return {stage,plain:makeLane("plain",round.plain_pick,round.accepted_plain),lex:makeLane("lex",round.lex_pick,round.accepted_lex)};
  }
  return {gain, formatGain, validateTrace, cumulative, snapshot, engineRows, gainDomain, fourArmRows, FOUR_ARM_MAX, RACE_END, raceSnapshot, blockSnapshot};
});
