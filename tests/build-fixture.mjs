import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
export const output = path.resolve(process.env.HLI_TEST_OUTPUT || ".tmp/tests");
export default async function setup() {
    await mkdir(output, { recursive: true });
    const baseline = process.env.HLI_BASELINE === "1";
    // This adapter supplies only the new settings facet to the old module. Its
    // original sizing, global selectors and frontmatter logic remain unchanged.
    const plugins = baseline ? [{ name: "original-regression-baseline", setup(builder) {
        builder.onLoad({ filter: /src\/editingMode\.ts$/ }, () => ({
            contents: execFileSync("git", ["show", "6f5eff9:src/editingMode.ts"], { encoding: "utf8" }) +
                '\nimport { Facet as TestFacet } from "@codemirror/state";\nexport const headingIndentSettings = TestFacet.define({});',
            loader: "ts", resolveDir: path.resolve("src")
        }));
    }}] : [];
    await build({ entryPoints: ["tests/fixture.mjs"], bundle: true, format: "iife", plugins,
        define: { "globalThis.__HLI_BASELINE__": String(baseline) },
        alias: { obsidian: path.resolve("tests/obsidian-host.mjs") }, outfile: path.join(output, "fixture.js") });
    await writeFile(path.join(output, "fixture.html"), `<!doctype html>
<meta charset="utf-8"><title>Heading indent regression fixture</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; display: flex; flex-wrap: wrap; gap: 16px; font: 16px/1.5 sans-serif; }
.workspace-leaf { flex: none; border: 0; background: #f4f4f4; }
.cm-editor { width: 100%; }
.cm-scroller { overflow: auto; }
.cm-content { flex: none !important; width: calc(100% - 32px); margin: 16px; padding: 0 !important; }
.cm-line { position: relative; }
/* Minimal's relevant rule, with only its redundant contentContainer ancestor
   omitted because stock CodeMirror does not insert Obsidian's wrapper. */
.markdown-source-view.mod-cm6.is-readable-line-width .cm-content > div {
    max-width: var(--max-width); width: var(--line-width);
    margin-inline: var(--content-margin) !important;
}
.markdown-source-view { --max-width: 95%; --line-width: 80rem; --content-margin: auto; }
</style><script src="fixture.js"></script>`);
}
