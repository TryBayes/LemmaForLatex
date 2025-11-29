import { stepCountIs, streamText, tool } from 'ai'
import { z } from 'zod'
import SessionManager from '../Authentication/SessionManager.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectLocator from '../Project/ProjectLocator.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'

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
  const { project_id: projectId } = req.params
  const { messages } = req.body
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' })
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' })
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

    console.log('[AI Assistant] Starting streamText with model:', Settings.ai?.model || 'anthropic/claude-sonnet-4-5')
    console.log('[AI Assistant] Messages:', JSON.stringify(messages, null, 2))

    // Stream the response using AI SDK with tools enabled
    const result = streamText({
      model: Settings.ai?.model || 'anthropic/claude-sonnet-4-5',
      system: SYSTEM_PROMPT,
      messages,
      tools,
      // Allow multiple LLM-tool rounds so the model can respond after tool calls
      stopWhen: stepCountIs(6),
      onStepFinish: async ({ toolResults }) => {
        console.log('[AI Assistant] Step finished, toolResults:', toolResults)
        if (toolResults && toolResults.length > 0) {
          const sseData = `data: ${JSON.stringify({ type: 'tool_results', data: toolResults })}\n\n`
          console.log('[AI Assistant] Sending tool_results SSE:', sseData)
          res.write(sseData)
        }
      },
    })

    console.log('[AI Assistant] Starting to stream text...')
    
    // Stream text deltas to client
    let totalText = ''
    for await (const chunk of result.textStream) {
      if (chunk) {
        totalText += chunk
        const sseData = `data: ${JSON.stringify({ type: 'text', data: chunk })}\n\n`
        console.log('[AI Assistant] Sending text chunk:', chunk)
        res.write(sseData)
      }
    }

    console.log('[AI Assistant] Stream complete. Total text:', totalText)
    
    // Send completion signal
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    console.log('[AI Assistant] Sent done signal')
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
          console.log('[AI Assistant] list_files called with folder:', folder)
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
          console.log('[AI Assistant] list_files result:', result)
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
          console.log('[AI Assistant] read_file called with path:', path)
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
          console.log('[AI Assistant] read_file result for', path, '- lines:', lines.length)
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
          console.log('[AI Assistant] edit_file called with path:', path)
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
          console.log('[AI Assistant] edit_file result:', result)
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
 * Get conversation history (placeholder for future persistence)
 */
async function getHistory(req, res) {
  const { project_id: projectId } = req.params
  const userId = SessionManager.getLoggedInUserId(req.session)

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' })
  }

  // For now, return empty history - can be extended to persist conversations
  res.json({ messages: [] })
}

export default {
  chat,
  getHistory,
}
