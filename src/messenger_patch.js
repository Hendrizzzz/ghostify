(function () {
    'use strict';
    const isMessenger = window.location.hostname.includes('messenger.com') ||
        window.location.hostname.includes('facebook.com');
    if (!isMessenger) return;
    if (window.__GHOSTIFY_MESSENGER_PATCH__) return;
    window.__GHOSTIFY_MESSENGER_PATCH__ = true;

    window.__GHOSTIFY_SETTINGS__ = window.__GHOSTIFY_SETTINGS__ || {
        msgTyping: true
    };

    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data.type === 'GHOSTIFY_SETTINGS_UPDATE') {
            window.__GHOSTIFY_SETTINGS__ = event.data.settings;
        }
    });

    window.__ghostify_noop__ = function () { };

    window.__ghostifyFnCache__ = window.__ghostifyFnCache__ || {};

    function getFunctionBody(fnString) {
        return fnString.slice(fnString.indexOf('{') + 1, fnString.lastIndexOf('}')) || '';
    }

    function getFunctionParams(fnString) {
        const noComments = fnString.replace(/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm, '');
        const paramString = noComments.slice(noComments.indexOf('(') + 1, noComments.indexOf(')'));
        const params = paramString.match(/([^\s,]+)/g);
        return params || [];
    }

    function recreateFunctionFromSource(fnString) {
        const body = getFunctionBody(fnString);
        const params = getFunctionParams(fnString);
        const fnId = 'ghostify_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const scriptContent = `window.__ghostifyFnCache__["${fnId}"] = function(${params.join(', ')}) { ${body} }`;
        const script = document.createElement('script');
        try {
            script.appendChild(document.createTextNode(scriptContent));
        } catch (e) {
            script.text = scriptContent;
        }
        const head = document.head || document.documentElement;
        head.appendChild(script);
        head.removeChild(script);
        const recreatedFn = window.__ghostifyFnCache__[fnId];
        delete window.__ghostifyFnCache__[fnId];
        return recreatedFn;
    }

    function wrapFunction(originalFn, wrapper) {
        const wrapped = function (...args) {
            return wrapper.call(this, originalFn, args);
        };
        try {
            Object.getOwnPropertyNames(originalFn).forEach(prop => {
                if (prop.startsWith('__')) {
                    Object.defineProperty(wrapped, prop, {
                        value: originalFn[prop],
                        writable: false,
                        enumerable: false,
                        configurable: true
                    });
                }
            });
        } catch (e) { }
        return wrapped;
    }

    const sourceReplacements = {};
    const exportCallbacks = {};
    const processedModules = new Set();

    function registerSourceReplacement(moduleName, transformer) {
        sourceReplacements[moduleName] = sourceReplacements[moduleName] || [];
        sourceReplacements[moduleName].push(transformer);
    }

    function registerExportCallback(moduleName, callback) {
        exportCallbacks[moduleName] = exportCallbacks[moduleName] || [];
        exportCallbacks[moduleName].push(callback);
    }

    registerSourceReplacement('MAWSecureTypingState', (source) => {
        if (window.__GHOSTIFY_SETTINGS__?.msgTyping) {
            return source.replaceAll('sendChatStateFromComposer', 'window.__ghostify_noop__');
        } else {
            return source;
        }
    });

    registerExportCallback('LSSendTypingIndicator', (factoryArgs) => {
        const moduleObj = factoryArgs[4];
        if (!moduleObj || !moduleObj.exports) return;
        const exports = moduleObj.exports;
        if (exports.default && typeof exports.default === 'function') {
            const original = exports.default;
            exports.default = wrapFunction(original, function (origFn, args) {
                if (window.__GHOSTIFY_SETTINGS__?.msgTyping) {
                    if (args.length >= 3) args[2] = false;
                }
                return origFn.apply(this, args);
            });
        }
    });

    registerExportCallback('LSSendTypingIndicatorStoredProcedure', (factoryArgs) => {
        const moduleObj = factoryArgs[4];
        if (!moduleObj || !moduleObj.exports) return;
        const exports = moduleObj.exports;
        if (exports.default && typeof exports.default === 'function') {
            const original = exports.default;
            exports.default = wrapFunction(original, function (origFn, args) {
                if (window.__GHOSTIFY_SETTINGS__?.msgTyping) {
                    if (args.length >= 3) args[2] = false;
                }
                return origFn.apply(this, args);
            });
        }
    });

    function applySourceReplacements(factory, moduleName) {
        for (const [pattern, transformers] of Object.entries(sourceReplacements)) {
            if (moduleName.includes(pattern)) {
                let source = factory.toString();
                let modified = false;
                for (const transformer of transformers) {
                    const newSource = transformer(source);
                    if (newSource !== source) {
                        source = newSource;
                        modified = true;
                    }
                }
                if (modified) {
                    try {
                        const recreated = recreateFunctionFromSource(source);
                        if (typeof recreated === 'function') {
                            return recreated;
                        }
                    } catch (e) {
                    }
                }
            }
        }
        return factory;
    }

    function applyExportCallbacks(factoryArgs, moduleName) {
        for (const [pattern, callbacks] of Object.entries(exportCallbacks)) {
            if (moduleName.includes(pattern)) {
                for (const callback of callbacks) {
                    try {
                        callback(factoryArgs);
                    } catch (e) {
                    }
                }
            }
        }
    }

    function shouldProcessModule(moduleName) {
        return Object.keys(sourceReplacements).some(p => moduleName.includes(p)) ||
            Object.keys(exportCallbacks).some(p => moduleName.includes(p));
    }

    function setupModuleInterceptor() {
        let originalDefine = window.__d;

        const createProxy = (target) => {
            return new Proxy(target, {
                apply: (fn, thisArg, args) => {
                    const moduleName = args[0];
                    if (typeof moduleName === 'string' && !processedModules.has(moduleName)) {
                        if (shouldProcessModule(moduleName)) {
                            processedModules.add(moduleName);
                            const originalFactory = args[2];
                            let factory = applySourceReplacements(originalFactory, moduleName);
                            const needsExportCallback = Object.keys(exportCallbacks).some(p => moduleName.includes(p));
                            if (needsExportCallback) {
                                const patchedFactory = factory;
                                factory = function (...factoryArgs) {
                                    const result = patchedFactory.apply(this, factoryArgs);
                                    applyExportCallbacks(factoryArgs, moduleName);
                                    return result;
                                };
                            }
                            args[2] = factory;
                        }
                    }
                    return fn.apply(thisArg, args);
                }
            });
        };

        if (window.__d) {
            if (window.__d.toString().indexOf('__d_stub') !== -1) {
                delete window.__d;
            } else {
                originalDefine = createProxy(window.__d);
            }
        }

        Object.defineProperty(window, '__d', {
            get: function () { return originalDefine; },
            set: function (newValue) { originalDefine = createProxy(newValue); },
            configurable: true
        });
    }

    setupModuleInterceptor();
})();
