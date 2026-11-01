// Checks on the hand-maintained popup assets (dist/popup.html and
// dist/js/popup.js): removed UI stays removed and required links stay present.

const { fail } = require("./assertions");

function assertPopupHasNoLabsOrSurvey(popupHtml, popupJs) {
    if (
        /\bLabs\b/.test(popupHtml) ||
        popupHtml.includes("tally.so") ||
        /feature survey/i.test(popupHtml)
    ) {
        fail("dist/popup.html must not include Labs or feature-survey UI");
    }

    if (
        popupJs.includes("attachViewListeners") ||
        popupJs.includes("open-labs") ||
        popupJs.includes("labs-view")
    ) {
        fail("dist/js/popup.js must not include removed Labs navigation");
    }
}

function assertPopupPublicStatusLink(popupHtml, popupJs) {
    if (!popupHtml.includes("https://ghostify-extension.vercel.app/status")) {
        fail(
            "dist/popup.html must include the public verification status link",
        );
    }

    if (
        !popupJs.includes("https://ghostify-extension.vercel.app/status.json")
    ) {
        fail("dist/js/popup.js must fetch the display-only public status feed");
    }

    if (
        !popupJs.includes("latestPublicStatusRecord") ||
        !popupJs.includes("data.history")
    ) {
        fail(
            "dist/js/popup.js must derive popup color and date from the latest public status record",
        );
    }
}

function assertPopupPlatformLinks(popupHtml) {
    const expectedLinks = [
        ["Instagram", "https://instagram.com/"],
        ["Messenger", "https://messenger.com/"],
        ["Facebook", "https://facebook.com/"],
    ];

    for (const [label, href] of expectedLinks) {
        if (!popupHtml.includes(`href="${href}"`)) {
            fail(`dist/popup.html must link ${label} to ${href}`);
        }
    }
}

module.exports = {
    assertPopupHasNoLabsOrSurvey,
    assertPopupPlatformLinks,
    assertPopupPublicStatusLink,
};
