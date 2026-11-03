package io.github.nekorak.anotherdino;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// One-tap update: downloads the new APK from GitHub Releases and opens Android's
// installer. Android always asks the player to confirm the install, and the very
// first time it asks to allow installs from this app; after that it is one tap.
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    private File pending;

    @PluginMethod
    public void install(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://github.com/Nekorak/Another-Dino/")) {
            call.reject("bad url");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("no cache dir");
                File apk = new File(dir, "another-dino.apk");
                download(url, apk);
                pending = apk;
                JSObject res = new JSObject();
                if (canInstall()) {
                    launchInstaller(apk);
                    res.put("status", "installer");
                } else {
                    // send the player to "Install unknown apps" for this app;
                    // the installer opens by itself when they come back
                    Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(i);
                    res.put("status", "permission");
                }
                call.resolve(res);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }, "apk-update").start();
    }

    @Override
    protected void handleOnResume() {
        if (pending != null && pending.exists() && canInstall()) {
            File apk = pending;
            pending = null;
            launchInstaller(apk);
        }
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void launchInstaller(File apk) {
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
    }

    private void download(String url, File out) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        int code = c.getResponseCode();
        if (code != 200) throw new Exception("HTTP " + code);
        long total = c.getContentLengthLong();
        long done = 0;
        int lastPct = -1;
        try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(out)) {
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) {
                os.write(buf, 0, n);
                done += n;
                int pct = total > 0 ? (int) (done * 100 / total) : -1;
                if (pct != lastPct) {
                    lastPct = pct;
                    JSObject p = new JSObject();
                    p.put("percent", pct);
                    notifyListeners("progress", p);
                }
            }
        } finally {
            c.disconnect();
        }
    }
}
