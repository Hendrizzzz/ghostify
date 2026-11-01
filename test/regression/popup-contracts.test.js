const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const pkg = require("../../package.json");

function testPopupMessengerSeenWarningRemoved() {
    const popupHtml = fs.readFileSync("dist/popup.html", "utf8");
    const popupCss = fs.readFileSync("dist/css/popup.css", "utf8");
    const popupJs = fs.readFileSync("dist/js/popup.js", "utf8");

    assert(
        !popupHtml.includes("msg-seen-warning") &&
            !popupHtml.includes("warning-trigger") &&
            !popupHtml.includes("warning-tooltip") &&
            !popupHtml.includes("group chats may not send") &&
            !popupHtml.includes(" title="),
        "Messenger/Facebook Hide Seen should no longer show the group-chat sending warning",
    );
    assert(
        popupHtml.includes(
            '<label class="switch"><input type="checkbox" id="msg-seen"',
        ),
        "Messenger/Facebook Hide Seen visible switch should activate its checkbox",
    );
    assert(
        !popupCss.includes(".warning-trigger") &&
            !popupCss.includes(".warning-tooltip") &&
            popupCss.includes("--status-yellow: #c98b20;") &&
            !popupCss.includes("--status-red"),
        "Popup CSS should drop the warning badge styles but keep the amber status token",
    );
    assert(
        !popupJs.includes("updateMessengerSeenWarning") &&
            !popupJs.includes("msg-seen-warning"),
        "Popup script should no longer toggle a Hide Seen warning",
    );
}

