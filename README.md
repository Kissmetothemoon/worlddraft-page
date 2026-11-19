# LexDraft — project page

Static project page for *What Slows Parallel Diffusion Drafters Across Languages?*.

Open `index.html` directly, or serve it:

    python3 -m http.server 8000

No build step. `assets/data.js` is generated from `data/*.json` by `../tools/bundle_data.py`.

Everything on the page is measured, not drawn by hand:

- `data/word_te.json` — teacher-forced candidate lists from the multilingual DFlash
  drafter and the Telugu count table, for the words shown in §01 and §04.
- `data/seqs.json` / `data/pieces.json` — per-round acceptance counts and the
  committed 512-token sequence from the paper's `sd_lex.py`, with and without the prior.
- `data/survey_summary.json` — tokens per word for 204 FLORES languages with the
  Qwen3-8B tokenizer (`data/flores_raw.json` holds the raw measurement).
- `data/speed.json`, `data/table_main.json`, `data/quality.json` — parsed from the
  paper's tables; `speed.json` is cross-checked against `LexDraft/results/engine_speedup.csv`.
- `assets/figs/` — figures rendered from the paper's PDFs.
