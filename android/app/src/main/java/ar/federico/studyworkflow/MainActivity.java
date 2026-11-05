package ar.federico.studyworkflow;

import android.content.Intent;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // SystemBars con insetsHandling 'css' lo pide en Capacitor 8 (en el 9 viene solo).
        EdgeToEdge.enable(this);
        registerPlugin(SharedTextPlugin.class);
        super.onCreate(savedInstanceState);
        SharedTextPlugin.capture(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Con la app abierta: avisa a la web (si el plugin ya está cargado) para que tome el texto.
        if (SharedTextPlugin.capture(intent) && bridge != null && bridge.getPlugin("SharedText") != null) {
            ((SharedTextPlugin) bridge.getPlugin("SharedText").getInstance()).deliver();
        }
    }
}
