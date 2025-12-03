import UserAiKeysController from './UserAiKeysController.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'

export default {
  apply(webRouter) {
    // Get all user API keys
    webRouter.get(
      '/api/user/ai-keys',
      AuthenticationController.requireLogin(),
      UserAiKeysController.listKeys
    )

    // Add a new API key
    webRouter.post(
      '/api/user/ai-keys',
      AuthenticationController.requireLogin(),
      UserAiKeysController.addKey
    )

    // Delete an API key
    webRouter.delete(
      '/api/user/ai-keys/:keyId',
      AuthenticationController.requireLogin(),
      UserAiKeysController.deleteKey
    )

    // Check if user has any API keys (for AI assistant to know whether to use user's key)
    webRouter.get(
      '/api/user/ai-keys/status',
      AuthenticationController.requireLogin(),
      UserAiKeysController.getKeyStatus
    )
  },
}
