const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['src/ghost.js'],
    bundle: true,
    outfile: 'dist/js/ghost.js',
    minify: false,
    format: 'iife',
    target: ['chrome89'],
    logLevel: 'info',
}).catch(() => process.exit(1));

esbuild.build({
    entryPoints: ['src/content.js'],
    bundle: true,
    outfile: 'dist/js/content.js',
    minify: false,
    format: 'iife',
    target: ['chrome89'],
    logLevel: 'info',
}).catch(() => process.exit(1));

esbuild.build({
    entryPoints: ['src/background.js'],
    bundle: true,
    outfile: 'dist/background.js',
    minify: false,
    format: 'iife',
    target: ['chrome89'],
    logLevel: 'info',
}).catch(() => process.exit(1));

esbuild.build({
    entryPoints: ['src/messenger_patch.js'],
    bundle: true,
    outfile: 'dist/js/messenger_patch.js',
    minify: false,
    format: 'iife',
    target: ['chrome89'],
    logLevel: 'info',
}).catch(() => process.exit(1));
