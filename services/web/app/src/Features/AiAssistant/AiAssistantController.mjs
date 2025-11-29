import { stepCountIs, streamText, tool } from 'ai'
import { z } from 'zod'
import SessionManager from '../Authentication/SessionManager.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectLocator from '../Project/ProjectLocator.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import { AiConversation } from '../../models/AiConversation.mjs'
import { AiMessageCount } from '../../models/AiMessageCount.mjs'
import UserGetter from '../User/UserGetter.mjs'
import SubscriptionLocator from '../Subscription/SubscriptionLocator.mjs'

// Check if user has reached their AI message limit
async function checkMessageLimit(userId) {
  try {
    // Check if user has a paid subscription
    const subscription = await SubscriptionLocator.promises.getUsersSubscription(userId)
    
    // If user has an active paid subscription, they have unlimited messages
    if (subscription && subscription.planCode && subscription.planCode !== 'free') {
      return { allowed: true, remaining: -1, limit: -1 }
    }
    
    // Get the weekly limit from settings
    const weeklyLimit = Settings.aiMessageLimits?.freeMessagesPerWeek || 5
    
    // Get user's current weekly count
    const { weeklyMessages } = await AiMessageCount.getWeeklyCount(userId)
    
    const remaining = weeklyLimit - weeklyMessages
    
    if (remaining <= 0) {
      return { 
        allowed: false, 
        remaining: 0, 
        limit: weeklyLimit,
        message: `You've used all ${weeklyLimit} free AI messages this week. Upgrade to Lemma Pro for unlimited AI assistance.`
      }
    }
    
    return { allowed: true, remaining, limit: weeklyLimit }
  } catch (error) {
    logger.error({ err: error, userId }, 'Error checking message limit')
    // On error, allow the message but log it
    return { allowed: true, remaining: -1, limit: -1 }
  }
}

// System prompt for the LaTeX assistant
const SYSTEM_PROMPT = `You are an expert LaTeX assistant integrated into Lemma, a collaborative LaTeX editor. Your role is to help users with their LaTeX documents.

You have access to tools that let you:
1. List all files in the current project
2. Read the content of any file
3. Edit files by replacing specific content

When helping users:
- Be concise and helpful
- When editing files, always read the file first to understand its current state
- Explain what changes you're making and why
- If you encounter errors, explain them clearly
- For LaTeX-specific questions, provide examples when helpful

Always use the tools when the user asks about their document or wants to make changes. Don't assume you know the document content - read it first.`

/**
 * Stream chat completion with AI assistant
 */
