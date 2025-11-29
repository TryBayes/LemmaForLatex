import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import MaterialIcon from '@/shared/components/material-icon'
import { useState, useRef, useEffect } from 'react'
import classNames from 'classnames'
import {
  useAiAssistant,
  Message,
  ToolResult,
  MessagePart,
} from './use-ai-assistant'
import ReactMarkdown from 'react-markdown'

const Loading = () => <FullSizeLoadingSpinner delay={500} className="pt-4" />

export const AssistantPane = () => {
  const { messages, isLoading, error, sendMessage, stopGeneration } =
    useAiAssistant()
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

  const shouldDisplayPlaceholder = messages.length === 0 && !isLoading

  return (
    <div className="assistant-panel">
      <div className="assistant-wrapper">
        <aside className="assistant" aria-label="AI assistant">
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
                <div className="assistant-error">
                  <MaterialIcon type="error" />
                  <span>{error}</span>
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
          />
        </aside>
      </div>
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
              <ReactMarkdown>{message.content}</ReactMarkdown>
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
                <ReactMarkdown>{part.content}</ReactMarkdown>
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
    write_file: 'note_add',
    search: 'search',
    run_command: 'terminal',
  }
  return iconMap[toolName] || 'build'
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function AssistantInput({
  value,
  onChange,
  onKeyDown,
  onSend,
  onStop,
  isLoading,
}: {
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onStop: () => void
  isLoading: boolean
}) {
  return (
    <form className="assistant-input" onSubmit={e => e.preventDefault()}>
      <label htmlFor="assistant-input" className="visually-hidden">
        Ask AI assistant
      </label>
      <textarea
        id="assistant-input"
        placeholder="Ask AI assistant"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={isLoading}
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
          <MaterialIcon type="send" />
        </button>
      )}
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
