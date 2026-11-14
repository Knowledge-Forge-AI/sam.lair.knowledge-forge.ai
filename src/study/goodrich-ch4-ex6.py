"""Bounded harmonic-number adapter for the selected study slice.

Adapted from Samuel Lair's GPL-3.0 source in
lair001/goodrich-dsa-python at the pinned revision. The recursive source
algorithm remains recognizable; the host guard is new integration code.
"""

MAX_N = 8


# Selected recursive algorithm from the pinned source record.
def harmonic(n):
    if n == 1:
        return 1
    else:
        return 1 / n + harmonic(n - 1)


# New host boundary; this guard is not present in the authored source.
def bounded_harmonic(n, maximum=MAX_N):
    if isinstance(maximum, bool) or not isinstance(maximum, int):
        raise ValueError("maximum must be an integer")
    if maximum < 1 or maximum > MAX_N:
        raise ValueError("maximum outside the pilot bound")
    if isinstance(n, bool) or not isinstance(n, int) or n < 1 or n > maximum:
        raise ValueError("n must be a positive integer within the pilot bound")
    return harmonic(n)
