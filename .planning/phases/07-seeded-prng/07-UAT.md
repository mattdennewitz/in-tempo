---
status: complete
phase: 07-seeded-prng
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md]
started: 2026-02-15T20:30:00Z
updated: 2026-02-15T20:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Deterministic replay with same seed
expected: Start a performance. Note the seed. Stop. Enter that same seed. Start again with same mode/BPM/count. The note sequence is identical.
result: pass

### 2. Seed visible in UI during performance
expected: Start a performance. A numeric seed value appears in the UI (not zero, not blank).
result: issue
reported: "user-entered seed is not visible during performance. app says 'Random'. confirm app is using seed and shows."
severity: major

### 3. Copy seed to clipboard
expected: Click the Copy button next to the seed. Paste somewhere — the seed number is in your clipboard.
result: pass

### 4. Manual seed entry
expected: Type a seed number into the seed input field before starting. Start performance. The displayed seed matches what you entered.
result: issue
reported: "fail - shows 'random', not the seed i entered"
severity: major

### 5. Share URL to clipboard
expected: After starting a performance, click Share. Paste the URL — it contains a hash fragment with seed, mode, bpm, and count parameters.
result: pass

### 6. Shared URL auto-configures
expected: Copy a shared URL. Open it in a new tab. The mode, BPM, performer count, and seed are pre-configured in the UI. Click Play — same performance as the original.
result: pass

### 7. Reset clears seed
expected: After a performance, click Reset. The seed display clears (shows "random" or similar). Starting a new performance generates a fresh seed different from the previous one.
result: pass

### 8. Seed input disabled while playing
expected: While a performance is playing, the seed input field is disabled/not editable.
result: pass

## Summary

total: 8
passed: 6
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Seed value is visible in the UI during performance"
  status: failed
  reason: "User reported: user-entered seed is not visible during performance. app says 'Random'. confirm app is using seed and shows."
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Displayed seed matches the manually entered seed after starting"
  status: failed
  reason: "User reported: fail - shows 'random', not the seed i entered"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
