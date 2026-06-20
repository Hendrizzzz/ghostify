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

const STATUS_COPY = {
    checking: {
        label: 'Checking',
        message: 'Checking Ghostify.'
    },
    healthy: {
        label: 'Loaded',
        message: 'Ghostify loaded here.'
    },
    needsRefresh: {
        label: 'Refresh',
        message: 'Refresh this tab.'
    },
    noSupportedTab: {
        label: 'No tab',
        message: 'Open Instagram, Messenger, or Facebook.'
    },
    someChecksFailed: {
        label: 'Partial',
        message: 'Some checks did not respond.'
    }
};

const SUPPORTED_HOSTS = [
    'instagram.com',
    'messenger.com',
    'facebook.com'
];

const SUPPORTED_TAB_URL_PATTERNS = [
    'https://*.instagram.com/*',
    'https://*.messenger.com/*',
    'https://*.facebook.com/*',
    'https://www.fbsbx.com/*'
];

const STATUS_TIMEOUT_MS = 700;
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

let lastStatusTarget = null;

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    attachEventListeners();
    attachViewListeners();
    updateStatusCheck();
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
            updateStatusCheck();
        });
    });

    document.getElementById('status-refresh')?.addEventListener('click', refreshActiveStatusTab);
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

async function updateStatusCheck() {
    setStatus('checking');
    lastStatusTarget = null;

    const target = await getStatusTargetTab();
    if (!target) {
        setStatus('noSupportedTab');
        return;
    }
    lastStatusTarget = target;
    setStatus('checking', null, target);

    const pageStatus = await requestTabStatus(target.tab.id);
    if (!pageStatus || !pageStatus.contentScript) {
        setStatus('needsRefresh', null, target);
        return;
    }

    if (!pageStatus.page?.loaded) {
        setStatus('needsRefresh', null, target);
        return;
    }

    if (!pageStatus.page?.settingsReady || !hasRequiredHooks(pageStatus.page, target)) {
        setStatus('someChecksFailed', null, target);
        return;
    }

    setStatus('healthy', null, target);
}

async function refreshActiveStatusTab() {
    const target = lastStatusTarget || await getStatusTargetTab();
    if (!target?.tab?.id || !isSupportedUrl(target.tab.url)) {
        setStatus('noSupportedTab');
        return;
    }

    setStatus('checking', `Refreshing ${target.label}.`, target);
    const reloaded = await reloadTab(target.tab.id);
    if (!reloaded) {
        setStatus('needsRefresh', `Could not refresh ${target.label}. Try refreshing manually.`, target);
        return;
    }

    window.setTimeout(updateStatusCheck, 800);
}

function setStatus(state, messageOverride = null, target = null) {
    const localRefresh = document.getElementById('local-refresh');
    const refreshButton = document.getElementById('status-refresh');
    const refreshMessage = document.getElementById('local-refresh-message');
    const showRefresh = state === 'needsRefresh' || state === 'someChecksFailed';

    if (localRefresh) {
        localRefresh.hidden = !showRefresh;
    }

    if (refreshButton) {
        refreshButton.disabled = !showRefresh;
        refreshButton.tabIndex = showRefresh ? 0 : -1;
        refreshButton.setAttribute('aria-label', target?.label ? `Refresh ${target.label}` : 'Refresh this tab');
    }

    if (refreshMessage && showRefresh) {
        refreshMessage.textContent = messageOverride || getStatusMessage(state, target) || STATUS_COPY.needsRefresh.message;
    }
}

function getStatusMessage(state, target = null) {
    const label = target?.label;
    if (!label) return STATUS_COPY[state]?.message;

    switch (state) {
        case 'checking':
            return `Checking ${label}.`;
        case 'healthy':
            return `Ghostify is active on ${label}.`;
        case 'needsRefresh':
        case 'someChecksFailed':
            return `Refresh ${label} to load Ghostify.`;
        default:
            return STATUS_COPY[state]?.message;
    }
}

async function getStatusTargetTab() {
    const activeTab = (await queryTabs({ active: true, currentWindow: true }))[0] || null;
    if (activeTab && isSupportedUrl(activeTab.url)) {
        return createStatusTarget(activeTab);
    }

    const supportedTabs = await queryTabs({
        currentWindow: true,
        url: SUPPORTED_TAB_URL_PATTERNS
    });
    const tab = chooseSupportedTab(supportedTabs.filter(candidate => isSupportedUrl(candidate?.url)));
    return tab ? createStatusTarget(tab) : null;
}

function queryTabs(queryInfo) {
    return new Promise((resolve) => {
        try {
            if (!chrome.tabs?.query) {
                resolve([]);
                return;
            }

            chrome.tabs.query(queryInfo, (tabs) => {
                if (chrome.runtime.lastError) {
                    resolve([]);
                    return;
                }
                resolve(Array.isArray(tabs) ? tabs : []);
            });
        } catch (e) {
            resolve([]);
        }
    });
}

