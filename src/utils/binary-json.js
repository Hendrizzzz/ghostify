const MAX_STRUCTURED_BINARY_JSON_BYTES = 1024 * 1024;
const FACEBOOK_TASK_FRAME_PREFIXES = [
    "{}\r\u0000",
    "\u000fg\u0000\u0002\u0000\u0000{}\rg\u0000\u0000",
];

export function sanitizeWholeJsonArrayBinary(value, sanitizer) {
    try {
        const input = getSupportedBytes(value);
        const source = input?.bytes;
        if (
            !source ||
            source.byteLength === 0 ||
            source.byteLength > MAX_STRUCTURED_BINARY_JSON_BYTES
        ) {
            return unchanged(value);
        }

        const first = firstNonWhitespaceByte(source);
        if (first !== 0x5b && first !== 0x7b) return unchanged(value);

        const decoder = new TextDecoder("utf-8", { fatal: true });
        const encoder = new TextEncoder();
        const text = decoder.decode(source);
        const roundTrip = encoder.encode(text);
        if (!bytesEqual(source, roundTrip)) return unchanged(value);

        const sanitized = sanitizeJsonTaskBatchStringSource(text, sanitizer);
        if (
            !sanitized.changed ||
            sanitized.blockedAll ||
            typeof sanitized.value !== "string"
        ) {
            return unchanged(value, sanitized.blockedAll);
        }

        return changedBinary(input, encoder.encode(sanitized.value));
    } catch (e) {
        return unchanged(value);
    }
}

export function sanitizeJsonTaskBatchStringSource(value, sanitizer) {
    try {
        const source = String(value || "");
        const leadingLength = source.length - source.trimStart().length;
        const trailingLength = source.length - source.trimEnd().length;
        const containerEnd = source.length - trailingLength;
        const containerSource = source.slice(leadingLength, containerEnd);
        if (
            !containerSource ||
            (containerSource[0] !== "[" && containerSource[0] !== "{")
        ) {
            return unchanged(value);
        }

        const sanitized = sanitizeJsonContainerSource(
            containerSource,
            sanitizer,
            0,
        );
        if (!sanitized?.changed) return unchanged(value, sanitized?.blockedAll);
        if (sanitized.blockedAll)
            return { value: undefined, changed: true, blockedAll: true };

        return {
            value: `${source.slice(0, leadingLength)}${sanitized.source}${source.slice(containerEnd)}`,
            changed: true,
            blockedAll: false,
        };
    } catch (e) {
        return unchanged(value);
    }
}

function sanitizeJsonContainerSource(source, sanitizer, depth) {
    if (depth > 8) return null;
    const parsed = JSON.parse(source);
    const sanitized = sanitizer(parsed, 0);
    if (!sanitized?.changed)
        return { source, changed: false, blockedAll: false };
    if (sanitized.blockedAll) {
        return { source: undefined, changed: true, blockedAll: true };
    }
    const nextSource = rewriteJsonValueSource(
        source,
        parsed,
        sanitized.value,
        depth + 1,
    );
    if (typeof nextSource !== "string") return null;
    return { source: nextSource, changed: true, blockedAll: false };
}

function rewriteJsonValueSource(source, original, sanitized, depth) {
    if (depth > 10) return null;
    if (jsonValuesEqual(original, sanitized)) return source;

    if (Array.isArray(original) && Array.isArray(sanitized)) {
        const rawItems = splitJsonArrayElements(source);
        if (!rawItems || rawItems.length !== original.length) return null;
        const rewritten = [];
        let originalIndex = 0;

        for (const nextItem of sanitized) {
            let matchingIndex = -1;
            for (
                let index = originalIndex;
                index < original.length;
                index += 1
            ) {
                if (jsonValuesEqual(original[index], nextItem)) {
                    matchingIndex = index;
                    break;
                }
            }

            if (matchingIndex >= 0) {
                rewritten.push(rawItems[matchingIndex]);
                originalIndex = matchingIndex + 1;
                continue;
            }

            if (originalIndex >= original.length) {
                rewritten.push(JSON.stringify(nextItem));
                continue;
            }

            const rewrittenItem = rewriteJsonValueSource(
                rawItems[originalIndex],
                original[originalIndex],
                nextItem,
                depth + 1,
            );
            if (typeof rewrittenItem !== "string") return null;
            rewritten.push(rewrittenItem);
            originalIndex += 1;
        }

        return `[${rewritten.join(",")}]`;
    }

    if (isPlainJsonObject(original) && isPlainJsonObject(sanitized)) {
        const properties = splitJsonObjectProperties(source);
        if (!properties) return null;
        const originalKeys = new Set(
            properties.map((property) => property.key),
        );
        if (originalKeys.size !== properties.length) return null;
        if (Object.keys(sanitized).some((key) => !originalKeys.has(key)))
            return null;

        const rewritten = [];
        for (const property of properties) {
            if (!Object.prototype.hasOwnProperty.call(sanitized, property.key))
                continue;
            const rewrittenValue = rewriteJsonValueSource(
                property.valueSource,
                original[property.key],
                sanitized[property.key],
                depth + 1,
            );
            if (typeof rewrittenValue !== "string") return null;
            rewritten.push(`${property.keySource}:${rewrittenValue}`);
        }
        return `{${rewritten.join(",")}}`;
    }

    const replacement = JSON.stringify(sanitized);
    return typeof replacement === "string" ? replacement : null;
}

