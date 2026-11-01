const assert = require("assert");

const {
    SAFE_READ_WATERMARK,
    makeMessengerPatchPage,
    registerMessengerModule,
    registerMessengerModuleWithDependencies,
} = require("../helpers/regression-harness");

function registerFacebookOptimisticMarkThreadReadFixture(
    context,
    options = {},
) {
    const dependencyName = options.dependencyName || "LSIssueNewTask";
    const consumerName = options.consumerName || "LSOptimisticMarkThreadReadV2";
    const nativeThis = Object.freeze({ contract: "native-leaf-this" });
    const nativeResult = Object.freeze({ contract: "native-leaf-result" });
    const nativeCalls = [];
    const localReadCalls = [];
    const parentReadCalls = [];
    const pendingTasks = [];
    const forwardedSends = [];
    const zero = Object.freeze([0, 0]);
    let taskArgs;
    const nativeLeaf = function () {
        const args = Array.from(arguments);
        nativeCalls.push({ args, thisArg: this });
        if (options.taskError) throw options.taskError;
        pendingTasks.push({ queue: args[0], label: args[1], payload: args[2] });
        const runtime = args.at(-1);
        return typeof runtime?.resolve === "function"
            ? runtime.resolve([])
            : nativeResult;
    };
    const localRead = function (watermark, threadKey, runtime) {
        localReadCalls.push({
            args: [watermark, threadKey, runtime],
            thisArg: this,
            lastReadWatermarkTimestampMs: watermark,
            unreadMessageCount: 0,
        });
        return runtime.resolve([]);
    };
    const tables = Object.freeze(["tasks"]);
    Object.defineProperties(nativeLeaf, {
        __sproc_name__: {
            configurable: true,
            value: "LSIssueNewTaskStoredProcedure",
        },
        __tables__: {
            configurable: true,
            value: tables,
        },
    });
    let requiredLeaf;
    let requiredSibling;
    let secondaryRequire;
    let tertiaryRequire;
    let storedProcedureLeaf;
    const module = registerMessengerModuleWithDependencies(
        context,
        consumerName,
        ["LSMarkThreadRead", dependencyName],
        {
            LSMarkThreadRead: localRead,
            [dependencyName]: nativeLeaf,
        },
        function (
            _a,
            require,
            requireSecondary,
            requireTertiary,
            moduleObject,
        ) {
            secondaryRequire = requireSecondary;
            tertiaryRequire = requireTertiary;
            moduleObject.exports = function optimisticMarkThreadRead(
                threadKey,
                watermark,
                runtime,
                leafRuntime = runtime,
            ) {
                // The live consumer first updates local read state, then creates
                // a label-21 task. Merely requiring the task leaf misses the
                // queue-blocking behavior that originally escaped this fixture.
                requiredLeaf = require(dependencyName);
                requiredSibling = require("LSMarkThreadRead");
                taskArgs = [
                    options.queueName ?? threadKey.join(":"),
                    options.taskLabel ?? Object.freeze([0, 21]),
                    JSON.stringify({
                        thread_id: threadKey,
                        last_read_watermark_ts: watermark,
                        sync_group: 104,
                    }),
                    undefined,
                    undefined,
                    zero,
                    zero,
                    undefined,
                    undefined,
                    zero,
                    zero,
                    leafRuntime,
                ];
                return runtime.seq([
                    () =>
                        runtime.storedProcedure(
                            requiredSibling,
                            watermark,
                            threadKey,
                            runtime,
                        ),
                    () => parentReadCalls.push({ threadKey, watermark }),
                    () => runtime.storedProcedure(requiredLeaf, ...taskArgs),
                    () => runtime.resolve([]),
                ]);
            };
        },
    );

    const createRuntime = (leafRuntime = undefined) => {
        const resolveCalls = [];
        const runtimeResult = nativeResult;
        const runtime = {
            resolve(value) {
                resolveCalls.push(value);
                return runtimeResult;
            },
            seq(steps) {
                let result;
                for (const step of steps) result = step();
                return result;
            },
            storedProcedure(leaf, ...args) {
                if (leaf === requiredLeaf) {
                    storedProcedureLeaf = leaf;
                    if (leafRuntime !== undefined)
                        args[args.length - 1] = leafRuntime;
                }
                return Reflect.apply(leaf, nativeThis, args);
            },
        };
        return { resolveCalls, runtime, runtimeResult };
    };

    return {
        createRuntime,
        get requiredLeaf() {
            return requiredLeaf;
        },
        get requiredSibling() {
            return requiredSibling;
        },
        localRead,
        localReadCalls,
        parentReadCalls,
        pendingTasks,
        forwardedSends,
        enqueueSend(threadKey) {
            pendingTasks.push({
                queue: threadKey.join(":"),
                label: [0, 46],
                payload: "fixture-send",
            });
        },
        flushQueue(threadKey) {
            // A dropped receipt receives no server acknowledgement. Later tasks
            // in its queue therefore remain pending; other queues can progress.
            const queue = threadKey.join(":");
            while (true) {
                const index = pendingTasks.findIndex(
                    (task) => task.queue === queue,
                );
                if (index < 0) return;
                const task = pendingTasks[index];
                if (task.label[1] === 21) return;
                pendingTasks.splice(index, 1);
                if (task.label[1] === 46) forwardedSends.push(task);
            }
        },
        get taskArgs() {
            return taskArgs;
        },
        module,
        nativeCalls,
        nativeLeaf,
        nativeResult,
        nativeThis,
        get secondaryRequire() {
            return secondaryRequire;
        },
        get storedProcedureLeaf() {
            return storedProcedureLeaf;
        },
        tables,
        get tertiaryRequire() {
            return tertiaryRequire;
        },
    };
}

