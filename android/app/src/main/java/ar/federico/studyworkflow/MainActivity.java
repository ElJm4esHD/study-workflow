package ar.federico.studyworkflow;

import android.content.Intent;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import android.content.IntentSender;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import ar.federico.studyworkflow.widget.GooglePlugin;
import ar.federico.studyworkflow.widget.WidgetsPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Pantalla de permiso de Google (Drive): se registra acá porque tiene que existir antes de que la actividad arranque.
    private ActivityResultLauncher<IntentSenderRequest> googleLauncher;

    public void launchGoogle(IntentSender sender) {
        googleLauncher.launch(new IntentSenderRequest.Builder(sender).build());
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // SystemBars con insetsHandling 'css' lo pide en Capacitor 8 (en el 9 viene solo).
        EdgeToEdge.enable(this);
        registerPlugin(SharedTextPlugin.class);
        registerPlugin(WidgetsPlugin.class);
        registerPlugin(GooglePlugin.class);
        googleLauncher = registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(),
            r -> GooglePlugin.onResult(this, r.getResultCode(), r.getData()));
        super.onCreate(savedInstanceState);
        SharedTextPlugin.capture(getIntent());
        WidgetsPlugin.capture(getIntent());
        // Atrás: decide la web (historial → pantalla padre); desde una pantalla principal se minimiza.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge == null) { moveTaskToBack(true); return; }
                bridge.getWebView().evaluateJavascript("window.swBack ? window.swBack() : false",
                    v -> { if (!"true".equals(v)) moveTaskToBack(true); });
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Con la app abierta: avisa a la web (si el plugin ya está cargado) para que tome el texto.
        if (SharedTextPlugin.capture(intent) && bridge != null && bridge.getPlugin("SharedText") != null) {
            ((SharedTextPlugin) bridge.getPlugin("SharedText").getInstance()).deliver();
        }
        // Ruta pedida desde un widget (tocar una tarea, un día o el "+").
        if (WidgetsPlugin.capture(intent) && bridge != null && bridge.getPlugin("Widgets") != null) {
            ((WidgetsPlugin) bridge.getPlugin("Widgets").getInstance()).deliver();
        }
    }
}
