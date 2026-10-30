import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const output = path.resolve(process.env.HLI_TEST_OUTPUT || ".tmp/tests");
test.beforeEach(async ({ page }) => {
    await page.goto(pathToFileURL(path.join(output, "fixture.html")).href);
    await page.waitForFunction(() => window.lifecycleFixture && window.fixture);
});

test("reading-view clearing needs no settings and preserves unrelated styles in every preview", async ({ page }) => {
    await page.evaluate(() => window.lifecycleFixture.createPreviews());
    for (const id of ["preview-one", "preview-two"]) {
        await expect(page.locator(`#${id} .el-h2`)).toHaveCSS("padding-left", "30px");
        await expect(page.locator(`#${id} .el-p`)).toHaveCSS("padding-left", "50px");
    }
    await page.evaluate(() => {
        window.lifecycleFixture.clearPreviews();
        window.lifecycleFixture.clearPreviews();
    });
    for (const id of ["preview-one", "preview-two"]) {
        await expect(page.locator(`#${id} .el-p`)).toHaveCSS("padding-left", "0px");
        await expect(page.locator(`#${id} .el-p`)).toHaveCSS("color", "rgb(1, 2, 3)");
        await expect(page.locator(`#${id} .unrelated`)).toHaveCSS("padding-left", "12px");
        expect(await page.locator(`#${id} [class*="el-"]`).evaluateAll(elements =>
            elements.every(el => el.classList.contains("keep-class") &&
                ![...el.classList].some(name => /^(heading_|data_)/.test(name))))).toBe(true);
    }
});

test("rendered-mode cleanup clears existing styles and disconnects section and global observers", async ({ page }) => {
    await page.evaluate(() => {
        window.lifecycleFixture.createPreviews();
        window.lifecycleFixture.startObservers();
        window.lifecycleFixture.cleanup();
        window.lifecycleFixture.cleanup();
        const section = document.querySelector("#preview-one .markdown-preview-section");
        section.insertAdjacentHTML("beforeend", '<div class="el-p added"><p>After cleanup</p></div>');
        const third = document.querySelector("#preview-two").cloneNode(true);
        third.id = "preview-three";
        document.querySelector(".workspace").appendChild(third);
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.locator('.markdown-preview-view [class*="el-"]').evaluateAll(elements =>
        elements.every(el => el.style.paddingLeft === "" &&
            ![...el.classList].some(name => /^(heading_|data_)/.test(name))))).toBe(true);
    await expect(page.locator("#preview-one .added")).toHaveCSS("padding-left", "0px");
});

test("frontmatter listener removes each reference from its owning event source only once", async ({ page }) => {
    expect(await page.evaluate(() => window.lifecycleFixture.eventReferenceCleanup())).toEqual({
        names: ["active-leaf-change", "changed"], removed: [0, 1],
        remaining: { workspace: 0, metadata: 0 }
    });
});