function testFacebookAutomaticReadKeepsUnreadAndNativeHookExecution() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/messages/e2ee/t/fixture-thread",
        },
    );
    const fixture = registerFacebookOptimisticMarkThreadReadFixture(context);
    const threadKey = Object.freeze([135791357, 246802468]);
    const watermark = Object.freeze([1779530000, 417]);
    const { runtime, runtimeResult } = fixture.createRuntime();
    const hookResult = Object.freeze({ contract: "native-hook-result" });
    const hookThis = Object.freeze({ contract: "native-hook-this" });
    const callbackThis = Object.freeze({ contract: "native-callback-this" });
    const thread = Object.freeze({ threadKey });
    const hookCalls = [];
    const callbackCalls = [];
    const callback = function (...args) {
        callbackCalls.push({ args, thisArg: this });
        return fixture.module.exports(threadKey, watermark, runtime);
    };
    const nativeSibling = function useMAWMarkThreadAsRead() {};
    const nativeHook = function (thread, callback, enabled, options) {
        hookCalls.push({
            args: [thread, callback, enabled, options],
            thisArg: this,
        });
        return hookResult;
    };
    nativeHook.metadata = Object.freeze({ native: true });
    let requiredSibling;
    let requiredHook;
    const consumer = registerMessengerModuleWithDependencies(
        context,
        "useMWPSafelyMarkThreadAsRead",
        [
            "useMWMarkThreadAsReadWhenNewMessagesArrive",
            "useMAWMarkThreadAsRead",
        ],
        {
            useMWMarkThreadAsReadWhenNewMessagesArrive: nativeHook,
            useMAWMarkThreadAsRead: nativeSibling,
        },
        function (_a, _b, require, _d, moduleObject) {
            requiredSibling = require("useMAWMarkThreadAsRead");
            requiredHook = require("useMWMarkThreadAsReadWhenNewMessagesArrive");
            moduleObject.exports = function (...args) {
                return Reflect.apply(requiredHook, hookThis, args);
            };
        },
    );
    const options = Object.freeze({ native: true });
    assert.strictEqual(
        consumer.exports(thread, callback, true, options),
        hookResult,
    );
    const guardedCallback = hookCalls[0].args[1];
    assert.strictEqual(
        Reflect.apply(guardedCallback, callbackThis, ["automatic"]),
        undefined,
    );
    assert.strictEqual(
        fixture.localReadCalls.length,
        0,
        "automatic reads must preserve the local unread state with Hide Seen enabled",
    );
    assert.strictEqual(fixture.parentReadCalls.length, 0);
    assert.strictEqual(fixture.pendingTasks.length, 0);
    assert.strictEqual(callbackCalls.length, 0);
    assert.strictEqual(
        hookCalls.length,
        1,
        "native React hooks must still execute",
    );
    assert.strictEqual(hookCalls[0].thisArg, hookThis);
    assert.strictEqual(hookCalls[0].args[0], thread);
    assert.strictEqual(hookCalls[0].args[2], true);
    assert.strictEqual(hookCalls[0].args[3], options);
    assert.strictEqual(requiredSibling, nativeSibling);
    assert.strictEqual(requiredHook.metadata, nativeHook.metadata);
    assert.strictEqual(
        consumer.exports(thread, callback, true, options),
        hookResult,
    );
    assert.strictEqual(hookCalls[1].args[1], guardedCallback);
    fixture.enqueueSend(threadKey);
    fixture.flushQueue(threadKey);
    assert.strictEqual(fixture.forwardedSends.length, 1);

    // Explicit Mark as read keeps its local mutation and the existing enqueue guard.
    assert.strictEqual(
        fixture.module.exports(threadKey, watermark, runtime),
        runtimeResult,
    );
    assert.strictEqual(fixture.localReadCalls.length, 1);
    assert.strictEqual(fixture.parentReadCalls.length, 1);
    assert.strictEqual(fixture.nativeCalls.length, 0);
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_TASK_ENQUEUES__,
        1,
    );
    fixture.enqueueSend(threadKey);
    fixture.flushQueue(threadKey);
    assert.strictEqual(fixture.forwardedSends.length, 2);

    context.window.__GHOSTIFY_SETTINGS__.msgSeen = false;
    assert.strictEqual(
        Reflect.apply(guardedCallback, callbackThis, ["settings-off"]),
        runtimeResult,
    );
    assert.deepStrictEqual(callbackCalls[0], {
        args: ["settings-off"],
        thisArg: callbackThis,
    });
    assert.strictEqual(fixture.localReadCalls.length, 2);
    assert.strictEqual(fixture.nativeCalls.length, 1);

    context.window.__GHOSTIFY_SETTINGS__.msgSeen = true;
    context.window.location.pathname = "/messages/requests";
    Reflect.apply(guardedCallback, callbackThis, ["request"]);
    assert.strictEqual(fixture.localReadCalls.length, 3);
    assert.strictEqual(fixture.nativeCalls.length, 2);

    context.window.location.pathname = "/messages/e2ee/t/fixture-thread";
    context.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: ["msgSeen"] },
    });
    Reflect.apply(guardedCallback, callbackThis, ["kill-switch"]);
    assert.strictEqual(fixture.localReadCalls.length, 4);
    assert.strictEqual(fixture.nativeCalls.length, 3);

    context.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: [] },
    });
    context.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ =
        Date.now() + 5000;
    Reflect.apply(guardedCallback, callbackThis, ["request-grace"]);
    assert.strictEqual(fixture.localReadCalls.length, 5);
    context.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ = Date.now() - 1;
    Reflect.apply(guardedCallback, callbackThis, ["grace-expired"]);
    assert.strictEqual(fixture.localReadCalls.length, 5);

    assert.strictEqual(
        consumer.exports(thread, undefined, true, options),
        hookResult,
    );
    assert.strictEqual(hookCalls.at(-1).args[1], undefined);
}

