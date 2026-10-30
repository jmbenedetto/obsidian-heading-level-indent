# Desktop replay for the recorded lab

These CLI helpers replay the 11 editing checks used for the committed application evidence. They require a real, visible Obsidian desktop window and do not run as part of `npm test`. Browser tests do not replace them.

## 1. Safety and setup

Use only a newly created synthetic vault for a new verification assignment. Never use a personal vault or an ongoing chat session. These capture-specific scripts deliberately require this exact name and repository-relative path:

- Name: `Heading Indent UI Lab 20261030`.
- Path: `artifacts/obsidian-ui-20261030/vaults/Heading Indent UI Lab 20261030` under the current repository.

For a different fresh assignment, change both constants in `ui-driver.mjs` before creating the vault. The helpers do not create/register vaults, install third-party code or select a bootstrap vault. Create/open the fresh vault through the installed app/CLI workflow first. Every evaluation verifies its absolute path; screenshots also check identity before capture.

From the repository root, after the fresh vault has been created and registered:

```sh
npm ci
npm run build
LAB='Heading Indent UI Lab 20261030'
LAB_DIR="$PWD/artifacts/obsidian-ui-20261030/vaults/$LAB"
ACTUAL_PATH="$(obsidian "vault=$LAB" vault info=path)"
test "$ACTUAL_PATH" = "$LAB_DIR" || exit 1
cp tests/fixtures/desktop/* "$LAB_DIR/"
mkdir -p "$LAB_DIR/.obsidian/plugins/heading-level-indent"
cp main.js manifest.json "$LAB_DIR/.obsidian/plugins/heading-level-indent/"
```

In that vault only:

- Enable community plugins and the local Heading Level Indent build.
- Install/select Minimal and install real Claudian. The recorded versions are Minimal 7.7.3 and Claudian 2.3.36, plugin ID `realclaudian`, in Obsidian 1.14.5.
- Do not configure credentials/model access or send a message. An empty composer or unsent synthetic draft is sufficient.
- Open `UI Regression.md` in Live Preview. Keep exactly one visible Markdown pane initially; close extra synthetic splits. Hidden tabs are fine.
- Use a sufficiently wide window, recorded as 1024 by 800 CSS pixels. Collapse the file sidebar and open Claudian in the right sidebar. The note content must initially be at least 500px wide.
- Bring the lab window forward and click Claudian's Message input. This initializes its real CodeMirror input; merely opening the view can leave it uninitialized.

## 2. Run the editing checks

```sh
node tests/desktop/ui-driver.mjs init
node tests/desktop/checks.mjs
```

The driver verifies readiness before changing notes/settings. It exercises Minimal geometry, real chat focus/refresh, resize, hide/show, independent frontmatter, heading removal, invalid/extreme/zero settings, normalization, native Arabic RTL and the default theme. It modifies only the path-checked lab, including temporary synthetic note edits and settings. It writes JSON evidence under the ignored `artifacts/obsidian-ui-20261030/evidence/` directory and exits nonzero if a check fails.

The code uses version-specific application internals exposed through CLI `eval`; it is a captured-lab replay helper, not a supported cross-version Obsidian automation API. Do not silently change selectors or skip assertions to accommodate an unready window.

## 3. Additional widget and cleanup checks

These five checks were performed separately with native UI painting between setup and assertions. Their assertions/results are recorded in the committed evidence JSON; they are not included in the 11-check driver count.

- Open `Widget Regression.md` in a vertical split beside the source note. With chat focused, confirm actual math, SVG and note embed use their own pane, their configured heading indents and no extra horizontal scroll width.
- Toggle that note's `heading-indent` property off. Its line/widget styles must clear without changing the other source note; re-enable it afterward.
- In the isolated lab, test widget-style restoration by unloading the plugin, assigning a math widget a 7px important logical start margin, 13px end margin, 81% width and static position, then loading/unloading again. The same connected element must recover those values and priority. Remove the probe styles and reload afterward.
- Switch the main note to reading view. Its H2/prose indent must apply, clear when its property is disabled, reapply when enabled and clear on actual plugin unload. Restore the original synthetic note and plugin state.
- Compare native workspace/metadata event-reference counts before load and after unload over two cycles. The inherited metadata leak left a reference on the wrong emitter; the corrected implementation returns both counts to their baselines, preserving other listeners.

The browser lifecycle tests provide portable automated coverage for clearing, observer teardown and event ownership. The desktop checks provide the separate actual-application observations.

## 4. Capture and finish

With matching dimensions, source text and theme, capture the original build before replacing it with the corrected build. Do not label browser-fixture images as application screenshots.

```sh
node tests/desktop/ui-driver.mjs measure final-state
node tests/desktop/ui-driver.mjs screenshot final-state
obsidian "vault=$LAB" dev:errors
```

Inspect captures for private content before committing. Do not commit the vault's `.obsidian` directory, credentials, third-party distributions or chat history. Retain synthetic data/evidence as needed and close only the assignment-owned window. Never quit all Obsidian windows or interrupt unrelated work.
