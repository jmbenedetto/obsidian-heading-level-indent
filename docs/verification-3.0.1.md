# Local verification of 3.0.1

## 1. Scope and build

- Fork baseline: commit `6f5eff9`, upstream plugin version 3.0.0.
- Local version: **3.0.1**, in `package.json`, `package-lock.json`, `manifest.json` and `versions.json`.
- Runtime minimum: Obsidian 1.1.1, matching the installed API definitions used for `editorInfoField`. Older app compatibility has not been tested.
- Build command: `npm run build`. Output: root `main.js`, with no separate stylesheet required.
- Local package: `artifacts/heading-level-indent-3.0.1.zip`. The archive contains `heading-level-indent/main.js` and `heading-level-indent/manifest.json`.
- Unpacked package, checksums and synthetic browser evidence: `artifacts/heading-level-indent-3.0.1/`.

The ZIP and browser evidence are local build artifacts, not GitHub release assets. Publishing a source branch or pull request does not publish a release or install the plugin into a vault.

## 2. Regression proof

Both tests were written and failed against the unmodified source before implementation. The fixture uses real CodeMirror state, views, decorations, widgets and Chromium layout. It supplies Obsidian API objects and HyperMD heading node names at the host boundary.

- **Minimal overflow.** A 938px pane contains a 906px content box. With Minimal's relevant `width:80rem`, `max-width:95%` and important auto-margin rule, the original paragraph extends to 931px inside that content box. The corrected paragraph starts at its configured 50px indent and ends at 906px. Its content scroll width equals its client width. The fixture's pane itself did not overflow in this case; the original content box did. The live-pane overflow reported by the caller was not independently remeasured here.
- **Focus-dependent shrinkage.** A note's content box is 1010px wide and its paragraph is 959.5px wide. Activating a separate 450px chat content box and sending an update changes the original paragraph width to 400px. The corrected paragraph remains 959.5px wide. The corrected fixture runs without `window.app`.

The original behavior can be reproduced without reverting files:

```sh
HLI_BASELINE=1 npm test -- --grep 'Minimal centered|focusing a 450px'
```

That command loads the original editing module from Git commit `6f5eff9` and is expected to exit with two failed assertions. The test adapter adds only the settings facet needed by the current harness; the original sizing and active-pane selector code remain unchanged. Git history must contain that commit.

## 3. Implementation

- State-field computation reads the file and metadata from that editor's `editorInfoField`. A plugin-provided settings facet replaces the global plugin lookup. Non-file-backed inputs receive no indent decorations.
- CSS resolves widths against each owning content box. No measured pixel widths, active-leaf selectors, font-size changes or overflow-hiding rules remain in editing-mode sizing.
- Affected heading sections normalize their own logical margins and share a content-edge baseline. This includes zero-offset heading lines when their section has indentation. Entirely zero-indent sections keep the theme's original alignment. Theme max-width and list padding are not overridden.
- Oversized indents are capped at half the content width, preventing negative or unusable widths in narrow panes. Logical positioning also supports RTL editors.
- Block embeds, math, internal embeds and direct images are visited only as direct children of the owning `contentDOM`. Each widget's document position is resolved independently, including when widget kinds are interleaved.
- Widget position lookup runs in CodeMirror's measurement read phase. Inline changes run in its write phase. Duplicate requests use a stable key; destruction guards pending work and restores the original inline properties and priorities. Logical margin longhands are preserved separately.
- Resize behavior comes from CSS, not a debounced resize observer or state transactions. View geometry and viewport updates schedule widget discovery. Metadata events refresh all Markdown panes for the changed file; settings refresh Markdown panes only, not unrelated chat editors.

A fresh-context reviewer reproduced RTL overflow, shorthand-margin restoration loss and all-zero theme-alignment changes in the first implementation. Added regressions cover the corrected RTL and restoration behavior and the all-zero no-op. Zero-offset heading lines in otherwise indented sections intentionally retain the shared baseline described above. Production registration and event routing were added to the host-boundary tests after review.

## 4. Checks and limits

Validation environment: macOS arm64, Node 26.11.1, npm 11.20.0, TypeScript 4.4.4, CodeMirror view 6.9.1/state 6.2.0, Playwright 1.58.2, Chromium 145.0.7632.6.

- Browser suite: **13 passed**. Coverage includes both reported failures, independent panes, inactive-note resize, hide/show, widgets and images, per-note metadata, final-heading removal, settings, extreme/invalid indents, production registration/event routing, RTL, zero indents, style restoration, default-theme widths and teardown.
- `npm run typecheck`: passed.
- `npm run lint:editing`: passed for both changed production modules.
- Browser test/config lint with browser and Node globals declared on the CLI: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Full `npm run lint`: still fails on three pre-existing `no-explicit-any` errors in untouched `src/FrontmatterListener.ts:24` and `src/renderedMode.ts:146,176`. These were not changed as part of this fix.
- `npm ci` reported five inherited dependency advisories. No unrelated dependency upgrades were attempted. Two high-severity advisories remain in the production-classified npm tree through its existing tooling dependency. The plugin bundle does not import that tooling.

The standard browser installer timed out during extraction. The same Chromium archive was downloaded and extracted with macOS `ditto` into session scratch, then selected through `HLI_CHROMIUM_EXECUTABLE`. All test browser contexts and processes were closed by the runner.

Screenshots of synthetic prose and widgets were captured and inspected. **No full Obsidian, full Minimal theme, real Claudian or disposable-vault visual verification was performed.** The private HyperMD parser and actual application widget rendering are not distributed by the API package. Reading-mode/PDF behavior was left unchanged and not revalidated. A disposable-vault application check remains advisable before a separately authorized live installation.

The user's live vault, settings, plugins and running Claudian sessions were left untouched. No private note content was read into or copied to this repository, its tests, screenshots or logs.
