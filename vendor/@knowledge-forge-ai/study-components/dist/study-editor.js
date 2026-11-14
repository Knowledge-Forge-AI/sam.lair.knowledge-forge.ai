import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { createStudyBrowserRunnerController, } from "./browser-runner.js";
import { createStudyEditorExecutionRequest, } from "./study-editor-execution.js";
import { useCallback, useEffect, useRef, useState, } from "react";
export const STUDY_EDITOR_MAX_CHECKS = 16;
const DEFAULT_LANGUAGE = "javascript";
const DEFAULT_INPUT = "null";
const LANGUAGE_CHANGE_STOP_NOTICE = "Run stopped because editor language support changed.";
function executionUnavailable(language, execution, pythonEntry) {
    if (language === "typescript" && execution === undefined) {
        return {
            detail: "TypeScript execution is unavailable.",
            diagnostic: "This editor has TypeScript syntax support only; connect the lazy TypeScript execution adapter before running.",
        };
    }
    if (language === "python" && execution === undefined) {
        return {
            detail: "Python execution is unavailable.",
            diagnostic: "This editor has Python syntax support only; connect a separate Python runtime boundary.",
        };
    }
    if (language === "python" && pythonEntry === undefined) {
        return {
            detail: "Python entry manifest is unavailable.",
            diagnostic: "Python execution requires a trusted named entry manifest before it can run.",
        };
    }
    return undefined;
}
export class StudyEditorInputError extends TypeError {
    code = "INVALID_JSON";
    constructor() {
        super("Study editor input must be valid JSON.");
        this.name = "StudyEditorInputError";
    }
}
/**
 * Thin, testable adapter from the visible JSON input field to the public
 * browser-runner controller. It does not execute or grade the source.
 */
export function createStudyEditorRunnerController(options) {
    const input = parseStudyEditorInput(options.inputText);
    return createStudyBrowserRunnerController({
        source: options.source,
        input,
        host: options.host,
        watchdog: options.watchdog,
        ...(options.limits === undefined ? {} : { limits: options.limits }),
        ...(options.onOutput === undefined ? {} : { onOutput: options.onOutput }),
    });
}
/**
 * Defers DOM host construction until a run requests a sandbox job. Consumers
 * can create this wrapper during SSR; the supplied factory is client-owned and
 * is called at most once for the wrapper lifetime.
 */
export function createStudyEditorClientOnlyHost(createHost) {
    let host;
    return Object.freeze({
        createSandboxJob: (options) => {
            host ??= createHost();
            return host.createSandboxJob(options);
        },
    });
}
export function parseStudyEditorInput(inputText) {
    try {
        return JSON.parse(inputText);
    }
    catch {
        throw new StudyEditorInputError();
    }
}
function cloneStudyEditorCheckInput(value, seen = new WeakMap()) {
    if (value === null || typeof value !== "object")
        return value;
    const prior = seen.get(value);
    if (prior !== undefined)
        return prior;
    if (Array.isArray(value)) {
        const clone = [];
        seen.set(value, clone);
        for (const item of value)
            clone.push(cloneStudyEditorCheckInput(item, seen));
        return clone;
    }
    const clone = {};
    seen.set(value, clone);
    for (const [key, item] of Object.entries(value)) {
        Object.defineProperty(clone, key, {
            configurable: true,
            enumerable: true,
            value: cloneStudyEditorCheckInput(item, seen),
            writable: true,
        });
    }
    return clone;
}
export function evaluateStudyEditorChecks(checks, input, output, runRevision, sourceRevision, inputRevision, completedResult) {
    const reports = checks.slice(0, STUDY_EDITOR_MAX_CHECKS).map((check) => {
        try {
            const context = {
                input: cloneStudyEditorCheckInput(input),
                output,
                ...(completedResult === undefined ? {} : {
                    value: cloneStudyEditorCheckInput(completedResult.value),
                    stdout: completedResult.stdout,
                    stderr: completedResult.stderr,
                }),
            };
            const result = check.check(context);
            return {
                id: check.id,
                label: check.label,
                status: result === true ? "passed" : result === false ? "failed" : "error",
            };
        }
        catch {
            return {
                id: check.id,
                label: check.label,
                status: "error",
            };
        }
    });
    return { runRevision, sourceRevision, inputRevision, reports };
}
/**
 * Keep the visible stream authoritative after Clear output. The runner's
 * completed outcome is still the full run output and remains the check input;
 * only the terminal UI buffer must not resurrect text cleared by the learner.
 */
