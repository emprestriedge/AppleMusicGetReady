import Capacitor
import Foundation

@objc(MusicKitPlugin)
public class MusicKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MusicKitPlugin"
    public let jsName = "MusicKitPlugin"
    public let pluginMethods: [CAPPluginMethod] = []
}