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
const PUBLIC_STATUS_TIMEOUT_MS = 1200;

const PUBLIC_STATUS_LABELS = {
    maintainer_verified: 'Maintainer verified',
    community_verified_reviewed: 'Community verified',
    under_review: 'Under review',
    not_recently_verified: 'Not recently verified',
    known_issue: 'Known issue',
    stale: 'Stale',
    public_status_unavailable: 'Public status unavailable'
};

const PUBLIC_STATUS_WEIGHT = {
    known_issue: 60,
    public_status_unavailable: 55,
    under_review: 50,
    stale: 40,
    not_recently_verified: 30,
    community_verified_reviewed: 10,
    maintainer_verified: 0
};

const PUBLIC_STATUS_VERIFIED = new Set([
    'maintainer_verified',
    'community_verified_reviewed'
]);

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    attachEventListeners();
    attachViewListeners();
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

function attachViewListeners() {
    const mainView = document.getElementById('main-view');
    const labsView = document.getElementById('labs-view');

    document.getElementById('open-labs')?.addEventListener('click', () => {
        if (!mainView || !labsView) return;
        mainView.hidden = true;
        labsView.hidden = false;
        labsView.querySelector('a, button')?.focus();
    });

    document.getElementById('close-labs')?.addEventListener('click', () => {
        if (!mainView || !labsView) return;
        labsView.hidden = true;
        mainView.hidden = false;
        document.getElementById('open-labs')?.focus();
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
        summaryElement.textContent = summary;
        if (linkElement) {
            linkElement.classList.remove('is-fallback');
            linkElement.setAttribute('aria-label', `Open Ghostify status page. ${summary}.`);
        }
    } catch (e) {
        const summary = 'Check status';
        summaryElement.textContent = summary;
        if (linkElement) {
            linkElement.classList.add('is-fallback');
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
    if (!data.provenWorking || typeof data.provenWorking !== 'object') throw new Error('missing proven working timeline');
}

function summarizePublicStatus(data, now = new Date()) {
    const entries = data.entries || [];
    const worstStatus = entries
        .map(entry => effectivePublicStatus(entry.publicStatus, entry.expiresAt, now))
        .sort((left, right) => (PUBLIC_STATUS_WEIGHT[right] || 0) - (PUBLIC_STATUS_WEIGHT[left] || 0))[0] || 'public_status_unavailable';

    if (worstStatus === 'maintainer_verified' || worstStatus === 'community_verified_reviewed') {
        return formatCompactWorkingSummary(data, entries, now) || 'Working';
    }

    return `${PUBLIC_STATUS_LABELS[worstStatus] || 'Under review'}.`;
}

function effectivePublicStatus(publicStatus, expiresAt, now = new Date()) {
    if (!PUBLIC_STATUS_VERIFIED.has(publicStatus)) {
        return publicStatus || 'public_status_unavailable';
    }

    if (!expiresAt) return 'stale';
    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
        return 'stale';
    }

    return publicStatus;
}

function formatCompactWorkingSummary(data, entries, now = new Date()) {
    const provenDate = data.provenWorking?.lastVerifiedAt ? new Date(data.provenWorking.lastVerifiedAt) : latestVerificationDate(entries);
    if (!provenDate || Number.isNaN(provenDate.getTime())) return '';

    if (sameUtcDay(provenDate, now)) {
        return 'Working today';
    }

    return `Working ${formatShortUtcDate(provenDate)}`;
}

function latestVerificationDate(entries) {
    const verifiedDates = entries
        .map(entry => entry.verifiedAt ? new Date(entry.verifiedAt) : null)
        .filter(date => date && !Number.isNaN(date.getTime()))
        .sort((left, right) => right.getTime() - left.getTime());

    return verifiedDates[0] || null;
}

function sameUtcDay(left, right) {
    return (
        left.getUTCFullYear() === right.getUTCFullYear() &&
        left.getUTCMonth() === right.getUTCMonth() &&
        left.getUTCDate() === right.getUTCDate()
    );
}

function formatShortUtcDate(date) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
