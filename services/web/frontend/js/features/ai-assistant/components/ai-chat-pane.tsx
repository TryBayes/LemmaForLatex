import React, { useRef, useEffect } from 'react'
import { useChat, type Message } from '@ai-sdk/react'
import { useTranslation } from 'react-i18next'
import { useProjectContext } from '@/shared/context/project-context'
import MaterialIcon from '@/shared/components/material-icon'
import AIChatMessage from './ai-chat-message'

export default function AIChatPane() {
  const { t } = useTranslation()
  const project = useProjectContext()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const projectId = project?._id

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: projectId ? `/project/${projectId}/ai/chat` : '/api/ai/chat',
    })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!projectId) {
    return (
      <div className="ai-chat-pane">
        <div className="ai-chat-header">
          <MaterialIcon type="smart_toy" />
          <span>{t('ai_assistant')}</span>
        </div>
        <div className="ai-chat-messages">
          <div className="ai-chat-loading">
            <div className="ai-chat-loading-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ai-chat-pane">
      <div className="ai-chat-header">
        <MaterialIcon type="smart_toy" />
        <span>{t('ai_assistant')}</span>
      </div>

      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-chat-placeholder">
            <MaterialIcon type="lightbulb" className="ai-chat-placeholder-icon" />
            <p>{t('ai_assistant_placeholder')}</p>
            <ul className="ai-chat-suggestions">
              <li>Help me fix a LaTeX error</li>
              <li>Add a table of contents</li>
              <li>Format my bibliography</li>
              <li>Explain this LaTeX code</li>
            </ul>
          </div>
        )}

        {messages.map((message: Message) => (
          <AIChatMessage key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="ai-chat-loading">
            <div className="ai-chat-loading-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {error && (
          <div className="ai-chat-error">
            <MaterialIcon type="error" />
            <span>{error.message || t('ai_error_generic')}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="ai-chat-input-form">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder={t('ai_input_placeholder')}
          className="ai-chat-input"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="ai-chat-submit"
          disabled={isLoading || !input.trim()}
        >
          <MaterialIcon type="send" />
        </button>
      </form>
    </div>
  )
}

// Indicator component for the rail tab
export function AIChatIndicator() {
  return null // No indicator needed for AI chat
}
