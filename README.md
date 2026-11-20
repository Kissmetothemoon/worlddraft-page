# LexDraft interactive exhibit v3

## Preview

Open index.html offline, or serve this directory with python3 -m http.server 8000 --bind 127.0.0.1.
Main exhibit: index.html#demo. Actual proposal inspector: index.html#block-demo.
This independent session artifact does not modify the original site or prior v1/v2 artifacts. Save the ZIP before the session ends.

## What changed

The interactive exhibit is now the main page content, not a static results chart followed by the old two-lane replay.

1. Four simultaneous lanes in the author-requested order: original DFlash, original + LexDraft, multilingual-trained DFlash, multilingual-trained + LexDraft.
2. Shared normalized time slider, play/pause, reset, clickable finish times, three finish checkpoints.
3. All 18 language/script conditions and three concurrency settings can be selected.
4. Recorded block inspector with Draft / Rescore / Verify phases, actual before/after token candidates, and target-verified accepted-prefix lengths.
5. Eight recorded prefixes selectable, including ties. Prefix 7 defaults to the informative 1-versus-3 accepted-token example.
6. Static four-system summary and complete two-run trace moved to disclosures.
7. Reduced-motion preference disables both timed animations; manual controls remain operational.
8. Controls placed before the four lanes so phone users can start and scrub without scrolling past the entire exhibit.

## Evidence boundary: read before interpreting

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
- LexDraft is not forced to win: English c=1 multilingual-only finishes before multilingual + LexDraft.

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

All seven JSON exports are unchanged copies of the original site. assets/data.js and assets/block-data.js embed data for offline rendering. Study-reported 2,106 identical paired outputs and 0.13ms overhead are inherited, not remeasured. Percentages derive from existing rounded speedup exports. Paper/code links remain pending; no links or experiments fabricated.

## Test commands

node --check assets/interactive.js
node --test tests/metrics.test.cjs
node --experimental-websocket tests/browser.mjs

25 unit tests and 26 browser validation groups pass. Browser tests exercise all 54 race settings, 216 lane progress/finish values, all eight recorded prefixes, actual pointer and keyboard input, pause/reset, checkpoints, reduced motion, light/dark, 320/390/768/1024/1440 widths, contained mobile tables, HTTP/network/console health, and file:// opening.

Verification logs and screenshots are in verification/. tests/browser.mjs uses local macOS Google Chrome plus Node 20 experimental WebSocket; no npm installation. It removes its own temporary profile when done.

## Remaining limits

A scientifically faithful four-run token-by-token replay requires four matched full traces with checkpoint IDs, prompts, decoding settings, proposals/target decisions and timing. Those are not present in the supplied website exports. This version does not fill that gap with fabricated model output.