async function testFacebookOptimisticReadReceiptEnqueueDoesNotStallSend() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const fixture = registerFacebookOptimisticMarkThreadReadFixture(context);
    const threadKey = Object.freeze([135791357, 246802468]);
    const watermark = Object.freeze([1779530000, 417]);
    const { resolveCalls, runtime, runtimeResult } = fixture.createRuntime();

    const result = fixture.module.exports(threadKey, watermark, runtime);
    fixture.enqueueSend(threadKey);
    fixture.flushQueue(threadKey);

    assert.strictEqual(
        fixture.forwardedSends.length,
        1,
        "a suppressed receipt must never occupy the local task queue ahead of a send",
    );
    assert.strictEqual(fixture.pendingTasks.length, 0);

    assert.strictEqual(
        result,
        runtimeResult,
        "the consumer must preserve the Lightspeed runtime return contract",
    );
    assert.strictEqual(
        resolveCalls.length,
        3,
        "local mutation, suppressed enqueue, and consumer completion must resolve",
    );
    assert.ok(
        Array.isArray(resolveCalls[0]),
        "the neutral leaf must resolve the native empty-array result shape",
    );
    assert.strictEqual(resolveCalls[0].length, 0);
    assert.strictEqual(
        fixture.nativeCalls.length,
        0,
        "the receipt must be suppressed before native task creation",
    );
    assert.strictEqual(fixture.localReadCalls.length, 1);
    assert.strictEqual(fixture.parentReadCalls.length, 1);
    assert.strictEqual(fixture.localReadCalls[0].unreadMessageCount, 0);
    assert.strictEqual(
        fixture.localReadCalls[0].lastReadWatermarkTimestampMs,
        watermark,
    );
    assert.strictEqual(fixture.localReadCalls[0].thisArg, fixture.nativeThis);
    assert.deepStrictEqual(fixture.localReadCalls[0].args, [
        watermark,
        threadKey,
        runtime,
    ]);
    assert.notStrictEqual(
        fixture.storedProcedureLeaf,
        fixture.nativeLeaf,
        "only the exact consumer must receive a task enqueue shadow",
    );
    assert.strictEqual(
        fixture.storedProcedureLeaf.name,
        fixture.nativeLeaf.name,
    );
    assert.strictEqual(
        fixture.storedProcedureLeaf.length,
        fixture.nativeLeaf.length,
    );
    assert.strictEqual(
        fixture.storedProcedureLeaf.__sproc_name__,
        fixture.nativeLeaf.__sproc_name__,
    );
    assert.strictEqual(fixture.storedProcedureLeaf.__tables__, fixture.tables);
    assert.strictEqual(
        fixture.requiredSibling,
        fixture.localRead,
        "LSMarkThreadRead must retain its native local state effects",
    );
    assert.strictEqual(
        fixture.secondaryRequire,
        fixture.tertiaryRequire,
        "the exact consumer must leave unrelated require slots untouched",
    );
    assert.strictEqual(
        fixture.secondaryRequire("LSIssueNewTask"),
        fixture.nativeLeaf,
        "unrelated require slots must retain the native task export",
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_TASK_ENQUEUES__ || 0,
        1,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0,
        0,
    );

    const asyncFixture = registerFacebookOptimisticMarkThreadReadFixture(
        makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/messages/t/fixture-thread",
                href: "https://www.facebook.com/messages/t/fixture-thread",
            },
        ),
    );
    const asyncRuntime = asyncFixture.createRuntime().runtime;
    asyncRuntime.resolve = (value) => Promise.resolve(value);
    asyncRuntime.seq = async (steps) => {
        let value;
        for (const step of steps) value = await step();
        return value;
    };
    const asyncResult = asyncFixture.module.exports(
        threadKey,
        watermark,
        asyncRuntime,
    );
    assert.strictEqual(typeof asyncResult.then, "function");
    assert.deepStrictEqual(await asyncResult, []);
    assert.strictEqual(asyncFixture.localReadCalls.length, 1);
    assert.strictEqual(asyncFixture.nativeCalls.length, 0);
}

function testFacebookTopFrameModuleInterceptorIsExactScopedForLoaderSafety() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const definitions = [];
    context.window.__d = function (moduleName, dependencies, factory) {
        definitions.push({ dependencies, factory, moduleName });
        return "registered";
    };

    const hydrationFactory = function nativeHydrationFactory() {
        return "hydrate";
    };
    const hydrationDependencies = [
        "LSUpdateThreadReadWatermark",
        "LSIssueNewTask",
    ];
    assert.strictEqual(
        context.window.__d(
            "MWThreadListHydration",
            hydrationDependencies,
            hydrationFactory,
        ),
        "registered",
    );
    assert.strictEqual(
        definitions[0].factory,
        hydrationFactory,
        "hydration factories must retain native identity",
    );
    assert.strictEqual(definitions[0].dependencies, hydrationDependencies);

    const broadReadFactory = function nativeBroadReadFactory() {
        return "read";
    };
    assert.strictEqual(
        context.window.__d("LSUpdateThreadReadWatermark", [], broadReadFactory),
        "registered",
    );
    assert.strictEqual(
        definitions[1].factory,
        broadReadFactory,
        "broad local-read factories must remain native",
    );

    const exactFactory = function exactOptimisticFactory() {
        return "exact";
    };
    assert.strictEqual(
        context.window.__d(
            "LSOptimisticMarkThreadReadV2",
            ["LSMarkThreadRead"],
            exactFactory,
        ),
        "registered",
    );
    assert.notStrictEqual(
        definitions[2].factory,
        exactFactory,
        "only the confirmed optimistic consumer may be wrapped",
    );

    const automaticFactory = function nativeAutomaticReadFactory() {};
    context.window.__d(
        "useMWMarkThreadAsReadWhenNewMessagesArrive",
        [],
        automaticFactory,
    );
    assert.strictEqual(definitions[3].factory, automaticFactory);
    context.window.__d(
        "useMWPSafelyMarkThreadAsReadAnalytics",
        ["useMWMarkThreadAsReadWhenNewMessagesArrive"],
        automaticFactory,
    );
    assert.strictEqual(
        definitions[4].factory,
        automaticFactory,
        "lookalike consumers must not receive an automatic-read guard",
    );
    context.window.__d(
        "useMWPSafelyMarkThreadAsRead",
        ["useMWMarkThreadAsReadWhenNewMessagesArrive"],
        automaticFactory,
    );
    assert.notStrictEqual(definitions[5].factory, automaticFactory);
}

