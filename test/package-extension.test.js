const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const staticPopupAssets = new Set(['css/popup.css', 'icons/icon32.png', 'js/popup.js']);

function findEndOfCentralDirectory(buffer) {
    for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
    }
    throw new Error('ZIP end of central directory record not found');
}

function readZipEntries(zipPath) {
    const buffer = fs.readFileSync(zipPath);
    const eocdOffset = findEndOfCentralDirectory(buffer);
    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    let offset = buffer.readUInt32LE(eocdOffset + 16);
    const entries = new Map();

    for (let index = 0; index < entryCount; index += 1) {
        assert.strictEqual(buffer.readUInt32LE(offset), 0x02014b50, 'invalid central directory entry');
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const fileNameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);
        const name = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
        entries.set(name, { compressedSize, localHeaderOffset });
        offset += 46 + fileNameLength + extraLength + commentLength;
    }

    return { buffer, entries };
}

function readStoredZipEntry(zip, name) {
    const entry = zip.entries.get(name);
    assert(entry, `missing ZIP entry: ${name}`);
    const offset = entry.localHeaderOffset;
    assert.strictEqual(zip.buffer.readUInt32LE(offset), 0x04034b50, 'invalid local file header');
    const fileNameLength = zip.buffer.readUInt16LE(offset + 26);
    const extraLength = zip.buffer.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + fileNameLength + extraLength;
    return zip.buffer.subarray(dataStart, dataStart + entry.compressedSize);
}

function requiredManifestAssets(manifest) {
    const files = new Set(staticPopupAssets);
    files.add('manifest.json');
    files.add(manifest.background.service_worker);
    files.add(manifest.action.default_popup);
    for (const file of Object.values(manifest.icons)) files.add(file);
    for (const script of manifest.content_scripts) {
        for (const file of script.js) files.add(file);
    }
    for (const group of manifest.web_accessible_resources) {
        for (const file of group.resources) files.add(file);
    }
    return files;
}

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghostify-package-'));

try {
    const result = childProcess.spawnSync(
        process.execPath,
        ['scripts/package-extension.js', '--output-dir', outputDir],
        { cwd: repoRoot, encoding: 'utf8' }
    );

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);

    const zipName = `ghostify-v${pkg.version}-chrome-web-store.zip`;
    const zipPath = path.join(outputDir, zipName);
    const shaPath = `${zipPath}.sha256`;
    assert(fs.existsSync(zipPath), 'release ZIP was not created');
    assert(fs.existsSync(shaPath), 'release checksum was not created');

    const zip = readZipEntries(zipPath);
    assert(zip.entries.has('manifest.json'), 'manifest.json must be at the ZIP root');
    assert(!zip.entries.has('dist/manifest.json'), 'ZIP must not contain a dist/ prefix');

    const manifest = JSON.parse(readStoredZipEntry(zip, 'manifest.json').toString('utf8'));
    assert.strictEqual(manifest.version, pkg.version, 'ZIP manifest version must match package.json');
    for (const file of requiredManifestAssets(manifest)) {
        assert(zip.entries.has(file), `ZIP is missing required asset: ${file}`);
    }

    const expectedSha = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
    assert.strictEqual(
        fs.readFileSync(shaPath, 'utf8').trim(),
        `${expectedSha}  ${zipName}`,
        'checksum file must match the generated ZIP'
    );

    const mismatchedTag = childProcess.spawnSync(
        process.execPath,
        ['scripts/package-extension.js', '--output-dir', outputDir, '--expected-tag', 'v0.0.0'],
        { cwd: repoRoot, encoding: 'utf8' }
    );
    assert.notStrictEqual(mismatchedTag.status, 0, 'mismatched release tag should fail');
    assert.match(
        mismatchedTag.stderr,
        new RegExp(`Release tag v0\\.0\\.0 does not match package version v${pkg.version}`),
        mismatchedTag.stderr || mismatchedTag.stdout
    );

    const rogueDist = fs.mkdtempSync(path.join(os.tmpdir(), 'ghostify-dist-'));
    fs.cpSync(path.join(repoRoot, 'dist'), rogueDist, { recursive: true });
    fs.writeFileSync(path.join(rogueDist, 'debug-capture.log'), 'local debug capture');
    const rogueResult = childProcess.spawnSync(
        process.execPath,
        ['scripts/package-extension.js', '--dist-dir', rogueDist, '--output-dir', outputDir],
        { cwd: repoRoot, encoding: 'utf8' }
    );
    fs.rmSync(rogueDist, { recursive: true, force: true });
    assert.notStrictEqual(rogueResult.status, 0, 'unexpected dist files should fail packaging');
    assert.match(
        rogueResult.stderr,
        /Unexpected dist file: debug-capture\.log/,
        rogueResult.stderr || rogueResult.stdout
    );
} finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
}

console.log('package-extension release ZIP tests passed');
