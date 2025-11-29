import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import Settings from '@overleaf/settings'
import SessionManager from '../Authentication/SessionManager.mjs'
import { createAITools } from './AITools.mjs'

const SYSTEM_PROMPT = `You are an expert LaTeX assistant integrated into a LaTeX editor (similar to Overleaf). Your role is to help users write, edit, and debug their LaTeX documents.

You have access to tools that let you:
- List all files in the project
- Read file contents
- Edit files by replacing text
- Search across the project

When helping users:
1. First use listFiles to understand the project structure if needed
2. Use readFile to examine relevant files before making suggestions
3. When making edits, use editFile with exact string matching
4. Be precise with LaTeX syntax - proper escaping, environments, commands
5. Explain what you're doing and why

Always confirm successful edits and offer to make additional changes if needed.`

async function chat(req, res) {
  const { project_id: projectId } = req.params
  const { messages } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const apiKey = Settings.ai?.openaiApiKey
  if (!apiKey) {
    return res.status(500).json({ error: 'AI service not configured' })
  }

  const openai = createOpenAI({ apiKey })
  const tools = createAITools(projectId, userId)

  try {
    const result = streamText({
      model: openai('gpt-4o'),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      maxSteps: 10, // Allow multi-step agent reasoning
    })

    // Stream the response back to the client
    return result.toDataStreamResponse(res)
  } catch (error) {
    console.error('AI chat error:', error)
    return res.status(500).json({ error: 'Failed to process AI request' })
  }
}

export default {
  chat,
}