function testFacebookOptimisticMarkThreadReadPreservesNativeBypasses() {
    const page = () => ({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    });
    const threadKey = Object.freeze([135791357, 246802468]);
    const watermark = Object.freeze([1779530000, 417]);
    const assertNative = (fixture, runtime, label) => {
        const result = fixture.module.exports(threadKey, watermark, runtime);
        assert.strictEqual(
            result,
            fixture.nativeResult,
            `${label} must preserve the native leaf result`,
        );
        assert.strictEqual(
            fixture.nativeCalls.length,
            1,
            `${label} must execute the native leaf exactly once`,
        );
        assert.strictEqual(
            fixture.nativeCalls[0].thisArg,
            fixture.nativeThis,
            `${label} must preserve native this`,
        );
        assert.deepStrictEqual(
            fixture.nativeCalls[0].args,
            fixture.taskArgs,
            `${label} must preserve the native enqueue argument order`,
        );
        assert.strictEqual(fixture.localReadCalls.length, 1);
        assert.strictEqual(fixture.parentReadCalls.length, 1);
    };

    const settingsOffContext = makeMessengerPatchPage(
        { msgSeen: false },
        page(),
    );
    const settingsOff =
        registerFacebookOptimisticMarkThreadReadFixture(settingsOffContext);
    assertNative(
        settingsOff,
        settingsOff.createRuntime().runtime,
        "settings-off behavior",
    );
    settingsOff.enqueueSend(threadKey);
    settingsOff.flushQueue(threadKey);
    assert.strictEqual(settingsOff.forwardedSends.length, 0);
    assert.strictEqual(settingsOff.pendingTasks.length, 2);
    const otherThreadKey = [246802468, 135791357];
    settingsOff.enqueueSend(otherThreadKey);
    settingsOff.flushQueue(otherThreadKey);
    assert.strictEqual(
        settingsOff.forwardedSends.length,
        1,
        "an unacknowledged receipt must stall only its own task queue",
    );

    const killedContext = makeMessengerPatchPage({}, page());
    const killed =
        registerFacebookOptimisticMarkThreadReadFixture(killedContext);
    killedContext.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: ["msgSeen"] },
    });
    assertNative(
        killed,
        killed.createRuntime().runtime,
        "kill-switched behavior",
    );

    const requestContext = makeMessengerPatchPage(
        {},
        {
            ...page(),
            pathname: "/messages/requests",
            href: "https://www.facebook.com/messages/requests",
        },
    );
    const request =
        registerFacebookOptimisticMarkThreadReadFixture(requestContext);
    assertNative(
        request,
        request.createRuntime().runtime,
        "Message Requests behavior",
    );

    const graceContext = makeMessengerPatchPage({}, page());
    const grace = registerFacebookOptimisticMarkThreadReadFixture(graceContext);
    graceContext.window.__GHOSTIFY_MESSAGE_REQUEST_NATIVE_UNTIL__ =
        Date.now() + 15000;
    assertNative(
        grace,
        grace.createRuntime().runtime,
        "Message Requests transition grace",
    );

    const invalidRuntimeContext = makeMessengerPatchPage({}, page());
    const invalidRuntime = registerFacebookOptimisticMarkThreadReadFixture(
        invalidRuntimeContext,
    );
    const outerRuntime = invalidRuntime.createRuntime(
        Object.freeze({ contract: "invalid-leaf-runtime" }),
    ).runtime;
    const invalidResult = invalidRuntime.module.exports(
        threadKey,
        watermark,
        outerRuntime,
    );
    assert.strictEqual(
        invalidResult,
        invalidRuntime.nativeResult,
        "an invalid injected runtime must fall back to the native leaf",
    );
    assert.strictEqual(invalidRuntime.nativeCalls.length, 1);
    assert.strictEqual(invalidRuntime.localReadCalls.length, 1);
    assert.strictEqual(
        invalidRuntime.nativeCalls[0].args.at(-1).contract,
        "invalid-leaf-runtime",
    );

    for (const taskLabel of [[0, 46], [1, 21], [21, 0], [0, 21, 0], 21, "21"]) {
        const fixture = registerFacebookOptimisticMarkThreadReadFixture(
            makeMessengerPatchPage({}, page()),
            { taskLabel },
        );
        assertNative(
            fixture,
            fixture.createRuntime().runtime,
            `non-receipt or unrecognized label ${JSON.stringify(taskLabel)}`,
        );
    }
    const emptyQueue = registerFacebookOptimisticMarkThreadReadFixture(
        makeMessengerPatchPage({}, page()),
        { queueName: "" },
    );
    assertNative(emptyQueue, emptyQueue.createRuntime().runtime, "empty queue");

    const nativeError = new Error("native enqueue failure");
    const throwing = registerFacebookOptimisticMarkThreadReadFixture(
        makeMessengerPatchPage({ msgSeen: false }, page()),
        { taskError: nativeError },
    );
    assert.throws(
        () =>
            throwing.module.exports(
                threadKey,
                watermark,
                throwing.createRuntime().runtime,
            ),
        (error) => error === nativeError,
        "native enqueue errors must retain their original identity",
    );
}

function testFacebookOptimisticMarkThreadReadShadowIsConsumerAndHostScoped() {
    const facebookPage = () => ({
        hostname: "www.facebook.com",
        pathname: "/",
        href: "https://www.facebook.com/",
        facebookMiniChatOpen: true,
    });
    const threadKey = Object.freeze([135791357, 246802468]);
    const watermark = Object.freeze([1779530000, 417]);
    const fixtures = [];

    fixtures.push({
        label: "suffix consumer",
        fixture: registerFacebookOptimisticMarkThreadReadFixture(
            makeMessengerPatchPage({}, facebookPage()),
            { consumerName: "LSOptimisticMarkThreadReadV2Analytics" },
        ),
    });
    fixtures.push({
        label: "suffix dependency",
        fixture: registerFacebookOptimisticMarkThreadReadFixture(
            makeMessengerPatchPage({}, facebookPage()),
            { dependencyName: "LSIssueNewTask.bs" },
        ),
    });
    fixtures.push({
        label: "Messenger.com",
        fixture: registerFacebookOptimisticMarkThreadReadFixture(
            makeMessengerPatchPage(
                {},
                {
                    hostname: "www.messenger.com",
                    pathname: "/t/redacted-thread",
                    href: "https://www.messenger.com/t/redacted-thread",
                },
            ),
        ),
    });
    fixtures.push({
        label: "MAW proxy",
        fixture: registerFacebookOptimisticMarkThreadReadFixture(
            makeMessengerPatchPage(
                {},
                {
                    hostname: "www.fbsbx.com",
                    pathname: "/maw_proxy_page/",
                    search: "?__cci=redacted",
                    href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
                },
            ),
        ),
    });

    const childContext = makeMessengerPatchPage({}, facebookPage());
    childContext.window.top = {};
    fixtures.push({
        label: "Facebook child frame",
        fixture: registerFacebookOptimisticMarkThreadReadFixture(childContext),
    });

    for (const { fixture, label } of fixtures) {
        const runtime = fixture.createRuntime().runtime;
        assert.strictEqual(
            fixture.module.exports(threadKey, watermark, runtime),
            fixture.nativeResult,
        );
        assert.strictEqual(
            fixture.nativeCalls.length,
            1,
            `${label} must keep the native leaf`,
        );
        assert.strictEqual(
            fixture.requiredLeaf,
            fixture.nativeLeaf,
            `${label} must not receive a shadow`,
        );
        assert.strictEqual(fixture.requiredSibling, fixture.localRead);
        assert.strictEqual(fixture.localReadCalls.length, 1);
    }
}

