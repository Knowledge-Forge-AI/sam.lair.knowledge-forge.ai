import { useCallback, useMemo } from "react";
import { LEHMAN_CHECKS } from "./lehman-checks.mjs";
import { StudyEditor } from "@knowledge-forge-ai/study-components/editor";
import { createStudyRuntimeEditorAdapterFactory } from "@knowledge-forge-ai/study-components/runtime-adapter";
import { STUDY_RUNTIME_ASSET_PATHS } from "@knowledge-forge-ai/study-components/runtime-protocol";

/** The deployed runner is a trusted consumer configuration, not lesson input. */
export const LEHMAN_PARENT_ORIGIN = "https://sam.lair.knowledge-forge.ai";
export const LEHMAN_RUNNER_ORIGIN = "https://study-runner.knowledge-forge.ai";

const LEHMAN_SOURCE_REVISION =
  "23ac35dd77d923f45137fa3ccce7599890056c70";

const LEHMAN_RUNTIME_LIMITS = Object.freeze({
  maxSourceBytes: 64 * 1024,
  maxInputBytes: 8 * 1024,
  maxOutputBytes: 64 * 1024,
  maxInitMs: 45_000,
  maxProgramMs: 3_000,
});

export interface LehmanCh3P4InteractiveProps {
  readonly source: string;
}

/**
 * Optional client island for the existing static Lehman lesson.
 *
 * The static MDX and its source-bound CodeInclude remain the page's authored
 * document. This island owns only the editable draft and delegates execution
 * to the already-admitted separate-origin adapter. Runtime/frame/Pyodide
 * modules are dynamically loaded by that adapter after Run; this component
 * never enables TypeScript or the legacy opaque runner.
 */
export function LehmanCh3P4Interactive({ source }: LehmanCh3P4InteractiveProps) {
  const execution = useMemo(
    () =>
      createStudyRuntimeEditorAdapterFactory({
        parentOrigin: LEHMAN_PARENT_ORIGIN,
        runnerOrigin: LEHMAN_RUNNER_ORIGIN,
        assets: STUDY_RUNTIME_ASSET_PATHS,
        limits: LEHMAN_RUNTIME_LIMITS,
      }),
    [],
  );

  const loadPythonLanguage = useCallback(async (language: "python" | "javascript" | "typescript") => {
    if (language !== "python") {
      throw new Error("This lesson provides Python syntax support only.");
    }
    const { python } = await import("@codemirror/lang-python");
    return python();
  }, []);

  return (
    <section className="study-editor-slot study-editor-gate" aria-label="Optional Lehman Python editor">
      <h2>Optional Python editor</h2>
      <p>
        Edit the maintained bounded entry and press Run when the separate
        study runner is available. The static lesson remains usable without
        this island; Python execution is not a semantic checker. Editor dependencies retain their MIT notices.
      </p>
      <p><a href="/study/licenses/codemirror-NOTICES.txt">Editor dependency notices</a></p>
      <p>Example checks inspect the current result. Passing examples does not replace the proof above.</p>
      <StudyEditor
        source={source}
        input={4}
        language="python"
        loadLanguage={loadPythonLanguage}
        execution={execution}
        pythonEntry={{ entry: "bounded_truth_value_array", revision: LEHMAN_SOURCE_REVISION }}
        title="Lehman Chapter 3 Problem 4 editor"
        checks={LEHMAN_CHECKS}
      />
    </section>
  );
}