function testPopupSupportLinksUseGuidedIssueForms() {
    const popupHtml = fs.readFileSync("dist/popup.html", "utf8");
    const popupCss = fs.readFileSync("dist/css/popup.css", "utf8");
    const popupJs = fs.readFileSync("dist/js/popup.js", "utf8");
    const privacyPolicy = fs.readFileSync("PRIVACY.md", "utf8");
    const websiteUrl = "https://ghostify-extension.vercel.app/";
    const chromeStoreReviewUrl =
        "https://chromewebstore.google.com/detail/ghostify-hide-seen-typing/flpnibonbhdmnpgflnbemgghghhblmpm/reviews";
    const edgeAddonsListingUrl =
        "https://microsoftedge.microsoft.com/addons/detail/mgbppdkolkeelimnemlbpmfdddhoeeal";
    const directHelpFormUrl =
        "https://github.com/Hendrizzzz/Ghostify/issues/new?template=help_feedback.yml";
    const ratingTooltip =
        "Enjoying Ghostify? Leave a quick rating on the Chrome Web Store.";
    const thanksTooltip =
        "Helpful bug reports or ideas will be credited in release notes and on the website, with permission.";
    const directHelpPlaceholder =
        "Example: On facebook.com, I clicked New message requests and it opened a blank chat page instead of the request list. I expected Ghostify to keep the real UI working while Seen stays blocked.";
    const issueTemplateFiles = [
        ".github/ISSUE_TEMPLATE/config.yml",
        ".github/ISSUE_TEMPLATE/bug_report.yml",
        ".github/ISSUE_TEMPLATE/feature_request.yml",
        ".github/ISSUE_TEMPLATE/feedback.yml",
        ".github/ISSUE_TEMPLATE/question.yml",
        ".github/ISSUE_TEMPLATE/help_feedback.yml",
    ];
    const issueTemplateNames = [
        "name: Report a bug",
        "name: Share an idea",
        "name: Share feedback",
        "name: Ask a question",
    ];

    assert(
        popupHtml.includes(`href="${websiteUrl}"`) &&
            popupHtml.includes('aria-label="Open the Ghostify website"'),
        "Popup brand should open the Ghostify website when clicked",
    );
    assert(
        popupHtml.includes(`href="${directHelpFormUrl}"`) &&
            popupHtml.includes("Help &amp; feedback") &&
            popupHtml.includes(`data-tooltip="${thanksTooltip}"`) &&
            !popupHtml.includes("issues/new/choose") &&
            !popupHtml.includes("Report issue"),
        "Popup should open one guided Help & feedback draft directly instead of the issue chooser",
    );
    assert(
        popupHtml.includes(`href="${chromeStoreReviewUrl}"`) &&
            popupHtml.includes('class="footer-link rate-link"') &&
            popupHtml.includes(
                'aria-label="Rate Ghostify on the Chrome Web Store"',
            ) &&
            popupHtml.includes(`data-tooltip="${ratingTooltip}"`),
        "Popup footer should link directly to Ghostify reviews on the Chrome Web Store",
    );
    assert(
        popupJs.includes(edgeAddonsListingUrl) &&
            popupJs.includes("configureStoreRatingLink") &&
            popupJs.includes("Rate Ghostify on Microsoft Edge Add-ons"),
        "Shared Chromium popup should switch the rating destination to Microsoft Edge Add-ons in Edge",
    );
    assert(
        popupHtml.includes('class="footer-link support-link"') &&
            popupHtml.includes('id="version-number"') &&
            !popupHtml.includes("footer-separator") &&
            !popupHtml.includes("Feature survey"),
        "Popup footer should keep the version, rating, and Help & feedback links without a separator",
    );
    assert(
        popupCss.includes(".footer-link:hover::after") &&
            popupCss.includes(".support-link:hover::after") &&
            popupCss.includes("box-sizing: border-box;") &&
            popupCss.includes("max-width: min(208px, calc(100vw - 24px));") &&
            popupCss.includes("text-align: center;"),
        "Popup footer should reveal compact, balanced tooltips on hover and keyboard focus",
    );
    assert(
        !popupHtml.includes("Labs") &&
            !popupHtml.includes("tally.so") &&
            !popupHtml.includes('id="open-labs"') &&
            !popupHtml.includes('id="labs-view"') &&
            !popupJs.includes("attachViewListeners") &&
            !popupJs.includes("open-labs") &&
            !popupCss.includes(".labs-row") &&
            !popupCss.includes(".survey-link"),
        "Popup should remove Labs and feature-survey UI completely",
    );
    assert(
        privacyPolicy.includes("GitHub issue forms") &&
            !privacyPolicy.includes("Tally") &&
            !privacyPolicy.includes("feature surveys"),
        "Privacy policy should match the remaining GitHub feedback path",
    );
    const headerHtml = popupHtml.slice(
        popupHtml.indexOf('<header class="header">'),
        popupHtml.indexOf("</header>") + "</header>".length,
    );
    assert(
        headerHtml.includes('id="public-status-link"') &&
            headerHtml.includes('id="public-status-summary"') &&
            headerHtml.includes('id="public-status-tooltip"') &&
            headerHtml.includes('aria-describedby="public-status-tooltip"') &&
            headerHtml.includes('data-status="review"') &&
            !headerHtml.includes('id="public-status-action"') &&
            !headerHtml.includes(">Verification</span>") &&
            !popupHtml.includes(">View</span>") &&
            popupCss.includes(".header-verification") &&
            popupCss.includes("--status-green: #27835f;") &&
            popupCss.includes("--status-yellow: #c98b20;") &&
            popupCss.includes(".header-verification .status-icon") &&
            popupCss.includes("box-shadow: none;") &&
            popupCss.includes('.header-verification[data-status="verified"]') &&
            popupCss.includes(".header-verification:hover .status-tooltip") &&
            popupCss.includes("z-index: 40;") &&
            popupCss.includes("width: max-content;") &&
            popupCss.includes("max-width: min(272px, calc(100vw - 24px));") &&
            popupCss.includes("text-wrap: balance;") &&
            popupCss.includes("transition-delay: 0s;") &&
            !popupCss.includes("550ms") &&
            popupCss.includes("@media (prefers-reduced-motion: reduce)") &&
            !popupCss.includes("--status-red") &&
            !popupCss.includes('data-status="issue"') &&
            !popupHtml.includes('class="verification-panel"') &&
            !popupHtml.includes('id="local-refresh"') &&
            !popupHtml.includes('id="local-refresh-message"') &&
            !popupHtml.includes('id="status-refresh"') &&
            !popupHtml.includes("Refresh this tab to load Ghostify.") &&
            !popupHtml.includes("Status Check") &&
            !popupHtml.includes('id="status-pill"') &&
            !popupHtml.includes('id="status-message"') &&
            !popupJs.includes("GHOSTIFY_STATUS_CHECK") &&
            !popupJs.includes("refreshActiveStatusTab") &&
            !popupJs.includes("chrome.tabs.reload") &&
            !popupJs.includes("SUPPORTED_TAB_URL_PATTERNS") &&
            !popupJs.includes("getStatusTargetTab") &&
            !popupJs.includes("hasRequiredHooks") &&
            !popupJs.includes(
                "state === 'needsRefresh' || state === 'someChecksFailed'",
            ) &&
            !popupJs.includes(
                "summaryElement.textContent = 'Status unavailable.';",
            ) &&
            !popupJs.includes("PACKAGED_PUBLIC_STATUS") &&
            !popupJs.includes("fallbackPublicStatusSummary") &&
            !popupJs.includes("last packaged proof") &&
            !popupJs.includes("2026-06-27T00:00:00Z") &&
            popupJs.includes("latestPublicStatusRecord") &&
            popupJs.includes("formatStatusRecordDate") &&
            popupJs.includes("getPublicStatusTone") &&
            popupJs.includes("linkElement.dataset.status = tone") &&
            !popupCss.includes(".verification-panel") &&
            !popupCss.includes(".local-refresh") &&
            !popupCss.includes(".status-refresh") &&
            !popupJs.includes("smoke test") &&
            !popupJs.includes("Local hooks active.") &&
            !popupJs.includes("platformMayHaveChanged") &&
            !popupHtml.includes("Seen is definitely blocked") &&
            !popupHtml.includes("sender-side") &&
            !popupHtml.includes("sender-side Seen is verified"),
        "Popup should keep compact public status proof in the header and remove the local Ghostify-loaded checker",
    );
    assert(
        popupCss.includes(".brand-link:hover .header-icon") &&
            popupCss.includes(".brand-link:focus-visible .header-icon") &&
            !popupCss.includes(".brand-link:hover::before") &&
            !popupCss.includes("drop-shadow(") &&
            !popupCss.includes("text-shadow:"),
        "Popup hover feedback should use motion and color without decorative glow shadows",
    );
    assert(
        popupHtml.indexOf('href="https://facebook.com/"') <
            popupHtml.indexOf('href="https://messenger.com/"') &&
            popupHtml.includes('id="facebook-messenger-heading"') &&
            popupHtml.includes(
                'class="platform-heading-link platform-heading-link--with-icon" href="https://instagram.com/"',
            ) &&
            popupHtml.includes(
                'class="platform-heading-link platform-heading-link--with-icon" href="https://facebook.com/"',
            ) &&
            popupHtml.includes(
                'class="platform-heading-link platform-heading-link--with-icon" href="https://messenger.com/"',
            ) &&
            popupHtml.includes('class="platform-logo-facebook"') &&
            popupHtml.includes('class="platform-logo-knockout"') &&
            !popupCss.includes(".platform-heading-link--with-icon:hover svg") &&
            !popupCss.includes(
                ".platform-heading-link--with-icon:focus-visible svg",
            ),
        "Popup should present optically balanced linked platform identities without hover motion",
    );
    assert(
        ["feature-seen", "feature-typing", "feature-story"].every(
            (iconId) =>
                popupHtml.includes(`id="${iconId}"`) &&
                popupHtml.includes(`href="#${iconId}"`),
        ) &&
            popupCss.includes(".row:hover .feature-icon") &&
            !popupCss.includes(".seen-icon::before") &&
            !popupCss.includes(".typing-icon::before") &&
            !popupCss.includes(".story-icon::before"),
        "Popup controls should use reusable SVG feature icons instead of CSS-drawn placeholders",
    );

    for (const file of issueTemplateFiles) {
        assert(
            fs.existsSync(file),
            `${file} should exist so users are guided before filing reports`,
        );
    }

    const issueTemplateConfig = fs.readFileSync(
        ".github/ISSUE_TEMPLATE/config.yml",
        "utf8",
    );
    assert(
        issueTemplateConfig.includes("blank_issues_enabled: false"),
        "GitHub blank issues should be disabled so users do not draft from scratch",
    );

    const forms = issueTemplateFiles
        .filter((file) => file.endsWith(".yml") && !file.endsWith("config.yml"))
        .map((file) => fs.readFileSync(file, "utf8"));
    for (const name of issueTemplateNames) {
        assert(
            forms.some((form) => form.includes(name)),
            `Guided issue chooser should include the action label "${name}"`,
        );
    }
    assert(
        !fs.existsSync(".github/ISSUE_TEMPLATE/platform_update.yml"),
        "Guided issue chooser should avoid extra overlapping issue types beyond bug, idea, feedback, and question",
    );
    const directHelpForm = fs.readFileSync(
        ".github/ISSUE_TEMPLATE/help_feedback.yml",
        "utf8",
    );
    const bugReportForm = fs.readFileSync(
        ".github/ISSUE_TEMPLATE/bug_report.yml",
        "utf8",
    );
    assert(
        directHelpForm.includes("name: Help & feedback") &&
            directHelpForm.includes("Report a bug") &&
            directHelpForm.includes("Share an idea") &&
            directHelpForm.includes("Share feedback") &&
            directHelpForm.includes("Ask a question") &&
            directHelpForm.includes(`placeholder: "${directHelpPlaceholder}"`),
        "Popup direct Help & feedback form should guide users into bug, idea, feedback, or question paths",
    );
    assert(
        forms.every(
            (form) =>
                form.includes("type: dropdown") &&
                form.includes("type: textarea") &&
                form.includes("id: public-thanks") &&
                form.includes("Thank-you credit preview:") &&
                form.includes(
                    "Do not include private messages, credentials, or account-sensitive details",
                ) &&
                form.includes(
                    "Can we thank you publicly if this helps Ghostify?",
                ) &&
                form.includes(
                    "Yes means we can credit your GitHub name and avatar in release notes and on the Ghostify website.",
                ) &&
                form.includes("- Yes, name and avatar") &&
                form.includes("- No thanks") &&
                !form.includes("- GitHub username only"),
        ),
        "Guided issue forms should collect structured details and public-thanks consent with a clear two-option thank-you credit",
    );
    assert(
        forms.every(
            (form) => !/^\s*placeholder:\s+[^"|\n][^\n]*:\s/m.test(form),
        ),
        "Guided issue forms should quote colon-containing placeholder text so GitHub does not reject the YAML",
    );
    assert(
        !directHelpForm.includes("type: upload") &&
            directHelpForm.includes("id: attachments") &&
            directHelpForm.includes("Screenshots or screen recording links") &&
            directHelpForm.includes(
                "Do not include private messages, credentials, or account-sensitive details",
            ) &&
            directHelpForm.includes(
                "Remove private messages, credentials, and account-sensitive details first",
            ) &&
            bugReportForm.includes("id: attachments") &&
            bugReportForm.includes("Screenshots or screen recording links") &&
            bugReportForm.includes(
                "Do not include private messages, credentials, or account-sensitive details",
            ) &&
            !bugReportForm.includes("type: upload"),
        "Guided bug and feedback forms should explain how to attach safe screenshots or videos without using unsupported issue-form upload fields",
    );
    assert(
        directHelpForm.includes("type: textarea") &&
            directHelpForm.includes("id: attachments") &&
            directHelpForm.includes("short video") &&
            bugReportForm.includes("id: attachments"),
        "Guided bug and feedback forms should keep a screenshot/video attachment field",
    );
}

function testLocalStatusCheckerIsRemovedFromPopupRuntime() {
    const popupSource = fs.readFileSync("dist/js/popup.js", "utf8");
    const contentSource = fs.readFileSync("src/content.js", "utf8");
    const ghostSource = fs.readFileSync("src/ghost.js", "utf8");

    for (const source of [popupSource, contentSource, ghostSource]) {
        assert(
            !source.includes("GHOSTIFY_STATUS_CHECK") &&
                !source.includes("GHOSTIFY_STATUS_REQUEST") &&
                !source.includes("GHOSTIFY_STATUS_RESPONSE") &&
                !source.includes("createStatusSnapshot"),
            "Popup and runtime code should not keep the removed local Ghostify-loaded checker",
        );
    }
}

function testPopupPublicStatusSummaryUsesWorkingProofDate() {
    const popupSource = fs.readFileSync("dist/js/popup.js", "utf8");
    const context = {
        console,
        Date,
        Intl,
        setTimeout,
        clearTimeout,
        window: null,
        chrome: {
            runtime: {
                getManifest: () => ({ version: pkg.version }),
                lastError: null,
            },
            storage: {
                local: {
                    get() {},
                    set() {},
                },
            },
        },
        document: {
            addEventListener() {},
            querySelectorAll() {
                return [];
            },
            getElementById() {
                return null;
            },
        },
    };
    context.window = context;
    vm.runInNewContext(popupSource, context, { filename: "popup.js" });

    const currentStatus = JSON.parse(
        fs.readFileSync("site/src/app/statusData.json", "utf8"),
    );
    const latestHistoryDate = new Date(
        `${currentStatus.history[0].date}T00:00:00Z`,
    );
    const compactHistoryDate = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    }).format(latestHistoryDate);
    const longHistoryDate = new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    }).format(latestHistoryDate);
    const latestVerificationRecord = currentStatus.history.find(
        (record) =>
            record.eventType !== "release" && record.eventType !== "fix",
    );
    const expectedTone =
        currentStatus.release.matchesVerificationBuild &&
        ["maintainer_verified", "community_verified_reviewed"].includes(
            latestVerificationRecord.publicStatus,
        )
            ? "verified"
            : "review";
    assert.strictEqual(
        context.summarizePublicStatus(currentStatus),
        compactHistoryDate,
        "Popup should show the date from the latest committed status record",
    );
    assert.strictEqual(
        context.getPublicStatusTone(currentStatus),
        expectedTone,
        "Popup tone should follow the latest status record for the published Store build",
    );
    assert.strictEqual(
        context.getPublicStatusDescription(currentStatus),
        latestVerificationRecord.title,
        "Popup status tooltip should use the latest public JSON title",
    );
    assert(
        !context
            .getPublicStatusDescription(currentStatus)
            .includes(compactHistoryDate) &&
            !context
                .getPublicStatusDescription(currentStatus)
                .includes(longHistoryDate),
        "Popup status tooltip should not repeat the compact status date",
    );

    const workingEntry = {
        publicStatus: "maintainer_verified",
        verifiedAt: "2026-06-27T00:00:00Z",
    };
    const workingData = {
        schemaVersion: 1,
        productVersion: pkg.version,
        release: { matchesVerificationBuild: true },
        history: [
            {
                date: "2026-06-27",
                publicStatus: "maintainer_verified",
            },
        ],
        entries: Array.from({ length: 9 }, () => ({ ...workingEntry })),
    };

    assert.strictEqual(
        context.summarizePublicStatus(
            workingData,
            new Date("2026-06-27T12:00:00Z"),
        ),
        "Jun 27",
        "Popup green state should show only the month and day of the latest proof",
    );
    assert.strictEqual(
        context.summarizePublicStatus(
            workingData,
            new Date("2026-06-28T12:00:00Z"),
        ),
        "Jun 27",
        "Popup proof date should stay compact and omit the year",
    );
    assert.strictEqual(
        context.getPublicStatusTone(
            workingData,
            new Date("2026-06-28T12:00:00Z"),
        ),
        "verified",
        "Current reviewed proof should use the green status tone",
    );
    assert.strictEqual(
        context.getPublicStatusTone({
            ...workingData,
            release: { matchesVerificationBuild: false },
        }),
        "review",
        "A verified record for a build that differs from the Store build must not render green",
    );
    assert.strictEqual(
        context.getPublicStatusTone({
            ...workingData,
            history: [
                { date: "2026-06-20", publicStatus: "under_review" },
                { date: "2026-06-27", publicStatus: "maintainer_verified" },
            ],
        }),
        "review",
        "The first merged history record must remain authoritative even when its display date is older",
    );
    assert.strictEqual(
        context.getPublicStatusTone({
            ...workingData,
            history: [{ date: "2026-07-12", publicStatus: "under_review" }],
        }),
        "review",
        "A later report or review record should use the yellow tone",
    );
    assert.strictEqual(
        context.summarizePublicStatus({
            ...workingData,
            history: [{ date: "2026-07-12", publicStatus: "known_issue" }],
        }),
        "Jul 12",
        "A report record should show its month and day instead of a generic Review label",
    );
    assert.strictEqual(
        context.getPublicStatusTone({
            ...workingData,
            history: [{ date: "2026-07-12", publicStatus: "known_issue" }],
        }),
        "review",
        "Confirmed reports should also use the yellow report tone",
    );
}

