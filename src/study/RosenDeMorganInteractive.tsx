import { useMemo } from "react";
import {
  StudyEditor,
  type StudyEditorCheck,
} from "@knowledge-forge-ai/study-components/editor";
import { createStudyRuntimeEditorAdapterFactory } from "@knowledge-forge-ai/study-components/runtime-adapter";

export const ROSEN_RUNNER = "https://study-runner.knowledge-forge.ai";

const expectedInputs = [[true, true], [true, false], [false, true], [false, false]];
const expectedLeft = [false, true, true, true];
const expectedWithAnd = [false, false, false, true];

const checks: readonly StudyEditorCheck[] = [
  {
    id: "rosen-de-morgan-exhaustive-rows",
    label: "All four rows match the selected truth table",
    check: ({ input, value }) => {
      if (input !== "or" && input !== "and") return false;
      if (!Array.isArray(value) || value.length !== expectedInputs.length) return false;
      const expectedRight = input === "or" ? expectedLeft : expectedWithAnd;
      return expectedInputs.every(([p, q], index) => {
        const row = value[index];
        return Array.isArray(row) && row.length === 4 &&
          row[0] === p && row[1] === q &&
          row[2] === expectedLeft[index] && row[3] === expectedRight[index];
      });
    },
  },
];

async function loadJavaScriptLanguage(language: "javascript" | "typescript" | "python") {
  if (language !== "javascript") throw new Error("This lesson uses JavaScript.");
  const { javascript } = await import("@codemirror/lang-javascript");
  return javascript();
}

export function RosenDeMorganInteractive({ source }: { readonly source: string }) {
  const execution = useMemo(() => createStudyRuntimeEditorAdapterFactory({
    parentOrigin: "https://sam.lair.knowledge-forge.ai",
    runnerOrigin: ROSEN_RUNNER,
  }), []);

  return (
    <section className="study-editor-slot study-editor-gate" aria-labelledby="rosen-editor-title">
      <h2 id="rosen-editor-title">JavaScript editor</h2>
      <p>Run with <code>"or"</code>, then change the JSON input to <code>"and"</code> and look for the two rows that disagree.</p>
      <StudyEditor
        source={source}
        input="or"
        language="javascript"
        loadLanguage={loadJavaScriptLanguage}
        execution={execution}
        checks={checks}
        title="De Morgan's law in JavaScript"
      />
    </section>
  );
}
