package io.github.nekorak.anotherdino;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.util.Calendar;

// Home-screen widget: the record and how long is left for today's daily challenge.
// Tapping it opens the game. Android refreshes it every 30 minutes.
public class DinoWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        SharedPreferences p = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE);
        int best = p.getInt("best", 0);
        boolean done = p.getBoolean("dailyDone", false);
        // the daily challenge changes at midnight
        Calendar now = Calendar.getInstance();
        Calendar midnight = (Calendar) now.clone();
        midnight.add(Calendar.DAY_OF_MONTH, 1);
        midnight.set(Calendar.HOUR_OF_DAY, 0);
        midnight.set(Calendar.MINUTE, 0);
        midnight.set(Calendar.SECOND, 0);
        long hours = Math.max(1, (midnight.getTimeInMillis() - now.getTimeInMillis() + 3599999) / 3600000);
        String daily = done ? p.getString("dailyDoneText", "") : p.getString("dailyTodo", "").replace("{h}", String.valueOf(hours));
        Intent open = new Intent(ctx, MainActivity.class);
        PendingIntent tap = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_dino);
            v.setTextViewText(R.id.widget_record, p.getString("recordLabel", "RECORD") + " " + String.format("%05d", best));
            v.setTextViewText(R.id.widget_daily, daily);
            v.setTextViewText(R.id.widget_streak, p.getString("streakText", ""));
            v.setOnClickPendingIntent(R.id.widget_root, tap);
            mgr.updateAppWidget(id, v);
        }
    }
}
