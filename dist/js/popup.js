const DEFAULT_SETTINGS = {
    igTyping: true,
    igSeen: true,
    igStory: true,
    msgTyping: true,
    msgSeen: true,
    msgStory: true
};


const ELEMENT_MAP = {
    'ig-typing': 'igTyping',
    'ig-seen': 'igSeen',
    'ig-story': 'igStory',
    'msg-typing': 'msgTyping',
    'msg-seen': 'msgSeen',
    'msg-story': 'msgStory'
};

const PUBLIC_STATUS_FEED_URL = 'https://ghostify-extension.vercel.app/status.json';
const PUBLIC_STATUS_TIMEOUT_MS = 4000;

const PUBLIC_STATUS_VERIFIED = new Set([
    'maintainer_verified',
    'community_verified_reviewed'
]);

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    attachEventListeners();
    updatePublicStatusSummary();

    const manifestData = chrome.runtime.getManifest();
    const versionSpan = document.getElementById('version-number');
    if (versionSpan) {
        versionSpan.innerText = `v${manifestData.version}`;
    }
});


function loadSettings() {
    chrome.storage.local.get(['ghostifySettings'], (result) => {
        const settings = result.ghostifySettings || DEFAULT_SETTINGS;

        Object.entries(ELEMENT_MAP).forEach(([elementId, settingKey]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.checked = settings[settingKey];
            }
        });
    });
}


function attachEventListeners() {
    const inputs = document.querySelectorAll('input[type="checkbox"]');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            saveSettings();
        });
    });
}

function saveSettings() {
    const settings = {
        igTyping: document.getElementById('ig-typing')?.checked ?? true,
        igSeen: document.getElementById('ig-seen')?.checked ?? true,
        igStory: document.getElementById('ig-story')?.checked ?? true,
        msgTyping: document.getElementById('msg-typing')?.checked ?? true,
        msgSeen: document.getElementById('msg-seen')?.checked ?? true,
        msgStory: document.getElementById('msg-story')?.checked ?? true
    };

    chrome.storage.local.set({ ghostifySettings: settings });
}

async function updatePublicStatusSummary() {
    const summaryElement = document.getElementById('public-status-summary');
    const linkElement = document.getElementById('public-status-link');
    if (!summaryElement) return;

    try {
        const data = await fetchPublicStatus();
        const summary = summarizePublicStatus(data);
        const tone = getPublicStatusTone(data);
        summaryElement.textContent = summary;
        if (linkElement) {
            linkElement.classList.remove('is-fallback');
            linkElement.dataset.status = tone;
            linkElement.setAttribute('aria-label', buildPublicStatusAriaLabel(tone, summary));
        }
    } catch (e) {
        const summary = 'Review';
        summaryElement.textContent = summary;
        if (linkElement) {
            linkElement.classList.add('is-fallback');
            linkElement.dataset.status = 'review';
            linkElement.setAttribute('aria-label', 'Open Ghostify status page. Public status feed unavailable.');
        }
    }
}

function fetchPublicStatus() {
    return new Promise((resolve, reject) => {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeout = setTimeout(() => {
            if (controller) controller.abort();
            reject(new Error('status timeout'));
        }, PUBLIC_STATUS_TIMEOUT_MS);

        fetch(PUBLIC_STATUS_FEED_URL, {
            method: 'GET',
            cache: 'no-store',
            signal: controller?.signal
        })
            .then(response => {
                if (!response.ok) throw new Error(`status ${response.status}`);
                return response.json();
            })
            .then(data => {
                clearTimeout(timeout);
                validatePublicStatusData(data);
                resolve(data);
            })
            .catch(error => {
                clearTimeout(timeout);
                reject(error);
            });
    });
}

function validatePublicStatusData(data) {
    if (!data || typeof data !== 'object') throw new Error('invalid status data');
    if (data.schemaVersion !== 1) throw new Error('unsupported status schema');
    if (!Array.isArray(data.entries)) throw new Error('missing status entries');
    if (data.entries.length > 32) throw new Error('status feed too large');
    if (!Array.isArray(data.history) || !data.history.length) throw new Error('missing status history');
}

function summarizePublicStatus(data) {
    const latestRecord = latestPublicStatusRecord(data.history || []);
    return formatStatusRecordDate(latestRecord) || formatLastVerifiedDate(data) || 'Review';
}

function getPublicStatusTone(data) {
    if (data.release?.matchesVerificationBuild === false) return 'review';
    const latestRecord = latestPublicStatusRecord(data.history || []);
    if (latestRecord && PUBLIC_STATUS_VERIFIED.has(latestRecord.publicStatus)) return 'verified';
    return 'review';
}

function latestPublicStatusRecord(history) {
    return history.find(record => record?.date && record?.publicStatus) || null;
}

function buildPublicStatusAriaLabel(tone, summary) {
    if (tone === 'verified') return `Open Ghostify status page. Verified ${summary}.`;
    return `Open Ghostify status page. Reports or review recorded ${summary}.`;
}

function formatStatusRecordDate(record) {
    if (!record?.date) return '';
    const date = new Date(record.date);
    if (Number.isNaN(date.getTime())) return '';
    return formatShortUtcDate(date);
}

function formatLastVerifiedDate(data) {
    const entries = data.entries || [];
    const verifiedDate = latestVerificationDate(entries);
    if (!verifiedDate || Number.isNaN(verifiedDate.getTime())) return '';
    return formatShortUtcDate(verifiedDate);
}

function latestVerificationDate(entries) {
    const verifiedDates = entries
        .map(entry => entry.verifiedAt ? new Date(entry.verifiedAt) : null)
        .filter(date => date && !Number.isNaN(date.getTime()))
        .sort((left, right) => right.getTime() - left.getTime());

    return verifiedDates[0] || null;
}

function formatShortUtcDate(date) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
