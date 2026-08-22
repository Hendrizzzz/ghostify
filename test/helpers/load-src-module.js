const Module = require("module");
const path = require("path");
const esbuild = require("esbuild");

function loadSrcModule(relativePath) {
    const absolutePath = path.resolve(__dirname, "..", "..", relativePath);
    const result = esbuild.buildSync({
        entryPoints: [absolutePath],
        bundle: true,
        platform: "node",
        format: "cjs",
        write: false,
        logLevel: "silent",
    });
    const compiled = new Module(absolutePath, module.parent);
    compiled.filename = absolutePath;
    compiled.paths = Module._nodeModulePaths(path.dirname(absolutePath));
    compiled._compile(result.outputFiles[0].text, absolutePath);
    return compiled.exports;
}

module.exports = { loadSrcModule };