async function testFacebookOptimisticMarkThreadReadAdapterRemainsNative() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const optimisticProcedure = function () {
        return "native-optimistic-procedure";
    };
    const maybeExtractCalls = [];
    const synchronousPromise = {
        maybeExtractValueIfSynchronousPromise(value) {
            maybeExtractCalls.push(value);
            return value;
        },
    };
    let adapterCalls = 0;
    const module = registerMessengerModuleWithDependencies(
        context,
        "LSOptimisticMarkThreadReadV2StoredProcedure",
        [
            "LSOptimisticMarkThreadReadV2",
            "LSSynchronousPromise",
            "Promise",
            "cr:8709",
        ],
        {
            LSOptimisticMarkThreadReadV2: optimisticProcedure,
            LSSynchronousPromise: synchronousPromise,
            Promise,
        },
        function (
            _a,
            promiseRequire,
            optimisticRequire,
            syncRequire,
            _moduleObject,
            exportsObject,
        ) {
            exportsObject.default = function adapter(store, args) {
                adapterCalls += 1;
                const result = store.storedProcedure(
                    optimisticRequire("LSOptimisticMarkThreadReadV2"),
                    args.threadKey,
                    args.readWatermarkTimestampMs,
                );
                return promiseRequire("Promise").resolve(
                    syncRequire(
                        "LSSynchronousPromise",
                    ).maybeExtractValueIfSynchronousPromise(result),
                );
            };
        },
    );
    const threadKey = Object.freeze([135791357, 246802468]);
    const watermark = Object.freeze([1779530000, 417]);
    const nativeResolvedValue = Object.freeze([]);
    const storedProcedureCalls = [];
    const store = {
        storedProcedure() {
            storedProcedureCalls.push(Array.from(arguments));
            return nativeResolvedValue;
        },
    };

    const result = module.exports.default(store, {
        readWatermarkTimestampMs: watermark,
        threadKey,
    });
    assert.ok(
        result && typeof result.then === "function",
        "the adapter must retain its native Promise contract",
    );
    assert.strictEqual(
        await result,
        nativeResolvedValue,
        "the adapter must preserve its native resolved value",
    );
    assert.strictEqual(
        adapterCalls,
        1,
        "the native adapter orchestration must execute",
    );
    assert.deepStrictEqual(storedProcedureCalls[0], [
        optimisticProcedure,
        threadKey,
        watermark,
    ]);
    assert.deepStrictEqual(maybeExtractCalls, [nativeResolvedValue]);
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0,
        0,
    );

    const nativeError = new Error("native optimistic adapter rejection");
    const rejectingStore = {
        storedProcedure() {
            return Promise.reject(nativeError);
        },
    };
    await assert.rejects(
        module.exports.default(rejectingStore, {
            readWatermarkTimestampMs: watermark,
            threadKey,
        }),
        (error) => error === nativeError,
        "native adapter rejections must propagate unchanged",
    );
    assert.strictEqual(adapterCalls, 2);
}

function testFacebookUnprovenGroupReadLeavesPreserveNativeContracts() {
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);

    for (const moduleName of [
        "LSOptimisticMarkThreadReadV2",
        "LSMarkThreadRead",
    ]) {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
                facebookMiniChatOpen: true,
            },
        );
        let mutationCalls = 0;
        const state = { unread: true };
        const nativeResult = Object.freeze({ moduleName });
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (...args) {
                    mutationCalls += 1;
                    state.unread = false;
                    assert.deepStrictEqual(args, [
                        threadKeyI64,
                        watermarkI64,
                        95,
                    ]);
                    return nativeResult;
                };
            },
        );

        assert.strictEqual(
            module.exports.default(threadKeyI64, watermarkI64, 95),
            nativeResult,
        );
        assert.strictEqual(
            mutationCalls,
            1,
            `${moduleName} must preserve its unconfirmed native leaf contract`,
        );
        assert.strictEqual(
            state.unread,
            false,
            `${moduleName} must not be suppressed by an unproven alias`,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0,
            0,
        );

        context.window.__GHOSTIFY_SETTINGS__.msgSeen = false;
        assert.strictEqual(
            module.exports.default(threadKeyI64, watermarkI64, 95),
            nativeResult,
        );
        assert.strictEqual(
            mutationCalls,
            2,
            `${moduleName} remains native when Hide Seen is disabled`,
        );

        const requestContext = makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/messages/requests",
                href: "https://www.facebook.com/messages/requests",
                facebookMiniChatOpen: true,
            },
        );
        let requestCalls = 0;
        const requestModule = registerMessengerModule(
            requestContext,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function () {
                    requestCalls += 1;
                    return nativeResult;
                };
            },
        );
        assert.strictEqual(
            requestModule.exports.default(threadKeyI64, watermarkI64, 95),
            nativeResult,
        );
        assert.strictEqual(
            requestCalls,
            1,
            `${moduleName} must remain native for Message Requests`,
        );
    }
}

