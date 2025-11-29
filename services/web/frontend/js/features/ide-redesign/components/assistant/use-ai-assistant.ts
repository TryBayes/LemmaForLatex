import { useState, useCallback, useRef } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import getMeta from '@/utils/meta'

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  content: string
  role: MessageRole
  timestamp: Date
  toolResults?: ToolResult[]
  parts?: MessagePart[]
}

export interface ToolResult {
  toolName: string
  result: unknown
}

export type MessagePart = TextPart | ToolResultsPart

interface TextPart {
  type: 'text'
  content: string
}

interface ToolResultsPart {
  type: 'tool_results'
  results: ToolResult[]
}

interface StreamEvent {
  type: 'text' | 'tool_results' | 'done' | 'error'
  data?: string | ToolResult[]
}

export function useAiAssistant() {
  const { projectId } = useProjectContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !projectId) return

      // Add user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        content: content.trim(),
        role: 'user',
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, userMessage])
      setIsLoading(true)
      setError(null)

      // Create assistant message placeholder
      const assistantMessageId = `assistant-${Date.now()}`
      const assistantMessage: Message = {
        id: assistantMessageId,
        content: '',
        role: 'assistant',
        timestamp: new Date(),
        toolResults: [],
        parts: [{ type: 'text', content: '' }],
      }

      setMessages(prev => [...prev, assistantMessage])

      // Abort any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      try {
        // Prepare messages for API (convert to AI SDK format)
        const apiMessages = [...messages, userMessage].map(msg => ({
          role: msg.role,
          content: msg.content,
        }))

        const response = await fetch(`/project/${projectId}/ai-assistant/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Csrf-Token': getMeta('ol-csrfToken'),
          },
          credentials: 'same-origin',
          body: JSON.stringify({ messages: apiMessages }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        console.log('[AI Assistant Frontend] Starting to read stream...')

        const decoder = new TextDecoder()
        let accumulatedContent = ''
        let accumulatedToolResults: ToolResult[] = []
        let parts: MessagePart[] = [{ type: 'text', content: '' }]

        while (true) {
          const { done, value } = await reader.read()
          console.log('[AI Assistant Frontend] Read chunk, done:', done, 'value length:', value?.length)
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          console.log('[AI Assistant Frontend] Decoded chunk:', chunk)
          const lines = chunk.split('\n')

          for (const line of lines) {
            console.log('[AI Assistant Frontend] Processing line:', line)
            if (line.startsWith('data: ')) {
              try {
                const event: StreamEvent = JSON.parse(line.slice(6))
                console.log('[AI Assistant Frontend] Parsed event:', event)

                switch (event.type) {
                  case 'text':
                    console.log('[AI Assistant Frontend] Text event data:', event.data)
                    if (typeof event.data === 'string') {
                      accumulatedContent += event.data
                      console.log('[AI Assistant Frontend] Accumulated content:', accumulatedContent)
                      // append to the latest text part or create one
                      const lastPart = parts[parts.length - 1]
                      if (lastPart && lastPart.type === 'text') {
                        lastPart.content += event.data
                      } else {
                        parts.push({ type: 'text', content: event.data })
                      }
                      setMessages(prev =>
                        prev.map(msg =>
                          msg.id === assistantMessageId
                            ? {
                                ...msg,
                                content: accumulatedContent,
                                parts: parts.map(part =>
                                  part.type === 'tool_results'
                                    ? { ...part, results: [...part.results] }
                                    : { ...part }
                                ),
                              }
                            : msg
                        )
                      )
                    }
                    break

                  case 'tool_results':
                    console.log('[AI Assistant Frontend] Tool results:', event.data)
                    if (Array.isArray(event.data)) {
                      accumulatedToolResults = [
                        ...accumulatedToolResults,
                        ...event.data,
                      ]
                      parts.push({
                        type: 'tool_results',
                        results: event.data,
                      })
                      setMessages(prev =>
                        prev.map(msg =>
                          msg.id === assistantMessageId
                            ? {
                                ...msg,
                                toolResults: accumulatedToolResults,
                                parts: parts.map(part =>
                                  part.type === 'tool_results'
                                    ? { ...part, results: [...part.results] }
                                    : { ...part }
                                ),
                              }
                            : msg
                        )
                      )
                    }
                    break

                  case 'error':
                    console.log('[AI Assistant Frontend] Error event:', event.data)
                    setError(
                      typeof event.data === 'string'
                        ? event.data
                        : 'Unknown error'
                    )
                    break

                  case 'done':
                    console.log('[AI Assistant Frontend] Done event received')
                    // Stream complete
                    break
                }
              } catch (parseError) {
                console.log('[AI Assistant Frontend] Parse error for line:', line, parseError)
                // Ignore parsing errors for incomplete chunks
              }
            }
          }
        }
        console.log('[AI Assistant Frontend] Stream reading complete. Final content:', accumulatedContent)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted, ignore
          return
        }

        const errorMessage =
          err instanceof Error ? err.message : 'Failed to send message'
        setError(errorMessage)

        // Update assistant message with error
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${errorMessage}` }
              : msg
          )
        )
      } finally {
        setIsLoading(false)
      }
    },
    [projectId, messages]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    stopGeneration,
  }
}
