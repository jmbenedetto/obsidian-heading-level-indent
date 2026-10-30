import { defineConfig } from "@playwright/test";
import path from "node:path";
const output = path.resolve(process.env.HLI_TEST_OUTPUT || ".tmp/tests");
export default defineConfig({
    testDir: "tests",
    testMatch: "*.spec.mjs",
    globalSetup: "./tests/build-fixture.mjs",
    outputDir: path.join(output, "results"),
    workers: 1,
    use: { browserName: "chromium", channel: "chromium",
        launchOptions: process.env.HLI_CHROMIUM_EXECUTABLE ? { executablePath: process.env.HLI_CHROMIUM_EXECUTABLE } : {},
        viewport: { width: 1900, height: 1000 } }
});
