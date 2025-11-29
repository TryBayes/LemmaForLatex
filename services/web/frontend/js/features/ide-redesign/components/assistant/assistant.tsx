import MaterialIcon from '@/shared/components/material-icon'
import { useUserContext } from '@/shared/context/user-context'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import RailPanelHeader from '../rail/rail-panel-header'

type Message = {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

export const AssistantPane = () => {
  const { t } = useTranslation()
  const user = useUserContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, newMessage])
    setInputValue('')
  }, [inputValue])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendMessage()
      }
    },
    [handleSendMessage]
  )

  if (!user) {
    return null
  }

  return (
    <div className="chat-panel">
      <RailPanelHeader title={t('assistant')} />
      <div className="chat-wrapper">
        <aside className="chat" aria-label={t('assistant')}>
          <div className="messages">
            {messages.length === 0 ? (
              <Placeholder />
            ) : (
              <div className="chat-message-redesign">
                {messages.map(message => (
                  <div key={message.id} className="message-row">
                    <div className="message-avatar-placeholder" />
                    <div
                      className={`message-container ${message.isUser ? 'message-from-self' : ''}`}
                    >
                      <div className="message-content">
                        <p>{message.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          <div className="new-message">
            <textarea
              placeholder="Ask the assistant..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

function Placeholder() {
  const { t } = useTranslation()
  return (
    <div className="chat-empty-state-placeholder">
      <div>
        <span className="chat-empty-state-icon">
          <MaterialIcon type="smart_toy" />
        </span>
      </div>
      <div>
        <div className="chat-empty-state-title">{t('assistant')}</div>
        <div className="chat-empty-state-body">
          {t('ask_assistant_for_help')}
        </div>
      </div>
    </div>
  )
}