function testFacebookSendOpenMessageHooksForceNativeDisableMarkRead() {
    for (const moduleName of [
        "useMWV2SendOpenMessage",
        "useMWV2SendOpenMessageImpl",
        "useMWV2SendOpenMessageImplShared",
    ]) {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
                facebookMiniChatOpen: true,
            },
        );
        const nativeCallback = function () {
            return "opened";
        };
        const received = [];
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (options) {
                    received.push(options);
                    return nativeCallback;
                };
            },
        );
        const options = Object.freeze({
            disableMarkRead: false,
            entryPoint: "chat_list",
            thread: Object.freeze({
                threadKey: "redacted-thread",
                threadType: "GROUP",
            }),
        });

        const callback = module.exports.default(options);
        assert.strictEqual(
            callback,
            nativeCallback,
            `${moduleName} must preserve the native open callback identity`,
        );
        assert.strictEqual(callback(), "opened");
        assert.strictEqual(received.length, 1);
        assert.notStrictEqual(
            received[0],
            options,
            `${moduleName} must not mutate Facebook's frozen options object`,
        );
        assert.strictEqual(
            received[0].disableMarkRead,
            true,
            `${moduleName} must use Facebook's native disableMarkRead control`,
        );
        assert.strictEqual(received[0].thread, options.thread);
        assert.strictEqual(options.disableMarkRead, false);
    }

    for (const moduleName of [
        "useMWV2SendOpenMessage",
        "useMWV2SendOpenMessageImpl",
        "useMWV2SendOpenMessageImplShared",
    ]) {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: "www.facebook.com",
                pathname: "/",
                href: "https://www.facebook.com/",
                facebookMiniChatOpen: true,
            },
        );
        const received = [];
        const unrelatedCalls = [];
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports[moduleName] = function (options) {
                    received.push(options);
                    return "named-open";
                };
                moduleObject.exports.unrelated = function (options) {
                    unrelatedCalls.push(options);
                    return "unrelated";
                };
            },
        );
        const options = Object.freeze({ disableMarkRead: false });
        assert.strictEqual(module.exports[moduleName](options), "named-open");
        assert.notStrictEqual(received[0], options);
        assert.strictEqual(
            received[0].disableMarkRead,
            true,
            `${moduleName} exact named export must be patched`,
        );
        assert.strictEqual(module.exports.unrelated(options), "unrelated");
        assert.strictEqual(
            unrelatedCalls[0],
            options,
            `${moduleName} unrelated sibling export must remain native`,
        );
    }

    const groupContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    let receivedGroupOptions;
    const groupModule = registerMessengerModule(
        groupContext,
        "useMWV2SendOpenMessageImplShared",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) {
                receivedGroupOptions = options;
                return "group-opened";
            };
        },
    );
    const groupOptionsWithoutFlag = Object.freeze({
        entryPoint: "chat_list",
        thread: Object.freeze({
            threadKey: "redacted-group",
            threadType: "GROUP",
        }),
    });
    assert.strictEqual(
        groupModule.exports.default(groupOptionsWithoutFlag),
        "group-opened",
    );
    assert.notStrictEqual(
        receivedGroupOptions,
        groupOptionsWithoutFlag,
        "group options without an explicit flag must be cloned",
    );
    assert.strictEqual(
        receivedGroupOptions.disableMarkRead,
        true,
        "group opens must opt into Facebook native unread preservation",
    );
    assert.strictEqual(
        receivedGroupOptions.thread,
        groupOptionsWithoutFlag.thread,
    );
    assert.strictEqual(
        Object.prototype.hasOwnProperty.call(
            groupOptionsWithoutFlag,
            "disableMarkRead",
        ),
        false,
    );

    const shapeContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const shapeCalls = [];
    const shapeModule = registerMessengerModule(
        shapeContext,
        "useMWV2SendOpenMessage",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) {
                shapeCalls.push(options);
                return "shape-open";
            };
        },
    );
    class CustomOpenOptions {
        constructor() {
            this.disableMarkRead = false;
        }
        open() {
            return true;
        }
    }
    const customOptions = new CustomOpenOptions();
    assert.strictEqual(
        shapeModule.exports.default(customOptions),
        "shape-open",
    );
    assert.strictEqual(
        shapeCalls[0],
        customOptions,
        "custom-prototype options must remain native",
    );
    assert.strictEqual(shapeCalls[0].open(), true);
    const nullPrototypeOptions = Object.assign(Object.create(null), {
        disableMarkRead: false,
        sibling: true,
    });
    assert.strictEqual(
        shapeModule.exports.default(nullPrototypeOptions),
        "shape-open",
    );
    assert.notStrictEqual(shapeCalls[1], nullPrototypeOptions);
    assert.strictEqual(
        Object.getPrototypeOf(shapeCalls[1]),
        null,
        "null-prototype options must retain their prototype",
    );
    assert.strictEqual(shapeCalls[1].disableMarkRead, true);
    assert.strictEqual(shapeCalls[1].sibling, true);

    const settingsOffContext = makeMessengerPatchPage(
        { msgSeen: false },
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    let settingsOffOptions;
    const settingsOffModule = registerMessengerModule(
        settingsOffContext,
        "useMWV2SendOpenMessage",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) {
                settingsOffOptions = options;
                return "native-open";
            };
        },
    );
    const nativeOptions = {
        disableMarkRead: false,
        thread: { threadKey: "redacted-thread" },
    };
    assert.strictEqual(
        settingsOffModule.exports.default(nativeOptions),
        "native-open",
    );
    assert.strictEqual(
        settingsOffOptions,
        nativeOptions,
        "settings-off behavior must remain byte-for-byte native",
    );

    const requestContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/messages/requests",
            href: "https://www.facebook.com/messages/requests",
            facebookMiniChatOpen: true,
        },
    );
    let requestOptions;
    const requestModule = registerMessengerModule(
        requestContext,
        "useMWV2SendOpenMessage",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) {
                requestOptions = options;
                return "request-opened";
            };
        },
    );
    const requestNativeOptions = {
        disableMarkRead: false,
        thread: { threadKey: "redacted-request" },
    };
    assert.strictEqual(
        requestModule.exports.default(requestNativeOptions),
        "request-opened",
    );
    assert.strictEqual(
        requestOptions,
        requestNativeOptions,
        "Message Requests must keep native open-message semantics",
    );

    const identityContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const identityCalls = [];
    const identityThis = Object.freeze({ kind: "native-this" });
    const identityCallback = function () {
        return "stable-open";
    };
    const identityModule = registerMessengerModule(
        identityContext,
        "useMWV2SendOpenMessageImplShared",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (...args) {
                identityCalls.push({ args, thisArg: this });
                return identityCallback;
            };
        },
    );
    const before = Object.freeze({ context: true });
    const firstOptions = Object.freeze({
        disableMarkRead: false,
        threadKey: "redacted-thread",
    });
    const laterOptions = Object.freeze({
        disableMarkRead: false,
        threadKey: "redacted-later-thread",
    });
    const after = Object.freeze({ trailing: true });
    assert.strictEqual(
        identityModule.exports.default.call(
            identityThis,
            before,
            firstOptions,
            laterOptions,
            after,
        ),
        identityCallback,
    );
    assert.strictEqual(identityCalls[0].thisArg, identityThis);
    assert.strictEqual(identityCalls[0].args[0], before);
    assert.notStrictEqual(identityCalls[0].args[1], firstOptions);
    assert.strictEqual(identityCalls[0].args[1].disableMarkRead, true);
    assert.strictEqual(
        identityCalls[0].args[2],
        laterOptions,
        "only the first exact options object may be cloned",
    );
    assert.strictEqual(identityCalls[0].args[3], after);

    const alreadyDisabled = Object.freeze({
        disableMarkRead: true,
        threadKey: "redacted-thread",
    });
    assert.strictEqual(
        identityModule.exports.default(alreadyDisabled),
        identityCallback,
    );
    assert.strictEqual(
        identityCalls[1].args[0],
        alreadyDisabled,
        "already-disabled options must preserve identity",
    );
    const absentFlag = Object.freeze({ context: "not-open-options" });
    assert.strictEqual(
        identityModule.exports.default(absentFlag),
        identityCallback,
    );
    assert.strictEqual(
        identityCalls[2].args[0],
        absentFlag,
        "unrelated objects without a thread target must remain untouched",
    );
    assert.strictEqual(
        identityModule.exports.default(firstOptions),
        identityCallback,
    );
    assert.strictEqual(
        identityModule.exports.default(firstOptions),
        identityCallback,
    );
    assert.strictEqual(
        identityCalls.length,
        5,
        "repeated calls must invoke the native hook exactly once each",
    );

    const killedContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    let killedOptions;
    const killedModule = registerMessengerModule(
        killedContext,
        "useMWV2SendOpenMessage",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) {
                killedOptions = options;
                return "killed-open";
            };
        },
    );
    killedContext.window.postMessage({
        type: "GHOSTIFY_CONFIG_UPDATE",
        source: "GHOSTIFY_EXTENSION",
        config: { killSwitch: ["msgSeen"] },
    });
    const killedNativeOptions = { disableMarkRead: false };
    assert.strictEqual(
        killedModule.exports.default(killedNativeOptions),
        "killed-open",
    );
    assert.strictEqual(
        killedOptions,
        killedNativeOptions,
        "kill-switched behavior must remain native",
    );

    const staleRequestContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    let staleRequestOptions;
    const staleRequestModule = registerMessengerModule(
        staleRequestContext,
        "useMWV2SendOpenMessage",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) {
                staleRequestOptions = options;
                return "stale-request-open";
            };
        },
    );
    staleRequestContext.window.location.pathname = "/messages/requests";
    staleRequestContext.window.location.href =
        "https://www.facebook.com/messages/requests";
    const staleRequestNativeOptions = { disableMarkRead: false };
    assert.strictEqual(
        staleRequestModule.exports.default(staleRequestNativeOptions),
        "stale-request-open",
    );
    assert.strictEqual(
        staleRequestOptions,
        staleRequestNativeOptions,
        "a stale inbox wrapper must become native after request navigation",
    );

    for (const page of [
        {
            label: "Messenger.com",
            hostname: "www.messenger.com",
            pathname: "/t/redacted-thread",
            href: "https://www.messenger.com/t/redacted-thread",
        },
        {
            label: "Facebook MAW proxy",
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            href: "https://www.fbsbx.com/maw_proxy_page/",
        },
    ]) {
        const context = makeMessengerPatchPage({}, page);
        let receivedOptions;
        const module = registerMessengerModule(
            context,
            "useMWV2SendOpenMessage",
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (options) {
                    receivedOptions = options;
                    return "host-native";
                };
            },
        );
        const hostOptions = { disableMarkRead: false };
        assert.strictEqual(module.exports.default(hostOptions), "host-native");
        assert.strictEqual(
            receivedOptions,
            hostOptions,
            `${page.label} must remain native`,
        );
    }

    const negativeContext = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    let negativeOptions;
    const negativeModule = registerMessengerModule(
        negativeContext,
        "useMWV2SendOpenMessageAnalytics",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (options) {
                negativeOptions = options;
                return "analytics-native";
            };
        },
    );
    const negativeNativeOptions = { disableMarkRead: false };
    assert.strictEqual(
        negativeModule.exports.default(negativeNativeOptions),
        "analytics-native",
    );
    assert.strictEqual(
        negativeOptions,
        negativeNativeOptions,
        "unobserved suffix aliases must not be patched",
    );
}

