// PRIVACY.md must justify exactly the manifest's permissions and keep the
// disclosures the store listings rely on.

const { fail } = require("./assertions");
const { ALLOWED_HOST_PERMISSIONS, ALLOWED_PERMISSIONS } = require("./manifest");

const REQUIRED_PRIVACY_DISCLOSURES = [
    {
        label: "runtime-scoped collection statement",
        phrases: [
            "Ghostify's extension runtime does not collect, store, share, or sell your personal data.",
        ],
    },
    {
        label: "local transient inspection disclosure",
        phrases: [
            "Ghostify transiently inspects request URLs, request payloads, and supported page or worker messages inside your browser",
            "does not send this inspected data to a Ghostify server",
        ],
    },
    {
        label: "fbsbx proxy narrowing disclosure",
        phrases: [
            "https://www.fbsbx.com/*",
            "Ghostify limits Messenger-specific runtime behavior to supported Messenger proxy pages",
        ],
    },
    {
        label: "public status feed host disclosure",
        phrases: [
            "https://ghostify-extension.vercel.app/*",
            "fetch the display-only public status JSON",
        ],
    },
    {
        label: "Chrome Web Store Limited Use disclosure",
        phrases: [
            "Chrome Web Store User Data Policy",
            "Limited Use requirements",
        ],
    },
    {
        label: "voluntary feedback disclosure",
        phrases: [
            "GitHub issue forms",
            "Do not submit private messages, credentials, or account-sensitive details",
        ],
    },
];

function assertPrivacyPolicyCoversPermissions(privacyPolicy) {
    const match = privacyPolicy.match(
        /### 2\.1\. Permissions Justification([\s\S]*?)(?:\n##\s|\n#\s|$)/,
    );
    if (!match)
        fail("PRIVACY.md must include a Permissions Justification section");

    const section = match[1];
    const justified = [];
    for (const line of section.split(/\r?\n/)) {
        const bulletMatch = line.match(/^\*\s+\*\*[^`]*\(`([^`]+)`\):/);
        if (bulletMatch) justified.push(bulletMatch[1]);
    }

    const expected = [...ALLOWED_HOST_PERMISSIONS, ...ALLOWED_PERMISSIONS];
    for (const permission of expected) {
        if (!justified.includes(permission)) {
            const label = ALLOWED_HOST_PERMISSIONS.includes(permission)
                ? "host permission"
                : "permission";
            fail(`PRIVACY.md must justify ${permission} ${label}`);
        }
    }

    const expectedSet = new Set(expected);
    const unexpected = justified.filter(
        (permission) => !expectedSet.has(permission),
    );
    if (unexpected.length)
        fail(
            `Unexpected PRIVACY.md permission justification: ${unexpected.join(", ")}`,
        );
}

function assertPrivacyPolicyRequiredDisclosures(privacyPolicy) {
    for (const disclosure of REQUIRED_PRIVACY_DISCLOSURES) {
        for (const phrase of disclosure.phrases) {
            if (!privacyPolicy.includes(phrase)) {
                fail(`PRIVACY.md must include ${disclosure.label}`);
            }
        }
    }
}

module.exports = {
    assertPrivacyPolicyCoversPermissions,
    assertPrivacyPolicyRequiredDisclosures,
};
