/** Build the adapter request without leaking Python-only metadata to other languages. */
export function createStudyEditorExecutionRequest(request, pythonEntry) {
    const { pythonEntry: _carriedPythonEntry, ...requestWithoutPythonEntry } = request;
    return {
        ...requestWithoutPythonEntry,
        ...(request.language === "python" && pythonEntry !== undefined ? { pythonEntry } : {}),
    };
}