function testFacebookLateUnconfirmedLeafDefinitionsRemainNative() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.facebook.com",
            pathname: "/",
            href: "https://www.facebook.com/",
            facebookMiniChatOpen: true,
        },
    );
    const threadKeyI64 = Object.freeze([135791357, 246802468]);
    const watermarkI64 = Object.freeze([1779530000, 417]);
    let firstCalls = 0;
    let secondCalls = 0;

    const first = registerMessengerModule(
        context,
        "LSMarkThreadRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () {
                firstCalls += 1;
            };
        },
    );
    const second = registerMessengerModule(
        context,
        "LSMarkThreadRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function () {
                secondCalls += 1;
            };
        },
    );

    assert.strictEqual(
        first.exports.default(threadKeyI64, watermarkI64, 95),
        undefined,
    );
    assert.strictEqual(
        second.exports.default(threadKeyI64, watermarkI64, 95),
        undefined,
    );
    assert.strictEqual(firstCalls, 1);
    assert.strictEqual(
        secondCalls,
        1,
        "unconfirmed lazy leaf definitions must preserve native contracts",
    );
}

function testFacebookMawReadInfrastructureStaysNative() {
    for (const moduleName of [
        "MAWMarkThreadAsReadScheduler",
        "MAWMarkThreadAsReadTxns",
        "MAWMarkThreadAsReadUpToApi",
    ]) {
        const context = makeMessengerPatchPage(
            {},
            {
                hostname: "www.fbsbx.com",
                pathname: "/maw_proxy_page/",
                search: "?__cci=redacted",
                href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
            },
        );
        const calls = [];
        const module = registerMessengerModule(
            context,
            moduleName,
            function (_a, _b, _c, _d, moduleObject) {
                moduleObject.exports.default = function (payload) {
                    calls.push(payload);
                    return "native-maw-infrastructure";
                };
            },
        );
        const payload = { threadKey: [1, 2], inboundReceipt: true };

        assert.strictEqual(
            module.exports.default(payload),
            "native-maw-infrastructure",
        );
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0], payload);
        assert.strictEqual(
            context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0,
            0,
        );
        assert.strictEqual(
            context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
            0,
        );
    }
}

