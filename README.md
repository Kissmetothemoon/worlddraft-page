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

25 unit tests and 26 browser validation groups pass. Browser tests exercise all 54 race settings, 216 lane progress/finish values, all eight recorded prefixes, actual pointer and keyboard input, pause/reset, checkpoints, reduced motion, light/dark, 320/390/768/1024/1440 widths, contained mobile tables, HTTP/network/console health, and file:// opening.

Verification logs and screenshots are in verification/. tests/browser.mjs uses Chrome or Edge (set CHROME_BIN) plus Node 20 experimental WebSocket; no npm installation. It removes its own temporary profile when done.


## License

The original website code is MIT-licensed. Third-party assets and data retain their respective licenses and terms.
