const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const pkg = require('../package.json');
const popupSource = fs.readFileSync('dist/js/popup.js', 'utf8');
const chromeStoreReviewUrl = 'https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm/reviews';
const edgeAddonsListingUrl = 'https://microsoftedge.microsoft.com/addons/detail/mgbppdkolkeelimnemlbpmfdddhoeeal';

function createPopupContext({ firefox, userAgent = 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36' }) {
    const classNames = new Set();
    const summaryElement = { textContent: '' };
    const tooltipElement = { textContent: '' };
    const linkElement = {
        dataset: {},
        attributes: new Map(),
        classList: {
            add(name) { classNames.add(name); },
            remove(name) { classNames.delete(name); },
            contains(name) { return classNames.has(name); }
        },
        setAttribute(name, value) { this.attributes.set(name, value); },
        getAttribute(name) { return this.attributes.get(name) || null; }
    };
    const statusRequests = [];
    const ratingLink = {
        href: chromeStoreReviewUrl,
        dataset: {
            tooltip: 'Enjoying Ghostify? Leave a quick rating on the Chrome Web Store.'
        },
        attributes: new Map([
            ['aria-label', 'Rate Ghostify on the Chrome Web Store']
        ]),
        setAttribute(name, value) { this.attributes.set(name, value); },
        getAttribute(name) { return this.attributes.get(name) || null; }
    };
    const manifest = firefox
        ? {
            version: pkg.version,
            browser_specific_settings: { gecko: { id: 'ghostify@ghostify-extension.vercel.app' } }
        }
        : { version: pkg.version };
    const statusData = {
        schemaVersion: 1,
        release: { matchesVerificationBuild: true },
        entries: [],
        history: [{
            date: '2026-07-18',
            eventType: 'verification',
            publicStatus: 'maintainer_verified',
            title: 'Supported controls passed review'
        }]
    };
    const context = {
        console,
        Date,
        Intl,
        Promise,
        setTimeout,
        clearTimeout,
        navigator: { userAgent },
        XMLHttpRequest: class {
            constructor() {
                this.response = statusData;
                this.status = 200;
                this.responseType = '';
                this.timeout = 0;
                this.withCredentials = true;
                statusRequests.push(this);
            }
            open(method, url, async) {
                this.method = method;
                this.url = url;
                this.async = async;
            }
            send(body) {
                this.body = body;
                this.onload();
            }
        },
        window: null,
        chrome: {
            runtime: { getManifest: () => manifest, lastError: null },
            storage: { local: { get() { }, set() { } } }
        },
        document: {
            addEventListener() { },
            querySelectorAll() { return []; },
            querySelector(selector) {
                if (selector === '.rate-link') return ratingLink;
                return null;
            },
            getElementById(id) {
                if (id === 'public-status-summary') return summaryElement;
                if (id === 'public-status-link') return linkElement;
                if (id === 'public-status-tooltip') return tooltipElement;
                return null;
            }
        }
    };
    context.window = context;
    vm.runInNewContext(popupSource, context, { filename: 'popup.js' });
    return { context, statusRequests, linkElement, ratingLink, summaryElement, tooltipElement };
}

function assertBrowserSpecificRatingLink() {
    const chromePopup = createPopupContext({ firefox: false });
    chromePopup.context.configureStoreRatingLink();
    assert.strictEqual(chromePopup.ratingLink.href, chromeStoreReviewUrl);
    assert.strictEqual(
        chromePopup.ratingLink.getAttribute('aria-label'),
        'Rate Ghostify on the Chrome Web Store'
    );

    const edgePopup = createPopupContext({
        firefox: false,
        userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'
    });
    edgePopup.context.configureStoreRatingLink();
    assert.strictEqual(edgePopup.ratingLink.href, edgeAddonsListingUrl);
    assert.strictEqual(
        edgePopup.ratingLink.getAttribute('aria-label'),
        'Rate Ghostify on Microsoft Edge Add-ons'
    );
    assert.strictEqual(
        edgePopup.ratingLink.dataset.tooltip,
        'Enjoying Ghostify? Leave a quick rating on Microsoft Edge Add-ons.'
    );
}

async function assertDynamicStatus(target) {
    const popup = createPopupContext({ firefox: target === 'firefox' });
    await popup.context.updatePublicStatusSummary();
    assert.strictEqual(popup.statusRequests.length, 1, `${target} popup must request the public status feed`);
    const request = popup.statusRequests[0];
    assert.strictEqual(request.url, 'https://ghostify-extension.vercel.app/status.json');
    assert.strictEqual(request.method, 'GET');
    assert.strictEqual(request.async, true);
    assert.strictEqual(request.body, undefined);
    assert.strictEqual(request.responseType, 'json');
    assert.strictEqual(request.timeout, 4000);
    assert.strictEqual(request.withCredentials, false);
    assert.strictEqual(popup.summaryElement.textContent, 'Jul 18');
    assert.strictEqual(popup.linkElement.dataset.status, 'verified');
    assert(!popup.linkElement.classList.contains('is-fallback'));
    assert.strictEqual(popup.tooltipElement.textContent, 'Supported controls passed review');
    assert.strictEqual(
        popup.linkElement.getAttribute('aria-label'),
        'Open Ghostify status page. Verified Jul 18.'
    );
}

async function main() {
    const target = process.argv[2] || 'all';
    assert(
        ['all', 'chromium', 'firefox'].includes(target),
        `Unknown popup test target: ${target}`
    );

    if (target !== 'chromium') await assertDynamicStatus('firefox');
    if (target !== 'firefox') {
        await assertDynamicStatus('chromium');
        assertBrowserSpecificRatingLink();
    }
}

main()
    .then(() => console.log(`${process.argv[2] || 'Firefox and Chromium'} popup status behavior tests passed`))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
