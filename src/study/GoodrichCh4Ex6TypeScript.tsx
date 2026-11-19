import { useMemo } from "react";
import {
  StudyEditor,
  type StudyEditorCheck,
} from "@knowledge-forge-ai/study-components/editor";
import { createStudyRuntimeEditorAdapterFactory } from "@knowledge-forge-ai/study-components/runtime-adapter";
import { createStudyTypeScriptExecutionAdapterFactory } from "@knowledge-forge-ai/study-components/typescript";
import { goodrichResultMatchesFiniteSum } from "./goodrich-harmonic-check";

export const TYPESCRIPT_PARENT = "https://sam.lair.knowledge-forge.ai";
export const TYPESCRIPT_RUNNER = "https://study-runner.knowledge-forge.ai";
export const TYPESCRIPT_COMPILER = Object.freeze({
  url: TYPESCRIPT_RUNNER + "/assets/typescript-5.9.3.js",
  version: "5.9.3",
  sha256: "3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675",
});

const checks: readonly StudyEditorCheck[] = [
  {
    id: "goodrich-harmonic-independent-sum",
    label: "Matches the finite sum for 1 ≤ n ≤ 8",
    check: ({ input, value }) => goodrichResultMatchesFiniteSum(input, value),
  },
];

async function loadTypeScriptLanguage(language: "typescript" | "javascript" | "python") {
  if (language !== "typescript") {
    throw new Error("This editor supports TypeScript.");
  }
  const { javascript } = await import("@codemirror/lang-javascript");
  return javascript({ typescript: true });
}

export function GoodrichCh4Ex6TypeScript({ source }: { readonly source: string }) {
  const execution = useMemo(
    () => createStudyTypeScriptExecutionAdapterFactory({
      base: createStudyRuntimeEditorAdapterFactory({
        parentOrigin: TYPESCRIPT_PARENT,
        runnerOrigin: TYPESCRIPT_RUNNER,
      }),
      compilerAsset: TYPESCRIPT_COMPILER,
    }),
    [],
  );

  return (
    <section className="study-editor-slot study-editor-gate" aria-label="Optional Goodrich TypeScript editor">
      <h2>TypeScript editor</h2>
      <p>Enter an integer from 1 through 8. Run loads the compiler, reports syntax errors, and executes the result in the study runner.</p>
      <StudyEditor
        source={source}
        input={4}
        language="typescript"
        loadLanguage={loadTypeScriptLanguage}
        execution={execution}
        checks={checks}
        title="Recursive harmonic numbers in TypeScript"
      />
    </section>
  );
}
