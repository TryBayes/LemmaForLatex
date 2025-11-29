import AiAssistantController from './AiAssistantController.mjs'
import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.mjs'
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
    // Stream chat messages with AI assistant
    webRouter.post(
      '/project/:project_id/ai-assistant/chat',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      RateLimiterMiddleware.rateLimit(rateLimiters.aiAssistantChat),
      AiAssistantController.chat
    )

    // Get conversation history (placeholder for persistence)
    webRouter.get(
      '/project/:project_id/ai-assistant/history',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      AiAssistantController.getHistory
    )
  },
}

