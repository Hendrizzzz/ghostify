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
const EDGE_ADDONS_LISTING_URL = 'https://microsoftedge.microsoft.com/addons/detail/mgbppdkolkeelimnemlbpmfdddhoeeal';
const EDGE_USER_AGENT_PATTERN = /\bEdg(?:A|iOS)?\//;

const PUBLIC_STATUS_VERIFIED = new Set([
    'maintainer_verified',
    'community_verified_reviewed'
]);

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    attachEventListeners();
    configureStoreRatingLink();
    updatePublicStatusSummary();

    const manifestData = chrome.runtime.getManifest();
    const versionSpan = document.getElementById('version-number');
    if (versionSpan) {
        versionSpan.innerText = `v${manifestData.version}`;
    }
});

function configureStoreRatingLink(userAgent = navigator.userAgent) {
    const ratingLink = document.querySelector('.rate-link');
    if (!ratingLink || !EDGE_USER_AGENT_PATTERN.test(userAgent || '')) return;

    ratingLink.href = EDGE_ADDONS_LISTING_URL;
    ratingLink.setAttribute('aria-label', 'Rate Ghostify on Microsoft Edge Add-ons');
    ratingLink.dataset.tooltip = 'Enjoying Ghostify? Leave a quick rating on Microsoft Edge Add-ons.';
}


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
    const tooltipElement = document.getElementById('public-status-tooltip');
    if (!summaryElement) return;

    try {
        const data = await fetchPublicStatus();
        const summary = summarizePublicStatus(data);
        const tone = getPublicStatusTone(data);
        const description = getPublicStatusDescription(data);
        summaryElement.textContent = summary;
        if (tooltipElement) tooltipElement.textContent = description;
        if (linkElement) {
            linkElement.classList.remove('is-fallback');
            linkElement.dataset.status = tone;
            linkElement.setAttribute('aria-label', buildPublicStatusAriaLabel(tone, summary));
        }
    } catch (e) {
        const summary = 'Review';
        summaryElement.textContent = summary;
        if (tooltipElement) tooltipElement.textContent = 'Public status details are temporarily unavailable.';
        if (linkElement) {
            linkElement.classList.add('is-fallback');
            linkElement.dataset.status = 'review';
            linkElement.setAttribute('aria-label', 'Open Ghostify status page. Public status feed unavailable.');
        }
    }
}

function fetchPublicStatus() {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('GET', PUBLIC_STATUS_FEED_URL, true);
        request.responseType = 'json';
        request.timeout = PUBLIC_STATUS_TIMEOUT_MS;
        request.withCredentials = false;
        request.onload = () => {
            try {
                if (request.status < 200 || request.status >= 300) {
                    throw new Error(`status ${request.status}`);
                }
                const data = request.response;
                validatePublicStatusData(data);
                resolve(data);
            } catch (error) {
                reject(error);
            }
        };
        request.onerror = () => reject(new Error('status request failed'));
        request.ontimeout = () => reject(new Error('status timeout'));
        request.send();
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

function getPublicStatusDescription(data) {
    const latestRecord = latestPublicStatusRecord(data.history || []);
    return latestRecord?.title || latestRecord?.summary || 'Open the public status page for the latest review.';
}

function getPublicStatusTone(data) {
    if (data.release?.matchesVerificationBuild === false) return 'review';
    const latestRecord = latestPublicStatusRecord(data.history || []);
    if (latestRecord && PUBLIC_STATUS_VERIFIED.has(latestRecord.publicStatus)) return 'verified';
    return 'review';
}

function latestPublicStatusRecord(history) {
    return history.find(record =>
        record?.date &&
        record?.publicStatus &&
        record.eventType !== 'release' &&
        record.eventType !== 'fix'
    ) || null;
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
