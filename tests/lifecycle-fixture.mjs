import { FrontmatterListener } from "../src/FrontmatterListener.ts";
import { RenderedModeIndenter } from "../src/renderedMode.ts";

const settings = { h1: "30", h2: "50", h3: "70", h4: "90", h5: "110", h6: "130",
    treatHighestPresentHeadingAsH1: false };

window.lifecycleFixture = {
    createPreviews() {
        // Obsidian supplies this global for the active application document.
        window.activeDocument = document;
        const workspace = document.createElement("section");
        workspace.className = "workspace";
        for (const id of ["preview-one", "preview-two"]) {
            const root = document.createElement("div");
            root.id = id;
            root.className = "markdown-preview-view";
            root.innerHTML = '<div class="markdown-preview-section">' +
                '<div class="el-h2 keep-class"><h2>Synthetic heading</h2></div>' +
                '<div class="el-p keep-class" style="color:rgb(1, 2, 3)"><p>Synthetic prose</p></div>' +
                '<div class="unrelated" style="padding-left:12px">Unrelated styles</div></div>';
            workspace.appendChild(root);
        }
        document.body.appendChild(workspace);
        RenderedModeIndenter.applyToCurrentView(settings);
    },
    clearPreviews() { RenderedModeIndenter.clearCurrentView(); },
    startObservers() { RenderedModeIndenter.setupGlobalObserver({}, () => settings); },
    cleanup() { RenderedModeIndenter.cleanup(); },
    eventReferenceCleanup() {
        const registered = [], removed = [];
        const emitter = () => {
            const live = new Set();
            return {
                on(name, callback) {
                    const reference = { name, callback };
                    registered.push(reference);
                    live.add(reference);
                    return reference;
                },
                offref(ref) { if (live.delete(ref)) removed.push(ref); },
                count() { return live.size; }
            };
        };
        const workspace = emitter(), metadataCache = emitter();
        const file = { path: "synthetic.md" };
        const listener = new FrontmatterListener({
            workspace: { ...workspace, getActiveFile: () => file },
            metadataCache: { ...metadataCache, getFileCache: () => ({ frontmatter: {} }) }
        });
        listener.start();
        listener.stop();
        listener.stop();
        return { names: registered.map(ref => ref.name),
            removed: removed.map(ref => registered.indexOf(ref)),
            remaining: { workspace: workspace.count(), metadata: metadataCache.count() } };
    }
};
