// Deployment settings for the public site (site/vercel.json and
// site/vite.config.ts): an uncached status feed and approved security headers.

const { fail } = require("./assertions");

function assertStatusFeedDisablesCaching(siteHeaders, siteViteConfig) {
    const statusRoute = siteHeaders.headers?.find(
        (route) => route.source === "/status.json",
    );
    const cacheHeader = statusRoute?.headers?.find(
        (header) => header.key.toLowerCase() === "cache-control",
    );
    if (cacheHeader?.value !== "no-store") {
        fail(
            "site/vercel.json must serve /status.json with Cache-Control: no-store",
        );
    }
    if (
        !siteViteConfig.includes(
            "response.setHeader('Cache-Control', 'no-store')",
        )
    ) {
        fail(
            "site/vite.config.ts must serve /status.json with Cache-Control: no-store",
        );
    }
}

function assertSiteSecurityHeaders(siteHeaders) {
    const siteRoute = siteHeaders.headers?.find(
        (route) => route.source === "/(.*)",
    );
    const headerMap = new Map(
        (siteRoute?.headers || []).map((header) => [
            header.key.toLowerCase(),
            header.value,
        ]),
    );
    const requiredHeaders = {
        "content-security-policy":
            "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy":
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    };

    for (const [key, expectedValue] of Object.entries(requiredHeaders)) {
        const actualValue = headerMap.get(key);
        if (actualValue !== expectedValue) {
            fail(`site/vercel.json must set ${key} to the approved value`);
        }
    }
}

module.exports = {
    assertSiteSecurityHeaders,
    assertStatusFeedDisablesCaching,
};
