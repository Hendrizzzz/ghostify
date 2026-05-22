const esbuild = require('esbuild');

const builds = [
    {
        entryPoints: ['src/ghost.js'],
        outfile: 'dist/js/ghost.js'
    },
    {
        entryPoints: ['src/content.js'],
        outfile: 'dist/js/content.js'
    },
    {
        entryPoints: ['src/background.js'],
        outfile: 'dist/background.js'
    },
    {
        entryPoints: ['src/messenger_patch.js'],
        outfile: 'dist/js/messenger_patch.js'
    }
];

Promise.all(builds.map(options => esbuild.build({
    ...options,
    bundle: true,
    minify: false,
    format: 'iife',
    target: ['chrome89'],
    logLevel: 'info'
}))).catch(() => process.exit(1));
