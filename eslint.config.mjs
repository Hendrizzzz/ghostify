import js from "@eslint/js";
import globals from "globals";

export default [
    {
        ignores: [
            "dist/**",
            "tmp/**",
            "site/**",
            "browser-targets/**",
            "screenshots/**",
        ],
    },
    js.configs.recommended,
    {
        files: ["src/**/*.js", "scripts/**/*.js", "test/**/*.js", "build.js"],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.webextensions,
            },
        },
        rules: {
            "no-empty": ["error", { allowEmptyCatch: true }],
            "no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", caughtErrors: "none" },
            ],
        },
    },
    {
        // The regression corpus keeps archival helpers by design and uses
        // deliberate denormal number literals for f64/i64 watermark tests.
        files: ["test/**/*.js"],
        rules: {
            "no-unused-vars": "off",
            "no-loss-of-precision": "off",
        },
    },
];
