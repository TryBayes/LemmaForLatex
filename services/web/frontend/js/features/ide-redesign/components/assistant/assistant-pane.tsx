import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import MaterialIcon from '@/shared/components/material-icon'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import RailPanelHeader from '../rail/rail-panel-header'
import { useAiAssistant, Message, ToolResult } from './use-ai-assistant'
import ReactMarkdown from 'react-markdown'

const Loading = () => <FullSizeLoadingSpinner delay={500} className="pt-4" />

export const AssistantPane = () => {
  const { t } = useTranslation()
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
      <RailPanelHeader title={t('ai_assistant')} />
      <div className="assistant-wrapper">
        <aside className="assistant" aria-label={t('ai_assistant')}>
          <div className="assistant-messages">
            <div
              className={classNames({ 'h-100': shouldDisplayPlaceholder })}
            >
              <h2 className="visually-hidden">{t('ai_assistant')}</h2>
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
      {messages.map(message => (
        <li
          key={message.id}
          className={classNames('assistant-message', {
            'assistant-message-user': message.role === 'user',
            'assistant-message-ai': message.role === 'assistant',
          })}
        >
          <div className="assistant-message-content">
            {message.role === 'assistant' ? (
              <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
            ) : (
              message.content
            )}
          </div>
          {message.toolResults && message.toolResults.length > 0 && (
            <ToolResultsDisplay results={message.toolResults} />
          )}
        </li>
      ))}
    </ul>
  )
}

function ToolResultsDisplay({ results }: { results: ToolResult[] }) {
  const [expanded, setExpanded] = useState(false)

  if (results.length === 0) return null

  return (
    <div className="assistant-tool-results">
      <button
        className="assistant-tool-toggle"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <MaterialIcon type={expanded ? 'expand_less' : 'expand_more'} />
        <span>
          {results.length} tool {results.length === 1 ? 'call' : 'calls'}
        </span>
      </button>
      {expanded && (
        <div className="assistant-tool-results-list">
          {results.map((result, index) => (
            <div key={index} className="assistant-tool-result">
              <div className="assistant-tool-name">
                <MaterialIcon type="build" />
                {formatToolName(result.toolName)}
              </div>
              <pre className="assistant-tool-output">
                {JSON.stringify(result.result, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
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
  const { t } = useTranslation()

  return (
    <form className="assistant-input" onSubmit={e => e.preventDefault()}>
      <label htmlFor="assistant-input" className="visually-hidden">
        {t('ask_ai_assistant')}
      </label>
      <textarea
        id="assistant-input"
        placeholder={t('ask_ai_assistant')}
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
          aria-label={t('stop')}
        >
          <MaterialIcon type="stop" />
        </button>
      ) : (
        <button
          type="button"
          className="assistant-send-button"
          onClick={onSend}
          disabled={!value.trim()}
          aria-label={t('send')}
        >
          <MaterialIcon type="send" />
        </button>
      )}
    </form>
  )
}

function Placeholder() {
  const { t } = useTranslation()
  return (
    <div className="assistant-empty-state-placeholder">
      <div>
        <span className="assistant-empty-state-icon">
          <MaterialIcon type="smart_toy" />
        </span>
      </div>
      <div>
        <div className="assistant-empty-state-title">
          {t('ai_assistant')}
        </div>
        <div className="assistant-empty-state-body">
          {t('ask_questions_about_latex_or_get_help_with_your_document')}
        </div>
      </div>
    </div>
  )
}

export default AssistantPane
