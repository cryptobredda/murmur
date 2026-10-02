package app.murmur.mobile;
import org.junit.Test;
import static org.junit.Assert.*;
public class OverlayBehaviorTest {
    @Test public void aDraggedButtonNeverTriggersDictation() {
        OverlayTouch touch = new OverlayTouch(8);
        touch.down(100, 100); assertTrue(touch.move(130, 140));
        assertFalse(touch.tap(130, 140));
        touch.down(100,100); assertTrue(touch.tap(102,102));
        touch.down(100,100);touch.cancel();assertFalse(touch.tap(100,100));
    }
    @Test public void returningToOriginalScreenRestoresPreferredPosition() {
        assertEquals(260,OverlayPlacement.restore(260,1,390,52,8));
        assertEquals(160,OverlayPlacement.restore(260,1,220,52,8));
        assertEquals(260,OverlayPlacement.restore(260,1,390,52,8));
        assertEquals(520,OverlayPlacement.restore(260,2,780,104,16));
    }
    @Test public void temporaryPauseExpiresAndDropTargetIsOnlyAtBottomCentre() {
        long now=1000000,until=now+OverlayPause.TEN_MINUTES;
        assertTrue(OverlayPause.active(until,now));assertTrue(OverlayPause.active(until,until-1));assertFalse(OverlayPause.active(until,until));
        assertFalse(OverlayPause.active(until,now-1000));
        assertTrue(OverlayPause.inTarget(195,790,390,844,1));assertFalse(OverlayPause.inTarget(350,790,390,844,1));assertFalse(OverlayPause.inTarget(195,400,390,844,1));
        assertTrue(OverlayPause.inTarget(585,2370,1170,2532,3));
        assertEquals(.2f,OverlayPause.opacity(-1),.001);assertEquals(1f,OverlayPause.opacity(2),.001);assertEquals(1f,OverlayPause.opacity(Double.NaN),.001);
    }
}
