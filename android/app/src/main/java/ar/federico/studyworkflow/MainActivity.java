package ar.federico.studyworkflow;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // SystemBars con insetsHandling 'css' lo pide en Capacitor 8 (en el 9 viene solo).
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
