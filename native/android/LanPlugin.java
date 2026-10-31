package io.github.nekorak.anotherdino;

import android.content.Context;
import android.net.wifi.WifiManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// UDP sockets for LAN play over Wi-Fi or a phone hotspot (the game's JS talks to it
// through Capacitor as the "Lan" plugin).
@CapacitorPlugin(name = "Lan")
public class LanPlugin extends Plugin {
    private DatagramSocket socket;
    private WifiManager.MulticastLock lock;
    private final ExecutorService sender = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void start(PluginCall call) {
        int port = call.getInt("port", 47777);
        try {
            closeSocket();
            WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) {
                // many phones drop broadcast packets unless an app holds this lock
                lock = wifi.createMulticastLock("another-dino");
                lock.setReferenceCounted(false);
                lock.acquire();
            }
            DatagramSocket s = new DatagramSocket(null);
            s.setReuseAddress(true);
            s.setBroadcast(true);
            s.bind(new InetSocketAddress(port));
            socket = s;
            Thread receiver = new Thread(() -> receiveLoop(s), "lan-receiver");
            receiver.setDaemon(true);
            receiver.start();
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open port " + port + ": " + e.getMessage());
        }
    }

    private void receiveLoop(DatagramSocket s) {
        byte[] buf = new byte[16384];
        while (!s.isClosed()) {
            try {
                DatagramPacket p = new DatagramPacket(buf, buf.length);
                s.receive(p);
                JSObject msg = new JSObject();
                msg.put("data", new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8));
                msg.put("address", p.getAddress().getHostAddress());
                msg.put("port", p.getPort());
                notifyListeners("message", msg);
            } catch (Exception e) {
                if (s.isClosed()) break;
            }
        }
    }

    @PluginMethod
    public void send(PluginCall call) {
        String host = call.getString("host");
        int port = call.getInt("port", 47777);
        String data = call.getString("data", "");
        DatagramSocket s = socket;
        if (s == null || host == null) {
            call.reject("not started");
            return;
        }
        sender.execute(() -> {
            try {
                byte[] b = data.getBytes(StandardCharsets.UTF_8);
                s.send(new DatagramPacket(b, b.length, InetAddress.getByName(host), port));
                call.resolve();
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    @PluginMethod
    public void broadcast(PluginCall call) {
        int port = call.getInt("port", 47777);
        String data = call.getString("data", "");
        DatagramSocket s = socket;
        if (s == null) {
            call.reject("not started");
            return;
        }
        sender.execute(() -> {
            byte[] b = data.getBytes(StandardCharsets.UTF_8);
            for (InetAddress addr : broadcastAddresses()) {
                try {
                    s.send(new DatagramPacket(b, b.length, addr, port));
                } catch (Exception ignored) {
                    // some interfaces refuse broadcasts; the others still get it
                }
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void addresses(PluginCall call) {
        JSArray list = new JSArray();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address) list.put(a.getHostAddress());
                }
            }
        } catch (Exception ignored) {
            // no network interfaces available
        }
        JSObject res = new JSObject();
        res.put("addresses", list);
        call.resolve(res);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        closeSocket();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        closeSocket();
        sender.shutdownNow();
    }

    private void closeSocket() {
        if (socket != null) {
            socket.close();
            socket = null;
        }
        if (lock != null && lock.isHeld()) lock.release();
        lock = null;
    }

    // The subnet broadcast address of every interface (Wi-Fi and hotspot), plus 255.255.255.255.
    private List<InetAddress> broadcastAddresses() {
        List<InetAddress> out = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    InetAddress b = ia.getBroadcast();
                    if (b != null && !out.contains(b)) out.add(b);
                }
            }
        } catch (Exception ignored) {
            // fall back to the global broadcast address only
        }
        try {
            out.add(InetAddress.getByName("255.255.255.255"));
        } catch (Exception ignored) {
            // cannot happen for a literal address
        }
        return out;
    }
}
