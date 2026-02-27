import Capacitor
import Foundation

@objc(MusicKitPlugin)
public class MusicKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MusicKitPlugin"
    public let jsName = "MusicKitPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise)
    ]
    
    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard let developerToken = call.getString("developerToken") else {
            call.reject("Developer token required")
            return
        }
        
        MusicKitBridge.requestAuthorization(bridge: self.bridge, developerToken: developerToken)
        call.resolve()
    }
}