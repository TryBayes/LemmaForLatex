import { useState, useCallback, useRef, useEffect } from 'react'
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
  type: 'text' | 'tool_results' | 'done' | 'error' | 'conversation_id'
  data?: string | ToolResult[]
}

interface SavedPart {
  type: 'text' | 'tool_results'
  content?: string
  results?: ToolResult[]
}

interface SavedMessage {
  _id?: string
  role: MessageRole
  content: string
  timestamp: string
  toolResults?: ToolResult[]
  parts?: SavedPart[]
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5'

export function useAiAssistant() {
  const { projectId } = useProjectContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [messageCount, setMessageCount] = useState<number>(0)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const conversationsLoadedRef = useRef(false)

  // Load conversations list on mount
  useEffect(() => {
    if (!projectId || conversationsLoadedRef.current) return

    const loadConversations = async () => {
      try {
        const response = await fetch(`/project/${projectId}/ai-assistant/conversations`, {
          credentials: 'same-origin',
        })
        if (response.ok) {
          const data = await response.json()
          setConversations(data.conversations || [])
        }
        conversationsLoadedRef.current = true
      } catch (err) {
        console.error('[AI Assistant] Failed to load conversations:', err)
        conversationsLoadedRef.current = true
      }
    }

    loadConversations()
  }, [projectId])

  // Load message count on mount
  useEffect(() => {
    const loadMessageCount = async () => {
      try {
        const response = await fetch('/ai-assistant/message-count', {
          credentials: 'same-origin',
        })
        if (response.ok) {
          const data = await response.json()
          setMessageCount(data.totalMessages || 0)
        }
      } catch (err) {
        console.error('[AI Assistant] Failed to load message count:', err)
      }
    }

    loadMessageCount()
  }, [])

  // Load a specific conversation
  const loadConversation = useCallback(async (conversationId: string) => {
    if (!projectId) return

    try {
      const response = await fetch(`/project/${projectId}/ai-assistant/conversations/${conversationId}`, {
        credentials: 'same-origin',
      })
      if (response.ok) {
        const data = await response.json()
        const loadedMessages: Message[] = data.messages.map((msg: SavedMessage, index: number) => {
          // Use saved parts directly - they have the correct order
          const parts: MessagePart[] = (msg.parts || []).map((p: SavedPart) => {
            if (p.type === 'text') {
              return { type: 'text' as const, content: p.content || '' }
            } else {
              return { type: 'tool_results' as const, results: p.results || [] }
            }
          })

          return {
            id: msg._id || `loaded-${index}`,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            toolResults: msg.toolResults,
            parts: parts.length > 0 ? parts : [{ type: 'text' as const, content: msg.content }],
          }
        })
        setMessages(loadedMessages)
        setCurrentConversationId(conversationId)
        setShowHistory(false)
      }
    } catch (err) {
      console.error('[AI Assistant] Failed to load conversation:', err)
    }
  }, [projectId])

  // Start a new conversation
  const startNewConversation = useCallback(() => {
    setMessages([])
    setCurrentConversationId(null)
    setError(null)
    setShowHistory(false)
  }, [])

  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!projectId) return

    try {
      const response = await fetch(`/project/${projectId}/ai-assistant/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'X-Csrf-Token': getMeta('ol-csrfToken'),
        },
        credentials: 'same-origin',
      })
      if (response.ok) {
        setConversations((prev: Conversation[]) => prev.filter((c: Conversation) => c.id !== conversationId))
        // If we deleted the current conversation, start fresh
        if (currentConversationId === conversationId) {
          startNewConversation()
        }
      }
    } catch (err) {
      console.error('[AI Assistant] Failed to delete conversation:', err)
    }
  }, [projectId, currentConversationId, startNewConversation])

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

      setMessages((prev: Message[]) => [...prev, userMessage])
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

      setMessages((prev: Message[]) => [...prev, assistantMessage])

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

        // Use conversation-specific endpoint if we have an ID
        const endpoint = currentConversationId
          ? `/project/${projectId}/ai-assistant/conversations/${currentConversationId}/chat`
          : `/project/${projectId}/ai-assistant/chat`

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Csrf-Token': getMeta('ol-csrfToken'),
          },
          credentials: 'same-origin',
          body: JSON.stringify({ messages: apiMessages, model: selectedModel }),
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
                      setMessages((prev: Message[]) =>
                        prev.map((msg: Message) =>
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
                      setMessages((prev: Message[]) =>
                        prev.map((msg: Message) =>
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

                  case 'conversation_id':
                    // New conversation was created, save the ID
                    if (typeof event.data === 'string') {
                      setCurrentConversationId(event.data)
                      // Refresh conversations list
                      const convResponse = await fetch(`/project/${projectId}/ai-assistant/conversations`, {
                        credentials: 'same-origin',
                      })
                      if (convResponse.ok) {
                        const convData = await convResponse.json()
                        setConversations(convData.conversations || [])
                      }
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
                    // Stream complete - increment local message count
                    setMessageCount((prev: number) => prev + 1)
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
        setMessages((prev: Message[]) =>
          prev.map((msg: Message) =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${errorMessage}` }
              : msg
          )
        )
      } finally {
        setIsLoading(false)
      }
    },
    [projectId, messages, selectedModel, currentConversationId]
  )

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
    stopGeneration,
    selectedModel,
    setSelectedModel,
    messageCount,
    conversations,
    currentConversationId,
    loadConversation,
    startNewConversation,
    deleteConversation,
    showHistory,
    setShowHistory,
  }
}