function splitJsonObjectProperties(source) {
    let index = skipWhitespace(source, 0);
    if (source[index] !== "{") return null;
    index += 1;
    const properties = [];

    while (index < source.length) {
        index = skipWhitespace(source, index);
        if (source[index] === "}") return properties;
        if (source[index] !== '"') return null;

        const keyStart = index;
        const keyEnd = scanJsonStringEnd(source, keyStart);
        if (keyEnd < 0) return null;
        const keySource = source.slice(keyStart, keyEnd);
        const key = JSON.parse(keySource);
        index = skipWhitespace(source, keyEnd);
        if (source[index] !== ":") return null;
        index = skipWhitespace(source, index + 1);

        const valueStart = index;
        const valueEnd = scanJsonValueEnd(source, valueStart);
        if (valueEnd < 0) return null;
        properties.push({
            key,
            keySource,
            valueSource: source.slice(valueStart, valueEnd),
        });

        index = skipWhitespace(source, valueEnd);
        if (source[index] === ",") {
            index += 1;
            continue;
        }
        if (source[index] === "}") return properties;
        return null;
    }
    return null;
}

function isPlainJsonObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function jsonValuesEqual(left, right) {
    if (left === right) return true;
    try {
        return JSON.stringify(left) === JSON.stringify(right);
    } catch (e) {
        return false;
    }
}

export function sanitizeFramedJsonTaskBatchBinary(value, sanitizer) {
    try {
        const input = getSupportedBytes(value);
        const source = input?.bytes;
        if (
            !source ||
            source.byteLength === 0 ||
            source.byteLength > MAX_STRUCTURED_BINARY_JSON_BYTES
        ) {
            return unchanged(value);
        }

        const decoder = new TextDecoder("utf-8", { fatal: true });
        const encoder = new TextEncoder();
        const text = decoder.decode(source);
        if (!bytesEqual(source, encoder.encode(text))) return unchanged(value);

        const framed = findFramedTaskEnvelopeSource(text);
        if (!framed) return unchanged(value);

        const retainedTasks = [];
        let changed = false;
        for (const rawTask of framed.rawTasks) {
            const task = JSON.parse(rawTask);
            const sanitized = sanitizer([task], 1);
            if (!sanitized?.changed) {
                retainedTasks.push(rawTask);
                continue;
            }

            changed = true;
            if (sanitized.blockedAll) {
                if (
                    !Array.isArray(sanitized.value) ||
                    sanitized.value.length !== 0
                ) {
                    return unchanged(value);
                }
                continue;
            }

            if (
                !Array.isArray(sanitized.value) ||
                sanitized.value.length !== 1
            ) {
                return unchanged(value);
            }

            const rewrittenTask = rewriteJsonValueSource(
                rawTask,
                task,
                sanitized.value[0],
                0,
            );
            if (typeof rewrittenTask !== "string") return unchanged(value);
            retainedTasks.push(rewrittenTask);
        }
        if (!changed || retainedTasks.length === 0)
            return unchanged(value, changed);

        const nextTasksSource = `[${retainedTasks.join(",")}]`;
        const nextInnerSource = replaceSpan(
            framed.innerSource,
            framed.tasksSpan,
            nextTasksSource,
        );
        const nextOuterSource = replaceSpan(
            framed.outerSource,
            framed.payloadSpan,
            JSON.stringify(nextInnerSource),
        );
        const encoded = encoder.encode(
            `${framed.prefix}${nextOuterSource}${framed.trailingWhitespace}`,
        );
        return changedBinary(input, encoded);
    } catch (e) {
        return unchanged(value);
    }
}

function findFramedTaskEnvelopeSource(text) {
    for (const prefix of FACEBOOK_TASK_FRAME_PREFIXES) {
        if (!text.startsWith(prefix)) continue;

        const candidate = text.slice(prefix.length);
        const outerSource = candidate.trimEnd();
        const trailingWhitespace = candidate.slice(outerSource.length);
        JSON.parse(outerSource);

        const payloadSpan = findTopLevelPropertyValueSpan(
            outerSource,
            "payload",
        );
        if (!payloadSpan || outerSource[payloadSpan.start] !== '"') continue;
        const rawPayloadToken = outerSource.slice(
            payloadSpan.start,
            payloadSpan.end,
        );
        const innerSource = JSON.parse(rawPayloadToken);
        if (typeof innerSource !== "string") continue;
        if (rawPayloadToken !== JSON.stringify(innerSource)) continue;
        JSON.parse(innerSource);

        const tasksSpan = findTopLevelPropertyValueSpan(innerSource, "tasks");
        if (!tasksSpan || innerSource[tasksSpan.start] !== "[") continue;
        const rawTasks = splitJsonArrayElements(
            innerSource.slice(tasksSpan.start, tasksSpan.end),
        );
        if (!rawTasks || rawTasks.length === 0) continue;

        return {
            prefix,
            outerSource,
            trailingWhitespace,
            payloadSpan,
            innerSource,
            tasksSpan,
            rawTasks,
        };
    }
    return null;
}

