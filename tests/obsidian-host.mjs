// Test boundary for Obsidian's ownership, metadata, workspace and plugin APIs.
// This does not simulate CodeMirror or browser layout.
import { StateField } from "@codemirror/state";
export const editorInfoField = StateField.define({ create: () => null, update: value => value });
export class TFile {}
export class MarkdownView {}
export class PluginSettingTab {}
export class Setting {}
export class Plugin {
    constructor(app) { this.app = app; this.editorExtensions = []; }
    async loadData() { return undefined; }
    async saveData() {}
    addSettingTab() {}
    registerEditorExtension(extension) { this.editorExtensions.push(extension); }
    registerMarkdownPostProcessor() {}
    registerEvent() {}
}
