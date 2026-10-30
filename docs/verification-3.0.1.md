# Verification of 3.0.1

## 1. Scope and results

This record covers the editor-sizing correction, the desktop-discovered per-line RTL case, and the cleanup of the three inherited lint errors. All changes belong to the existing editor-scoped indentation fix.

- Browser baseline: original editing module from commit `6f5eff9`, plugin 3.0.0.
- Desktop baseline: the original installed 3.0.0 distribution, copied read-only into a fresh synthetic vault.
- Corrected build: 3.0.1, built with `npm run build`.
- Browser suite: **17 tests**, repeated three times with **51 passes**. The direction case also passed ten repetitions after its fixture race was corrected.
- Desktop checks: **16 passed**, comprising 11 editing checks, three widget/lifecycle checks and two additional reading/event cleanup checks.
- Full source lint, test/driver lint, typecheck, production build and diff checks: **passed**.

The committed [evidence directory](evidence/3.0.1/README.md) contains before/after application screenshots, browser screenshots, sanitized measurements, regression logs and checksums. Synthetic replay notes are under `tests/fixtures/desktop/`; the application driver is under `tests/desktop/`. Vault settings, third-party plugin/theme distributions, local package ZIPs, session metadata and work logs are not committed.

No live-vault installation, merge or release was performed.

## 2. What the browser tests simulate

The fixture is a narrow Obsidian API substitute, not an Obsidian emulator.

`tests/build-fixture.mjs` bundles production TypeScript and aliases the `obsidian` import to `tests/obsidian-host.mjs`. The actual CodeMirror packages remain in the bundle. Tests exercise real state, views, transactions, decorations, widgets, viewport changes and measurement scheduling inside Chromium. Layout assertions use DOM rectangles and scroll/client widths, not canned geometry.

The supplied host boundary includes:

- A substitute `editorInfoField` with a synthetic app and owning file per editor. Non-note inputs have no file-backed metadata.
- In-memory metadata, workspace leaves and captured metadata callbacks.
- Placeholder Obsidian classes. The Plugin substitute collects editor extensions; persistence, post-processor registration and registered-event cleanup are no-ops.
- A small Lezer parser recognizing ATX heading lines and emitting HyperMD heading node names. It is not Obsidian's private Markdown parser and does not implement complete Markdown syntax.
- Hand-built math/embed/image widgets, not the application's actual renderers.
- A reduced copy of Minimal's relevant width/max-width/important auto-margin rules, not the complete theme.
- Host direction attributes supplied through CodeMirror line decorations and widget construction. The initial direction test wrote attributes directly into managed line DOM; CodeMirror could remove them during redraw. The fixture now preserves them through the proper extension mechanism and asserts their presence.

The lifecycle fixture supplies Obsidian's `activeDocument` global, synthetic preview DOM and separate workspace/metadata event emitters. It runs the real clearing/observer code and checks event-source ownership. It does not emulate the full Obsidian event implementation. The separate native checks verify selected actual integration behavior.

## 3. Reproducible automated proof

The original source failed both reported regressions:

- Under the reduced Minimal rules, a 906px content box overflowed to 931px. The corrected scroll width is 906px.
- With a separate 450px input active, an update narrowed the original note paragraph from 959.5px to 400px. The corrected paragraph remains 959.5px.

Reproduce the two expected failures without reverting files:

```sh
HLI_BASELINE=1 npm test -- --grep 'Minimal centered|focusing a 450px'
```

The adapter adds only a settings facet to the original module. Its sizing and global active-pane selectors remain unchanged. Git history must contain `6f5eff9`. The committed `baseline-expected-failures.txt` records both failures.

The 14 editing tests cover the reported failures, independent/inactive/hidden editors, resize, widgets/images, metadata, final-heading removal, settings, registration/routing, extreme/invalid/zero indents, original style restoration and teardown. The direction case tests every combination of two container directions, two line directions and the presence/absence of the reduced Minimal rules.

Three additional lifecycle tests verify settings-independent reading-view clearing, observer teardown, unrelated-style preservation, idempotence and removal of each event reference through its owning source. The event cleanup regression was first run against the inherited implementation and failed with one metadata listener left registered; `event-cleanup-before.txt` preserves that expected failure.

## 4. Real desktop verification

Tested on macOS arm64 with **Obsidian 1.14.5**, **Minimal 7.7.3** and real **Claudian 2.3.36**, plugin ID `realclaudian`.

The fresh assignment-owned vault is named `Heading Indent UI Lab 20261030` and lives under the repository's ignored `artifacts/obsidian-ui-20261030/vaults/` directory. It was created programmatically through the installed CLI and the application's version-specific create/open workflow. Every subsequent evaluation checks the exact vault path. Only synthetic notes/assets and explicitly required distribution files were copied into it, never personal notes, settings, chat history or credentials.

