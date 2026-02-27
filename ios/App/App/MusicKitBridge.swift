import Foundation
import StoreKit
import Capacitor

class MusicKitBridge: NSObject {
    
    static func requestAuthorization(bridge: CAPBridgeProtocol?, developerToken: String) {
        SKCloudServiceController.requestAuthorization { status in
            switch status {
            case .authorized:
                let controller = SKCloudServiceController()
                controller.requestUserToken(forDeveloperToken: developerToken) { userToken, error in
                    if let error = error {
                        DispatchQueue.main.async {
                            bridge?.webView?.evaluateJavaScript(
                                "window.dispatchEvent(new CustomEvent('musickit-native-auth', { detail: { status: 'error', error: '\(error.localizedDescription)' } }))"
                            )
                        }
                        return
                    }
                    
                    guard let userToken = userToken else {
                        DispatchQueue.main.async {
                            bridge?.webView?.evaluateJavaScript(
                                "window.dispatchEvent(new CustomEvent('musickit-native-auth', { detail: { status: 'error', error: 'No token returned' } }))"
                            )
                        }
                        return
                    }
                    
                    DispatchQueue.main.async {
                        bridge?.webView?.evaluateJavaScript(
                            "window.dispatchEvent(new CustomEvent('musickit-native-auth', { detail: { status: 'authorized', userToken: '\(userToken)' } }))"
                        )
                    }
                }
            default:
                DispatchQueue.main.async {
                    bridge?.webView?.evaluateJavaScript(
                        "window.dispatchEvent(new CustomEvent('musickit-native-auth', { detail: { status: 'error', error: 'Authorization denied or restricted' } }))"
                    )
                }
            }
        }
    }
}