import AiAssistantController from './AiAssistantController.mjs'
import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.mjs'

const rateLimiters = {
  aiAssistantChat: new RateLimiter('ai-assistant-chat', {
    points: 30,
    duration: 60,
  }),
}

export default {
  apply(webRouter) {
    // Stream chat messages with AI assistant (new conversation)
    webRouter.post(
      '/project/:project_id/ai-assistant/chat',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      RateLimiterMiddleware.rateLimit(rateLimiters.aiAssistantChat),
      AiAssistantController.chat
    )

    // Stream chat messages with AI assistant (existing conversation)
    webRouter.post(
      '/project/:project_id/ai-assistant/conversations/:conversation_id/chat',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      RateLimiterMiddleware.rateLimit(rateLimiters.aiAssistantChat),
      AiAssistantController.chat
    )

    // List all conversations for a project
    webRouter.get(
      '/project/:project_id/ai-assistant/conversations',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      AiAssistantController.listConversations
    )

    // Get a specific conversation
    webRouter.get(
      '/project/:project_id/ai-assistant/conversations/:conversation_id',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      AiAssistantController.getConversation
    )

    // Delete a specific conversation
    webRouter.delete(
      '/project/:project_id/ai-assistant/conversations/:conversation_id',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
      AiAssistantController.deleteConversation
    )

    // Get user's message count
    webRouter.get(
      '/ai-assistant/message-count',
      AuthenticationController.requireLogin(),
      AiAssistantController.getMessageCount
    )
  },
}
