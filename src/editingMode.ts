import { syntaxTree } from "@codemirror/language";
import { EditorState, Facet, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import type { HeadingIndentSettings } from "./settings";

/** Settings are supplied by this plugin, not by a globally active window/editor. */
export const headingIndentSettings = Facet.define<() => HeadingIndentSettings>({});
export const updateNeededNotificationEffect = StateEffect.define<void>();

interface DecorationSetWithIntervals {
	decorations: DecorationSet;
	/** Document positions where a heading's content indent starts. */
	intervals: [number, number][];
}

export const indentStateField = StateField.define<DecorationSetWithIntervals>({
	create: getDecorationSet,
	update(value, tr) {
		if (tr.docChanged || syntaxTree(tr.startState) !== syntaxTree(tr.state) ||
			tr.effects.some(effect => effect.is(updateNeededNotificationEffect))) {
			return getDecorationSet(tr.state);
		}
		return value;
	},
	provide: field => EditorView.decorations.from(field, value => value.decorations)
});

function getDecorationSet(state: EditorState): DecorationSetWithIntervals {
	const empty: DecorationSetWithIntervals = { decorations: Decoration.none, intervals: [] };
	// CodeMirror inputs in other plugins do not necessarily represent Markdown files.
	const info = state.field(editorInfoField, false);
	const file = info?.file;
	const settings = state.facet(headingIndentSettings)[0]?.();
	if (!file || !settings) return empty;
	const enabled = info.app.metadataCache.getFileCache(file)?.frontmatter?.["heading-indent"];
	if (["false", "0"].includes(String(enabled).toLowerCase())) return empty;

	const headings: { level: number; line: number; pos: number }[] = [];
	syntaxTree(state).iterate({
		enter(node) {
			if (node.type.name.startsWith("HyperMD-header_HyperMD-header-")) {
				headings.push({ level: Number(node.type.name.slice(-1)),
					line: state.doc.lineAt(node.from).number, pos: node.from });
			}
		}
	});
	const highestLevel = headings.reduce((level, heading) => Math.min(level, heading.level), 6);
	const builder = new RangeSetBuilder<Decoration>();
	const intervals: [number, number][] = [];
	for (const [index, heading] of headings.entries()) {
		const level = settings.treatHighestPresentHeadingAsH1
			? heading.level - highestLevel + 1 : heading.level;
		const contentIndent = indentForLevel(settings, level);
		const headingIndent = indentForLevel(settings, level - 1);
		intervals.push([heading.pos, contentIndent]);
		// A completely unindented section should keep the theme's own alignment.
		if (contentIndent === 0 && headingIndent === 0) continue;
		const lastLine = headings[index + 1]?.line - 1 || state.doc.lines;
		for (let line = heading.line; line <= lastLine; line++) {
			const indent = line === heading.line ? headingIndent : contentIndent;
			builder.add(state.doc.line(line).from, state.doc.line(line).from,
				Decoration.line({ attributes: { class: "heading-level-indent-line",
					style: indentStyle(indent) } }));
		}
	}
	return { decorations: builder.finish(), intervals };
}

function indentForLevel(settings: HeadingIndentSettings, level: number): number {
	if (level < 1 || level > 6) return 0;
	const value = Number(settings[`h${level}` as keyof HeadingIndentSettings]);
	return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Resolve percentages in the owning content box in CSS, including while resizing
 * or hidden. Never read geometry in a StateField or store a measured pixel width.
 * Affected heading sections share a content-edge baseline, including zero-offset
 * heading lines. Their auto margins would center the reduced box before shifting
 * it again. Entirely zero-indent sections and theme max-width stay untouched.
 * Cap oversized indents at half the content width to keep narrow panes usable.
 */
function indentProperties(indent: number, image = false): Record<string, string> {
	const offset = `min(${indent}px, 50%)`;
	return {
		position: "relative",
		"inset-inline-start": offset,
		[image ? "max-width" : "width"]: `calc(100% - ${offset})`,
		"box-sizing": "border-box",
		"margin-inline-start": "0px",
		"margin-inline-end": "0px"
	};
}

function indentStyle(indent: number): string {
	return Object.entries(indentProperties(indent)).map(([name, value]) =>
		`${name}:${value}${name.startsWith("margin-inline-") ? "!important" : ""};`).join("");
}

type SavedStyles = [string, string, string][];

/** Obsidian creates block widgets outside line decorations. Only visit direct
 * children of this EditorView's contentDOM, never nested or globally active CMs.
 */
export const indentEmbedsPlugin = ViewPlugin.fromClass(class {
	private originals = new Map<HTMLElement, SavedStyles>();
	private destroyed = false;

	constructor(readonly view: EditorView) {
		this.schedule();
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged || update.geometryChanged ||
			update.startState.field(indentStateField) !== update.state.field(indentStateField)) {
			this.schedule();
		}
	}

	private schedule() {
		this.view.requestMeasure<Map<HTMLElement, Record<string, string>>>({
			key: this,
			read: view => {
				const targets = new Map<HTMLElement, Record<string, string>>();
				if (this.destroyed) return targets;
				const { intervals } = view.state.field(indentStateField);
				if (!intervals.length) return targets;
				for (const child of Array.from(view.contentDOM.children)) {
					if (!child.matches("div.cm-embed-block, div.math-block, div.internal-embed, img")) continue;
					const indent = findIntervalOffset(intervals, view.posAtDOM(child));
					if (indent > 0) targets.set(child as HTMLElement, indentProperties(indent, child.tagName === "IMG"));
				}
				return targets;
			},
			write: targets => {
				if (this.destroyed) return;
				for (const [element, styles] of this.originals) {
					if (!targets.has(element)) {
						this.restore(element, styles);
						this.originals.delete(element);
					}
				}
				for (const [element, properties] of targets) {
					if (!this.originals.has(element)) {
						this.originals.set(element, Object.keys(properties).map(name =>
							[name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]));
					}
					for (const [name, value] of Object.entries(properties)) {
						const priority = name.startsWith("margin-inline-") ? "important" : "";
						if (element.style.getPropertyValue(name) !== value || element.style.getPropertyPriority(name) !== priority) {
							element.style.setProperty(name, value, priority);
						}
					}
				}
			}
		});
	}

	private restore(element: HTMLElement, styles: SavedStyles) {
		for (const [name, value, priority] of styles) element.style.setProperty(name, value, priority);
	}

	destroy() {
		this.destroyed = true;
		for (const [element, styles] of this.originals) this.restore(element, styles);
		this.originals.clear();
	}
});

/** Search each widget independently. Grouping embeds and math separately breaks
 * monotonic-position assumptions when the two kinds are interleaved. */
function findIntervalOffset(intervals: [number, number][], pos: number): number {
	let low = 0, high = intervals.length - 1, offset = 0;
	while (low <= high) {
		const mid = (low + high) >> 1;
		if (intervals[mid][0] < pos) {
			offset = intervals[mid][1];
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return offset;
}
