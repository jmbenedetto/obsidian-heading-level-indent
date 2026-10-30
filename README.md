**Indenting content under headers based on their level** is a visual technique to create a visual hierarchy that makes it easier to understand the structure and organization of your document and facilitates the application of **selective attention** on specific structure part.

Indentation for each heading's content can be customized in the plugin settings.

## Install

Download available through Community plugins in Obsidian settings

<a href="https://obsidian.md/plugins?id=heading-level-indent"><img src="https://img.shields.io/badge/dynamic/json?query=%24%5B%22heading-level-indent%22%5D.downloads&amp;url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json&amp;label=Downloads:&amp;logo=obsidian&amp;color=8c79de&amp;logoColor=8c79de" alt="GitHub Downloads (specific asset, latest release)"></a>

## Demo

![demo](https://github.com/user-attachments/assets/1efed823-a2f4-49cb-a036-fad4d7614488)

## Indentation support

| Element          | Source/Live Preview | Reading View | PDF Export |
| ---------------- | ------------------- | ------------ | ---------- |
| Code block       | ✅                  | ✅           | ✅         |
| Blockquote       | ✅                  | ✅           | ✅         |
| Callout          | ✅                  | ✅           | ✅         |
| Table            | ✅                  | ✅           | ✅         |
| LaTeX block      | ✅                  | ✅           | ✅         |
| Note block embed | ✅                  | x            | ✅         |
| PDF embed        | ✅                  | ✅           | thumb      |
| Image embed      | ✅                  | ✅           | ✅         |
| Excalidraw embed | N/A                 | ✅           | ?          |
| Canvas embed     | ✅                  | ✅           | ✅         |

## Features

### Per-document indent control

Toggle heading indentation for individual notes using the `heading-indent` frontmatter property:

- **Omit the property** or set to `true`: Indentation enabled (default)
- **Set to `false`**: Indentation disabled

```yaml
---
heading-indent: false
---
```

## 1. Local fork version 3.0.1

This fork corrects two editing-mode sizing bugs in 3.0.0:

- Heading-indented prose no longer extends beyond its content box when a theme such as Minimal centers lines with auto margins.
- Focusing another CodeMirror input, such as Claudian chat, no longer makes an inactive note use that input's width.

Line widths now use responsive CSS relative to their own editor's content box. Block widgets, math, internal embeds and images are scoped to that same editor. Settings and the `heading-indent` property apply independently to each Markdown file, including inactive editors. Inputs without a file-backed Obsidian editor are ignored.

Affected heading sections align to the editor content edge. The plugin normalizes only those elements' inline margins, preserves theme max-width and existing list padding, and does not hide horizontal overflow. Entirely zero-indent sections keep their theme alignment. Indents larger than half the content width are capped there so narrow panes remain usable. RTL editors indent from the right. Reading mode and PDF-export behavior are unchanged.

Version 3.0.1 declares Obsidian 1.1.1 or later, matching the API package that supplies `editorInfoField`. This is a local build, not a published release. Nothing is installed automatically.

## 2. Development and verification

Use Node.js 20 or later for the browser test tooling.

```sh
npm ci
npx playwright install chromium
npm test
npm run lint:editing
npm run typecheck
npm run build
```

The build produces `main.js` beside `manifest.json`. This version does not require a separate `styles.css`. To try it, copy those two files into `.obsidian/plugins/heading-level-indent/` in a **disposable test vault**, then enable the plugin there. Do not overwrite an existing live installation without backing it up and confirming the installation separately.

The tests exercise real CodeMirror and Chromium with synthetic notes and widgets. They reproduce the relevant Minimal CSS rule, not the whole Obsidian application or Claudian. Host API and private HyperMD heading nodes are supplied at the test boundary. Production plugin registration, metadata notifications and settings routing also run against that boundary.

To reproduce the two original failures without changing the working tree, run the original sizing module from commit `6f5eff9` through the same fixture. Both tests are **expected to fail**:

```sh
HLI_BASELINE=1 npm test -- --grep 'Minimal centered|focusing a 450px'
```

Test output defaults to `.tmp/tests/`. Set `HLI_TEST_OUTPUT` to choose another directory. If Chromium is managed separately, set `HLI_CHROMIUM_EXECUTABLE` to its executable path. The baseline command requires Git history containing `6f5eff9`.

`npm run lint` checks all source files. The untouched `FrontmatterListener.ts` and `renderedMode.ts` currently have three pre-existing `no-explicit-any` errors. See [the local verification record](docs/verification-3.0.1.md) for results and limits.

## Contributors

<a href="https://github.com/svonjoi/obsidian-heading-level-indent/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=svonjoi/obsidian-heading-level-indent" />
</a>
