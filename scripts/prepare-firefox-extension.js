const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const defaultOutputDir = path.join(repoRoot, "tmp", "firefox-extension");
const staticPackageAssets = [
    "css/popup.css",
    "icons/icon32.png",
    "js/popup.js",
];
const chromiumRatingLinkPattern =
    /\s*<a class="footer-link rate-link" href="https:\/\/chromewebstore\.google\.com\/[^>]+>Rate Ghostify<\/a>/;

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function addPackageFile(files, file, label) {
    if (!file || typeof file !== "string")
        throw new Error(`${label} must be a non-empty string`);
    const normalized = file.replace(/^\/+/, "").replace(/\\/g, "/");
    if (path.isAbsolute(normalized) || normalized.split("/").includes("..")) {
        throw new Error(`Unsafe package path: ${file}`);
    }
    files.add(normalized);
}

function collectManifestFiles(manifest) {
    const files = new Set(["manifest.json", ...staticPackageAssets]);

    for (const [index, script] of (
        manifest.background?.scripts || []
    ).entries()) {
        addPackageFile(files, script, `background.scripts[${index}]`);
    }
    addPackageFile(
        files,
        manifest.action?.default_popup,
        "action.default_popup",
    );
    Object.entries(manifest.icons || {}).forEach(([size, file]) =>
        addPackageFile(files, file, `icons.${size}`),
    );
    for (const [index, script] of (manifest.content_scripts || []).entries()) {
        for (const file of script.js || [])
            addPackageFile(files, file, `content_scripts[${index}].js`);
    }
    for (const [index, group] of (
        manifest.web_accessible_resources || []
    ).entries()) {
        for (const file of group.resources || []) {
            addPackageFile(
                files,
                file,
                `web_accessible_resources[${index}].resources`,
            );
        }
    }

    return [...files].sort();
}

function createFirefoxManifest() {
    const chromiumManifest = readJson(
        path.join(repoRoot, "dist", "manifest.json"),
    );
    const overlay = readJson(
        path.join(
            repoRoot,
            "browser-targets",
            "firefox",
            "manifest.overlay.json",
        ),
    );
    const statusHost = "https://ghostify-extension.vercel.app/*";

    if (chromiumManifest.background?.service_worker !== "background.js") {
        throw new Error(
            "Chromium manifest background service worker contract changed",
        );
    }
    if (!chromiumManifest.host_permissions?.includes(statusHost)) {
        throw new Error(
            "Chromium manifest status host permission contract changed",
        );
    }
    if (!overlay.host_permissions.includes(statusHost)) {
        throw new Error(
            "Firefox manifest must retain the public status-feed host",
        );
    }
    if (
        JSON.stringify(overlay.host_permissions) !==
        JSON.stringify(chromiumManifest.host_permissions)
    ) {
        throw new Error(
            "Firefox and Chromium host permissions must stay aligned",
        );
    }

    return {
        ...chromiumManifest,
        ...overlay,
    };
}

function prepareFirefoxExtension(outputDir = defaultOutputDir) {
    const resolvedOutput = path.resolve(outputDir);
    const resolvedTmp = path.resolve(repoRoot, "tmp");
    if (
        resolvedOutput !== resolvedTmp &&
        !resolvedOutput.startsWith(`${resolvedTmp}${path.sep}`)
    ) {
        throw new Error(
            `Firefox staging directory must stay inside ${resolvedTmp}`,
        );
    }

    fs.rmSync(resolvedOutput, { recursive: true, force: true });
    fs.mkdirSync(resolvedOutput, { recursive: true });

    const manifest = createFirefoxManifest();
    const packageFiles = collectManifestFiles(manifest);
    for (const relativePath of packageFiles) {
        if (relativePath === "manifest.json") continue;
        const source = path.join(repoRoot, "dist", relativePath);
        const destination = path.join(resolvedOutput, relativePath);
        if (!fs.existsSync(source))
            throw new Error(`Missing Firefox package asset: ${source}`);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(source, destination);
    }
    fs.writeFileSync(
        path.join(resolvedOutput, "manifest.json"),
        `${JSON.stringify(manifest, null, 4)}\n`,
    );

    const popupPath = path.join(resolvedOutput, "popup.html");
    const popupHtml = fs.readFileSync(popupPath, "utf8");
    if (!chromiumRatingLinkPattern.test(popupHtml)) {
        throw new Error(
            "Chromium rating link contract changed; review the Firefox popup transformation",
        );
    }
    const firefoxPopupHtml = popupHtml.replace(chromiumRatingLinkPattern, "");
    if (
        firefoxPopupHtml.includes("chromewebstore.google.com") ||
        firefoxPopupHtml.includes("Rate Ghostify")
    ) {
        throw new Error(
            "Firefox popup must not link to a Chromium store rating page",
        );
    }
    fs.writeFileSync(popupPath, firefoxPopupHtml);

    return { manifest, outputDir: resolvedOutput, packageFiles };
}

function parseArgs(argv) {
    let outputDir = defaultOutputDir;
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] !== "--output-dir")
            throw new Error(`Unknown argument: ${argv[index]}`);
        outputDir = argv[++index];
        if (!outputDir) throw new Error("--output-dir requires a value");
    }
    return { outputDir };
}

if (require.main === module) {
    try {
        const { outputDir } = parseArgs(process.argv.slice(2));
        const result = prepareFirefoxExtension(outputDir);
        console.log(`prepared ${result.outputDir}`);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

module.exports = {
    collectManifestFiles,
    createFirefoxManifest,
    prepareFirefoxExtension,
};
