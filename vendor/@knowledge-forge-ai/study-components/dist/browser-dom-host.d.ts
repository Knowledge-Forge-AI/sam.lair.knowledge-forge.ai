import { type StudyBrowserRunnerHost, type StudyBrowserRunnerWatchdog } from "./browser-runner.js";
/** Minimal DOM shapes keep this optional package source free of DOM typings. */
export interface StudyBrowserDomContainer {
    readonly appendChild: (node: StudyBrowserDomIframe) => void;
    readonly removeChild?: (node: StudyBrowserDomIframe) => void;
}
export interface StudyBrowserDomWindow {
    readonly postMessage: (message: unknown, targetOrigin: string, transfer?: readonly unknown[]) => void;
}
export interface StudyBrowserDomIframe {
    readonly sandbox: {
        value: string;
    };
    readonly style?: {
        display: string;
    };
    hidden?: boolean;
    srcdoc: string;
    readonly contentWindow: StudyBrowserDomWindow | null;
    readonly addEventListener: (type: "load" | "error", listener: () => void) => void;
    readonly removeEventListener: (type: "load" | "error", listener: () => void) => void;
    readonly remove?: () => void;
}
export interface StudyBrowserDomDocument {
    readonly body: StudyBrowserDomContainer | null;
    readonly documentElement?: StudyBrowserDomContainer | null;
    readonly createElement: (tagName: "iframe") => StudyBrowserDomIframe;
}
export interface StudyBrowserDomMessagePort {
    onmessage: ((event: {
        readonly data: unknown;
    }) => void) | null;
    readonly postMessage: (message: unknown) => void;
    readonly start: () => void;
    readonly close: () => void;
}
export interface StudyBrowserDomMessageChannel {
    readonly port1: StudyBrowserDomMessagePort;
    readonly port2: StudyBrowserDomMessagePort;
}
export interface StudyBrowserDomScheduler {
    readonly setTimeout: (callback: () => void, delayMs: number) => unknown;
    readonly clearTimeout: (handle: unknown) => void;
}
export interface StudyBrowserDomHostOptions {
    readonly document?: StudyBrowserDomDocument;
    readonly createMessageChannel?: () => StudyBrowserDomMessageChannel;
    readonly scheduler?: StudyBrowserDomScheduler;
    readonly maxFrameLoadMs?: number;
}
export declare class StudyBrowserDomHostError extends Error {
    readonly code: "HOST_UNAVAILABLE";
    constructor();
}
export declare const STUDY_BROWSER_DOM_HOST_LIMITS: Readonly<{
    maxFrameLoadMs: 5000;
    maxQueuedCommands: 2;
}>;
export declare function createStudyBrowserDomWatchdog(options?: {
    readonly scheduler?: StudyBrowserDomScheduler;
}): StudyBrowserRunnerWatchdog;
export declare function createStudyBrowserDomHost(options?: StudyBrowserDomHostOptions): StudyBrowserRunnerHost;
