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


document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    attachEventListeners();

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
        input.addEventListener('change', saveSettings);
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

