import "./lifecycle-fixture.mjs";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { Language, defineLanguageFacet } from "@codemirror/language";
import { NodeType, Parser, Tree } from "@lezer/common";
import { editorInfoField, MarkdownView } from "./obsidian-host.mjs";
import HeadingIndent from "../src/main.ts";
import { initFrontmatterListener, getFrontmatterListener } from "../src/FrontmatterListener.ts";
import { indentStateField, indentEmbedsPlugin, headingIndentSettings,
    updateNeededNotificationEffect } from "../src/editingMode.ts";

// Obsidian's private HyperMD parser is not distributed with its API package.
// Supply its heading node names at that host boundary; use real CM state, views,
// decorations, widgets, transactions, layout and measurement scheduling below.
class HeadingParser extends Parser {
    createParse(input) {
        const text = input.read(0, input.length);
        return { parsedPos: input.length, stopAt() {}, advance() {
            const children = [], positions = [];
            for (const match of text.matchAll(/^#{1,6} .+$/gm)) {
                const level = match[0].indexOf(" ");
                children.push(new Tree(NodeType.define({ id: level,
                    name: `HyperMD-header_HyperMD-header-${level}` }), [], [], match[0].length));
                positions.push(match.index);
            }
            return new Tree(NodeType.define({ id: 0, name: "Document", top: true }),
                children, positions, input.length);
        }};
    }
}
const language = new Language(defineLanguageFacet(), new HeadingParser());
const settings = { h1: "30", h2: "50", h3: "70", h4: "90", h5: "110", h6: "130",
    treatHighestPresentHeadingAsH1: false };
const leaves = new Map();
const metadataHandlers = [];
const app = {
    workspace: {
        getActiveFile: () => ({ path: "synthetic.md" }),
        iterateAllLeaves(callback) { leaves.forEach(callback); },
        on() { return {}; }, offref() {}, onLayoutReady() {}
    },
    metadataCache: {
        getFileCache: file => ({ frontmatter: file.frontmatter || {} }),
        on(name, callback) { if (name === "changed") metadataHandlers.push(callback); return {}; }
    }
};
// Only the original module needs this global. The corrected module runs without it.
if (globalThis.__HLI_BASELINE__) window.app = { ...app, plugins: { plugins: { "heading-level-indent": { settings } } } };
initFrontmatterListener(app);
getFrontmatterListener().update();

class Embed extends WidgetType {
    constructor(kind, direction) { super(); this.kind = kind; this.direction = direction; }
    eq(other) { return other.kind === this.kind && other.direction === this.direction; }
    toDOM() {
        const element = document.createElement(this.kind === "IMAGE" ? "img" : "div");
        element.className = { EMBED: "cm-embed-block", MATH: "math-block",
            INTERNAL: "internal-embed", IMAGE: "fixture-image" }[this.kind];
        if (this.kind === "IMAGE") {
            element.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="80"><rect width="1600" height="80" fill="steelblue"/></svg>';
        } else {
            element.textContent = `${this.kind} synthetic widget`;
        }
        if (this.direction) element.dir = this.direction;
        element.style.cssText = window.widgetStyle || "";
        return element;
    }
}
const widgets = StateField.define({
    create: state => widgetDecorations(state),
    update: (_, transaction) => widgetDecorations(transaction.state),
    provide: field => EditorView.decorations.from(field)
});
function widgetDecorations(state) {
    const ranges = [];
    for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i);
        if (/^(EMBED|MATH|INTERNAL|IMAGE)$/.test(line.text)) {
            const direction = state.field(editorInfoField, false)?.file?.lineDirection;
            ranges.push(Decoration.replace({ widget: new Embed(line.text, direction), block: true }).range(line.from, line.to));
        }
    }
    return Decoration.set(ranges);
}
// Model Obsidian's host-owned per-line dir attributes through decorations.
// Direct DOM writes race with CodeMirror redrawing its own line elements.
function directionDecorations(state) {
    const direction = state.field(editorInfoField, false)?.file?.lineDirection;
    if (!direction) return Decoration.none;
    const ranges = [];
    for (let line = 1; line <= state.doc.lines; line++) {
        ranges.push(Decoration.line({ attributes: { dir: direction } }).range(state.doc.line(line).from));
    }
    return Decoration.set(ranges);
}
const lineDirections = StateField.define({
    create: directionDecorations,
    update: (_, transaction) => directionDecorations(transaction.state),
    provide: field => EditorView.decorations.from(field)
});
const views = new Map();
let plugin;
window.fixture = {
    async loadPlugin() {
        plugin = new HeadingIndent(app);
        await plugin.onload();
    },
    async savePluginSettings(values) {
        Object.assign(plugin.settings, values);
        await plugin.saveSettings();
    },
    metadataChanged(id, disabled) {
        const file = views.get(id).state.field(editorInfoField).file;
        file.frontmatter["heading-indent"] = !disabled;
        metadataHandlers.forEach(handler => handler(file));
    },
    create(id, width, { doc = "## Heading\n" + "Ordinary prose wraps within its note pane. ".repeat(60),
        note = true, disabled = false, active = false, lineDirection } = {}) {
        const leaf = document.createElement("section");
        leaf.id = id;
        leaf.className = `workspace-leaf ${active ? "mod-active" : ""}`;
        leaf.style.width = `${width}px`;
        const parent = leaf.appendChild(document.createElement("div"));
        parent.className = "markdown-source-view mod-cm6 is-readable-line-width";
        document.body.appendChild(leaf);
        const file = { path: `${id}.md`, frontmatter: disabled ? { "heading-indent": false } : {}, lineDirection };
        const extensions = [language, widgets, lineDirections, EditorView.lineWrapping,
            plugin ? plugin.editorExtensions : [indentStateField, indentEmbedsPlugin, headingIndentSettings.of(() => settings)]];
        if (note) extensions.unshift(editorInfoField.init(() => ({ app, file })));
        const view = new EditorView({ state: EditorState.create({ doc, extensions }), parent });
        views.set(id, view);
        const markdownView = note ? new MarkdownView() : {};
        markdownView.file = file;
        markdownView.editor = { cm: note ? view : { dispatch() { throw new Error("Must not dispatch to a chat editor"); } } };
        leaves.set(id, { view: markdownView });
        view.dispatch({ effects: updateNeededNotificationEffect.of() });
        return id;
    },
    activate(id) {
        document.querySelectorAll(".workspace-leaf").forEach(el => el.classList.toggle("mod-active", el.id === id));
        views.get(id).focus();
        // Same settings/resize notification that used to recalculate from the wrong active pane.
        for (const view of views.values()) view.dispatch({ effects: updateNeededNotificationEffect.of() });
    },
    resize(id, width) { document.getElementById(id).style.width = `${width}px`; },
    hide(id, hidden) { document.getElementById(id).style.display = hidden ? "none" : ""; },
    setDisabled(id, disabled) {
        const view = views.get(id);
        view.state.field(editorInfoField).file.frontmatter["heading-indent"] = !disabled;
        view.dispatch({ effects: updateNeededNotificationEffect.of() });
    },
    removeIndentExtension(id) {
        const view = views.get(id);
        view.dispatch({ effects: StateEffect.reconfigure.of([language, widgets, EditorView.lineWrapping]) });
    },
    replace(id, doc) {
        const view = views.get(id);
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
    },
    configure(values) {
        Object.assign(settings, values);
        for (const view of views.values()) view.dispatch({ effects: updateNeededNotificationEffect.of() });
    },
    measure(id) {
        const view = views.get(id), content = view.contentDOM;
        const rect = element => {
            const r = element.getBoundingClientRect(), c = content.getBoundingClientRect();
            return { left: r.left - c.left, right: r.right - c.left, width: r.width,
                css: element.getAttribute("style"), className: element.className };
        };
        return { contentWidth: content.clientWidth, contentScroll: content.scrollWidth,
            paneWidth: view.scrollDOM.clientWidth, paneScroll: view.scrollDOM.scrollWidth,
            lines: [...content.querySelectorAll(":scope > .cm-line")].map(rect),
            embeds: [...content.children].filter(el => !el.classList.contains("cm-line")).map(rect) };
    },
    destroy(id) { views.get(id).destroy(); views.delete(id); document.getElementById(id).remove(); }
};
