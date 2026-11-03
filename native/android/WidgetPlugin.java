package io.github.nekorak.anotherdino;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// The game hands the home-screen widget its numbers (record, daily challenge)
// and the texts in the player's language; the widget draws them.
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    static final String PREFS = "dino_widget";

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor e = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        e.putInt("best", call.getInt("best", 0));
        e.putBoolean("dailyDone", Boolean.TRUE.equals(call.getBoolean("dailyDone", false)));
        e.putInt("streak", call.getInt("streak", 0));
        e.putString("recordLabel", call.getString("recordLabel", "RECORD"));
        e.putString("dailyTodo", call.getString("dailyTodo", "Daily challenge: {h} h left"));
        e.putString("dailyDoneText", call.getString("dailyDoneText", "Daily challenge done!"));
        e.putString("streakText", call.getString("streakText", ""));
        e.apply();
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, DinoWidget.class));
        DinoWidget.render(ctx, mgr, ids);
        call.resolve();
    }
}
