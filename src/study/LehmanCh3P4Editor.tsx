export interface LehmanCh3P4EditorProps {
  readonly source: string;
  readonly runnerOrigin: string;
}

/**
 * Explicitly disabled editor seam for the static lesson.
 *
 * The static lesson is useful without a runtime. This component must not
 * expose an inert clickable control or load editor/runtime assets.
 */
export function LehmanCh3P4Editor({ source, runnerOrigin }: LehmanCh3P4EditorProps) {
  void source;
  void runnerOrigin;
  return (
    <section className="study-editor-disabled" aria-label="Optional study editor">
      <h3>Optional editor unavailable</h3>
      <p>
        The lesson, equations, proof, and maintained source are readable. The
        interactive editor is not part of this static lesson build.
      </p>
      <p role="status">Interactive execution is not enabled in this build.</p>
    </section>
  );
}
