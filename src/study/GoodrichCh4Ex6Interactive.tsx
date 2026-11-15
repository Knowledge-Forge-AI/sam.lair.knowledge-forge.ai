import { useCallback, useMemo } from "react";
import {
  StudyEditor,
  type StudyEditorCheck,
} from "@knowledge-forge-ai/study-components/editor";
import { createStudyRuntimeEditorAdapterFactory } from "@knowledge-forge-ai/study-components/runtime-adapter";
import { STUDY_RUNTIME_ASSET_PATHS } from "@knowledge-forge-ai/study-components/runtime-protocol";
import {
  goodrichResultMatchesFiniteSum,
} from "./goodrich-harmonic-check";

/** The deployed runner is a trusted consumer configuration, not lesson input. */
export const GOODRICH_PARENT_ORIGIN = "https://sam.lair.knowledge-forge.ai";
export const GOODRICH_RUNNER_ORIGIN = "https://study-runner.knowledge-forge.ai";

const GOODRICH_SOURCE_REVISION =
  "6933caaf854cfe49e1c67cb383b4e279bd34ba77";

const GOODRICH_RUNTIME_LIMITS = Object.freeze({
  maxSourceBytes: 64 * 1024,
  maxInputBytes: 8 * 1024,
  maxOutputBytes: 64 * 1024,
  maxInitMs: 45_000,
  maxProgramMs: 3_000,
});

const GOODRICH_CHECKS: readonly StudyEditorCheck[] = Object.freeze([
  {
    id: "goodrich-harmonic-independent-sum",
    label: "Matches the finite sum for 1 ≤ n ≤ 8",
    check: ({ input, value }) => goodrichResultMatchesFiniteSum(input, value),
  },
]);

export interface GoodrichCh4Ex6InteractiveProps {
  readonly source: string;
}

/**
 * Optional client island for the existing static Goodrich lesson.
 *
 * The static MDX and its source-bound CodeInclude remain the authored
 * document. This island owns only the editable draft and delegates execution
 * to the already-admitted separate-origin adapter. Python syntax and all
 * runtime modules stay lazy; no runtime is constructed during render.
 */
export function GoodrichCh4Ex6Interactive({
  source,
}: GoodrichCh4Ex6InteractiveProps) {
  const execution = useMemo(
    () =>
      createStudyRuntimeEditorAdapterFactory({
        parentOrigin: GOODRICH_PARENT_ORIGIN,
        runnerOrigin: GOODRICH_RUNNER_ORIGIN,
        assets: STUDY_RUNTIME_ASSET_PATHS,
        limits: GOODRICH_RUNTIME_LIMITS,
      }),
    [],
  );

  const loadPythonLanguage = useCallback(
    async (language: "python" | "javascript" | "typescript") => {
      if (language !== "python") {
        throw new Error("This lesson provides Python syntax support only.");
      }
      const { python } = await import("@codemirror/lang-python");
      return python();
    },
    [],
  );

  return (
    <section className="study-editor-slot study-editor-gate" aria-label="Optional Goodrich Python editor">
      <h2>Optional Python editor</h2>
      <p>
        Edit the Python and run it with an integer from 1 through 8. Run uses
        the separate study runner when available. The check compares your
        result with a direct loop sum within floating-point tolerance; an
        input outside this range fails the check.
      </p>
      <p>
        The optional editor uses MIT-licensed CodeMirror. <a href="/study/licenses/codemirror-NOTICES.txt">CodeMirror notices</a>.
      </p>
      <StudyEditor
        source={source}
        input={4}
        language="python"
        loadLanguage={loadPythonLanguage}
        execution={execution}
        pythonEntry={{
          entry: "bounded_harmonic",
          revision: GOODRICH_SOURCE_REVISION,
        }}
        checks={GOODRICH_CHECKS}
        title="Goodrich Chapter 4 Exercise 6 editor"
      />
    </section>
  );
}