async function chat(req, res) {
  const { project_id: projectId, conversation_id: conversationId } = req.params
  const { messages, model } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' })
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' })
  }

  // Check message limit before processing
  const limitCheck = await checkMessageLimit(userId)
  if (!limitCheck.allowed) {
    return res.status(429).json({ 
      error: 'message_limit_reached',
      message: limitCheck.message,
      remaining: limitCheck.remaining,
      limit: limitCheck.limit,
      upgradeUrl: '/user/subscription/plans'
    })
  }

  try {
    // Verify user has access to project
    const project = await ProjectGetter.promises.getProject(projectId, {
      rootFolder: true,
      owner_ref: true,
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // Create tools for the AI agent
    const tools = createProjectTools(projectId, userId)

    // Use model from request or fall back to settings/default
    const selectedModel = model || Settings.ai?.model || 'anthropic/claude-sonnet-4-5'

    // Track parts in order for saving to database
    let allToolResults = []
    let messageParts = []
    let currentTextPart = { type: 'text', content: '' }

    // Stream the response using AI SDK with tools enabled
    const result = streamText({
      model: selectedModel,
      system: SYSTEM_PROMPT,
      messages,
      tools,
      // Allow multiple LLM-tool rounds so the model can respond after tool calls
      stopWhen: stepCountIs(6),
      onStepFinish: async ({ toolResults }) => {
        if (toolResults && toolResults.length > 0) {
          // Save current text part if it has content
          if (currentTextPart.content.trim()) {
            messageParts.push({ ...currentTextPart })
            currentTextPart = { type: 'text', content: '' }
          }
          
          // Add tool results part
          const toolResultsForDb = toolResults.map(tr => ({
            toolName: tr.toolName,
            result: tr.result,
          }))
          allToolResults = [...allToolResults, ...toolResultsForDb]
          messageParts.push({ type: 'tool_results', results: toolResultsForDb })
          
          const sseData = `data: ${JSON.stringify({ type: 'tool_results', data: toolResults })}\n\n`
          res.write(sseData)
        }
      },
    })

    // Stream text deltas to client
    let totalText = ''
    for await (const chunk of result.textStream) {
      if (chunk) {
        totalText += chunk
        currentTextPart.content += chunk
        const sseData = `data: ${JSON.stringify({ type: 'text', data: chunk })}\n\n`
        res.write(sseData)
      }
    }

    // Save any remaining text part
    if (currentTextPart.content.trim()) {
      messageParts.push({ ...currentTextPart })
    }

    // Save conversation to database
    try {
      // Find the last user message from the request
      const lastUserMessage = messages[messages.length - 1]
      
      // Generate title from first user message if this is a new conversation
      const generateTitle = (content) => {
        const maxLength = 50
        const cleaned = content.replace(/\n/g, ' ').trim()
        return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned
      }

      if (conversationId) {
        // Update existing conversation
        await AiConversation.findByIdAndUpdate(
          conversationId,
          {
            $push: {
              messages: {
                $each: [
                  { role: 'user', content: lastUserMessage.content, timestamp: new Date() },
                  { role: 'assistant', content: totalText, timestamp: new Date(), toolResults: allToolResults, parts: messageParts },
                ],
              },
            },
            $set: { updatedAt: new Date() },
          }
        )
      } else {
        // Create new conversation
        const newConversation = new AiConversation({
          userId,
          projectId,
          title: generateTitle(lastUserMessage.content),
          messages: [
            { role: 'user', content: lastUserMessage.content, timestamp: new Date() },
            { role: 'assistant', content: totalText, timestamp: new Date(), toolResults: allToolResults, parts: messageParts },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        await newConversation.save()
        
        // Send the new conversation ID to client
        res.write(`data: ${JSON.stringify({ type: 'conversation_id', data: newConversation._id.toString() })}\n\n`)
      }

      // Increment user's message count (both total and weekly)
      await AiMessageCount.incrementWeeklyCount(userId)
    } catch (saveError) {
      logger.error({ err: saveError, projectId, userId }, 'Error saving AI conversation')
      // Don't fail the request if saving fails
    }
    
    // Send completion signal
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
  } catch (error) {
    logger.error({ err: error, projectId }, 'AI Assistant chat error')

    // If headers already sent, send error as SSE
    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`
      )
      res.end()
    } else {
      res.status(500).json({ error: 'Failed to process chat request' })
    }
  }
}

/**
 * Create tools for interacting with project files
 */
function createProjectTools(projectId, userId) {
  return {
    list_files: tool({
      description:
        'List all files and folders in the current LaTeX project. Returns file paths, types (doc/file/folder), and IDs.',
      inputSchema: z.object({
        folder: z.string().describe('The folder path to list files from. Use "/" for root folder.'),
      }),
      execute: async ({ folder }) => {
        try {
          const project = await ProjectGetter.promises.getProject(projectId, {
            rootFolder: true,
          })

          if (!project) {
            return { error: 'Project not found' }
          }

          const files = []
          collectFiles(project.rootFolder[0], '', files)

          const result = {
            success: true,
            files: files.map(f => ({
              path: f.path,
              type: f.type,
              id: f.id,
              name: f.name,
            })),
          }
          return result
        } catch (error) {
          logger.error({ err: error, projectId }, 'Error listing files')
          return { error: error.message }
        }
      },
    }),

    read_file: tool({
      description:
        'Read the content of a file in the project by its path. Use this to understand the current state of a document before making changes.',
      inputSchema: z.object({
        path: z.string().describe('The file path relative to project root, e.g., "main.tex" or "chapters/intro.tex"'),
      }),
      execute: async ({ path }) => {
        try {
          const project = await ProjectGetter.promises.getProject(projectId, {
            rootFolder: true,
          })

          if (!project) {
            return { error: 'Project not found' }
          }

          // Find the element by path
          const { element, type } = await ProjectLocator.promises.findElementByPath({
            project,
            path: path.startsWith('/') ? path : `/${path}`,
          })

          if (!element) {
            return { error: `File not found: ${path}` }
          }

          if (type !== 'doc') {
            return {
              error: `Cannot read content of ${type}. Only document files (.tex, .bib, etc.) can be read.`,
            }
          }

          // Get the document content
          const { lines } = await ProjectEntityHandler.promises.getDoc(
            projectId,
            element._id.toString()
          )

          const result = {
            success: true,
            path,
            content: lines.join('\n'),
            lineCount: lines.length,
          }
          return result
        } catch (error) {
          logger.error({ err: error, projectId, path }, 'Error reading file')
          return { error: error.message }
        }
      },
    }),

    edit_file: tool({
      description:
        'Edit a file by replacing specific content. You must provide the exact text to find and the new text to replace it with. Always read the file first to get the exact content.',
      inputSchema: z.object({
        path: z.string().describe('The file path relative to project root, e.g., "main.tex"'),
        old_content: z.string().describe('The exact content to find and replace. Must match exactly.'),
        new_content: z.string().describe('The new content to replace the old content with.'),
      }),
      execute: async ({ path, old_content, new_content }) => {
        try {
          const project = await ProjectGetter.promises.getProject(projectId, {
            rootFolder: true,
          })

          if (!project) {
            return { error: 'Project not found' }
          }

          // Find the element by path
          const { element, type } = await ProjectLocator.promises.findElementByPath({
            project,
            path: path.startsWith('/') ? path : `/${path}`,
          })

          if (!element) {
            return { error: `File not found: ${path}` }
          }

          if (type !== 'doc') {
            return {
              error: `Cannot edit ${type}. Only document files can be edited.`,
            }
          }

          const docId = element._id.toString()

          // Get current content
          const { lines } = await DocumentUpdaterHandler.promises.getDocument(
            projectId,
            docId,
            -1
          )

          const currentContent = lines.join('\n')

          // Check if old_content exists
          if (!currentContent.includes(old_content)) {
            return {
              error:
                'The specified content was not found in the file. Please read the file again to get the exact content.',
              hint: 'Make sure whitespace and line breaks match exactly.',
            }
          }

          // Replace content
          const newContent = currentContent.replace(old_content, new_content)
          const newLines = newContent.split('\n')

          // Update the document
          await DocumentUpdaterHandler.promises.setDocument(
            projectId,
            docId,
            userId,
            newLines,
            'ai-assistant'
          )

          const result = {
            success: true,
            path,
            message: 'File updated successfully',
            linesChanged: Math.abs(newLines.length - lines.length),
          }
          return result
        } catch (error) {
          logger.error({ err: error, projectId, path }, 'Error editing file')
          return { error: error.message }
        }
      },
    }),
  }
}

/**
 * Recursively collect all files from a folder structure
 */
function collectFiles(folder, basePath, results) {
  // Add docs
  if (folder.docs) {
    for (const doc of folder.docs) {
      results.push({
        path: basePath ? `${basePath}/${doc.name}` : doc.name,
        type: 'doc',
        id: doc._id.toString(),
        name: doc.name,
      })
    }
  }

  // Add fileRefs (binary files like images)
  if (folder.fileRefs) {
    for (const file of folder.fileRefs) {
      results.push({
        path: basePath ? `${basePath}/${file.name}` : file.name,
        type: 'file',
        id: file._id.toString(),
        name: file.name,
      })
    }
  }

  // Recursively process subfolders
  if (folder.folders) {
    for (const subfolder of folder.folders) {
      const subPath = basePath ? `${basePath}/${subfolder.name}` : subfolder.name
      results.push({
        path: subPath,
        type: 'folder',
        id: subfolder._id.toString(),
        name: subfolder.name,
      })
      collectFiles(subfolder, subPath, results)
    }
  }
}

/**
 * List all conversations for a user in a project
 */
async function listConversations(req, res) {
  const { project_id: projectId } = req.params
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' })
  }

  try {
    const conversations = await AiConversation.find(
      { userId, projectId },
      { title: 1, createdAt: 1, updatedAt: 1, 'messages.0': 1 }
    ).sort({ updatedAt: -1 })

    res.json({
      conversations: conversations.map(c => ({
        id: c._id.toString(),
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: c.messages?.length || 0,
      })),
    })
  } catch (error) {
    logger.error({ err: error, projectId, userId }, 'Error listing AI conversations')
    res.status(500).json({ error: 'Failed to list conversations' })
  }
}

/**
 * Get a specific conversation
 */
async function getConversation(req, res) {
  const { project_id: projectId, conversation_id: conversationId } = req.params
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' })
  }

  try {
    const conversation = await AiConversation.findOne({
      _id: conversationId,
      userId,
      projectId,
    })

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    res.json({
      id: conversation._id.toString(),
      title: conversation.title,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    })
  } catch (error) {
    logger.error({ err: error, projectId, conversationId, userId }, 'Error fetching AI conversation')
    res.status(500).json({ error: 'Failed to fetch conversation' })
  }
}

/**
 * Delete a specific conversation
 */
async function deleteConversation(req, res) {
  const { project_id: projectId, conversation_id: conversationId } = req.params
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' })
  }

  try {
    const result = await AiConversation.findOneAndDelete({
      _id: conversationId,
      userId,
      projectId,
    })

    if (!result) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    res.json({ success: true })
  } catch (error) {
    logger.error({ err: error, projectId, conversationId, userId }, 'Error deleting AI conversation')
    res.status(500).json({ error: 'Failed to delete conversation' })
  }
}

/**
 * Get message count for the current user
 */
async function getMessageCount(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' })
  }

  try {
    // Check subscription status
    const subscription = await SubscriptionLocator.promises.getUsersSubscription(userId)
    const hasPaidPlan = subscription && subscription.planCode && subscription.planCode !== 'free'
    
    // Get weekly count
    const { weeklyMessages, weekStartDate } = await AiMessageCount.getWeeklyCount(userId)
    const weeklyLimit = hasPaidPlan ? -1 : (Settings.aiMessageLimits?.freeMessagesPerWeek || 5)
    
    const countDoc = await AiMessageCount.findOne({ userId })
    res.json({
      totalMessages: countDoc?.totalMessages || 0,
      weeklyMessages,
      weeklyLimit,
      remaining: weeklyLimit === -1 ? -1 : Math.max(0, weeklyLimit - weeklyMessages),
      weekStartDate,
      hasPaidPlan,
      lastMessageAt: countDoc?.lastMessageAt || null,
    })
  } catch (error) {
    logger.error({ err: error, userId }, 'Error fetching AI message count')
    res.status(500).json({ error: 'Failed to fetch message count' })
  }
}

export default {
  chat,
  listConversations,
  getConversation,
  deleteConversation,
  getMessageCount,
}
