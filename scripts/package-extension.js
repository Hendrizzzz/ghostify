const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CRC_TABLE = new Uint32Array(256);
const STATIC_PACKAGE_ASSETS = [
    'css/popup.css',
    'icons/icon32.png',
    'js/popup.js'
];

for (let index = 0; index < CRC_TABLE.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    CRC_TABLE[index] = value >>> 0;
}

function fail(message) {
    throw new Error(message);
}

function parseArgs(argv) {
    const args = {
        distDir: 'dist',
        outputDir: '.',
        expectedTag: ''
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--dist-dir') {
            args.distDir = argv[++index];
        } else if (arg === '--output-dir') {
            args.outputDir = argv[++index];
        } else if (arg === '--expected-tag') {
            args.expectedTag = argv[++index];
        } else {
            fail(`Unknown argument: ${arg}`);
        }

        if (!argv[index]) fail(`${arg} requires a value`);
    }

    return args;
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime() {
    return {
        time: 0,
        date: ((2026 - 1980) << 9) | (1 << 5) | 1
    };
}

function writeUInt16(value) {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value);
    return buffer;
}

function writeUInt32(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value >>> 0);
    return buffer;
}

function localHeader(entry) {
    return Buffer.concat([
        writeUInt32(0x04034b50),
        writeUInt16(20),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(entry.time),
        writeUInt16(entry.date),
        writeUInt32(entry.crc),
        writeUInt32(entry.size),
        writeUInt32(entry.size),
        writeUInt16(entry.nameBuffer.length),
        writeUInt16(0),
        entry.nameBuffer
    ]);
}

function centralDirectoryHeader(entry) {
    return Buffer.concat([
        writeUInt32(0x02014b50),
        writeUInt16(20),
        writeUInt16(20),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(entry.time),
        writeUInt16(entry.date),
        writeUInt32(entry.crc),
        writeUInt32(entry.size),
        writeUInt32(entry.size),
        writeUInt16(entry.nameBuffer.length),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt32(0),
        writeUInt32(entry.offset),
        entry.nameBuffer
    ]);
}

function endOfCentralDirectory(entryCount, centralDirectorySize, centralDirectoryOffset) {
    return Buffer.concat([
        writeUInt32(0x06054b50),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(entryCount),
        writeUInt16(entryCount),
        writeUInt32(centralDirectorySize),
        writeUInt32(centralDirectoryOffset),
        writeUInt16(0)
    ]);
}

function listFiles(root) {
    const files = [];

    function walk(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const absolutePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                walk(absolutePath);
            } else if (entry.isFile()) {
                const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
                files.push({ absolutePath, relativePath });
            }
        }
    }

    walk(root);
    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function addDistFile(files, file, label) {
    if (!file || typeof file !== 'string') fail(`${label} must be a non-empty string`);
    const normalized = file.replace(/^\/+/, '').replace(/\\/g, '/');
    if (path.isAbsolute(normalized) || normalized.includes('..')) {
        fail(`Unsafe package path: ${file}`);
    }
    files.add(normalized);
}

function collectPackageFiles(manifest) {
    const files = new Set(['manifest.json']);
    for (const file of STATIC_PACKAGE_ASSETS) files.add(file);

    addDistFile(files, manifest.background?.service_worker, 'background.service_worker');
    addDistFile(files, manifest.action?.default_popup, 'action.default_popup');
    Object.entries(manifest.icons || {}).forEach(([size, file]) => addDistFile(files, file, `icons.${size}`));

    for (const [index, script] of (manifest.content_scripts || []).entries()) {
        for (const file of script.js || []) addDistFile(files, file, `content_scripts[${index}].js`);
    }

    for (const [index, group] of (manifest.web_accessible_resources || []).entries()) {
        for (const file of group.resources || []) addDistFile(files, file, `web_accessible_resources[${index}].resources`);
    }

    return [...files].sort();
}

function resolvePackageFiles(distDir, expectedFiles) {
    const actualFiles = listFiles(distDir);
    const actualSet = new Set(actualFiles.map(file => file.relativePath));
    const expectedSet = new Set(expectedFiles);
    const unexpected = actualFiles.map(file => file.relativePath).filter(file => !expectedSet.has(file));
    const missing = expectedFiles.filter(file => !actualSet.has(file));

    if (unexpected.length) fail(`Unexpected dist file: ${unexpected.join(', ')}`);
    if (missing.length) fail(`Missing dist file: ${missing.join(', ')}`);

    return expectedFiles.map(relativePath => ({
        absolutePath: path.join(distDir, relativePath),
        relativePath
    }));
}

function createZip(zipPath, packageFiles) {
    const timestamp = dosDateTime();
    const body = [];
    const centralDirectory = [];
    let offset = 0;

    for (const file of packageFiles) {
        if (path.isAbsolute(file.relativePath) || file.relativePath.includes('..')) {
            fail(`Unsafe ZIP path: ${file.relativePath}`);
        }

        const data = fs.readFileSync(file.absolutePath);
        const nameBuffer = Buffer.from(file.relativePath, 'utf8');
        const entry = {
            nameBuffer,
            crc: crc32(data),
            size: data.length,
            offset,
            time: timestamp.time,
            date: timestamp.date
        };
        const header = localHeader(entry);
        body.push(header, data);
        centralDirectory.push(centralDirectoryHeader(entry));
        offset += header.length + data.length;
    }

    const centralDirectoryOffset = offset;
    const centralDirectoryBuffer = Buffer.concat(centralDirectory);
    const eocd = endOfCentralDirectory(centralDirectory.length, centralDirectoryBuffer.length, centralDirectoryOffset);
    fs.writeFileSync(zipPath, Buffer.concat([...body, centralDirectoryBuffer, eocd]));
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const distDir = path.resolve(args.distDir);
    const outputDir = path.resolve(args.outputDir);
    if (!fs.existsSync(distDir)) fail(`Missing dist directory: ${distDir}`);

    const pkg = readJson('package.json');
    const manifest = readJson(path.join(distDir, 'manifest.json'));
    if (!pkg.version) fail('package.json must declare a version');
    if (manifest.version !== pkg.version) {
        fail(`dist/manifest.json version ${manifest.version || '<missing>'} does not match package.json ${pkg.version}`);
    }
    if (args.expectedTag && args.expectedTag !== `v${pkg.version}`) {
        fail(`Release tag ${args.expectedTag} does not match package version v${pkg.version}`);
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const zipName = `ghostify-v${pkg.version}-chrome-web-store.zip`;
    const zipPath = path.join(outputDir, zipName);
    const shaPath = `${zipPath}.sha256`;

    if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
    if (fs.existsSync(shaPath)) fs.rmSync(shaPath, { force: true });

    const packageFiles = resolvePackageFiles(distDir, collectPackageFiles(manifest));
    createZip(zipPath, packageFiles);

    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
    fs.writeFileSync(shaPath, `${sha256}  ${zipName}\n`);

    console.log(`created ${zipPath}`);
    console.log(`sha256 ${sha256}`);
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
