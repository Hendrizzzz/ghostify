const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { createZip, listFiles } = require("./lib/deterministic-zip");
const { prepareFirefoxExtension } = require("./prepare-firefox-extension");

const repoRoot = path.resolve(__dirname, "..");
const sourcePackagePaths = [
    "ARCHITECTURE.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "FIREFOX_REVIEW_BUILD.md",
    "LICENSE",
    "PRIVACY.md",
    "README.md",
    "RELEASE_CHECKLIST.md",
    "browser-targets",
    "build.js",
    "dist",
    "docs",
    "package-lock.json",
    "package.json",
    "scripts",
    "src",
    "test",
];

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseArgs(argv) {
    const args = { outputDir: repoRoot, expectedTag: "" };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--output-dir") {
            args.outputDir = argv[++index];
        } else if (arg === "--expected-tag") {
            args.expectedTag = argv[++index];
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
        if (!argv[index]) throw new Error(`${arg} requires a value`);
    }
    return args;
}

function entriesFromDirectory(root) {
    return listFiles(root).map((file) => ({
        name: file.relativePath,
        data: fs.readFileSync(file.absolutePath),
    }));
}

function sourceEntries() {
    const entries = [];
    for (const relativePath of sourcePackagePaths) {
        const absolutePath = path.join(repoRoot, relativePath);
        if (!fs.existsSync(absolutePath))
            throw new Error(
                `Missing Firefox reviewer source path: ${relativePath}`,
            );
        const stat = fs.statSync(absolutePath);
        if (stat.isDirectory()) {
            for (const file of listFiles(absolutePath)) {
                entries.push({
                    name: `${relativePath}/${file.relativePath}`.replace(
                        /\\/g,
                        "/",
                    ),
                    data: fs.readFileSync(file.absolutePath),
                });
            }
        } else {
            entries.push({
                name: relativePath.replace(/\\/g, "/"),
                data: fs.readFileSync(absolutePath),
            });
        }
    }
    return entries;
}

function writeChecksum(zipPath) {
    const hash = crypto
        .createHash("sha256")
        .update(fs.readFileSync(zipPath))
        .digest("hex");
    const checksumPath = `${zipPath}.sha256`;
    fs.writeFileSync(checksumPath, `${hash}  ${path.basename(zipPath)}\n`);
    return hash;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const pkg = readJson(path.join(repoRoot, "package.json"));
    if (args.expectedTag && args.expectedTag !== `v${pkg.version}`) {
        throw new Error(
            `Release tag ${args.expectedTag} does not match package version v${pkg.version}`,
        );
    }

    const tmpRoot = path.join(repoRoot, "tmp");
    fs.mkdirSync(tmpRoot, { recursive: true });
    const stagingRoot = fs.mkdtempSync(path.join(tmpRoot, "firefox-package-"));
    try {
        const prepared = prepareFirefoxExtension(
            path.join(stagingRoot, "extension"),
        );
        if (prepared.manifest.version !== pkg.version) {
            throw new Error(
                `Firefox manifest version ${prepared.manifest.version} does not match package.json ${pkg.version}`,
            );
        }

        const outputDir = path.resolve(args.outputDir);
        fs.mkdirSync(outputDir, { recursive: true });
        const extensionName = `ghostify-v${pkg.version}-firefox-add-ons.zip`;
        const sourceName = `ghostify-v${pkg.version}-firefox-add-ons-source.zip`;
        const extensionPath = path.join(outputDir, extensionName);
        const sourcePath = path.join(outputDir, sourceName);

        createZip(extensionPath, entriesFromDirectory(prepared.outputDir));
        createZip(sourcePath, sourceEntries());
        const extensionHash = writeChecksum(extensionPath);
        const sourceHash = writeChecksum(sourcePath);

        console.log(`created ${extensionPath}`);
        console.log(`sha256 ${extensionHash}`);
        console.log(`created ${sourcePath}`);
        console.log(`sha256 ${sourceHash}`);
    } finally {
        fs.rmSync(stagingRoot, { recursive: true, force: true });
    }
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
