const assert = require("assert");
const fs = require("fs");

const {
    messengerReadReceipt,
    facebookWorkerEdgeChatLastSeenFrame,
    makeGhostPage,
    makeMessengerPatchPage,
    registerMessengerModule,
    fetchOutcome,
    websocketOutcome,
} = require("../helpers/regression-harness");

async function testNonMawFbsbxPagesAreNotTreatedAsMessenger() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.fbsbx.com",
            pathname: "/cdn/redacted",
            href: "https://www.fbsbx.com/cdn/redacted",
        },
    );
    const calls = [];
    const module = registerMessengerModule(
        context,
        "LSUpdateThreadReadWatermark",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return "non-maw-read-updated";
            };
        },
    );
    const payload = {
        thread_key: { thread_fbid: "redacted-thread" },
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true },
    };

    assert.strictEqual(module.exports.default(payload), "non-maw-read-updated");
    assert.strictEqual(
        calls[0],
        payload,
        "non-MAW fbsbx pages must not get Messenger module patching",
    );

    const window = makeGhostPage({
        hostname: "www.fbsbx.com",
        pathname: "/cdn/redacted",
        href: "https://www.fbsbx.com/cdn/redacted",
    });
    assert.notStrictEqual(
        window.__GHOSTIFY_GHOST_HOOKED__,
        true,
        "non-MAW fbsbx pages must not install the main Ghostify hook set",
    );
    assert.strictEqual(
        window.document.hasFocus(),
        true,
        "non-MAW fbsbx pages must not get Messenger focus spoofing",
    );
    assert.strictEqual(
        await fetchOutcome(window, messengerReadReceipt),
        "allowed",
        "non-MAW fbsbx pages must not install Ghostify fetch privacy hooks",
    );
    assert.strictEqual(
        websocketOutcome(window, facebookWorkerEdgeChatLastSeenFrame),
        "allowed",
        "non-MAW fbsbx pages must not install Ghostify WebSocket privacy hooks",
    );
}

function testManifestInjectsIntoFacebookMawProxyFrames() {
    const manifest = JSON.parse(fs.readFileSync("dist/manifest.json", "utf8"));
    const proxyMatch = "https://www.fbsbx.com/*";

    assert(
        manifest.host_permissions.includes(proxyMatch),
        "manifest host_permissions must include Facebook MAW proxy frames",
    );

    for (const script of [
        "js/content.js",
        "js/messenger_patch.js",
        "js/ghost.js",
    ]) {
        const entry = manifest.content_scripts.find((candidate) =>
            candidate.js.includes(script),
        );
        assert(
            entry,
            `manifest must include content_script entry for ${script}`,
        );
        assert(
            entry.matches.includes(proxyMatch),
            `${script} must inject into Facebook MAW proxy frames`,
        );
    }

    const resources = manifest.web_accessible_resources || [];
    assert(
        resources.some((entry) => (entry.matches || []).includes(proxyMatch)),
        "web_accessible_resources must allow config reads from Facebook MAW proxy frames",
    );
}

(async () => {
    await testNonMawFbsbxPagesAreNotTreatedAsMessenger();
    testManifestInjectsIntoFacebookMawProxyFrames();
    console.log("host scope regression tests passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
