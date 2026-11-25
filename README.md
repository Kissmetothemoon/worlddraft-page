<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/brand/worlddraft-dark.svg">
  <img src="assets/brand/worlddraft.svg" alt="WorldDraft" width="340">
</picture>

[Paper details](https://kissmetothemoon.github.io/worlddraft-page/#paper) · [Project page](https://kissmetothemoon.github.io/worlddraft-page/) · [Interactive demo](https://kissmetothemoon.github.io/worlddraft-page/#block-demo) · [Source code](https://github.com/Kissmetothemoon/WorldDraft)

Compare measured throughput across 18 language and script conditions and inspect eight recorded draft blocks. Open `index.html` directly or serve this directory with a static HTTP server.

### Four-lane exhibit

This is an equal-work illustration driven by measured aggregate throughput. It is NOT a four-run trace, request latency measurement, live model call, or token-level timing capture.

- ratio = system throughput / original DFlash throughput at the same concurrency.
- original DFlash completes an abstract equal workload at normalized time 100.
- each system finishes at 100 / ratio.
- progress = min(1, elapsed / finish).
- all settings share the same 0..110 time axis, including slight regressions.
- The small tiles are abstract work subdivisions, not tokens.
- Default Telugu c=1 combined finish is 41.2: the four progress levels are 41.2%, 61.8%, 85.5%, 100%.
- Throughput and individual-request latency are not equated, especially under concurrency.
- WorldDraft is not forced to win: English c=1 multilingual-only finishes before multilingual + WorldDraft.

### Actual block inspector

data/trace_te.json is copied unchanged from the existing original site. Eight records contain plain_pick, lex_pick, accepted_plain, accepted_lex, positions and committed output at a shared prefix.

The inspector uses real picks and recorded acceptance counts. It does not stitch these local alternatives into four complete generation trajectories. It does not infer the exact trained/public checkpoint because the export lacks that metadata. Each recorded prefix remains a local drafter-vs-prior comparison, not a four-model result.

- Draft phase: both rows show the neural proposals.
- Rescore phase: the second row shows actual lex_pick; outlines mark changed proposals, not verified successes.
- Verify phase: indices below accepted_* are accepted; the next is first mismatch; the rest are discarded (not necessarily independently wrong).
- Accepted counts exclude the target correction/bonus token.
- Prefix 7 records accepted_plain=1, accepted_lex=3.
- Selecting a cell reveals the actual before/after token piece, with byte fragments explicitly labelled.
- The old data/seqs.json is still a separate two-run 512-token trace, unchanged.

### Other evidence

All seven JSON exports are unchanged copies of the original site. assets/data.js and assets/block-data.js embed data for offline rendering. Study-reported 2,106 identical paired outputs and 0.13ms overhead are inherited, not remeasured. Percentages derive from existing rounded speedup exports. The source code is linked from the project page.

## Test commands

node --check assets/interactive.js
node --test tests/metrics.test.cjs
node --experimental-websocket tests/browser.mjs

The unit and browser tests exercise the language map and word-fragmentation example as well as all 54 race settings, 216 lane progress/finish values, all eight recorded prefixes, actual pointer and keyboard input, pause/reset, checkpoints, reduced motion, light/dark, 320/390/768/1024/1440 widths, contained mobile tables, HTTP/network/console health, and file:// opening.

Verification logs and screenshots are in verification/. tests/browser.mjs uses Chrome or Edge (set CHROME_BIN) plus Node 20 experimental WebSocket; no npm installation. It removes its own temporary profile when done.


## Map and token sources

The [language map](https://kissmetothemoon.github.io/worlddraft-page/#background) uses *Glottolog 5.4* by Harald Hammarström, Robert Forkel, Martin Haspelmath and Sebastian Bank (2026), Max Planck Institute for Evolutionary Anthropology, Leipzig. The [Glottolog 5.4 CLDF release](https://doi.org/10.5281/zenodo.24101243) is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The map selects the 7,685 entries with `category-Spoken_L1_Language` in `values.csv` and joins their IDs to `languages.csv`. Of these, 7,683 have coordinates. A dot marks a single catalogue reference location. The catalogue includes historical languages. Land is adapted from [Natural Earth 1:110m](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/) (public domain). The bundled file `assets/atlas-geography.js` contains both layers projected to Equal Earth and rounded to one decimal in map units.

The world view includes all 7,685 entries in its search, including the two without coordinates. An entry can belong to several Glottolog macroareas. Catalogue-to-benchmark links count a standard variety against its spoken-L1 parent when Glottolog treats it as a dialect. Mandarin and Standard Arabic provide the reference locations for Chinese and Arabic. Under this mapping, 7,669 catalogue entries have no corresponding speed run in this project.

The tokenizer view uses the [FLORES-200 devtest survey](data/survey_summary.json). It retains all 204 language–script records (196 ISO codes), including records without a corresponding map location. An exact ISO match with catalogue coordinates places 198 records on the map. Script variants sharing an ISO code share a marker and remain individually selectable. The histogram and English comparison use the Qwen tokens per word measured on these parallel texts.

In the decoding view, Hindi and Serbian each have two script conditions at a shared location. Speedups come from concurrency 32 in [speed.json](data/speed.json) and use direct target decoding as the baseline. Mean Qwen tokens per word on study prompts come from [languages.json](data/languages.json). The two spellings of Janet and their token boundaries come from the first word of the paired MGSM prompts in [tok_examples.json](data/tok_examples.json).

To regenerate the static atlas, run `python scripts/build_atlas.py --languages languages.csv --values values.csv --land ne_110m_land.geojson` with the Glottolog 5.4 CLDF files and Natural Earth land GeoJSON. The build uses Python’s standard library. The published page needs no map or geocoding service.

## License

The original website code is MIT-licensed. Third-party assets and data retain their respective licenses and terms.
