package app.murmur.mobile;

/** Consumes the full pointer stream; a drag can never become a tap or long press. */
final class OverlayTouch {
    private final int slop;
    private float downX, downY;
    private boolean dragging, canceled;
    OverlayTouch(int slop) { this.slop = slop; }
    void down(float x, float y) { downX = x; downY = y; dragging = false; canceled = false; }
    boolean move(float x, float y) {
        float dx = x - downX, dy = y - downY;
        if (dx * dx + dy * dy > slop * slop) dragging = true;
        return dragging;
    }
    boolean tap(float x, float y) { move(x, y); return !dragging && !canceled; }
    void cancel() { canceled = true; }
    float dx(float x) { return x - downX; }
    float dy(float y) { return y - downY; }
    boolean dragged() { return dragging; }
}
