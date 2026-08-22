const fs = require("fs");
const path = require("path");

const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < CRC_TABLE.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
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

function zipTimestamp() {
    return {
        time: 0,
        date: ((2026 - 1980) << 9) | (1 << 5) | 1,
    };
}

function normalizeEntryName(name) {
    const normalized = name.replace(/\\/g, "/").replace(/^\/+/, "");
    if (
        !normalized ||
        path.isAbsolute(normalized) ||
        normalized.split("/").includes("..")
    ) {
        throw new Error(`Unsafe ZIP path: ${name}`);
    }
    return normalized;
}

function createZip(zipPath, inputEntries) {
    const timestamp = zipTimestamp();
    const entries = inputEntries
        .map((entry) => ({
            name: normalizeEntryName(entry.name),
            data: Buffer.isBuffer(entry.data)
                ? entry.data
                : Buffer.from(entry.data),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
    const seen = new Set();
    const body = [];
    const centralDirectory = [];
    let offset = 0;

    for (const entry of entries) {
        if (seen.has(entry.name))
            throw new Error(`Duplicate ZIP entry: ${entry.name}`);
        seen.add(entry.name);

        const nameBuffer = Buffer.from(entry.name, "utf8");
        const metadata = {
            nameBuffer,
            crc: crc32(entry.data),
            size: entry.data.length,
            offset,
            ...timestamp,
        };
        const localHeader = Buffer.concat([
            writeUInt32(0x04034b50),
            writeUInt16(20),
            writeUInt16(0),
            writeUInt16(0),
            writeUInt16(metadata.time),
            writeUInt16(metadata.date),
            writeUInt32(metadata.crc),
            writeUInt32(metadata.size),
            writeUInt32(metadata.size),
            writeUInt16(nameBuffer.length),
            writeUInt16(0),
            nameBuffer,
        ]);
        const directoryHeader = Buffer.concat([
            writeUInt32(0x02014b50),
            writeUInt16(20),
            writeUInt16(20),
            writeUInt16(0),
            writeUInt16(0),
            writeUInt16(metadata.time),
            writeUInt16(metadata.date),
            writeUInt32(metadata.crc),
            writeUInt32(metadata.size),
            writeUInt32(metadata.size),
            writeUInt16(nameBuffer.length),
            writeUInt16(0),
            writeUInt16(0),
            writeUInt16(0),
            writeUInt16(0),
            writeUInt32(0),
            writeUInt32(metadata.offset),
            nameBuffer,
        ]);

        body.push(localHeader, entry.data);
        centralDirectory.push(directoryHeader);
        offset += localHeader.length + entry.data.length;
    }

    const directoryOffset = offset;
    const directoryBuffer = Buffer.concat(centralDirectory);
    const endRecord = Buffer.concat([
        writeUInt32(0x06054b50),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(entries.length),
        writeUInt16(entries.length),
        writeUInt32(directoryBuffer.length),
        writeUInt32(directoryOffset),
        writeUInt16(0),
    ]);

    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
    fs.writeFileSync(
        zipPath,
        Buffer.concat([...body, directoryBuffer, endRecord]),
    );
}

function listFiles(root) {
    const files = [];

    function walk(directory) {
        for (const entry of fs.readdirSync(directory, {
            withFileTypes: true,
        })) {
            const absolutePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                walk(absolutePath);
            } else if (entry.isFile()) {
                files.push({
                    absolutePath,
                    relativePath: path
                        .relative(root, absolutePath)
                        .split(path.sep)
                        .join("/"),
                });
            }
        }
    }

    walk(root);
    return files.sort((left, right) =>
        left.relativePath.localeCompare(right.relativePath),
    );
}

module.exports = { createZip, listFiles };
