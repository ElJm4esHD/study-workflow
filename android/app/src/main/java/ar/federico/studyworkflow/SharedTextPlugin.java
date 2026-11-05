package ar.federico.studyworkflow;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Guarda el texto de un intent ACTION_SEND hasta que la web lo pide con take(). */
@CapacitorPlugin(name = "SharedText")
public class SharedTextPlugin extends Plugin {
    private static String pending;

    /** Lo llama MainActivity en onCreate y onNewIntent; devuelve true si había texto. */
    static boolean capture(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return false;
        String t = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (t == null || t.isEmpty()) return false;
        pending = t;
        return true;
    }

    void deliver() {
        if (pending == null) return;
        JSObject o = new JSObject();
        o.put("text", pending);
        pending = null;
        notifyListeners("received", o);
    }

    @PluginMethod
    public void take(PluginCall call) {
        JSObject o = new JSObject();
        o.put("text", pending == null ? JSObject.NULL : pending);
        pending = null;
        call.resolve(o);
    }
}
