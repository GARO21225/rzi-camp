import UIKit
import WebKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = RZIBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}


/// Pont Capacitor du projet : enregistre les plugins locaux (sans paquet npm).
class RZIBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ImpressionPlugin())
    }
}

/// Impression des rapports et fiches d'intervention depuis l'application.
/// window.print() ne fait rien dans WKWebView : le document est chargé dans une
/// WKWebView hors écran puis envoyé à la fenêtre d'impression iOS (AirPrint ou PDF).
/// Côté web : utils/impression.js → registerPlugin('Impression').imprimer({ html, titre }).
@objc(ImpressionPlugin)
public class ImpressionPlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate {
    public let identifier = "ImpressionPlugin"
    public let jsName = "Impression"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "imprimer", returnType: CAPPluginReturnPromise)
    ]

    // Gardés en propriété : ne doivent pas être libérés pendant le chargement / l'impression.
    private var vueImpression: WKWebView?
    private var appelEnCours: CAPPluginCall?
    private var titreEnCours = "Rapport"

    @objc func imprimer(_ call: CAPPluginCall) {
        let html = call.getString("html") ?? ""
        titreEnCours = call.getString("titre") ?? "Rapport"
        DispatchQueue.main.async {
            self.appelEnCours = call
            let vue = WKWebView(frame: CGRect(x: 0, y: 0, width: 794, height: 1123))
            vue.navigationDelegate = self
            self.vueImpression = vue
            vue.loadHTMLString(html, baseURL: nil)
        }
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = titreEnCours
        let controleur = UIPrintInteractionController.shared
        controleur.printInfo = info
        controleur.printFormatter = webView.viewPrintFormatter()
        controleur.present(animated: true) { _, termine, erreur in
            if let erreur = erreur { self.appelEnCours?.reject(erreur.localizedDescription) }
            else { self.appelEnCours?.resolve(["imprime": termine]) }
            self.appelEnCours = nil
            self.vueImpression = nil
        }
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        appelEnCours?.reject(error.localizedDescription)
        appelEnCours = nil
        vueImpression = nil
    }
}
