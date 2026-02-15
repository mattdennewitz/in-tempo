---
status: complete
phase: 07-seeded-prng
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md]
started: 2026-02-15T22:00:00Z
updated: 2026-02-15T22:10:00Z
round: 2
previous_round: "Round 1: 6/8 passed, 2 issues (seed display). Gap closure 07-03 applied."
---

## Current Test

[testing complete]

## Tests

### 1. Seed visible in UI during performance
expected: Start a performance. A numeric seed value appears in the SeedDisplay area (not "Random", not blank, not zero).
result: pass

### 2. Manual seed entry displays correctly
expected: Type a seed number (e.g., 12345) into the seed input field. Start the performance. The displayed seed shows "12345" (the number you entered), not "Random".
result: pass

### 3. Deterministic replay with same seed
expected: Start a performance. Note the seed. Stop. Enter that same seed. Start again with same mode/BPM/count. The note sequence is identical.
result: pass

### 4. Copy seed to clipboard
expected: Click the Copy button next to the seed. Paste somewhere — the seed number is in your clipboard.
result: pass

### 5. Share URL contains seed
expected: After starting a performance, click Share. Paste the URL — it contains a hash fragment with seed, mode, bpm, and count parameters.
result: pass

### 6. Shared URL auto-configures
expected: Copy a shared URL. Open it in a new tab. The mode, BPM, performer count, and seed are pre-configured. Click Play — same performance.
result: pass

### 7. Reset clears seed
expected: After a performance, click Reset. The seed display shows "Random" or similar. Starting a new performance generates a fresh seed different from the previous one.
result: pass

### 8. Seed input disabled while playing
expected: While a performance is playing, the seed input field is disabled/not editable.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
