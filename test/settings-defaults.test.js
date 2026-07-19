const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { loadSrcModule } = require('./helpers/load-src-module');

const {
    DEFAULT_MODULE_FLAGS,
    DEFAULT_PRIVACY_SETTINGS,
    FREE_PRIVACY_SETTING_KEYS
} = loadSrcModule('src/settings/defaults.js');
const {
    GHOSTIFY_SETTINGS_STORAGE_KEY,
    normalizePrivacySettings,
    sanitizePrivacySettingsForPage
} = loadSrcModule('src/settings/storage.js');

const EXPECTED_PRIVACY_SETTINGS = {
    igTyping: true,
    igSeen: true,
    igStory: true,
    msgTyping: true,
    msgSeen: true,
    msgStory: true
};
const EXPECTED_PRIVACY_KEYS = Object.keys(EXPECTED_PRIVACY_SETTINGS);

assert.deepStrictEqual(FREE_PRIVACY_SETTING_KEYS, EXPECTED_PRIVACY_KEYS);
assert.deepStrictEqual(DEFAULT_PRIVACY_SETTINGS, EXPECTED_PRIVACY_SETTINGS);
assert.deepStrictEqual(DEFAULT_MODULE_FLAGS, { ghostMode: true });
assert.strictEqual(GHOSTIFY_SETTINGS_STORAGE_KEY, 'ghostifySettings');

assert.deepStrictEqual(normalizePrivacySettings(), EXPECTED_PRIVACY_SETTINGS);
assert.deepStrictEqual(
    normalizePrivacySettings({
        igSeen: false,
        msgTyping: false,
        ignoredFlag: true,
        accountId: 'acct_public_test',
        sessionToken: 'token_public_test'
    }),
    {
        ...EXPECTED_PRIVACY_SETTINGS,
        igSeen: false,
        msgTyping: false
    }
);
assert.deepStrictEqual(
    sanitizePrivacySettingsForPage({
        igTyping: false,
        msgStory: false,
        accountId: 'acct_public_test',
        sessionToken: 'token_public_test',
        remotePolicy: { enabled: true }
    }),
    {
        ...EXPECTED_PRIVACY_SETTINGS,
        igTyping: false,
        msgStory: false
    }
);

for (const settings of [
    DEFAULT_PRIVACY_SETTINGS,
    normalizePrivacySettings({ extra: true }),
    sanitizePrivacySettingsForPage({ extra: true })
]) {
    assert.deepStrictEqual(Object.keys(settings), EXPECTED_PRIVACY_KEYS);
    for (const value of Object.values(settings)) {
        assert.strictEqual(typeof value, 'boolean');
    }
}

assert(
    fs.readFileSync('src/config.js', 'utf8').includes('DEFAULT_PRIVACY_SETTINGS'),
    'src/config.js should seed mutable MAIN-world settings from shared defaults'
);
assert(
    fs.readFileSync('src/messenger_patch.js', 'utf8').includes('normalizePrivacySettings'),
    'src/messenger_patch.js should normalize page-context settings through the shared defaults'
);

const popupSource = fs.readFileSync('dist/js/popup.js', 'utf8');
const popupDefaultsMatch = popupSource.match(/const DEFAULT_SETTINGS\s*=\s*({[\s\S]*?});/);
assert(popupDefaultsMatch, 'dist/js/popup.js should keep popup defaults until popup source migration');
const popupDefaults = vm.runInNewContext(`(${popupDefaultsMatch[1]})`, Object.create(null));
assert.deepStrictEqual(JSON.parse(JSON.stringify(popupDefaults)), EXPECTED_PRIVACY_SETTINGS);

const settingsMessages = [];
const storageChangeListeners = [];
const messageListeners = [];
const storedSettings = {
    igSeen: false,
    msgTyping: false,
    accountId: 'acct_public_test',
    sessionToken: 'token_public_test',
    hiddenObject: { enabled: true }
};
const contentContext = {
    console,
    Promise,
    setTimeout(callback) {
        callback();
        return 0;
    },
    fetch() {
        return Promise.resolve({ ok: false });
    },
    postMessage(message) {
        settingsMessages.push(message);
    },
    addEventListener(type, listener) {
        if (type === 'message') messageListeners.push(listener);
    },
    chrome: {
        runtime: {
            getURL(file) {
                return `chrome-extension://ghostify/${file}`;
            }
        },
        storage: {
            local: {
                get(keys, callback) {
                    if (keys.includes(GHOSTIFY_SETTINGS_STORAGE_KEY)) {
                        callback({ [GHOSTIFY_SETTINGS_STORAGE_KEY]: storedSettings });
                        return;
                    }
                    callback({});
                },
                set() { }
            },
            onChanged: {
                addListener(listener) {
                    storageChangeListeners.push(listener);
                }
            }
        }
    }
};
contentContext.window = contentContext;

vm.runInNewContext(fs.readFileSync('dist/js/content.js', 'utf8'), contentContext, {
    filename: 'dist/js/content.js'
});

assert(messageListeners.length, 'content script should listen for page settings requests');
assert(storageChangeListeners.length, 'content script should listen for settings storage changes');

storageChangeListeners[0](
    {
        [GHOSTIFY_SETTINGS_STORAGE_KEY]: {
            newValue: {
                igStory: false,
                msgSeen: false,
                accountId: 'acct_public_change',
                sessionToken: 'token_public_change'
            }
        }
    },
    'local'
);

const pageSettingsMessages = settingsMessages.filter(
    message => message?.type === 'GHOSTIFY_SETTINGS_UPDATE' && message.source === 'GHOSTIFY_EXTENSION'
);
assert(pageSettingsMessages.length >= 2, 'content script should bridge initial and changed Free settings');

for (const message of pageSettingsMessages) {
    assert.deepStrictEqual(Object.keys(message.settings), EXPECTED_PRIVACY_KEYS);
    for (const value of Object.values(message.settings)) {
        assert.strictEqual(typeof value, 'boolean');
    }
    assert.strictEqual(Object.prototype.hasOwnProperty.call(message.settings, 'accountId'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(message.settings, 'sessionToken'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(message.settings, 'hiddenObject'), false);
}

const installedListeners = [];
const removedStorageKeys = [];
const backgroundContext = {
    console,
    Promise,
    chrome: {
        runtime: {
            onInstalled: {
                addListener(listener) {
                    installedListeners.push(listener);
                }
            },
            onStartup: { addListener() { } },
            onMessage: { addListener() { } }
        },
        storage: {
            local: {
                get(keys, callback) {
                    callback({});
                },
                remove(key) {
                    removedStorageKeys.push(key);
                }
            },
            onChanged: { addListener() { } }
        },
        declarativeNetRequest: {
            updateDynamicRules() {
                return Promise.resolve();
            }
        }
    }
};

vm.runInNewContext(fs.readFileSync('dist/background.js', 'utf8'), backgroundContext, {
    filename: 'dist/background.js'
});

assert.strictEqual(installedListeners.length, 1, 'background should register its install migration');
installedListeners[0]();
assert.deepStrictEqual(
    removedStorageKeys,
    ['ghostifyConfig'],
    'extension updates should remove the obsolete runtime configuration cache'
);

console.log('settings defaults and page bridge tests passed');
