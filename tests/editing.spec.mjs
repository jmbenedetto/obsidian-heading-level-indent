import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
const output = path.resolve(process.env.HLI_TEST_OUTPUT || ".tmp/tests");
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
    const messages = [];
    errors.set(page, messages);
    page.on("pageerror", error => messages.push(error.message));
    page.on("console", message => { if (message.type() === "error") messages.push(message.text()); });
    await page.goto(pathToFileURL(path.join(output, "fixture.html")).href);
    await page.waitForFunction(() => window.fixture);
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });
async function measure(page, id) { return page.evaluate(id => window.fixture.measure(id), id); }

test("Minimal centered margins do not make indented prose overflow", async ({ page }) => {
    await page.evaluate(() => window.fixture.create("note", 938, { active: true }));
    const actual = await measure(page, "note");
    console.log("Minimal geometry", JSON.stringify(actual));
    expect(actual.paneScroll).toBeLessThanOrEqual(actual.paneWidth);
    expect(actual.contentScroll).toBeLessThanOrEqual(actual.contentWidth);
    expect(actual.lines[1].left).toBeCloseTo(50, 0);
    expect(actual.lines[1].right).toBeLessThanOrEqual(actual.contentWidth + 1);
});

test("focusing a 450px non-note editor cannot shrink an inactive note", async ({ page }) => {
    await page.evaluate(() => {
        window.fixture.create("note", 1042, { active: true });
        window.fixture.create("chat", 482, { note: false, doc: "Chat input" });
    });
    const before = await measure(page, "note");
    await page.evaluate(() => window.fixture.activate("chat"));
    const after = await measure(page, "note");
    console.log("Focus geometry", JSON.stringify({ before, after }));
    expect(after.lines[1].width).toBeGreaterThan(900);
    expect(after.lines[1].width).toBeCloseTo(before.lines[1].width, 0);
});

test("independent notes resize while a chat owns focus, including hidden editors", async ({ page }) => {
    await page.evaluate(() => {
        window.fixture.create("wide", 938);
        window.fixture.create("narrow", 680);
        window.fixture.create("chat", 482, { note: false, doc: "## Chat heading\nChat text" });
        window.fixture.activate("chat");
    });
    const unchanged = await measure(page, "narrow");
    await page.evaluate(() => window.fixture.resize("wide", 520));
    await expect.poll(async () => (await measure(page, "wide")).lines[1].width).toBeCloseTo(438, 0);
    expect((await measure(page, "narrow")).lines[1].width).toBeCloseTo(unchanged.lines[1].width, 0);
    expect((await measure(page, "chat")).lines.every(line => !line.css)).toBe(true);
    await page.evaluate(() => { window.fixture.hide("wide", true); window.fixture.resize("wide", 800); });
    await page.evaluate(() => window.fixture.hide("wide", false));
    await expect.poll(async () => (await measure(page, "wide")).lines[1].width).toBeCloseTo(718, 0);
});

test("math, block embeds, internal embeds and images use their own editor and heading", async ({ page }) => {
    await page.evaluate(() => {
        window.fixture.create("note", 938, { doc: "# First\nMATH\n## Second\nEMBED\nMATH\nINTERNAL\nIMAGE" });
        window.fixture.create("chat", 482, { note: false, doc: "Chat input", active: true });
        window.fixture.activate("chat");
    });
    await expect.poll(async () => (await measure(page, "note")).embeds.map(embed => embed.left)).toEqual([30, 50, 50, 50, 50]);
    let actual = await measure(page, "note");
    expect(actual.embeds.every(embed => embed.right <= actual.contentWidth + 1)).toBe(true);
    await page.evaluate(() => window.fixture.resize("note", 520));
    await expect.poll(async () => (await measure(page, "note")).embeds[1].width).toBeCloseTo(438, 0);
    actual = await measure(page, "note");
    expect(actual.embeds.every(embed => embed.right <= actual.contentWidth + 1)).toBe(true);
    await page.screenshot({ path: path.join(output, "widgets.png"), fullPage: true });
});

test("per-note metadata clears and restores line and widget styles without changing another note", async ({ page }) => {
    await page.evaluate(() => {
        window.fixture.create("enabled", 938, { doc: "## Heading\nText\nEMBED" });
        window.fixture.create("disabled", 680, { disabled: true });
        window.fixture.create("chat", 482, { note: false, doc: "Chat input", active: true });
    });
    await expect.poll(async () => (await measure(page, "enabled")).embeds[0].left).toBe(50);
    expect((await measure(page, "disabled")).lines.every(line => !line.css)).toBe(true);
    await page.evaluate(() => window.fixture.setDisabled("enabled", true));
    await expect.poll(async () => (await measure(page, "enabled")).embeds[0].css || "").toBe("");
    expect((await measure(page, "enabled")).lines.every(line => !line.css)).toBe(true);
    await page.evaluate(() => window.fixture.setDisabled("enabled", false));
    await expect.poll(async () => (await measure(page, "enabled")).embeds[0].left).toBe(50);
    expect((await measure(page, "disabled")).lines.every(line => !line.css)).toBe(true);
});

test("removing the final heading clears decorations and resizes widgets back to theme defaults", async ({ page }) => {
    await page.evaluate(() => window.fixture.create("note", 938, { doc: "## Heading\nText\nEMBED" }));
    await expect.poll(async () => (await measure(page, "note")).embeds[0].left).toBe(50);
    await page.evaluate(() => window.fixture.replace("note", "Plain text\nEMBED"));
    await expect.poll(async () => (await measure(page, "note")).embeds[0].css || "").toBe("");
    expect((await measure(page, "note")).lines.every(line => !line.css)).toBe(true);
});

