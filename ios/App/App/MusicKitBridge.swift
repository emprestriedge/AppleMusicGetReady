import Foundation
import AuthenticationServices
import Capacitor

class MusicKitBridge: NSObject {
    
    static func requestAuthorization(bridge: CAPBridgeProtocol?, developerToken: String) {
        guard let authURL = URL(string: "https://authorize.music.apple.com/woa?token=\(developerToken)&referrer=\(Bundle.main.bundleIdentifier ?? "")") else {
            return
        }
        
        let callbackScheme = "getreadyav"
        
        let session = ASWebAuthenticationSession(url: authURL, callbackURLScheme: callbackScheme) { callbackURL, error in
            if let error = error {
                DispatchQueue.main.async {
                    bridge?.webView?.evaluateJavaScript(
                        "window.dispatchEvent(new CustomEvent('musickit-native-auth', { detail: { status: 'error', error: '\(error.localizedDescription)' } }))"
                    )
                }
                return
            }
            
            guard let callbackURL = callbackURL,
                  let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                  let userToken = components.queryItems?.first(where: { $0.name == "music-user-token" })?.value else {
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
        
        session.prefersEphemeralWebBrowserSession = false
        
        DispatchQueue.main.async {
            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let rootVC = windowScene.windows.first?.rootViewController {
                session.presentationContextProvider = rootVC as? ASWebAuthenticationPresentationContextProviding
                session.start()
            }
        }
    }
}