export const GOODRICH_MAX_N = 8;
export const GOODRICH_ABS_TOLERANCE = 1e-15;

/**
 * Compare a completed numeric result with an independently accumulated
 * finite sum for this lesson's bounded positive-integer pilot.
 *
 * This is a teaching check only. It is not a grader, theorem prover, or
 * security boundary.
 */
export function goodrichResultMatchesFiniteSum(
  input: unknown,
  value: unknown,
): boolean {
  if (
    typeof input !== "number" ||
    !Number.isInteger(input) ||
    input < 1 ||
    input > GOODRICH_MAX_N ||
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return false;
  }

  let expected = 0;
  for (let i = 1; i <= input; i += 1) {
    expected += 1 / i;
  }
  return Math.abs(value - expected) <= GOODRICH_ABS_TOLERANCE;
}