function findTopLevelPropertyValueSpan(source, propertyName) {
    let index = skipWhitespace(source, 0);
    if (source[index] !== "{") return null;
    index += 1;
    let match = null;

    while (index < source.length) {
        index = skipWhitespace(source, index);
        if (source[index] === "}") return match;
        if (source[index] !== '"') return null;

        const keyEnd = scanJsonStringEnd(source, index);
        if (keyEnd < 0) return null;
        const key = JSON.parse(source.slice(index, keyEnd));
        index = skipWhitespace(source, keyEnd);
        if (source[index] !== ":") return null;
        index = skipWhitespace(source, index + 1);

        const valueStart = index;
        const valueEnd = scanJsonValueEnd(source, valueStart);
        if (valueEnd < 0) return null;
        if (key === propertyName) {
            if (match) return null;
            match = { start: valueStart, end: valueEnd };
        }

        index = skipWhitespace(source, valueEnd);
        if (source[index] === ",") {
            index += 1;
            continue;
        }
        if (source[index] === "}") return match;
        return null;
    }
    return null;
}

function splitJsonArrayElements(source) {
    let index = skipWhitespace(source, 0);
    if (source[index] !== "[") return null;
    index += 1;
    const items = [];

    while (index < source.length) {
        index = skipWhitespace(source, index);
        if (source[index] === "]") return items;
        const start = index;
        const end = scanJsonValueEnd(source, start);
        if (end < 0) return null;
        items.push(source.slice(start, end));
        index = skipWhitespace(source, end);
        if (source[index] === ",") {
            index += 1;
            continue;
        }
        if (source[index] === "]") return items;
        return null;
    }
    return null;
}

function scanJsonValueEnd(source, start) {
    const first = source[start];
    if (first === '"') return scanJsonStringEnd(source, start);
    if (first === "{" || first === "[") {
        const stack = [first];
        let inString = false;
        let escaped = false;
        for (let index = start + 1; index < source.length; index += 1) {
            const char = source[index];
            if (inString) {
                if (escaped) escaped = false;
                else if (char === "\\") escaped = true;
                else if (char === '"') inString = false;
                continue;
            }
            if (char === '"') {
                inString = true;
                continue;
            }
            if (char === "{" || char === "[") stack.push(char);
            else if (char === "}" || char === "]") {
                const open = stack.pop();
                if (
                    (open === "{" && char !== "}") ||
                    (open === "[" && char !== "]")
                )
                    return -1;
                if (stack.length === 0) return index + 1;
            }
        }
        return -1;
    }

    let index = start;
    while (index < source.length && !/[\s,}\]]/.test(source[index])) index += 1;
    return index > start ? index : -1;
}

function scanJsonStringEnd(source, start) {
    let escaped = false;
    for (let index = start + 1; index < source.length; index += 1) {
        const char = source[index];
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') return index + 1;
    }
    return -1;
}

function skipWhitespace(source, start) {
    let index = start;
    while (index < source.length && /\s/.test(source[index])) index += 1;
    return index;
}

function replaceSpan(source, span, replacement) {
    return `${source.slice(0, span.start)}${replacement}${source.slice(span.end)}`;
}

function unchanged(value, blockedAll = false) {
    return { value, changed: false, blockedAll: !!blockedAll };
}

function changedBinary(input, encoded) {
    return {
        value: input.kind === "array-buffer" ? encoded.buffer : encoded,
        changed: true,
        blockedAll: false,
    };
}

function getSupportedBytes(value) {
    const tag = Object.prototype.toString.call(value);
    if (tag === "[object ArrayBuffer]") {
        return {
            bytes: new Uint8Array(value),
            kind: "array-buffer",
        };
    }
    if (tag === "[object Uint8Array]" && ArrayBuffer.isView(value)) {
        return {
            bytes: new Uint8Array(
                value.buffer,
                value.byteOffset,
                value.byteLength,
            ),
            kind: "uint8-array",
        };
    }
    return null;
}

function firstNonWhitespaceByte(bytes) {
    for (const byte of bytes) {
        if (byte !== 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d)
            return byte;
    }
    return -1;
}

function bytesEqual(left, right) {
    if (left.byteLength !== right.byteLength) return false;
    for (let index = 0; index < left.byteLength; index += 1) {
        if (left[index] !== right[index]) return false;
    }
    return true;
}
