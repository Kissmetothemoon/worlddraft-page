(() => {
  "use strict";
  const selector = document.getElementById("site-locale");
  const supported = new Set(Array.from(selector.options, o => o.value));
  const bindings = [];
  const dictionaries = window.WorldDraftMessages = Object.create(null);
  const loading = new Map();
  let locale = "en", generation = 0, languageNames, scriptNames;
  const canonical = text => text.trim().replace(/\s+/g, " ");
  function t(source, ...args) {
    if (typeof source !== "string") return source;
    const pattern = dictionaries[locale]?.[source] ?? source;
    return args.length ? pattern.replace(/\{(\d+)\}/g, (_, n) => String(args[n])) : pattern;
  }
  function name(code, fallback, kind = "language") {
    if (locale === "en") return fallback;
    if (locale === "hi-Latn") return dictionaries[locale]?.[kind+"."+code] || fallback;
    try { return (kind === "script" ? scriptNames : languageNames).of(code) || fallback; }
    catch { return fallback; }
  }
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement || node.parentElement.closest("script,style,noscript,pre,code,.name-note,.research-byline,.authors,.word-pieces,.word-native,#site-locale")) continue;
    const source = node.data;
    if (/[a-z]/i.test(source)) bindings.push({node,source,key:canonical(source)});
  }
  for (const node of document.querySelectorAll("[aria-label],[placeholder],meta[name=description]")) {
    for (const attr of ["aria-label","placeholder","content"]) {
      if (node.hasAttribute(attr)) bindings.push({node,attr,source:node.getAttribute(attr),key:node.getAttribute(attr)});
    }
  }
  const note = document.querySelector(".name-note");
  const noteHTML = note.innerHTML;
  const intro = document.querySelector(".atlas-intro p");
  const introHTML = intro.innerHTML;
  const paperTitle=document.getElementById("paper-title");
  const originalPaperTitle=paperTitle.innerHTML;
  function apply(code) {
    locale = code;
    document.documentElement.lang = code;
    const direction = selector.querySelector(`option[value="${code}"]`).dir;
    document.documentElement.dir = direction === "rtl" ? "rtl" : "ltr";
    languageNames = new Intl.DisplayNames([code], {type:"language",fallback:"none"});
    scriptNames = new Intl.DisplayNames([code], {type:"script",fallback:"none"});
    for (const {node,attr,source,key} of bindings) {
      if (!node.isConnected) continue;
      const translated=t(key);
      if (attr) node.setAttribute(attr,translated);
      else node.data=translated===key ? source : source.replace(/\S[\s\S]*\S|\S/,()=>translated);
    }
    // Only trusted, checked-in translations of this fixed paragraph contain inline emphasis.
    note.innerHTML=dictionaries[locale]?.["brand.note"] || noteHTML;
    intro.innerHTML=dictionaries[locale]?.["atlas.intro"] || introHTML;
    if (code==="en") paperTitle.innerHTML=originalPaperTitle;
    else paperTitle.textContent=t("What Slows Parallel Diffusion Drafters Across Languages?");
    selector.value=code;
    document.dispatchEvent(new CustomEvent("worlddraft-locale",{detail:code}));
  }
  function load(code) {
    if (code==="en" || dictionaries[code]) return Promise.resolve();
    if (!loading.has(code)) {
      const script=document.createElement("script");
      script.src="assets/locales/"+code+".js";
      loading.set(code,new Promise((resolve,reject)=>{
        script.onload=()=>dictionaries[code] ? resolve() : reject(new Error("Missing locale"));
        script.onerror=reject;
      }).catch(error=>{loading.delete(code);script.remove();throw error;}));
      document.head.append(script);
    }
    return loading.get(code);
  }
  async function choose(code, save) {
    if (!supported.has(code)) code="en";
    const current=++generation;
    const status=document.getElementById("locale-status");
    try {
      await load(code);
      if(current!==generation) return;
      status.textContent="";
      apply(code);
      if (save) {
        try {localStorage.setItem("worlddraft-locale",code);} catch {}
        if(location.protocol!=="file:"){
          const u=new URL(location.href);u.searchParams.set("lang",code);history.replaceState(null,"",u);
        }
      }
    } catch {
      if(current!==generation) return;
      selector.value=locale;
      status.textContent=t("Language could not be loaded. Please try again.");
    }
  }
  window.WorldDraftI18n={t,name,get locale(){return locale;}};
  selector.addEventListener("change",()=>choose(selector.value,true));
  document.addEventListener("DOMContentLoaded",()=>{
    let saved;
    try {saved=localStorage.getItem("worlddraft-locale");} catch {}
    const code=new URLSearchParams(location.search).get("lang")||saved||"en";
    if(supported.has(code)&&code!=="en") choose(code,false);
  });
})();
