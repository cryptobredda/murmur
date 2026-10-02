package app.murmur.mobile;

import android.graphics.*;
import android.graphics.drawable.Drawable;
import android.os.SystemClock;

/** Murmur mark, a compact live waveform, and an unlabeled progress ring. */
final class OverlayGlyph extends Drawable {
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final int sizePixels;
    private String mode="idle";
    private boolean scheduled;
    private final Runnable tick=()->{scheduled=false;invalidateSelf();};
    OverlayGlyph(int sizePixels){this.sizePixels=sizePixels;paint.setColor(Color.WHITE);paint.setStrokeCap(Paint.Cap.ROUND);}
    void setMode(String value){if(!mode.equals(value)){mode=value;unscheduleSelf(tick);scheduled=false;invalidateSelf();}}
    @Override public void draw(Canvas canvas) {
        Rect bounds=getBounds();float w=bounds.width(),h=bounds.height();canvas.save();canvas.translate(bounds.left,bounds.top);
        paint.setStyle(Paint.Style.STROKE);
        if(mode.equals("processing")||mode.equals("starting")){
            paint.setStrokeWidth(w*.085f);float inset=w*.2f;
            canvas.drawArc(new RectF(inset,h*.2f,w-inset,h*.8f),(SystemClock.uptimeMillis()%1100)*360f/1100,265,false,paint);
        }else if(mode.equals("listening")){
            paint.setStrokeWidth(w*.075f);float level=RecordingService.currentLevel();double t=SystemClock.uptimeMillis()/130.0;
            for(int i=0;i<7;i++){float height=h*(.28f+(.25f+level*.40f)*(float)Math.abs(Math.sin(t+i*.8)));float x=w*(.1f+i*.133f);canvas.drawLine(x,h/2-height/2,x,h/2+height/2,paint);}
        }else{
            paint.setStrokeWidth(w*.105f);float[] heights={.46f,.9f,.65f,.35f};
            for(int i=0;i<4;i++){float height=h*heights[i],x=w*(.15f+i*.233f);canvas.drawLine(x,h/2-height/2,x,h/2+height/2,paint);}
        }
        canvas.restore();
        if((mode.equals("listening")||mode.equals("processing")||mode.equals("starting"))&&isVisible()&&!scheduled){scheduled=true;scheduleSelf(tick,SystemClock.uptimeMillis()+50);}
    }
    @Override public boolean setVisible(boolean visible,boolean restart){if(!visible){unscheduleSelf(tick);scheduled=false;}return super.setVisible(visible,restart);}
    @Override public void setAlpha(int alpha){paint.setAlpha(alpha);invalidateSelf();}
    @Override public void setColorFilter(ColorFilter filter){paint.setColorFilter(filter);invalidateSelf();}
    @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
    @Override public int getIntrinsicWidth(){return sizePixels;}
    @Override public int getIntrinsicHeight(){return sizePixels;}
}
