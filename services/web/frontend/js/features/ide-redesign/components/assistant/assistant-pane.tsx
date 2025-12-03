import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import MaterialIcon from '@/shared/components/material-icon'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import classNames from 'classnames'
import {
  useAiAssistant,
  Message,
  ToolResult,
  MessagePart,
  Conversation,
} from './use-ai-assistant'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

const Loading = () => <FullSizeLoadingSpinner delay={500} className="pt-4" />

export const AssistantPane = () => {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    stopGeneration,
    setSelectedModel,
    selectedModel,
    messageCount,
    weeklyLimit,
    remaining,
    hasPaidPlan,
    conversations,
    currentConversationId,
    loadConversation,
    startNewConversation,
    deleteConversation,
    showHistory,
    setShowHistory,
  } = useAiAssistant()

  // Check if error is due to message limit
  const isLimitReached = error?.includes('[LIMIT_REACHED]')
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = (messageText: string) => {
    if (!messageText.trim() || isLoading) return
    sendMessage(messageText)
    setInputValue('')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const selectingCharacter = event.nativeEvent.isComposing
    if (event.key === 'Enter' && !event.shiftKey && !selectingCharacter) {
      event.preventDefault()
      handleSendMessage(inputValue)
    }
  }

  const shouldDisplayPlaceholder = messages.length === 0 && !isLoading && !showHistory

  return (
    <div className="assistant-panel">
      <div className="assistant-wrapper">
        <aside className="assistant" aria-label="AI assistant">
          <div className="assistant-header">
            <div className="assistant-header-left">
              <MaterialIcon type="smart_toy" />
              <span className="assistant-header-title">AI Assistant</span>
              {!hasPaidPlan && weeklyLimit > 0 && (
                <span className="assistant-usage-badge" title="AI messages remaining this week">
                  {remaining}/{weeklyLimit}
                </span>
              )}
            </div>
            <div className="assistant-header-right">
              <button
                type="button"
                className="assistant-header-button"
                onClick={startNewConversation}
                title="New chat"
              >
                <MaterialIcon type="add" />
              </button>
              <button
                type="button"
                className={classNames('assistant-header-button', {
                  'assistant-header-button-active': showHistory,
                })}
                onClick={() => setShowHistory(!showHistory)}
                title="Chat history"
              >
                <MaterialIcon type="history" />
              </button>
            </div>
          </div>

          {showHistory ? (
            <HistoryPanel
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={loadConversation}
              onDeleteConversation={deleteConversation}
              onNewChat={startNewConversation}
              messageCount={messageCount}
            />
          ) : (
            <>
              <div className="assistant-messages">
                <div
                  className={classNames({ 'h-100': shouldDisplayPlaceholder })}
                >
                  <h2 className="visually-hidden">AI assistant</h2>
                  {isLoading && messages.length === 0 && <Loading />}
                  {shouldDisplayPlaceholder && <Placeholder />}
                  <MessageList messages={messages} />
                  {isLoading && messages.length > 0 && (
                    <div className="assistant-typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  )}
                  {error && (
                    <div className={classNames('assistant-error', { 'assistant-limit-reached': isLimitReached })}>
                      <MaterialIcon type={isLimitReached ? 'warning' : 'error'} />
                      {isLimitReached ? (
                        <div className="assistant-limit-message">
                          <span>You've used all your free AI messages this week.</span>
                          <a href="/user/subscription/plans" className="btn btn-sm btn-primary mt-2">
                            Upgrade to Pro
                          </a>
                        </div>
                      ) : (
                        <span>{error}</span>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              <AssistantInput
                value={inputValue}
                onChange={setInputValue}
                onKeyDown={handleKeyDown}
                onSend={() => handleSendMessage(inputValue)}
                onStop={stopGeneration}
                isLoading={isLoading}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function HistoryPanel({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
  messageCount,
}: {
  conversations: Conversation[]
  currentConversationId: string | null
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onNewChat: () => void
  messageCount: number
}) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className="assistant-history">
      <div className="assistant-history-header">
        <span className="assistant-history-title">Chat History</span>
        <span className="assistant-history-count">{messageCount} total messages</span>
      </div>
      
      <button
        type="button"
        className="assistant-history-new-chat"
        onClick={onNewChat}
      >
        <MaterialIcon type="add" />
        <span>New Chat</span>
      </button>

      {conversations.length === 0 ? (
        <div className="assistant-history-empty">
          <MaterialIcon type="chat_bubble_outline" />
          <p>No conversations yet</p>
          <span>Start a new chat to begin</span>
        </div>
      ) : (
        <ul className="assistant-history-list">
          {conversations.map(conversation => (
            <li
              key={conversation.id}
              className={classNames('assistant-history-item', {
                'assistant-history-item-active': conversation.id === currentConversationId,
              })}
            >
              <button
                type="button"
                className="assistant-history-item-content"
                onClick={() => onSelectConversation(conversation.id)}
              >
                <span className="assistant-history-item-title">{conversation.title}</span>
                <span className="assistant-history-item-date">
                  {formatDate(conversation.updatedAt)}
                </span>
              </button>
              <button
                type="button"
                className="assistant-history-item-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteConversation(conversation.id)
                }}
                title="Delete conversation"
              >
                <MaterialIcon type="delete_outline" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MessageList({ messages }: { messages: Message[] }) {
  return (
    <ul className="assistant-message-list">
      {messages.map(message => {
        if (message.role === 'user') {
          return (
            <li key={message.id} className="assistant-message assistant-message-user">
              <div className="assistant-message-content">{message.content}</div>
            </li>
          )
        }

        // Assistant message - render parts as separate bubbles
        if (message.parts?.length) {
          return <MessageParts key={message.id} parts={message.parts} />
        }

        // Fallback for simple assistant message
        const hasContent = message.content && message.content.trim()
        if (!hasContent) return null

        return (
          <li key={message.id} className="assistant-message assistant-message-ai">
            <div className="assistant-message-content">
              <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function MessageParts({ parts }: { parts: MessagePart[] }) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          // Skip empty text parts
          if (!part.content || !part.content.trim()) return null
          
          return (
            <li key={`text-${index}`} className="assistant-message assistant-message-ai">
              <div className="assistant-message-content">
                <ReactMarkdown components={markdownComponents}>{part.content}</ReactMarkdown>
              </div>
            </li>
          )
        }

        // Tool results as their own bubble
        if (part.results.length === 0) return null
        
        return (
          <li key={`tool-${index}`} className="assistant-message assistant-message-tool">
            <ToolCallBubble results={part.results} />
          </li>
        )
      })}
    </>
  )
}

function ToolCallBubble({ results }: { results: ToolResult[] }) {
  return (
    <div className="assistant-tool-bubble">
      {results.map((result, index) => (
        <div key={index} className="assistant-tool-chip">
          <MaterialIcon type={getToolIcon(result.toolName)} />
          <span>{formatToolName(result.toolName)}</span>
          <MaterialIcon type="check_circle" className="assistant-tool-check" />
        </div>
      ))}
    </div>
  )
}

function getToolIcon(toolName: string): string {
  const iconMap: Record<string, string> = {
    list_files: 'folder_open',
    read_file: 'description',
    edit_file: 'edit_document',
    create_file: 'note_add',
    write_file: 'note_add',
    search: 'search',
    run_command: 'terminal',
    get_compile_errors: 'build',
  }
  return iconMap[toolName] || 'build'
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// Custom code block with syntax highlighting
function CodeBlock({
  inline,
  className,
  children,
  ...props
}: {
  inline?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''
  const codeString = String(children).replace(/\n$/, '')

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(codeString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [codeString])

  // Better inline detection: no language class AND no newlines AND (inline prop OR short content)
  const hasNewlines = codeString.includes('\n')
  const isInlineCode = inline || (!className && !hasNewlines)

  if (isInlineCode) {
    return (
      <code className="assistant-inline-code" {...props}>
        {children}
      </code>
    )
  }

  return (
    <div className="assistant-code-block">
      <div className="assistant-code-header">
        <span className="assistant-code-language">{language || 'code'}</span>
        <button
          type="button"
          className="assistant-code-copy"
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy code'}
        >
          <MaterialIcon type={copied ? 'check' : 'content_copy'} />
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: '13px',
          lineHeight: '1.5',
        }}
        {...props}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  )
}

// Markdown components with syntax highlighting
const markdownComponents = {
  code: CodeBlock,
}

// Available models for Vercel AI Gateway
const AI_MODELS = [
  { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
  { id: 'anthropic/claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'Anthropic' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI' },
  { id: 'openai/gpt-5', name: 'GPT-5', provider: 'OpenAI' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', provider: 'Google' },
]

function AssistantInput({
  value,
  onChange,
  onKeyDown,
  onSend,
  onStop,
  isLoading,
  selectedModel,
  onModelChange,
}: {
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onStop: () => void
  isLoading: boolean
  selectedModel: string
  onModelChange: (model: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset textarea height when value is cleared (e.g., after sending)
  useEffect(() => {
    if (!value && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value])

  return (
    <form className="assistant-input" onSubmit={e => e.preventDefault()}>
      <div className="assistant-model-selector">
        <span className="assistant-model-label">Model</span>
        <select
          className="assistant-model-select"
          value={selectedModel}
          onChange={e => onModelChange(e.target.value)}
          disabled={isLoading}
        >
          {AI_MODELS.map(model => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>
      <div className="assistant-input-row">
        <div className="assistant-textarea-wrapper">
          <label htmlFor="assistant-input" className="visually-hidden">
            Ask AI assistant
          </label>
          <textarea
            ref={textareaRef}
            id="assistant-input"
            placeholder="Ask AI assistant..."
            value={value}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              onChange(e.target.value)
              // Auto-resize textarea
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
            }}
            onKeyDown={onKeyDown}
            disabled={isLoading}
            rows={1}
            style={{ height: 'auto' }}
          />
          {isLoading ? (
            <button
              type="button"
              className="assistant-send-button assistant-stop-button"
              onClick={onStop}
              aria-label="Stop"
            >
              <MaterialIcon type="stop" />
            </button>
          ) : (
            <button
              type="button"
              className="assistant-send-button"
              onClick={onSend}
              disabled={!value.trim()}
              aria-label="Send"
            >
              <MaterialIcon type="arrow_upward" />
            </button>
          )}
        </div>
      </div>
    </form>
  )
}

function Placeholder() {
  return (
    <div className="assistant-empty-state-placeholder">
      <div>
        <span className="assistant-empty-state-icon">
          <MaterialIcon type="smart_toy" />
        </span>
      </div>
      <div>
        <div className="assistant-empty-state-title">
          AI assistant
        </div>
        <div className="assistant-empty-state-body">
          Ask questions about LaTeX or get help with your document
        </div>
      </div>
    </div>
  )
}

export default AssistantPane