async function testPopupFetchFailureDoesNotClaimWorking() {
    const popupSource = fs.readFileSync("dist/js/popup.js", "utf8");
    const classNames = new Set();
    const summaryElement = { textContent: "" };
    const tooltipElement = { textContent: "" };
    const linkElement = {
        dataset: {},
        attributes: new Map(),
        classList: {
            add(name) {
                classNames.add(name);
            },
            remove(name) {
                classNames.delete(name);
            },
            contains(name) {
                return classNames.has(name);
            },
        },
        setAttribute(name, value) {
            this.attributes.set(name, value);
        },
        getAttribute(name) {
            return this.attributes.get(name) || null;
        },
    };
    const context = {
        console,
        Date,
        Intl,
        Promise,
        setTimeout,
        clearTimeout,
        XMLHttpRequest: class {
            open() {}
            send() {
                this.onerror();
            }
        },
        window: null,
        chrome: {
            runtime: {
                getManifest: () => ({ version: pkg.version }),
                lastError: null,
            },
            storage: {
                local: {
                    get() {},
                    set() {},
                },
            },
        },
        document: {
            addEventListener() {},
            querySelectorAll() {
                return [];
            },
            getElementById(id) {
                if (id === "public-status-summary") return summaryElement;
                if (id === "public-status-link") return linkElement;
                if (id === "public-status-tooltip") return tooltipElement;
                return null;
            },
        },
    };
    context.window = context;
    vm.runInNewContext(popupSource, context, { filename: "popup.js" });

    await context.updatePublicStatusSummary();

    assert.strictEqual(
        summaryElement.textContent,
        "Review",
        "Popup should show a neutral compact fallback when the public status feed cannot load",
    );
    assert(
        !summaryElement.textContent.toLowerCase().includes("working") &&
            !linkElement
                .getAttribute("aria-label")
                .toLowerCase()
                .includes("working"),
        "Popup fetch failures must not claim the controls are working",
    );
    assert(
        linkElement.classList.contains("is-fallback"),
        "Popup should mark the public-status link as fallback on fetch failure",
    );
    assert.strictEqual(
        linkElement.dataset.status,
        "review",
        "Popup fetch failures should use the yellow review tone",
    );
    assert.strictEqual(
        tooltipElement.textContent,
        "Public status details are temporarily unavailable.",
        "Popup status tooltip should remain honest when the public feed cannot load",
    );
}

(async () => {
    testPopupMessengerSeenWarningRemoved();
    testPopupSupportLinksUseGuidedIssueForms();
    testLocalStatusCheckerIsRemovedFromPopupRuntime();
    testPopupPublicStatusSummaryUsesWorkingProofDate();
    await testPopupFetchFailureDoesNotClaimWorking();
    console.log("popup contract regression tests passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
