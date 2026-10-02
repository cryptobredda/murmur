package app.murmur.mobile;

/** The preferred coordinates remain unchanged when the keyboard or viewport changes. */
final class OverlayPlacement {
    static int clamp(int preferred, int extent, int size, int margin) {
        return Math.max(margin, Math.min(preferred, Math.max(margin, extent - size - margin)));
    }
    static int restore(float preferredDp, float density, int extent, int size, int margin) {
        return clamp(Math.round(preferredDp * density), extent, size, margin);
    }
}
