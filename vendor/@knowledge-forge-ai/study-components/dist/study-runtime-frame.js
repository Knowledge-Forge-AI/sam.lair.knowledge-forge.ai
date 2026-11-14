import { STUDY_RUNTIME_ASSET_PATHS, STUDY_RUNTIME_FRAME_PATH, STUDY_RUNTIME_PROTOCOL, } from "./study-runtime-protocol.js";
/**
 * Trusted runner-origin frame source. A server must serve this source at the
 * fixed frame path with the selected runner CSP; this module does not create
 * an iframe or relax CSP itself.
 */
export const STUDY_RUNTIME_FRAME_SOURCE = String.raw `
"use strict";
(function () {
  const PROTOCOL = "${STUDY_RUNTIME_PROTOCOL}";
  const FRAME_PATH = "${STUDY_RUNTIME_FRAME_PATH}";
  const ASSETS = ${JSON.stringify(STUDY_RUNTIME_ASSET_PATHS)};
  const params = new URL(globalThis.location.href).searchParams;
  function canonicalOrigin(value) {
    if (typeof value !== 'string' || value.length > 256) return null;
    try {
      const parsed = new URL(value);
      if (parsed.username !== '' || parsed.password !== '' || parsed.pathname !== '/'
        || parsed.search !== '' || parsed.hash !== '') return null;
      if (parsed.protocol !== 'https:'
        && !(parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'))) return null;
      const origin = parsed.origin;
      return origin === value ? origin : null;
    } catch { return null; }
  }
  const parentOrigin = canonicalOrigin(params.get("parentOrigin"));
  const runId = params.get("runId");
  const runnerOrigin = globalThis.location.origin;
  const MAX_SOURCE_BYTES = 64 * 1024;
  const MAX_INPUT_BYTES = 64 * 1024;
  const MAX_OUTPUT_BYTES = 64 * 1024;
  const MAX_LOCK_BYTES = 512 * 1024;
  const encoder = new TextEncoder();
  let boundPort = null;
  let boundSource = null;
  let worker = null;
  let workerUrl = null;
  let jobUsed = false;

  function bytes(value) { return encoder.encode(value).byteLength; }
  function validOrigin(value) {
    if (typeof value !== "string" || value.length > 256) return false;
    try {
      const parsed = new URL(value);
      return parsed.username === "" && parsed.password === "" && parsed.pathname === "/"
        && parsed.search === "" && parsed.hash === "" && (parsed.protocol === "https:"
          || (parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")));
    } catch { return false; }
  }
  function validRunId(value) { return typeof value === "string" && /^[a-z0-9-]{1,80}$/u.test(value); }
  function record(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return null;
    }
    return value;
  }
  function field(value, key) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  }
  function exact(value, expected) {
    const names = Object.keys(value);
    const allowed = new Set(expected);
    return names.length === expected.length && names.every((name) => allowed.has(name));
  }
  function validAssets(value) {
    const item = record(value);
    if (!item || !exact(item, Object.keys(ASSETS))) return false;
    return Object.keys(ASSETS).every((key) => field(item, key) === ASSETS[key]);
  }
  function send(message) {
    if (boundPort !== null) boundPort.postMessage(message);
  }
  function probe(phase, category, terminal) {
    send({ type: "probe", protocol: PROTOCOL, runId, phase, category, terminal });
  }
  function disposeWorker() {
    try { worker?.terminate(); } catch { /* local cleanup */ }
    try { if (workerUrl !== null) URL.revokeObjectURL(workerUrl); } catch { /* local cleanup */ }
    worker = null;
    workerUrl = null;
  }
  function outputWorkerSource(command) {
    const assetsLiteral = JSON.stringify(ASSETS);
    const python = command.language === "python";
    const javascriptSource = python ? "undefined" : command.source;
    const pythonProgram = python ? [
      "import contextlib, inspect, io, json, math",
      "__tfsb_namespace = {'__name__': '__tfsb_embedded__'}",
      "class _tfsb_OutputLimit(Exception): pass",
      "_tfsb_MAX_OUTPUT_BYTES = " + command.maxOutputBytes,
      "_tfsb_output_bytes = [0]",
      "_tfsb_output_overflowed = [False]",
      "class __tfsb_BoundedWriter:",
      "    def __init__(self): self.__tfsb_buffer = io.StringIO()",
      "    def write(self, value):",
      "        if not isinstance(value, str): raise TypeError('output text')",
      "        if _tfsb_output_overflowed[0]: raise _tfsb_OutputLimit()",
      "        _tfsb_size = len(value.encode('utf-8', 'surrogatepass'))",
      "        if _tfsb_output_bytes[0] + _tfsb_size > _tfsb_MAX_OUTPUT_BYTES:",
      "            _tfsb_output_overflowed[0] = True",
      "            raise _tfsb_OutputLimit()",
      "        _tfsb_output_bytes[0] += _tfsb_size",
      "        return self.__tfsb_buffer.write(value)",
      "    def flush(self): self.__tfsb_buffer.flush()",
      "    def getvalue(self): return self.__tfsb_buffer.getvalue()",
      "__tfsb_stdout = __tfsb_BoundedWriter()",
      "__tfsb_stderr = __tfsb_BoundedWriter()",
      "def __tfsb_validate_result(value, depth=0, state=None, seen=None):",
      "    if state is None: state = [0]",
      "    if seen is None: seen = set()",
      "    if depth > 32: raise _tfsb_OutputLimit()",
      "    state[0] += 1",
      "    if state[0] > 8192: raise _tfsb_OutputLimit()",
      "    if value is None or type(value) is bool or type(value) is str: return",
      "    if type(value) is int:",
      "        if abs(value) > 9007199254740991: raise ValueError('result integer range')",
      "        return",
      "    if type(value) is float:",
      "        if not math.isfinite(value): raise ValueError('result number')",
      "        return",
      "    if type(value) is list or type(value) is tuple:",
      "        __tfsb_identity = id(value)",
      "        if __tfsb_identity in seen: raise TypeError('result cycle')",
      "        seen.add(__tfsb_identity)",
      "        try:",
      "            for __tfsb_item in value: __tfsb_validate_result(__tfsb_item, depth + 1, state, seen)",
      "        finally:",
      "            seen.remove(__tfsb_identity)",
      "        return",
      "    if type(value) is dict:",
      "        __tfsb_identity = id(value)",
      "        if __tfsb_identity in seen: raise TypeError('result cycle')",
      "        seen.add(__tfsb_identity)",
      "        try:",
      "            for __tfsb_item_key, __tfsb_item in value.items():",
      "                if type(__tfsb_item_key) is not str: raise TypeError('result key')",
      "                __tfsb_validate_result(__tfsb_item, depth + 1, state, seen)",
      "        finally:",
      "            seen.remove(__tfsb_identity)",
      "        return",
      "    raise TypeError('result type')",
      "async def __tfsb_call():",
      "    __tfsb_value = __tfsb_entry(__tfsb_input)",
      "    if inspect.isawaitable(__tfsb_value):",
      "        __tfsb_value = await __tfsb_value",
      "    return __tfsb_value",
      "try:",
      "    with contextlib.redirect_stdout(__tfsb_stdout), contextlib.redirect_stderr(__tfsb_stderr):",
      "        exec(__tfsb_source, __tfsb_namespace, __tfsb_namespace)",
      "        __tfsb_input = json.loads(__tfsb_input_json)",
      "        __tfsb_entry = __tfsb_namespace.get(__tfsb_entry_name)",
      "        if not callable(__tfsb_entry): raise RuntimeError('invalid entry')",
      "        __tfsb_value = await __tfsb_call()",
      "        if _tfsb_output_overflowed[0]: raise _tfsb_OutputLimit()",
      "        __tfsb_validate_result(__tfsb_value)",
      "except _tfsb_OutputLimit:",
      "    __tfsb_payload = {'__tfsb_error': 'OUTPUT_LIMIT'}",
      "except BaseException:",
      "    if _tfsb_output_overflowed[0]:",
      "        __tfsb_payload = {'__tfsb_error': 'OUTPUT_LIMIT'}",
      "    else:",
      "        raise",
      "else:",
      "    __tfsb_payload = {'value': __tfsb_value, 'stdout': __tfsb_stdout.getvalue(), 'stderr': __tfsb_stderr.getvalue()}",
      "json.dumps(__tfsb_payload, ensure_ascii=True, allow_nan=False, separators=(',', ':'))",
    ].join("\n") : "";
    const pythonDataLines = [];
    const lines = [
      "'use strict';",
      "const RUN_ID = " + JSON.stringify(command.runId) + ";",
      "const MAX_OUTPUT_BYTES = " + command.maxOutputBytes + ";",
      "const MAX_LOCK_BYTES = " + MAX_LOCK_BYTES + ";",
      ...(python ? [] : ["const INPUT_JSON = " + JSON.stringify(command.inputJson) + ";"]),
      ...pythonDataLines,
      "const encoder = new TextEncoder();",
      "let outputBytes = 0;",
      "let outputOverflowed = false;",
      "let initialized = false;",
      "function emit(stream, text) {",
      "  if (outputOverflowed) { const error = new Error('output limit'); error.name = 'StudyOutputLimit'; throw error; }",
      "  if (typeof text !== 'string') throw new Error('invalid output');",
      "  const size = encoder.encode(text).byteLength;",
      "  if (outputBytes + size > MAX_OUTPUT_BYTES) { outputOverflowed = true; const error = new Error('output limit'); error.name = 'StudyOutputLimit'; throw error; }",
      "  outputBytes += size;",
      "  self.postMessage({ type: stream, protocol: " + JSON.stringify(PROTOCOL) + ", runId: RUN_ID, text, bytes: size });",
      "}",
      "function sendProbe(phase, category, terminal) { self.postMessage({ type: 'probe', protocol: " + JSON.stringify(PROTOCOL) + ", runId: RUN_ID, phase, category, terminal }); }",
      "function resultBound(value, depth, state) {",
      "  if (depth > 32) return 'limit';",
      "  state.nodes += 1;",
      "  if (state.nodes > 8192) return 'limit';",
      "  if (value === null || typeof value === 'boolean' || typeof value === 'string') return null;",
      "  if (typeof value === 'number') return Number.isFinite(value) ? null : 'runtime';",
      "  if (typeof value !== 'object') return 'runtime';",
      "  if (state.seen.has(value)) return 'runtime';",
      "  state.seen.add(value);",
      "  try {",
      "    if (Array.isArray(value)) {",
      "      if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length > 0) return 'runtime';",
      "      const names = Object.getOwnPropertyNames(value);",
      "      if (names.some((name) => name !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(name))) return 'runtime';",
      "      for (let index = 0; index < value.length; index += 1) {",
      "        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));",
      "        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return 'runtime';",
      "        const outcome = resultBound(descriptor.value, depth + 1, state);",
      "        if (outcome !== null) return outcome;",
      "      }",
      "      return null;",
      "    }",
      "    const prototype = Object.getPrototypeOf(value);",
      "    if (prototype !== Object.prototype && prototype !== null) return 'runtime';",
      "    for (const key of Object.keys(value)) {",
      "      const descriptor = Object.getOwnPropertyDescriptor(value, key);",
      "      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return 'runtime';",
      "      const outcome = resultBound(descriptor.value, depth + 1, state);",
      "      if (outcome !== null) return outcome;",
      "    }",
      "    return null;",
      "  } finally { state.seen.delete(value); }",
      "}",
      "function sendResult(value) {",
      "  const candidate = value === undefined ? null : value;",
      "  const preflight = resultBound(candidate, 0, { nodes: 0, seen: new WeakSet() });",
      "  if (preflight === 'limit') { const error = new Error('result limit'); error.name = 'StudyOutputLimit'; throw error; }",
      "  if (preflight !== null) throw new Error('result is not JSON-compatible');",
      "  const encoded = JSON.stringify(candidate);",
      "  if (typeof encoded !== 'string') throw new Error('result is not JSON-compatible');",
      "  const valueBytes = encoder.encode(encoded).byteLength;",
      "  if (valueBytes > MAX_OUTPUT_BYTES) { const error = new Error('result limit'); error.name = 'StudyOutputLimit'; throw error; }",
      "  const normalized = JSON.parse(encoded);",
      "  const postflight = resultBound(normalized, 0, { nodes: 0, seen: new WeakSet() });",
      "  if (postflight === 'limit') { const error = new Error('result limit'); error.name = 'StudyOutputLimit'; throw error; }",
      "  if (postflight !== null) throw new Error('result is not JSON-compatible');",
      "  self.postMessage({ type: 'result', protocol: " + JSON.stringify(PROTOCOL) + ", runId: RUN_ID, value: normalized });",
      "}",
      "async function runJavaScript() {",
      "  const input = JSON.parse(INPUT_JSON);",
      "  const entry = (\n" + javascriptSource + "\n);",
      "  if (typeof entry !== 'function') { sendProbe('program', 'INVALID_ENTRY', true); return; }",
      "  const value = await entry(input, (text) => emit('stdout', text), (text) => emit('stderr', text));",
      "  if (outputOverflowed) { const error = new Error('output limit'); error.name = 'StudyOutputLimit'; throw error; }",
      "  sendResult(value);",
      "  sendProbe('terminal', 'COMPLETED', true);",
      "}",
      "/*PYTHON_START*/",
      "const ASSET_PATHS = " + assetsLiteral + ";",
      "async function runPython(item) {",
      "  const moduleUrl = new URL(ASSET_PATHS.modulePath, self.location.origin).href;",
      "  const stdlibUrl = new URL(ASSET_PATHS.stdlibPath, self.location.origin).href;",
      "  const lockUrl = new URL(ASSET_PATHS.lockPath, self.location.origin).href;",
      "  const indexUrl = new URL('.', moduleUrl).href;",
      "  sendProbe('init', 'INIT_STARTED', false);",
      "  const module = await import(moduleUrl);",
      "  if (!module || typeof module.loadPyodide !== 'function') throw new Error('missing loader');",
      "  const response = await fetch(lockUrl, { cache: 'no-store', credentials: 'omit' });",
      "  if (!response.ok) throw new Error('lock unavailable');",
      "  const lockFileContents = await response.text();",
      "  if (encoder.encode(lockFileContents).byteLength > MAX_LOCK_BYTES) throw new Error('lock too large');",
      "  const pyodide = await module.loadPyodide({ indexURL: indexUrl, stdLibURL: stdlibUrl, lockFileContents, packages: [], packageBaseUrl: indexUrl });",
      "  initialized = true;",
      "  sendProbe('init', 'INIT_OK', false);",
      "  sendProbe('program', 'PROGRAM_STARTED', false);",
      "  if (!item || typeof item.source !== 'string' || typeof item.inputJson !== 'string' || typeof item.entry !== 'string') throw new Error('python command invalid');",
      "  pyodide.globals.set('__tfsb_source', item.source);",
      "  pyodide.globals.set('__tfsb_input_json', item.inputJson);",
      "  pyodide.globals.set('__tfsb_entry_name', item.entry);",
      "  const raw = await pyodide.runPythonAsync(" + JSON.stringify(pythonProgram) + ");",
      "  if (typeof raw !== 'string') throw new Error('python result is not text');",
      "  const payload = JSON.parse(raw);",
      "  if (payload && typeof payload === 'object' && payload.__tfsb_error === 'OUTPUT_LIMIT') { const error = new Error('result limit'); error.name = 'StudyOutputLimit'; throw error; }",
      "  if (!payload || typeof payload !== 'object' || typeof payload.stdout !== 'string' || typeof payload.stderr !== 'string' || !Object.hasOwn(payload, 'value')) throw new Error('python result invalid');",
      "  emit('stdout', payload.stdout);",
      "  emit('stderr', payload.stderr);",
      "  sendResult(payload.value);",
      "  sendProbe('terminal', 'COMPLETED', true);",
      "}",
      "/*PYTHON_END*/",
      "async function run(item) {",
      "  try {",
      "    if (" + JSON.stringify(python) + ") { await runPython(item); } else { await runJavaScript(); }",
      "  } catch (error) {",
      "    if (outputOverflowed || (error && error.name === 'StudyOutputLimit')) { sendProbe('terminal', 'OUTPUT_LIMIT', true); return; }",
      "    sendProbe(" + (python ? "initialized ? 'program' : 'init'" : "'program'") + ", initialized ? 'RUNTIME_ERROR' : " + JSON.stringify(python ? "INIT_FAILED" : "RUNTIME_ERROR") + ", true);",
      "  } finally {",
      "    self.close?.();",
      "  }",
      "}",
      "self.onmessage = (event) => { if (event.data && event.data.type === 'start' && event.data.runId === RUN_ID) void run(event.data); };",
    ];
    if (!python) {
      const start = lines.indexOf("/*PYTHON_START*/");
      const end = lines.indexOf("/*PYTHON_END*/");
      if (start >= 0 && end >= start) lines.splice(start, end - start + 1);
    }
    return lines.join("\n");
  }
  function startWorker(command) {
    if (worker !== null) return;
    try {
      const source = outputWorkerSource(command);
      workerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      worker = new Worker(workerUrl, { type: 'module', name: 'study-runtime-worker' });
      worker.onmessage = (event) => {
        const message = event.data;
        if (!message || message.runId !== runId || message.protocol !== PROTOCOL) return;
        if (message.type === 'stdout' || message.type === 'stderr' || message.type === 'result' || message.type === 'probe') send(message);
        if (message.terminal === true) disposeWorker();
      };
      worker.onerror = () => { probe('terminal', 'RUNTIME_ERROR', true); disposeWorker(); };
      const payload = command.language === 'python'
        ? { type: 'start', runId, source: command.source, inputJson: command.inputJson, entry: command.entry }
        : { type: 'start', runId };
      worker.postMessage(payload);
    } catch {
      probe('terminal', 'RUNTIME_ERROR', true);
      disposeWorker();
    }
  }
  function bind(event) {
    if (boundPort !== null || event.source !== parent || event.origin !== parentOrigin || !validOrigin(parentOrigin)
      || !event.ports || event.ports.length !== 1) return;
    const message = record(event.data);
    if (!message || !exact(message, ['type', 'protocol', 'runId', 'parentOrigin', 'runnerOrigin', 'assets'])
      || field(message, 'type') !== 'bind' || field(message, 'protocol') !== PROTOCOL
      || field(message, 'runId') !== runId || field(message, 'parentOrigin') !== parentOrigin
      || field(message, 'runnerOrigin') !== runnerOrigin || !validRunId(runId) || !validAssets(field(message, 'assets'))) return;
    boundSource = event.source;
    boundPort = event.ports[0];
    parent.postMessage({ type: 'bound-window', protocol: PROTOCOL, runId, runnerOrigin }, parentOrigin);
    boundPort.onmessage = (portEvent) => {
      const item = record(portEvent.data);
      if (!item || field(item, 'protocol') !== PROTOCOL || field(item, 'runId') !== runId) return;
      const type = field(item, 'type');
      if (type === 'stop' && exact(item, ['type', 'protocol', 'runId'])) {
        jobUsed = true;
        disposeWorker();
        probe('terminal', 'STOPPED', true);
        return;
      }
      if (type !== 'run' || worker !== null || jobUsed) return;
      jobUsed = true;
      const language = field(item, 'language');
      const entry = field(item, 'entry');
      const source = field(item, 'source');
      const inputJson = field(item, 'inputJson');
      const expected = language === 'python'
        ? ['type', 'protocol', 'runId', 'language', 'source', 'inputJson', 'entry', 'maxOutputBytes']
        : ['type', 'protocol', 'runId', 'language', 'source', 'inputJson', 'maxOutputBytes'];
      if (!exact(item, expected) || (language !== 'javascript' && language !== 'python')
        || typeof source !== 'string' || bytes(source) > MAX_SOURCE_BYTES
        || typeof inputJson !== 'string' || bytes(inputJson) > MAX_INPUT_BYTES
        || !Number.isSafeInteger(field(item, 'maxOutputBytes')) || field(item, 'maxOutputBytes') < 1
        || field(item, 'maxOutputBytes') > MAX_OUTPUT_BYTES
        || (language === 'python' && (typeof entry !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/u.test(entry) || entry.startsWith('__tfsb_')))) {
        const category = typeof source !== 'string' || bytes(typeof source === 'string' ? source : '') > MAX_SOURCE_BYTES
          ? 'INVALID_SOURCE'
          : typeof inputJson !== 'string' || bytes(typeof inputJson === 'string' ? inputJson : '') > MAX_INPUT_BYTES
            ? 'INVALID_INPUT'
            : language === 'python' && (typeof entry !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/u.test(entry) || entry.startsWith('__tfsb_'))
              ? 'INVALID_ENTRY'
              : 'RUNTIME_ERROR';
        probe('terminal', category, true);
        return;
      }
      if (language === 'javascript') probe('program', 'PROGRAM_STARTED', false);
      startWorker(item);
    };
    boundPort.start();
    boundPort.postMessage({ type: 'bound', protocol: PROTOCOL, runId, runnerOrigin });
    boundPort.postMessage({ type: 'ready', protocol: PROTOCOL, runId, runnerOrigin });
  }
  if (FRAME_PATH === new URL(globalThis.location.href).pathname && validOrigin(parentOrigin)
    && parentOrigin !== runnerOrigin && validRunId(runId)) {
    globalThis.addEventListener('message', bind);
  }
})();
`;
export const STUDY_RUNTIME_FRAME_ASSET_CONFIG = STUDY_RUNTIME_ASSET_PATHS;
