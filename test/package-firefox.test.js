const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const pkg = require("../package.json");

function findEndOfCentralDirectory(buffer) {
    for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
    }
    throw new Error("ZIP end of central directory record not found");
}

function readZipEntries(zipPath) {
    const buffer = fs.readFileSync(zipPath);
    const eocdOffset = findEndOfCentralDirectory(buffer);
    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    let offset = buffer.readUInt32LE(eocdOffset + 16);
    const entries = new Map();

    for (let index = 0; index < entryCount; index += 1) {
        assert.strictEqual(
            buffer.readUInt32LE(offset),
            0x02014b50,
            "invalid central directory entry",
        );
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const fileNameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);
        const name = buffer.toString(
            "utf8",
            offset + 46,
            offset + 46 + fileNameLength,
        );
        entries.set(name, { compressedSize, localHeaderOffset });
        offset += 46 + fileNameLength + extraLength + commentLength;
    }

    return { buffer, entries };
}

function readStoredZipEntry(zip, name) {
    const entry = zip.entries.get(name);
    assert(entry, `missing ZIP entry: ${name}`);
    const offset = entry.localHeaderOffset;
    assert.strictEqual(
        zip.buffer.readUInt32LE(offset),
        0x04034b50,
        "invalid local file header",
    );
    const fileNameLength = zip.buffer.readUInt16LE(offset + 26);
    const extraLength = zip.buffer.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + fileNameLength + extraLength;
    return zip.buffer.subarray(dataStart, dataStart + entry.compressedSize);
}

function assertChecksum(zipPath) {
    const expectedHash = crypto
        .createHash("sha256")
        .update(fs.readFileSync(zipPath))
        .digest("hex");
    assert.strictEqual(
        fs.readFileSync(`${zipPath}.sha256`, "utf8").trim(),
        `${expectedHash}  ${path.basename(zipPath)}`,
        `checksum must match ${path.basename(zipPath)}`,
    );
}

const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ghostify-firefox-package-"),
);

try {
    const result = childProcess.spawnSync(
        process.execPath,
        ["scripts/package-firefox.js", "--output-dir", outputDir],
        { cwd: repoRoot, encoding: "utf8" },
    );
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);

    const extensionPath = path.join(
        outputDir,
        `ghostify-v${pkg.version}-firefox-add-ons.zip`,
    );
    const sourcePath = path.join(
        outputDir,
        `ghostify-v${pkg.version}-firefox-add-ons-source.zip`,
    );
    assert(fs.existsSync(extensionPath), "Firefox upload ZIP was not created");
    assert(
        fs.existsSync(sourcePath),
        "Firefox reviewer source ZIP was not created",
    );
    assertChecksum(extensionPath);
    assertChecksum(sourcePath);

    const extensionZip = readZipEntries(extensionPath);
    const manifest = JSON.parse(
        readStoredZipEntry(extensionZip, "manifest.json").toString("utf8"),
    );
    assert.strictEqual(manifest.version, pkg.version);
    assert.deepStrictEqual(manifest.background, { scripts: ["background.js"] });
    assert.strictEqual(
        manifest.browser_specific_settings.gecko.id,
        "ghostify@ghostify-extension.vercel.app",
    );
    assert.strictEqual(
        manifest.browser_specific_settings.gecko.strict_min_version,
        "140.0",
    );
    assert.strictEqual(
        manifest.browser_specific_settings.gecko_android.strict_min_version,
        "142.0",
    );
    assert.deepStrictEqual(
        manifest.browser_specific_settings.gecko.data_collection_permissions,
        { required: ["none"] },
    );
    assert.deepStrictEqual(manifest.icons, {
        16: "icons/icon16.png",
        128: "icons/icon128.png",
    });
    assert(
        manifest.host_permissions.includes(
            "https://ghostify-extension.vercel.app/*",
        ),
    );
    assert(extensionZip.entries.has("background.js"));
    assert(extensionZip.entries.has("js/ghost.js"));
    assert(extensionZip.entries.has("js/messenger_patch.js"));
    assert(extensionZip.entries.has("js/popup.js"));
    assert(!extensionZip.entries.has("icons/icon48.png"));
    assert(!extensionZip.entries.has("dist/manifest.json"));

    const packagedPopup = readStoredZipEntry(
        extensionZip,
        "js/popup.js",
    ).toString("utf8");
    assert(!packagedPopup.includes("isFirefoxPackage"));
    assert(packagedPopup.includes("new XMLHttpRequest()"));
    assert(packagedPopup.includes("request.withCredentials = false"));
    assert(!packagedPopup.includes("fetch(PUBLIC_STATUS_FEED_URL"));
    const packagedPopupHtml = readStoredZipEntry(
        extensionZip,
        "popup.html",
    ).toString("utf8");
    assert(!packagedPopupHtml.includes("chromewebstore.google.com"));
    assert(!packagedPopupHtml.includes("Rate Ghostify"));
    assert(packagedPopupHtml.includes("Help &amp; feedback"));

    const sourceZip = readZipEntries(sourcePath);
    const requiredSourceFiles = [
        "FIREFOX_REVIEW_BUILD.md",
        "browser-targets/firefox/manifest.overlay.json",
        "build.js",
        "package-lock.json",
        "scripts/package-firefox.js",
        "scripts/prepare-firefox-extension.js",
        "src/background.js",
    ];
    for (const file of requiredSourceFiles) {
        assert(
            sourceZip.entries.has(file),
            `Firefox reviewer source ZIP is missing ${file}`,
        );
    }
    const submissionPacket = readStoredZipEntry(
        sourceZip,
        "docs/FIREFOX_AMO_SUBMISSION.md",
    ).toString("utf8");
    assert(
        submissionPacket.includes("Firefox desktop and Firefox for Android"),
    );
    assert(
        !/Firefox desktop only|Select desktop only|do not claim Android support/i.test(
            submissionPacket,
        ),
    );
    const releaseChecklist = readStoredZipEntry(
        sourceZip,
        "docs/FIREFOX_RELEASE_CHECKLIST.md",
    ).toString("utf8");
    assert(
        releaseChecklist.includes(
            "Firefox for Android minimum version: `142.0`",
        ),
    );
    assert(
        !/desktop-only AMO submission|Select desktop only/i.test(
            releaseChecklist,
        ),
    );
    assert(!sourceZip.entries.has("node_modules/esbuild/bin/esbuild"));

    const mismatchedTag = childProcess.spawnSync(
        process.execPath,
        [
            "scripts/package-firefox.js",
            "--output-dir",
            outputDir,
            "--expected-tag",
            "v0.0.0",
        ],
        { cwd: repoRoot, encoding: "utf8" },
    );
    assert.notStrictEqual(
        mismatchedTag.status,
        0,
        "mismatched Firefox release tag should fail",
    );
    assert.match(
        mismatchedTag.stderr,
        new RegExp(
            `Release tag v0\\.0\\.0 does not match package version v${pkg.version}`,
        ),
        mismatchedTag.stderr || mismatchedTag.stdout,
    );
} finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
}

console.log("Firefox Add-ons package and reviewer source ZIP tests passed");
