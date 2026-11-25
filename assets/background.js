(() => {
  "use strict";
  const {t} = window.WorldDraftI18n;
  const geo = window.WorldDraftGeography;
  const rows = window.LEXDATA.speed.speed["32"];
  const byCode = new Map(rows.map(row => [row.lang, row]));
  const langs = {
    en: "English", de: "German", fr: "French", es: "Spanish", ru: "Russian",
    zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic", th: "Thai",
    sw: "Swahili", hi: "Hindi", bn: "Bengali", te: "Telugu", am: "Amharic", sr: "Serbian"
  };
  const scripts = {hi: "Devanagari", "hi-Latn": "Latin", "sr-Cyrl": "Cyrillic", "sr-Latn": "Latin"};
  const select = document.getElementById("atlas-condition");
  const markerLayer = document.getElementById("atlas-markers");
  const labelLayer = document.getElementById("atlas-label");
  const baseCode = code => code.split("-")[0];
  const label = code => t(langs[baseCode(code)]) + (scripts[code] ? " · " + t(scripts[code]) : "");
  const variants = new Map();
  const pins = new Map();
  const svg = (tag, attrs) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
    return el;
  };

  document.getElementById("atlas-grid").setAttribute("d", geo.grid);
  document.getElementById("atlas-land").setAttribute("d", geo.land);
  document.getElementById("atlas-locations").setAttribute("d",
    geo.dots.map(([x, y]) => "M" + x + " " + y + "h.01").join(""));
  for (const row of [...rows].sort((a,b) => label(a.lang).localeCompare(label(b.lang), "en"))) {
    select.add(new Option(label(row.lang), row.lang));
    const key = baseCode(row.lang);
    if (!variants.has(key)) variants.set(key, []);
    variants.get(key).push(row.lang);
  }

  function show(code) {
    const row = byCode.get(code), key = baseCode(code);
    select.value = code;
    document.getElementById("atlas-fertility").textContent =
      t("{0} tokens per word · Qwen3-8B",geo.fertility[code].toFixed(2));
    for (const [id, method] of [["public","dpub"],["trained","dml"],["ar","ar_draft"]]) {
      const cell = document.getElementById("atlas-" + id);
      const val = row[method].speedup;
      cell.textContent = val.toFixed(2) + "×";
      cell.className = val < 1 ? "under-baseline" : val > 1 ? "above-baseline" : "";
    }
    for (const [k,pin] of pins) pin.setAttribute("aria-pressed", String(k === key));
    const [x, y] = geo.study[key];
    const text = svg("text", {x: x, y: y - 12.5, "text-anchor":"middle"});
    text.textContent = t(langs[key]);
    labelLayer.replaceChildren(text);
  }

  for (const [key, codes] of variants) {
    const [x,y] = geo.study[key];
    const slower = byCode.get(codes[0]).dpub.speedup < 1;
    const pin = svg("g", {
      transform: "translate(" + x + " " + y + ")", class: "atlas-pin " + (slower ? "slower" : "faster"),
      role: "button", tabindex: "0", "aria-label": langs[key] + (slower ? ", slower" : ", faster") + " than direct decoding",
      "data-lang": key
    });
    const tip = svg("title",{}); tip.textContent = codes.map(c => label(c) + " " + byCode.get(c).dpub.speedup.toFixed(2) + "×").join(" / ");
    pin.append(tip, svg("circle", {r: 7.8, class:"pin-hit"}),
      svg("circle", {r: 7.5, class:"pin-ring"}),
      slower ? svg("path", {d:"M0 -5.2L5.2 0L0 5.2L-5.2 0Z", class:"pin-core"}) : svg("circle", {r: 4.5, class:"pin-core"}));
    function choose() {
      const current = select.value;
      show(codes.includes(current) ? current : codes[0]);
    }
    pin.addEventListener("click", choose);
    pin.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {event.preventDefault();choose();pin.focus();}
    });
    pins.set(key,pin); markerLayer.append(pin);
  }
  select.addEventListener("change", () => show(select.value));
  document.addEventListener("worlddraft-locale",()=>{
    for(const o of select.options) o.textContent=label(o.value);
    for(const [key,pin] of pins){
      const codes=variants.get(key);
      const slow=byCode.get(codes[0]).dpub.speedup<1;
      pin.setAttribute("aria-label",t(slow?"{0}, slower than direct decoding":"{0}, faster than direct decoding",t(langs[key])));
      pin.querySelector("title").textContent=codes.map(c=>label(c)+" "+byCode.get(c).dpub.speedup.toFixed(2)+"×").join(" / ");
    }
    show(select.value);
  });
  show("te");
})();
