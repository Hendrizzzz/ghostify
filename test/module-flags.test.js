const assert = require("assert");
const { loadSrcModule } = require("./helpers/load-src-module");

const { assertFreeCoreRemotePolicy, validateFreeCoreRemotePolicy } =
    loadSrcModule("src/modules/registry.js");

assert.strictEqual(
    assertFreeCoreRemotePolicy({
        schemaVersion: 1,
        disabledModules: ["ghostMode"],
        limitOverrides: { diagnosticEventLimit: 100 },
        copy: { status: "Privacy controls are temporarily unavailable." },
    }),
    true,
);

function assertPolicyRejected(policy, pattern) {
    const errors = validateFreeCoreRemotePolicy(policy);
    assert(errors.length, "remote policy should be rejected");
    assert.match(errors.join("; "), pattern);
    assert.throws(() => assertFreeCoreRemotePolicy(policy), pattern);
}

assertPolicyRejected(
    {
        schemaVersion: 1,
        enabledModules: ["ghostMode"],
    },
    /enabledModules/,
);

assertPolicyRejected(
    {
        schemaVersion: 1,
        disabledModules: ["futureModule"],
    },
    /unknown module/,
);

for (const blockedField of [
    "selectors",
    "matchers",
    "actionRules",
    "scripts",
    "templates",
]) {
    assertPolicyRejected(
        {
            schemaVersion: 1,
            [blockedField]: ["body"],
        },
        new RegExp(blockedField),
    );
}

assertPolicyRejected(
    {
        schemaVersion: 1,
        disabledModules: ["ghostMode"],
        copy: { status: "<script>alert(1)</script>" },
    },
    /plain text/,
);

assertPolicyRejected(
    {
        schemaVersion: 1,
        disabledModules: ["ghostMode"],
        copy: { status: "javascript:alert(1)" },
    },
    /plain text/,
);

assertPolicyRejected(
    {
        schemaVersion: 1,
        disabledModules: ["ghostMode"],
        copy: { status: { text: "Nested copy is not a plain string." } },
    },
    /must be a string/,
);

assertPolicyRejected(
    {
        schemaVersion: 2,
        disabledModules: ["ghostMode"],
    },
    /schemaVersion/,
);

console.log("module remote-flag boundary tests passed");
