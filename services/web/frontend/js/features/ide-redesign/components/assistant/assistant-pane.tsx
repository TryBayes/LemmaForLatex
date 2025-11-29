import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import MaterialIcon from '@/shared/components/material-icon'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import RailPanelHeader from '../rail/rail-panel-header'

type Message = {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

const Loading = () => <FullSizeLoadingSpinner delay={500} className="pt-4" />

export const AssistantPane = () => {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = (messageText: string) => {
    if (!messageText.trim()) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: messageText.trim(),
      role: 'user',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Simulate AI response (placeholder for actual API integration)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        content:
          "I'm your AI assistant. I can help you with your LaTeX documents. This is a placeholder response - API integration coming soon!",
        role: 'assistant',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
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
              <div ref={messagesEndRef} />
            </div>
          </div>
          <AssistantInput
            value={inputValue}
            onChange={setInputValue}
            onKeyDown={handleKeyDown}
            onSend={() => handleSendMessage(inputValue)}
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
            {message.content}
          </div>
        </li>
      ))}
    </ul>
  )
}

function AssistantInput({
  value,
  onChange,
  onKeyDown,
  onSend,
  isLoading,
}: {
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
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
      <button
        type="button"
        className="assistant-send-button"
        onClick={onSend}
        disabled={isLoading || !value.trim()}
        aria-label={t('send')}
      >
        <MaterialIcon type="send" />
      </button>
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

