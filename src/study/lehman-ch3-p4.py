# SPDX-License-Identifier: GPL-3.0-only

"""Bounded lesson entry for Lehman Chapter 3 Problem 4.

The recursive algorithm is preserved from
lair001/lehman-math-cs@23ac35dd77d923f45137fa3ccce7599890056c70,
solutions/book/p1/ch3_p4.py.  The bounded entry helper validates the input
before the preserved function allocates its initial result or recurses.

Adapted from Samuel Lair's GPLv3 source; see the maintained provenance record
for the pinned repository revision and source paths.
"""

from sys import argv


# Adaptation guard.  The original source function remains below, unchanged in
# its recursive construction and row order.
MAX_N = 8


def validate_nonnegative_integer_entry(value: object, maximum: object = MAX_N) -> int:
    """Validate the bounded lesson entry before recursion or result allocation."""

    if isinstance(maximum, bool) or not isinstance(maximum, int):
        raise TypeError("maximum must be an integer; bool is not accepted")
    if maximum < 0 or maximum > MAX_N:
        raise ValueError(f"maximum must be between 0 and {MAX_N}")
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError("n must be an integer; bool is not accepted")
    if value < 0 or value > maximum:
        raise ValueError(f"n must be between 0 and {maximum}")
    return value


# Preserved source algorithm from the pinned public Python file.
def get_truth_value_array(n: int) -> list[list[bool]]:
    result: list[list[bool]] = [[]]
    _add_truth_values(n, result[0], result)
    return result


def _add_truth_values(n: int, curr: list[bool], result: list[list[bool]]):
    if n == 0:
        return
    new: list[bool] = curr.copy()

    curr.append(True)
    new.append(False)

    _add_truth_values(n - 1, curr, result)
    _add_truth_values(n - 1, new, result)

    result.append(new)


def bounded_truth_value_array(value: object, maximum: object = MAX_N) -> list[list[bool]]:
    """Run the preserved algorithm only after bounded entry validation."""

    n = validate_nonnegative_integer_entry(value, maximum)
    return get_truth_value_array(n)


def _bool_to_str(b: bool):
    return "T" if b else "F"


def _main():
    candidate = int(argv[1]) if len(argv) > 1 else 4
    n = validate_nonnegative_integer_entry(candidate)
    print("n: {}".format(n))
    print()
    result: list[list[bool]] = get_truth_value_array(n)
    for row in result:
        print(" ".join(map(_bool_to_str, row)))
    print()
    print("total rows: {}".format(len(result)))


if __name__ == "__main__":
    _main()