function chooseSupportedTab(tabs) {
    return tabs
        .slice()
        .sort((a, b) => {
            const discardedRank = Number(Boolean(a.discarded)) - Number(Boolean(b.discarded));
            if (discardedRank !== 0) return discardedRank;
            const lastAccessedRank = (b.lastAccessed || 0) - (a.lastAccessed || 0);
            if (lastAccessedRank !== 0) return lastAccessedRank;
            return (a.index || 0) - (b.index || 0);
        })[0] || null;
}

function createStatusTarget(tab) {
    return {
        tab,
        label: getPlatformLabel(tab.url),
        platform: getPlatformKey(tab.url)
    };
}

function getPlatformLabel(url) {
    const platform = getPlatformKey(url);
    if (platform === 'instagram') return 'Instagram';
    if (platform === 'messenger') return 'Messenger';
    if (platform === 'facebook') return 'Facebook';
    return 'this tab';
}

function getPlatformKey(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        if (host.endsWith('instagram.com')) return 'instagram';
        if (host.endsWith('messenger.com') || host === 'www.fbsbx.com') return 'messenger';
        if (host.endsWith('facebook.com')) return 'facebook';
    } catch (e) {
    }
    return 'unknown';
}

function requestTabStatus(tabId) {
    return new Promise((resolve) => {
        if (!tabId || !chrome.tabs?.sendMessage) {
            resolve(null);
            return;
        }

        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve(null);
        }, STATUS_TIMEOUT_MS);

        try {
            chrome.tabs.sendMessage(tabId, { type: 'GHOSTIFY_STATUS_CHECK' }, { frameId: 0 }, (response) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);

                if (chrome.runtime.lastError) {
                    resolve(null);
                    return;
                }

                resolve(response || null);
            });
        } catch (e) {
            if (!settled) {
                settled = true;
                clearTimeout(timeout);
                resolve(null);
            }
        }
    });
}

function reloadTab(tabId) {
    return new Promise((resolve) => {
        try {
            if (!tabId || !chrome.tabs?.reload) {
                resolve(false);
                return;
            }

            chrome.tabs.reload(tabId, { bypassCache: false }, () => {
                resolve(!chrome.runtime.lastError);
            });
        } catch (e) {
            resolve(false);
        }
    });
}

function isSupportedUrl(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host === 'www.fbsbx.com') {
            return parsed.pathname.toLowerCase().startsWith('/maw_proxy_page');
        }
        return SUPPORTED_HOSTS.some(domain => host === domain || host.endsWith(`.${domain}`));
    } catch (e) {
        return false;
    }
}

function hasRequiredHooks(page, target) {
    const hooks = page?.hooks || {};
    const coreReady = Boolean(
        hooks.ghost &&
        hooks.fetch &&
        hooks.xhr &&
        hooks.websocket &&
        hooks.visibility
    );
    if (!coreReady) return false;

    if (target?.platform === 'instagram') return Boolean(hooks.instagram);
    if (target?.platform === 'messenger') return Boolean(hooks.messenger);
    if (target?.platform === 'facebook') return Boolean(hooks.facebook);
    return false;
}

async function updatePublicStatusSummary() {
    const summaryElement = document.getElementById('public-status-summary');
    const actionElement = document.getElementById('public-status-action');
    if (!summaryElement) return;

    try {
        const data = await fetchPublicStatus();
        const summary = summarizePublicStatus(data);
        summaryElement.textContent = summary;
        if (actionElement) actionElement.textContent = 'View';
    } catch (e) {
        summaryElement.textContent = 'Public status unavailable.';
        if (actionElement) actionElement.textContent = 'View';
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
}

function summarizePublicStatus(data) {
    const entries = data.entries || [];
    const worstStatus = entries
        .map(entry => effectivePublicStatus(entry.publicStatus, entry.expiresAt))
        .sort((left, right) => (PUBLIC_STATUS_WEIGHT[right] || 0) - (PUBLIC_STATUS_WEIGHT[left] || 0))[0] || 'public_status_unavailable';

    if (worstStatus === 'maintainer_verified' || worstStatus === 'community_verified_reviewed') {
        return latestVerificationSummary(entries) || `${PUBLIC_STATUS_LABELS[worstStatus]}.`;
    }

    const version = data.productVersion ? ` for v${String(data.productVersion).replace(/^v/i, '')}` : '';
    return `${PUBLIC_STATUS_LABELS[worstStatus] || 'Under review'}${version}.`;
}

function effectivePublicStatus(publicStatus, expiresAt) {
    if (!PUBLIC_STATUS_VERIFIED.has(publicStatus)) {
        return publicStatus || 'public_status_unavailable';
    }

    if (!expiresAt) return 'stale';
    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
        return 'stale';
    }

    return publicStatus;
}

function latestVerificationSummary(entries) {
    const verifiedDates = entries
        .map(entry => entry.verifiedAt ? new Date(entry.verifiedAt) : null)
        .filter(date => date && !Number.isNaN(date.getTime()))
        .sort((left, right) => right.getTime() - left.getTime());

    if (!verifiedDates.length) return '';

    return `Verified ${verifiedDates[0].toLocaleDateString([], { month: 'short', day: 'numeric' })}.`;
}