async function testFacebookMawSchedulerStaysNativeWithSuppressedLeafDependency() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            search: "?__cci=redacted",
            href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
        },
    );
    let schedulerCalls = 0;
    let mutationCalls = 0;
    const dependencyExports = {
        MAWMarkThreadAsRead: {
            async markThreadAsReadImpl() {
                mutationCalls += 1;
                return "native-read-mutated";
            },
        },
    };
    const module = registerMessengerModuleWithDependencies(
        context,
        "MAWMarkThreadAsReadScheduler",
        ["MAWMarkThreadAsRead"],
        dependencyExports,
        function (_a, require, _c, _d, moduleObject) {
            const markThreadRead = require("MAWMarkThreadAsRead");
            moduleObject.exports.schedule = async function (...args) {
                schedulerCalls += 1;
                await markThreadRead.markThreadAsReadImpl(...args);
                return "scheduler-completed";
            };
        },
    );

    const result = module.exports.schedule(
        [135791357, 246802468],
        [1779530000, 417],
    );
    assert.ok(result && typeof result.then === "function");
    assert.strictEqual(await result, "scheduler-completed");
    assert.strictEqual(
        schedulerCalls,
        1,
        "native scheduler orchestration must continue",
    );
    assert.strictEqual(
        mutationCalls,
        0,
        "only the leaf local-read mutation should be suppressed",
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0,
        1,
    );
}

function testFacebookMawExactMarkThreadAsReadRemainsSanitized() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            search: "?__cci=redacted",
            href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
        },
    );
    const calls = [];
    const module = registerMessengerModule(
        context,
        "MWMarkThreadAsRead",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.markThreadAsRead = function markThreadAsRead(
                payload,
            ) {
                calls.push(payload);
                return "proxy-read-updated";
            };
        },
    );
    const payload = {
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
    };

    assert.strictEqual(
        module.exports.markThreadAsRead(payload),
        "proxy-read-updated",
    );
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(calls[0], payload);
    assert.strictEqual(calls[0].last_read_watermark, SAFE_READ_WATERMARK);
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        1,
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_MARK_THREAD_AS_READ_CALLS__ || 0,
        0,
    );
}

function testFacebookMawProxyLocalReadModulesAreSanitized() {
    const context = makeMessengerPatchPage(
        {},
        {
            hostname: "www.fbsbx.com",
            pathname: "/maw_proxy_page/",
            search: "?__cci=redacted",
            href: "https://www.fbsbx.com/maw_proxy_page/?__cci=redacted",
        },
    );
    const calls = [];
    const module = registerMessengerModule(
        context,
        "LSUpdateThreadReadWatermark",
        function (_a, _b, _c, _d, moduleObject) {
            moduleObject.exports.default = function (payload) {
                calls.push(payload);
                return "proxy-read-updated";
            };
        },
    );
    const normalReadPayload = {
        thread_key: { thread_fbid: "redacted-thread" },
        last_read_watermark: 1779530000000,
        should_send_read_receipt: true,
        readReceiptMutation: { should_send_read_receipt: true },
    };

    assert.strictEqual(
        module.exports.default(normalReadPayload),
        "proxy-read-updated",
    );
    assert.strictEqual(calls.length, 1);
    assert.notStrictEqual(
        calls[0],
        normalReadPayload,
        "Facebook MAW proxy local read modules must receive a sanitized clone",
    );
    assert.strictEqual(calls[0].should_send_read_receipt, false);
    assert.strictEqual(calls[0].readReceiptMutation, null);
    assert.strictEqual(
        context.window.__GHOSTIFY_SANITIZED_READ_EXPORT_CALLS__ || 0,
        1,
        "Facebook MAW proxy local read modules must increment sanitization",
    );
    assert.strictEqual(
        context.window.__GHOSTIFY_BLOCKED_READ_EXPORT_CALLS__ || 0,
        0,
    );
}

(async () => {
    testFacebookTopFrameModuleInterceptorIsExactScopedForLoaderSafety();
    testFacebookAutomaticReadKeepsUnreadAndNativeHookExecution();
    await testFacebookOptimisticReadReceiptEnqueueDoesNotStallSend();
    testFacebookOptimisticMarkThreadReadPreservesNativeBypasses();
    testFacebookOptimisticMarkThreadReadShadowIsConsumerAndHostScoped();
    await testFacebookOptimisticMarkThreadReadAdapterRemainsNative();
    testFacebookUnprovenGroupReadLeavesPreserveNativeContracts();
    testFacebookSendOpenMessageHooksForceNativeDisableMarkRead();
    testFacebookLateUnconfirmedLeafDefinitionsRemainNative();
    testFacebookMawReadInfrastructureStaysNative();
    await testFacebookMawSchedulerStaysNativeWithSuppressedLeafDependency();
    testFacebookMawExactMarkThreadAsReadRemainsSanitized();
    testFacebookMawProxyLocalReadModulesAreSanitized();
    console.log("Facebook read-state regression tests passed");
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
