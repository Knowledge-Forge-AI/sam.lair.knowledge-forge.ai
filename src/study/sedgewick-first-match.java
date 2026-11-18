// Adapted from Samuel Lair's GPL-3.0 source at
// lair001/sedgewick-algs4@7ade7f51594a3002124cc71a52b06b52a5837fcc.
// The selected source does not state "or later"; see the provenance manifest.
// Repository I/O interfaces and the main method are removed; the algorithm
// body is preserved for a static source view only.
// Java/browser compilation and runtime execution remain unqualified.
final class BinarySearchMinIndex {
    static int rank(int key, int[] a) {
        int lo = 0;
        int hi = a.length - 1;

        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;

            if (key > a[mid]) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return key == a[lo] ? lo : -1;
    }
}
