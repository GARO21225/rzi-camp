package com.roxgold.rzicamp;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Impression des rapports et fiches d'intervention depuis l'application.
 * window.print() ne fait rien dans la WebView Android : on charge le document
 * dans une WebView hors écran et on ouvre la fenêtre d'impression du système
 * (imprimante Wi-Fi ou « Enregistrer au format PDF »).
 * Côté web : utils/impression.js → registerPlugin('Impression').imprimer({ html, titre }).
 */
@CapacitorPlugin(name = "Impression")
public class ImpressionPlugin extends Plugin {

    // Gardée en champ : ne doit pas être libérée pendant que le service d'impression la lit.
    private WebView vueImpression;

    @PluginMethod
    public void imprimer(PluginCall call) {
        final String html = call.getString("html", "");
        final String titre = call.getString("titre", "Rapport");
        getActivity().runOnUiThread(() -> {
            WebView vue = new WebView(getContext());
            vue.getSettings().setJavaScriptEnabled(false);
            vue.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView v, String url) {
                    PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                    if (pm == null) {
                        call.reject("Impression indisponible sur cet appareil");
                        return;
                    }
                    pm.print(titre, v.createPrintDocumentAdapter(titre),
                        new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                    call.resolve();
                }
            });
            vueImpression = vue;
            vue.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
        });
    }
}
