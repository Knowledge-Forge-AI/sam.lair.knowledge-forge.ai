import { type StudyRuntimeAssetConfig, type StudyRuntimeHost, type StudyRuntimeWatchdog } from "./study-runtime-protocol.js";
export interface StudyRuntimeDomContainer {
    readonly appendChild: (node: StudyRuntimeDomIframe) => void;
    readonly removeChild?: (node: StudyRuntimeDomIframe) => void;
}
export interface StudyRuntimeDomWindow {
    readonly postMessage: (message: unknown, targetOrigin: string, transfer?: readonly unknown[]) => void;
}
export interface StudyRuntimeDomIframe {
    readonly sandbox: {
        value: string;
    };
    hidden?: boolean;
    src: string;
    readonly contentWindow: StudyRuntimeDomWindow | null;
    readonly addEventListener: (type: "load" | "error", listener: () => void) => void;
    readonly removeEventListener: (type: "load" | "error", listener: () => void) => void;
    readonly remove?: () => void;
}
export interface StudyRuntimeDomDocument {
    readonly body: StudyRuntimeDomContainer | null;
    readonly documentElement?: StudyRuntimeDomContainer | null;
    readonly createElement: (tagName: "iframe") => StudyRuntimeDomIframe;
}
export interface StudyRuntimeDomMessagePort {
    onmessage: ((event: {
        readonly data: unknown;
    }) => void) | null;
    readonly postMessage: (message: unknown) => void;
    readonly start: () => void;
    readonly close: () => void;
}
export interface StudyRuntimeDomMessageChannel {
    readonly port1: StudyRuntimeDomMessagePort;
    readonly port2: StudyRuntimeDomMessagePort;
}
export interface StudyRuntimeDomScheduler {
    readonly setTimeout: (callback: () => void, delayMs: number) => unknown;
    readonly clearTimeout: (handle: unknown) => void;
}
export interface StudyRuntimeDomEventTarget {
    readonly addEventListener: (type: "message", listener: (event: RuntimeWindowMessageEvent) => void) => void;
    readonly removeEventListener: (type: "message", listener: (event: RuntimeWindowMessageEvent) => void) => void;
}
export interface StudyRuntimeHostOptions {
    readonly runnerOrigin: string;
    readonly parentOrigin?: string;
    readonly assets?: StudyRuntimeAssetConfig;
    readonly document?: StudyRuntimeDomDocument;
    readonly createMessageChannel?: () => StudyRuntimeDomMessageChannel;
    readonly scheduler?: StudyRuntimeDomScheduler;
    readonly windowEvents?: StudyRuntimeDomEventTarget;
    readonly maxFrameLoadMs?: number;
    readonly maxBindMs?: number;
}
export declare const STUDY_RUNTIME_HOST_LIMITS: Readonly<{
    maxFrameLoadMs: 5000;
    maxBindMs: 1000;
    maxQueuedCommands: 2;
}>;
export declare class StudyRuntimeHostError extends Error {
    readonly code: "HOST_UNAVAILABLE";
    constructor();
}
interface RuntimeWindowMessageEvent {
    readonly source: unknown;
    readonly origin: string;
    readonly data: unknown;
}
export declare function createSeparateOriginRuntimeHost(options: StudyRuntimeHostOptions): StudyRuntimeHost;
export declare function createSeparateOriginRuntimeWatchdog(options?: {
    readonly scheduler?: StudyRuntimeDomScheduler;
}): StudyRuntimeWatchdog;
export {};