test("settings changes, normalized heading levels and extreme indents stay responsive", async ({ page }) => {
    await page.evaluate(() => {
        window.fixture.create("note", 520);
        window.fixture.configure({ treatHighestPresentHeadingAsH1: true });
    });
    let actual = await measure(page, "note");
    expect(actual.lines[0].left).toBe(0);
    expect(actual.lines[1].left).toBe(30);
    await page.evaluate(() => window.fixture.configure({ h1: "99999" }));
    actual = await measure(page, "note");
    expect(actual.lines[1].left).toBe(244);
    expect(actual.lines[1].width).toBe(244);
    expect(actual.contentScroll).toBe(actual.contentWidth);
    await page.evaluate(() => window.fixture.configure({ h1: "not a number" }));
    expect((await measure(page, "note")).lines[1].css).toBeNull();
});

test("production registration routes metadata and settings to Markdown editors only", async ({ page }) => {
    await page.evaluate(async () => {
        await window.fixture.loadPlugin();
        window.fixture.create("note", 938, { doc: "## Heading\nText\nEMBED" });
        window.fixture.create("other", 680);
        window.fixture.create("chat", 482, { note: false, doc: "Chat input", active: true });
        window.fixture.metadataChanged("note", true);
    });
    await expect.poll(async () => (await measure(page, "note")).embeds[0].css || "").toBe("");
    expect((await measure(page, "note")).lines.every(line => !line.css)).toBe(true);
    expect((await measure(page, "other")).lines[1].left).toBe(50);
    await page.evaluate(async () => {
        window.fixture.metadataChanged("note", false);
        await window.fixture.savePluginSettings({ h2: "80" });
    });
    await expect.poll(async () => (await measure(page, "note")).embeds[0].left).toBe(80);
    expect((await measure(page, "other")).lines[1].left).toBe(80);
});

test("RTL prose and widgets indent from the right without overflow", async ({ page }) => {
    await page.evaluate(() => {
        window.fixture.create("note", 938, { doc: "## Heading\nOrdinary prose\nINTERNAL" });
        document.querySelector("#note .cm-content").style.direction = "rtl";
    });
    await expect.poll(async () => (await measure(page, "note")).embeds[0].right).toBeLessThanOrEqual(856);
    const actual = await measure(page, "note");
    expect(actual.lines[1].right).toBeCloseTo(856, 0);
    expect(actual.contentScroll).toBe(actual.contentWidth);
    expect(actual.paneScroll).toBe(actual.paneWidth);
});

test("all-zero indentation leaves the theme's original alignment intact", async ({ page }) => {
    await page.evaluate(() => {
        window.fixture.create("note", 938, { doc: "Before heading\n# Heading\nAfter heading" });
        window.fixture.configure({ h1: "0", h2: "0", h3: "0", h4: "0", h5: "0", h6: "0" });
    });
    const actual = await measure(page, "note");
    expect(actual.lines.every(line => !line.css)).toBe(true);
    expect(actual.lines[0].left).toBeCloseTo(actual.lines[2].left, 1);
});

test("widget cleanup preserves pre-existing inline values and priorities", async ({ page }) => {
    await page.evaluate(() => {
        window.widgetStyle = "position:static;width:81%;margin-inline-start:7px!important;margin-inline-end:13px;color:rgb(1, 2, 3)";
        window.fixture.create("note", 938, { doc: "## Heading\nEMBED" });
    });
    await expect.poll(async () => (await measure(page, "note")).embeds[0].left).toBe(50);
    await page.evaluate(() => window.fixture.setDisabled("note", true));
    await expect.poll(async () => page.locator("#note .cm-embed-block").evaluate(el => ({
        position: el.style.position, width: el.style.width,
        start: el.style.marginInlineStart, startPriority: el.style.getPropertyPriority("margin-inline-start"),
        end: el.style.marginInlineEnd, endPriority: el.style.getPropertyPriority("margin-inline-end"),
        color: el.style.color
    }))).toEqual({ position: "static", width: "81%", start: "7px", startPriority: "important",
        end: "13px", endPriority: "", color: "rgb(1, 2, 3)" });
});

test("default theme widths also fit and no overflow is hidden", async ({ page }) => {
    await page.evaluate(() => {
        window.fixture.create("note", 938, { active: true });
        document.querySelector(".markdown-source-view").classList.remove("is-readable-line-width");
    });
    const actual = await measure(page, "note");
    expect(actual.lines[1].width).toBe(856);
    expect(actual.contentScroll).toBe(actual.contentWidth);
    expect(await page.locator("#note .cm-scroller").evaluate(el => window.getComputedStyle(el).overflowX)).toBe("auto");
    await page.screenshot({ path: path.join(output, "prose.png"), fullPage: true });
});

test("unloading the editor extension restores widget styles and cancels pending work", async ({ page }) => {
    await page.evaluate(() => window.fixture.create("note", 938, { doc: "## Heading\nEMBED\nIMAGE" }));
    await expect.poll(async () => (await measure(page, "note")).embeds[0].left).toBe(50);
    await page.evaluate(() => window.fixture.removeIndentExtension("note"));
    expect((await measure(page, "note")).embeds.every(embed => !embed.css)).toBe(true);
    await page.evaluate(() => {
        window.fixture.create("transient", 500);
        window.fixture.resize("transient", 300);
        window.fixture.destroy("transient");
    });
});