export function resolveStudyEditorTerminalOutput(streamedOutput, completedOutput, outputWasCleared) {
    return outputWasCleared ? streamedOutput : completedOutput;
}
function initialInputText(input) {
    try {
        const serialized = JSON.stringify(input === undefined ? null : input, null, 2);
        return serialized === undefined ? DEFAULT_INPUT : serialized;
    }
    catch {
        // Keep the first render deterministic. This is a lossy display fallback;
        // it does not preserve the original non-JSON value for the runner.
        return DEFAULT_INPUT;
    }
}
function builtInLanguage(language) {
    if (language === "typescript")
        return javascript({ typescript: true });
    if (language === "javascript")
        return javascript();
    throw new Error("A Python CodeMirror language loader is required.");
}
function languageExtension(language, loadLanguage) {
    if (language === "python") {
        if (loadLanguage === undefined) {
            throw new Error("A Python CodeMirror language loader is required.");
        }
        return loadLanguage(language);
    }
    return builtInLanguage(language);
}
function codeFromError(error) {
    if (error !== null && typeof error === "object" && "code" in error) {
        const code = error.code;
        if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code))
            return code;
    }
    return "UNEXPECTED_ERROR";
}
function statusText(status) {
    switch (status) {
        case "initializing": return "Initializing editor";
        case "ready": return "Ready";
        case "running": return "Running";
        case "completed": return "Completed";
        case "stopped": return "Stopped";
        case "timeout": return "Timed out";
        case "error": return "Error";
    }
}
function checkStatusText(status) {
    switch (status) {
        case "passed": return "Passed";
        case "failed": return "Failed";
        case "error": return "Check error";
    }
}
function errorText(error) {
    if (error instanceof StudyEditorInputError)
        return "Input must be valid JSON before it can run.";
    return `Runner error: ${codeFromError(error)}.`;
}
function normalizeLegacyOutcome(outcome) {
    if (outcome.kind === "completed")
        return { kind: "completed", stdout: outcome.output, stderr: "" };
    if (outcome.kind === "stopped")
        return { kind: "stopped", stdout: "", stderr: "" };
    if (outcome.kind === "timeout")
        return { kind: "timeout", stdout: "", stderr: "" };
    return { kind: "error", code: outcome.code, stdout: "", stderr: "" };
}
function normalizeExecutionOutcome(outcome) {
    return outcome;
}
function timeoutDiagnostic(phase) {
    if (phase === "initialization")
        return "The run exceeded its configured initialization time limit.";
    if (phase === "program")
        return "The run exceeded its configured program time limit.";
    return "The run exceeded its configured time limit.";
}
function resolveStudyEditorTerminalStream(streamedOutput, completedOutput, outputWasCleared) {
    return outputWasCleared ? streamedOutput : completedOutput;
}
export function formatStudyEditorResult(value) {
    if (value === undefined)
        return "No result yet.";
    try {
        const serialized = JSON.stringify(value, null, 2);
        return serialized === undefined ? "Result unavailable." : serialized;
    }
    catch {
        return "Result unavailable.";
    }
}
function createEditorState(source, languageCompartment, extension, onSourceChange) {
    return EditorState.create({
        doc: source,
        extensions: [
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap]),
            languageCompartment.of(extension),
            EditorView.lineWrapping,
            EditorView.contentAttributes.of({
                "aria-label": "Source editor",
                "data-study-editor-content": "true",
            }),
            EditorView.updateListener.of((update) => {
                if (update.docChanged)
                    onSourceChange(update.state.doc.toString());
            }),
        ],
    });
}
/**
 * Optional source editor and runner controls for a study lesson.
 *
 * This component does not create a browser sandbox during render and does not
 * execute source itself. It calls either the legacy runner controller or an
 * opt-in execution-adapter factory only after the user presses Run. Before
 * client effects initialize CodeMirror, server/static output keeps a plain
 * textarea fallback so the document remains inspectable without JS.
 */
