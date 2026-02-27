import StoreKit

let controller = SKCloudServiceController()
controller.requestUserToken(forDeveloperToken: "test") { token, error in
    print(token)
}
