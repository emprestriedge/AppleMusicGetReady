import UIKit
import Capacitor
import AuthenticationServices
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Inject a flag into the webview so JS knows it's running natively
        let userScript = WKUserScript(
            source: "window.__CAPACITOR_NATIVE__ = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        
        // Find the webview and inject
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            if let webView = self.window?.rootViewController?.view.subviews
                .compactMap({ $0 as? WKWebView }).first {
                webView.configuration.userContentController.addUserScript(userScript)
            }
        }
        
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

extension AppDelegate: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return window ?? ASPresentationAnchor()
    }
}