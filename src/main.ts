import { EditorView } from "@codemirror/view";
import { MarkdownView, Plugin, TFile } from "obsidian";
import {
	indentEmbedsPlugin,
	indentStateField,
	headingIndentSettings,
	updateNeededNotificationEffect
} from "./editingMode";
import { RenderedModeIndenter } from "./renderedMode";
import { DEFAULT_SETTINGS, HeadingIndentSettings, IndentSettingTab } from "./settings";
import { initFrontmatterListener, getFrontmatterListener, cleanupFrontmatterListener } from "./FrontmatterListener";

export default class HeadingIndent extends Plugin {
	settings: HeadingIndentSettings;
	private frontmatterChangeHandler: () => void;

	// Configure resources needed by the plugin.
	async onload() {
		await this.loadSettings(); // await here and use this.settings after
		this.addSettingTab(new IndentSettingTab(this.app, this));

		// Initialize frontmatter listener FIRST (before registering extensions that use it)
		initFrontmatterListener(this.app);
		getFrontmatterListener().start();

		// Register editor extensions for editing mode
		this.registerEditorExtension([
			headingIndentSettings.of(() => this.settings), indentStateField, indentEmbedsPlugin
		]);
		// Inactive notes must also respond to their own metadata, independently of focus.
		this.registerEvent(this.app.metadataCache.on("changed", file => this.refreshEditors(file)));

		// Register post-processor for reading view and PDF export
		this.registerMarkdownPostProcessor((element) => {
			RenderedModeIndenter.applyIndent(element, this.settings);
		}, 10);

		// Define and register the frontmatter change handler
		this.frontmatterChangeHandler = () => {
			// Handle reading view and pdf export
			if (getFrontmatterListener().isIndentEnabled()) {
				RenderedModeIndenter.applyToCurrentView(this.settings);
			} else {
				RenderedModeIndenter.clearCurrentView();
			}
		};

		getFrontmatterListener().addListener(this.frontmatterChangeHandler);

		// Set up observer for viewport changes when workspace is ready
		this.app.workspace.onLayoutReady(() => {
			RenderedModeIndenter.setupGlobalObserver(this.app, () => this.settings);
		});
	}

	/**
	 * Release any resources configured by the plugin; Automatically clean up registered event listeners
	 */
	onunload() {
		// Remove frontmatter listener to prevent memory leaks
		if (this.frontmatterChangeHandler) {
			getFrontmatterListener().removeListener(this.frontmatterChangeHandler);
		}

		// Clean up frontmatter listener singleton
		cleanupFrontmatterListener();

		// Clean up rendered mode resources
		RenderedModeIndenter.cleanup();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshEditors();
	}

	private refreshEditors(file?: TFile) {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView)) return;
			if (file && leaf.view.file?.path !== file.path) return;
			// Obsidian exposes the CM view on Editor at runtime, but not in its API types.
			const editor = leaf.view.editor as typeof leaf.view.editor & { cm?: EditorView };
			editor.cm?.dispatch({ effects: updateNeededNotificationEffect.of() });
		});
	}
}
