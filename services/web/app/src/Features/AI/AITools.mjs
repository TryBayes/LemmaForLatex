import { z } from 'zod'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'

/**
 * Create AI tools for a specific project context
 * @param {string} projectId - The project ID
 * @param {string} userId - The user ID making the request
 * @returns {Object} Tool definitions for the AI SDK
 */
export function createAITools(projectId, userId) {
  return {
    listFiles: {
      description:
        'List all files and documents in the project. Returns file paths and types.',
      parameters: z.object({}),
      execute: async () => {
        const entities =
          await ProjectEntityHandler.promises.getAllEntities(projectId)
        const files = []

        for (const { path, doc } of entities.docs) {
          files.push({ path, type: 'doc', id: doc._id.toString() })
        }

        for (const { path, file } of entities.files) {
          files.push({ path, type: 'file', id: file._id.toString() })
        }

        return { files }
      },
    },

    readFile: {
      description:
        'Read the content of a document file by its path. Only works for .tex, .bib, .cls, .sty and other text-based LaTeX files.',
      parameters: z.object({
        path: z
          .string()
          .describe(
            'The path to the file to read, e.g., "/main.tex" or "/chapters/introduction.tex"'
          ),
      }),
      execute: async ({ path }) => {
        // Get all docs to find the one matching the path
        const docs = await ProjectEntityHandler.promises.getAllDocs(projectId)
        const doc = docs[path]

        if (!doc) {
          return { error: `File not found: ${path}` }
        }

        // Get the latest content from document updater (includes unsaved changes)
        try {
          const { lines } =
            await DocumentUpdaterHandler.promises.getDocument(
              projectId,
              doc._id.toString(),
              -1
            )
          return { path, content: lines.join('\n') }
        } catch (err) {
          // Fall back to docstore content if document updater fails
          return { path, content: doc.lines.join('\n') }
        }
      },
    },

    editFile: {
      description:
        'Edit a document by replacing a specific string with a new string. The old_string must match exactly (including whitespace and indentation).',
      parameters: z.object({
        path: z.string().describe('The path to the file to edit'),
        old_string: z
          .string()
          .describe(
            'The exact string to find and replace. Must match exactly including whitespace.'
          ),
        new_string: z
          .string()
          .describe('The string to replace old_string with'),
      }),
      execute: async ({ path, old_string, new_string }) => {
        // Get all docs to find the one matching the path
        const docs = await ProjectEntityHandler.promises.getAllDocs(projectId)
        const doc = docs[path]

        if (!doc) {
          return { error: `File not found: ${path}` }
        }

        // Get current content
        let lines
        try {
          const result = await DocumentUpdaterHandler.promises.getDocument(
            projectId,
            doc._id.toString(),
            -1
          )
          lines = result.lines
        } catch (err) {
          lines = doc.lines
        }

        const content = lines.join('\n')

        // Check if old_string exists
        if (!content.includes(old_string)) {
          return {
            error: `Could not find the specified text in ${path}. Make sure old_string matches exactly.`,
          }
        }

        // Replace the string
        const newContent = content.replace(old_string, new_string)
        const newLines = newContent.split('\n')

        // Save the document
        await DocumentUpdaterHandler.promises.setDocument(
          projectId,
          doc._id.toString(),
          userId,
          newLines,
          'ai-assistant'
        )

        return {
          success: true,
          path,
          message: `Successfully edited ${path}`,
        }
      },
    },

    searchProject: {
      description:
        'Search for a text pattern across all documents in the project. Returns matching files and line numbers.',
      parameters: z.object({
        query: z
          .string()
          .describe('The text or pattern to search for (case-insensitive)'),
      }),
      execute: async ({ query }) => {
        const docs = await ProjectEntityHandler.promises.getAllDocs(projectId)
        const results = []
        const queryLower = query.toLowerCase()

        for (const [filePath, doc] of Object.entries(docs)) {
          const matches = []
          doc.lines.forEach((line, index) => {
            if (line.toLowerCase().includes(queryLower)) {
              matches.push({
                lineNumber: index + 1,
                line: line.trim(),
              })
            }
          })

          if (matches.length > 0) {
            results.push({
              path: filePath,
              matches: matches.slice(0, 10), // Limit matches per file
              totalMatches: matches.length,
            })
          }
        }

        return {
          query,
          totalFiles: results.length,
          results: results.slice(0, 20), // Limit total files
        }
      },
    },
  }
}

export default { createAITools }

