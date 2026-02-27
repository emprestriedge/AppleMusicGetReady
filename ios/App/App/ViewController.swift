import Capacitor
import WebKit

class ViewController: CAPBridgeViewController, WKScriptMessageHandler {

    override func capacitorDidLoad() {
        webView?.configuration.userContentController.add(self, name: "requestMusicAuth")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "requestMusicAuth",
              let body = message.body as? [String: Any],
              let developerToken = body["developerToken"] as? String else { return }

        MusicKitBridge.requestAuthorization(webView: webView, developerToken: developerToken)
    }
}
