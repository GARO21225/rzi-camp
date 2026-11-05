package com.roxgold.rzicamp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins locaux : à enregistrer AVANT super.onCreate (création du pont Capacitor).
        registerPlugin(ImpressionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