export function StudyEditor(props) {
    const { source, input, language = DEFAULT_LANGUAGE, loadLanguage, title = "Code editor", checks, onSourceChange, onInputChange, } = props;
    const host = props.host;
    const watchdog = props.watchdog;
    const limits = props.limits;
    const execution = props.execution;
    const pythonEntry = props.pythonEntry;
    const initialSourceRef = useRef(source);
    const initialInputRef = useRef(initialInputText(input));
    const sourceRef = useRef(source);
    const inputRef = useRef(initialInputRef.current);
    const onSourceChangeRef = useRef(onSourceChange);
    const onInputChangeRef = useRef(onInputChange);
    const loadLanguageRef = useRef(loadLanguage);
    const executionRef = useRef(execution);
    const pythonEntryRef = useRef(pythonEntry);
    const appliedLanguageRef = useRef(language);
    const languageRevisionRef = useRef(0);
    const previousBoundaryRef = useRef({ host, watchdog, execution });
    const sourceRevisionRef = useRef(0);
    const inputRevisionRef = useRef(0);
    const runRevisionRef = useRef(0);
    const outputWasClearedRef = useRef(false);
    const viewRef = useRef(null);
    const controllerRef = useRef(null);
    const executionControllerRef = useRef(null);
    const runTokenRef = useRef(0);
    const languageCompartmentRef = useRef(new Compartment());
    const languageExtensionRef = useRef(javascript());
    const editorHostRef = useRef(null);
    const [sourceDraft, setSourceDraft] = useState(source);
    const [inputDraft, setInputDraft] = useState(initialInputRef.current);
    const [editorReady, setEditorReady] = useState(false);
    const [hasActiveRun, setHasActiveRun] = useState(false);
    const [status, setStatus] = useState("initializing");
    const [statusDetail, setStatusDetail] = useState("Preparing the optional editor.");
    const [stdout, setStdout] = useState("");
    const [stderr, setStderr] = useState("");
    const [resultValue, setResultValue] = useState(undefined);
    const [checkSnapshot, setCheckSnapshot] = useState(null);
    onSourceChangeRef.current = onSourceChange;
    onInputChangeRef.current = onInputChange;
    loadLanguageRef.current = loadLanguage;
    executionRef.current = execution;
    pythonEntryRef.current = pythonEntry;
    const boundedChecks = checks?.slice(0, STUDY_EDITOR_MAX_CHECKS) ?? [];
    const checksConfigured = boundedChecks.length > 0;
    const applySourceChange = useCallback((nextSource) => {
        sourceRef.current = nextSource;
        sourceRevisionRef.current += 1;
        setSourceDraft(nextSource);
        onSourceChangeRef.current?.(nextSource);
    }, []);
    const applyLanguage = useCallback((nextLanguage, preservedDiagnostic) => {
        const view = viewRef.current;
        if (view === null)
            return;
        const revision = ++languageRevisionRef.current;
        setStatus("initializing");
        setStatusDetail(`Loading ${nextLanguage} editor support.`);
        if (preservedDiagnostic === undefined)
            setStderr("");
        try {
            const loaded = languageExtension(nextLanguage, loadLanguageRef.current);
            Promise.resolve(loaded).then((extension) => {
                if (viewRef.current !== view || languageRevisionRef.current !== revision)
                    return;
                languageExtensionRef.current = extension;
                view.dispatch({
                    effects: languageCompartmentRef.current.reconfigure(extension),
                });
                const unavailable = executionUnavailable(nextLanguage, executionRef.current, pythonEntryRef.current);
                if (unavailable === undefined) {
                    setStatus("ready");
                    setStatusDetail("Editor ready.");
                    if (preservedDiagnostic !== undefined)
                        setStderr(preservedDiagnostic);
                }
                else {
                    setStatus("error");
                    setStatusDetail(unavailable.detail);
                    setStderr(preservedDiagnostic === undefined
                        ? unavailable.diagnostic
                        : preservedDiagnostic + " " + unavailable.diagnostic);
                }
            }, () => {
                if (viewRef.current !== view || languageRevisionRef.current !== revision)
                    return;
                setStatus("error");
                setStatusDetail("Editor language support failed.");
                setStderr(preservedDiagnostic === undefined
                    ? "Editor language support could not be loaded."
                    : preservedDiagnostic + " Editor language support could not be loaded.");
            });
        }
        catch {
            if (viewRef.current !== view || languageRevisionRef.current !== revision)
                return;
            setStatus("error");
            setStatusDetail("Editor language support is unavailable.");
            setStderr(preservedDiagnostic === undefined
                ? "Editor language support is unavailable for this lesson."
                : preservedDiagnostic + " Editor language support is unavailable for this lesson.");
        }
    }, []);
    const invalidateActiveRun = useCallback((detail) => {
        const controller = controllerRef.current ?? executionControllerRef.current;
        if (controller === null)
            return false;
        runTokenRef.current += 1;
        controller.stop();
        controller.dispose();
        controllerRef.current = null;
        executionControllerRef.current = null;
        setHasActiveRun(false);
        setStatus("stopped");
        setStatusDetail(detail);
        setStderr(detail);
        return true;
    }, []);
    useEffect(() => {
        const hostElement = editorHostRef.current;
        if (hostElement === null) {
            setStatus("error");
            setStatusDetail("Editor host is unavailable.");
            setStderr("Editor host is unavailable.");
            return;
        }
        const appliedLanguage = appliedLanguageRef.current;
        const initialExtension = appliedLanguage === "python"
            ? javascript()
            : builtInLanguage(appliedLanguage);
        languageExtensionRef.current = initialExtension;
        const view = new EditorView({
            state: createEditorState(sourceRef.current, languageCompartmentRef.current, initialExtension, applySourceChange),
            parent: hostElement,
        });
        viewRef.current = view;
        setEditorReady(true);
        setStatus("ready");
        setStatusDetail("Editor ready.");
        // Python syntax support is intentionally loaded only after the editor
        // exists. JavaScript/TypeScript always use their built-in extensions.
        if (appliedLanguage !== "javascript") {
            applyLanguage(appliedLanguage);
        }
        return () => {
            runTokenRef.current += 1;
            languageRevisionRef.current += 1;
            controllerRef.current?.stop();
            controllerRef.current?.dispose();
            executionControllerRef.current?.stop();
            executionControllerRef.current?.dispose();
            controllerRef.current = null;
            executionControllerRef.current = null;
            setHasActiveRun(false);
            view.destroy();
            if (viewRef.current === view)
                viewRef.current = null;
            setEditorReady(false);
        };
    }, [applyLanguage, applySourceChange]);
    useEffect(() => {
        if (!editorReady)
            return;
        if (language === appliedLanguageRef.current)
            return;
        const stoppedActiveRun = invalidateActiveRun(LANGUAGE_CHANGE_STOP_NOTICE);
        setCheckSnapshot(null);
        appliedLanguageRef.current = language;
        applyLanguage(language, stoppedActiveRun ? LANGUAGE_CHANGE_STOP_NOTICE : undefined);
    }, [applyLanguage, editorReady, invalidateActiveRun, language]);
    useEffect(() => {
        const previous = previousBoundaryRef.current;
        const changed = previous.host !== host || previous.watchdog !== watchdog || previous.execution !== execution;
        previousBoundaryRef.current = { host, watchdog, execution };
        if (changed) {
            invalidateActiveRun("Run stopped because the runner boundary changed.");
        }
    }, [execution, host, invalidateActiveRun, watchdog]);
    const handleInputChange = (event) => {
        inputRef.current = event.currentTarget.value;
        inputRevisionRef.current += 1;
        setInputDraft(event.currentTarget.value);
        onInputChangeRef.current?.(event.currentTarget.value);
    };
    const handleRun = () => {
        const view = viewRef.current;
        if (view === null) {
            setStatus("error");
            setStatusDetail("Editor is not initialized.");
            setStderr("Editor is not initialized.");
            return;
        }
        if (controllerRef.current !== null || executionControllerRef.current !== null) {
            setStatus("running");
            setStatusDetail("A run is already in progress.");
            setStderr("A run is already in progress; stop it before starting another run.");
            return;
        }
        const unavailable = executionUnavailable(language, execution, pythonEntry);
        if (unavailable !== undefined) {
            setStatus("error");
            setStatusDetail(unavailable.detail);
            setStderr(unavailable.diagnostic);
            return;
        }
        setCheckSnapshot(null);
        let parsedInput;
        try {
            parsedInput = parseStudyEditorInput(inputRef.current);
        }
        catch (error) {
            setStatus("error");
            setStatusDetail("Run configuration was rejected.");
            setStderr(errorText(error));
            return;
        }
        const sourceRevision = sourceRevisionRef.current;
        const inputRevision = inputRevisionRef.current;
        const runRevision = ++runRevisionRef.current;
        const token = ++runTokenRef.current;
        outputWasClearedRef.current = false;
        setStdout("");
        setStderr("");
        setResultValue(undefined);
        setStatus(execution === undefined ? "running" : "initializing");
        setStatusDetail(execution === undefined
            ? "Running in the configured browser boundary."
            : "Loading the configured execution runtime.");
        let controller;
        let outcomePromise;
        try {
            const sourceSnapshot = view.state.doc.toString();
            const inputSnapshot = inputRef.current;
            if (execution === undefined) {
                if (host === undefined || watchdog === undefined)
                    throw new TypeError("legacy runner boundary is unavailable");
                const legacyController = createStudyEditorRunnerController({
                    source: sourceSnapshot,
                    inputText: inputSnapshot,
                    host,
                    watchdog,
                    ...(limits === undefined ? {} : { limits }),
                    onOutput: (chunk) => {
                        if (runTokenRef.current === token)
                            setStdout((current) => current + chunk);
                    },
                });
                controller = legacyController;
                outcomePromise = Promise.resolve()
                    .then(() => legacyController.start())
                    .then(normalizeLegacyOutcome);
            }
            else {
                const executionLanguage = language;
                const request = createStudyEditorExecutionRequest({
                    language: executionLanguage,
                    source: sourceSnapshot,
                    input: parsedInput,
                    sourceRevision,
                    inputRevision,
                    runToken: token,
                }, pythonEntry);
                const executionController = execution.createController(request, {
                    onProbe: (probe) => {
                        if (runTokenRef.current !== token)
                            return;
                        if (probe.category === "INIT_STARTED" || probe.category === "INIT_OK") {
                            setStatus("initializing");
                            setStatusDetail(probe.category === "INIT_OK" ? "Runtime initialized; starting program." : "Initializing runtime.");
                        }
                        else if (probe.category === "PROGRAM_STARTED") {
                            setStatus("running");
                            setStatusDetail("Running in the configured separate-origin runtime.");
                        }
                    },
                    onOutput: (output) => {
                        if (runTokenRef.current !== token)
                            return;
                        if (output.stream === "stdout")
                            setStdout((current) => current + output.text);
                        else
                            setStderr((current) => current + output.text);
                    },
                });
                controller = executionController;
                outcomePromise = Promise.resolve()
                    .then(() => executionController.start())
                    .then(normalizeExecutionOutcome);
            }
        }
        catch (error) {
            setStatus("error");
            setStatusDetail("Run configuration was rejected.");
            setStderr(errorText(error));
            return;
        }
        if (execution === undefined)
            controllerRef.current = controller;
        else
            executionControllerRef.current = controller;
        setHasActiveRun(true);
        void outcomePromise.then((outcome) => {
            if (runTokenRef.current !== token)
                return;
            if (outcome.kind === "completed") {
                setStdout((streamedOutput) => resolveStudyEditorTerminalOutput(streamedOutput, outcome.stdout, outputWasClearedRef.current));
                if (!outputWasClearedRef.current)
                    setStderr(outcome.stderr);
                if (outcome.value !== undefined)
                    setResultValue(outcome.value);
                if (boundedChecks.length > 0) {
                    setCheckSnapshot(evaluateStudyEditorChecks(boundedChecks, parsedInput, outcome.stdout, runRevision, sourceRevision, inputRevision, outcome.value === undefined
                        ? undefined
                        : { value: outcome.value, stdout: outcome.stdout, stderr: outcome.stderr }));
                }
                setStatus("completed");
                setStatusDetail("Run completed.");
            }
            else if (outcome.kind === "stopped") {
                if (execution !== undefined) {
                    setStdout((streamedOutput) => resolveStudyEditorTerminalStream(streamedOutput, outcome.stdout, outputWasClearedRef.current));
                    setStderr((streamedOutput) => resolveStudyEditorTerminalStream(streamedOutput, outcome.stderr, outputWasClearedRef.current));
                }
                setStatus("stopped");
                setStatusDetail("Run stopped.");
            }
            else if (outcome.kind === "timeout") {
                if (execution !== undefined) {
                    setStdout((streamedOutput) => resolveStudyEditorTerminalStream(streamedOutput, outcome.stdout, outputWasClearedRef.current));
                    setStderr((streamedOutput) => resolveStudyEditorTerminalStream(streamedOutput, outcome.stderr, outputWasClearedRef.current));
                }
                setStatus("timeout");
                setStatusDetail(outcome.phase === undefined
                    ? "Run timed out (TIMEOUT)."
                    : `Run timed out (TIMEOUT:${outcome.phase}).`);
                setStderr((current) => current.length === 0
                    ? timeoutDiagnostic(outcome.phase)
                    : current);
            }
            else {
                if (execution !== undefined) {
                    setStdout((streamedOutput) => resolveStudyEditorTerminalStream(streamedOutput, outcome.stdout, outputWasClearedRef.current));
                    setStderr((streamedOutput) => resolveStudyEditorTerminalStream(streamedOutput, outcome.stderr, outputWasClearedRef.current));
                }
                setStatus("error");
                setStatusDetail(`Run failed (${outcome.code}).`);
                setStderr((current) => current.length === 0 ? `Runner error: ${outcome.code}.` : current);
            }
        }, (error) => {
            if (runTokenRef.current !== token)
                return;
            setStatus("error");
            setStatusDetail("Run failed.");
            setStderr(errorText(error));
        }).finally(() => {
            const currentController = execution === undefined
                ? controllerRef.current
                : executionControllerRef.current;
            if (runTokenRef.current === token && currentController === controller) {
                controller.dispose();
                if (execution === undefined)
                    controllerRef.current = null;
                else
                    executionControllerRef.current = null;
                setHasActiveRun(false);
            }
        });
    };
    const handleStop = () => {
        const controller = controllerRef.current ?? executionControllerRef.current;
        if (controller === null)
            return;
        controller.stop();
        setStatus("stopped");
        setStatusDetail("Stopping run.");
    };
    const handleReset = () => {
        const view = viewRef.current;
        const stoppedActiveRun = invalidateActiveRun("Run stopped before code reset.");
        setCheckSnapshot(null);
        setResultValue(undefined);
        if (view === null) {
            applySourceChange(initialSourceRef.current);
            const unavailable = executionUnavailable(language, execution, pythonEntry);
            if (stoppedActiveRun) {
                setStatus("stopped");
                setStatusDetail("Run stopped; code reset and selection/history cleared.");
            }
            else if (unavailable === undefined) {
                setStatus("ready");
                setStatusDetail("Code reset; selection and history cleared.");
            }
            else {
                setStatus("error");
                setStatusDetail(unavailable.detail);
                setStderr(unavailable.diagnostic);
            }
            return;
        }
        view.setState(createEditorState(initialSourceRef.current, languageCompartmentRef.current, languageExtensionRef.current, applySourceChange));
        applySourceChange(initialSourceRef.current);
        const unavailable = executionUnavailable(language, execution, pythonEntry);
        if (stoppedActiveRun) {
            setStatus("stopped");
            setStatusDetail("Run stopped; code reset and selection/history cleared.");
        }
        else if (unavailable === undefined) {
            setStatus("ready");
            setStatusDetail("Code reset; selection and history cleared.");
        }
        else {
            setStatus("error");
            setStatusDetail(unavailable.detail);
            setStderr(unavailable.diagnostic);
            return;
        }
        setStderr("");
    };
    const handleClearOutput = () => {
        outputWasClearedRef.current = true;
        setStdout("");
        setStderr("");
        setCheckSnapshot(null);
        setResultValue(undefined);
        if (hasActiveRun || controllerRef.current !== null || executionControllerRef.current !== null) {
            if (status === "running") {
                setStatus("running");
                setStatusDetail("Output cleared; run remains active.");
            }
        }
        else if (editorReady && executionUnavailable(language, execution, pythonEntry) === undefined) {
            setStatus("ready");
            setStatusDetail("Output cleared.");
        }
    };
    const checksStale = checkSnapshot !== null
        && (checkSnapshot.sourceRevision !== sourceRevisionRef.current
            || checkSnapshot.inputRevision !== inputRevisionRef.current);
    return (_jsxs("section", { "data-study-editor": "true", "aria-label": typeof title === "string" ? title : "Code editor", children: [_jsx("h3", { children: title }), _jsxs("div", { "data-study-editor-controls": "true", children: [_jsx("button", { type: "button", onClick: handleRun, disabled: !editorReady || hasActiveRun || executionUnavailable(language, execution, pythonEntry) !== undefined, children: "Run" }), _jsx("button", { type: "button", onClick: handleStop, disabled: !hasActiveRun, children: "Stop" }), _jsx("button", { type: "button", onClick: handleReset, children: "Reset code" }), _jsx("button", { type: "button", onClick: handleClearOutput, children: "Clear output" })] }), _jsxs("p", { role: "status", "aria-live": "polite", "data-study-editor-status": status, children: [statusText(status), ": ", statusDetail] }), _jsxs("label", { children: ["Source", _jsx("textarea", { "data-study-editor-fallback": "true", "aria-label": "Source fallback", hidden: editorReady, value: sourceDraft, onChange: (event) => applySourceChange(event.currentTarget.value) })] }), _jsx("div", { ref: editorHostRef, "data-study-editor-host": "true", hidden: !editorReady }), _jsxs("label", { children: ["Input (JSON)", _jsx("textarea", { "data-study-editor-input": "true", "aria-label": "Input JSON", rows: 4, value: inputDraft, onChange: handleInputChange })] }), _jsxs("section", { "aria-label": "stdout", "data-study-editor-stream": "stdout", children: [_jsx("h4", { children: "stdout" }), _jsx("pre", { children: stdout || "No stdout yet." })] }), _jsxs("section", { "aria-label": "stderr and diagnostics", "data-study-editor-stream": "stderr", children: [_jsx("h4", { children: "stderr / diagnostics" }), _jsx("pre", { children: stderr || "No diagnostics." })] }), _jsxs("section", { "aria-label": "result", "data-study-editor-result": "true", children: [_jsx("h4", { children: "Result" }), _jsx("pre", { children: formatStudyEditorResult(resultValue) })] }), checksConfigured ? (_jsxs("section", { "aria-label": "Checks for last completed run", "data-study-editor-checks": "true", "data-study-editor-checks-state": checkSnapshot === null ? "empty" : checksStale ? "stale" : "current", children: [_jsx("h4", { children: "Checks for last completed run" }), checks !== undefined && checks.length > STUDY_EDITOR_MAX_CHECKS ? (_jsx("p", { children: "Only the first 16 configured checks are used." })) : null, checkSnapshot === null ? (_jsx("p", { "data-study-editor-checks-empty": "true", children: "No completed run checks yet." })) : (_jsxs(_Fragment, { children: [_jsxs("p", { "data-study-editor-check-revision": "true", children: ["Run ", checkSnapshot.runRevision, "; source revision ", checkSnapshot.sourceRevision, "; input revision ", checkSnapshot.inputRevision, "."] }), checksStale ? (_jsx("p", { "data-study-editor-checks-stale": "true", children: "Stale after source or input edit." })) : null, _jsx("ul", { children: checkSnapshot.reports.map((report, index) => (_jsxs("li", { "data-study-check-id": report.id, "data-study-check-status": report.status, children: [report.label, ": ", checkStatusText(report.status)] }, `${report.id}-${index}`))) })] }))] })) : null] }));
}