Claudian testing used its genuine input with an unsent synthetic draft or empty composer after restart. No model was configured and no chat message or model request was sent. The random greeting and tab strip can differ between captures; compared note/input widths and the outer window geometry match.

### 4.1. Before and after

- **Minimal overflow reproduced.** The original 680px content box had a 709px scroll width. The final build has matching 680px content and scroll widths.
- **Wrong-editor sizing reproduced.** With a 620px note box and the actual 334px Claudian input focused, settings refresh narrowed the original prose to 284px. The final build preserves its theme-constrained 545.59375px width. Focus alone did not reproduce shrinkage; refresh was the observed trigger.
- **Native per-line RTL corrected.** Obsidian assigns direction to individual lines. Relative offsets could push an Arabic line beyond its pane even when the earlier container-level RTL fixture passed. Logical flow margins fix that case. The actual Arabic note and expanded direction fixture both pass.

See the [before/after images and measurements](evidence/3.0.1/README.md). Publication review rejected pre-paint captures and recaptured both versions after native painting, with the final build restored afterward. Final screenshots were captured after the lint/cleanup changes.

### 4.2. Completed application checks

The committed application driver ran these 11 checks against the final build:

- Minimal content and pane geometry.
- Real Claudian focus plus settings refresh.
- Inactive-note resize while chat owns focus.
- Hidden-tab resize/restoration.
- Independent per-file metadata.
- Final-heading removal.
- Extreme/invalid indentation.
- All-zero alignment.
- Highest-present-heading normalization.
- Native Arabic RTL beside an LTR note.
- Default-theme geometry.

Three widget checks also passed after the cleanup changes:

- Actual math, note embed and SVG fit their own 310px split content box with no extra scroll width. Their measured math/embed start indents are 30px/50px; the SVG is 260px wide.
- Disabling the widget note restores its styles without changing the other note.
- Plugin unload restores a connected math widget's original 7px important start margin, 13px end margin, 81% width and static position, and removes line decorations. Probe styles were removed before reloading.

Two additional native checks cover the lint-related cleanup:

- Reading view applies heading/prose indentation, clears it when frontmatter disables it, reapplies it when enabled and clears it on actual plugin unload.
- Two actual plugin load/unload cycles return workspace and metadata listener counts to their pre-load baselines. Core and other-plugin listeners remain registered.

The native captured-error buffer reported no errors. Early incomplete driver runs are not passing evidence. The published driver now checks that the lab is visible, its real chat editor exists, and exactly one sufficiently wide source note is visible before changing fixtures. Widget assertions ran after native painting.

## 5. Lint fixes and implementation

- Replaced untyped event references with typed `Events`/`EventRef` pairs. Native inspection showed that `offref` removes references from the emitter it is called on. The inherited stop method incorrectly sent metadata references to the workspace emitter. Cleanup now uses the corresponding owning emitter. The regression fails before this change and passes after it.
- Replaced both `null as any` constructor calls with settings-independent static clearing. The observer's instance clearing method delegates to the same implementation. Indentation rules and unrelated style handling remain unchanged.
- No lint rules were weakened and no errors were suppressed. `npm run lint` now passes across all production files. `npm run lint:tests` checks browser fixtures, tests and desktop drivers.

Editing-mode computation uses each editor's `editorInfoField` and plugin-provided settings. CSS resolves against its own content box without active-leaf selectors or measured pixel widths. Logical margins preserve theme max-width/list padding and bound oversized indents at half the available width. Widgets use CodeMirror's read/write phases and restore saved inline properties and priorities.

## 6. Commands, tooling and limits

```sh
npm ci
npx playwright install chromium
npm test
npm run lint
npm run lint:tests
npm run typecheck
npm run build
```

For the repeated runs, use `npm test -- --repeat-each=3` and `npm test -- --grep 'per-line text' --repeat-each=10`. A task-local Chromium executable was selected through `HLI_CHROMIUM_EXECUTABLE` because the cached runtime could not launch; `HLI_TEST_OUTPUT` controls generated output. The runner closes its browser processes.

Tooling: Node 26.11.1, npm 11.20.0, TypeScript 4.4.4, CodeMirror view 6.9.1/state 6.2.0, Playwright 1.58.2 and Chromium 145.0.7632.6. The declared minimum app version is 1.1.1, but only Obsidian 1.14.5 was tested.

Reading-mode clearing/apply/unload received the focused coverage above, not exhaustive rendering validation. PDF export, mobile, older apps, exhaustive widget/Markdown compatibility, active conversations and model execution remain untested. Existing dependency advisories were not addressed through unrelated upgrades.

The tested build fingerprint and evidence hashes are committed with the proof. The user's live vault, installed plugins/settings and existing Claudian runs were left untouched. The synthetic lab and local ZIP are retained; the assignment-owned test window is closed after verification.
