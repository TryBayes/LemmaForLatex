import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useUserContext } from '../../../shared/context/user-context'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import MaterialIcon from '@/shared/components/material-icon'

const AiAssistantPane = React.memo(function AiAssistantPane() {
  const { t } = useTranslation()
  const { aiAssistantIsOpen } = useLayoutContext()
  const user = useUserContext()

  // Keep the AI assistant pane in the DOM to avoid resetting state
  const [openedOnce, setOpenedOnce] = useState(aiAssistantIsOpen)
  useEffect(() => {
    if (aiAssistantIsOpen) {
      setOpenedOnce(true)
    }
  }, [aiAssistantIsOpen])

  if (!user) {
    return null
  }
  if (!openedOnce) {
    return null
  }

  return (
    <aside className="chat" aria-label={t('ai_assistant')}>
      <div className="messages">
        <div>
          <h2 className="visually-hidden">{t('ai_assistant')}</h2>
          <Placeholder />
        </div>
      </div>
      <MessageInput />
    </aside>
  )
})

function Placeholder() {
  const { t } = useTranslation()
  return (
    <>
      <div className="no-messages text-center small">
        {t('ai_assistant_placeholder')}
      </div>
      <div className="first-message text-center">
        {t('ask_ai_assistant')}
        <br />
        <MaterialIcon type="arrow_downward" />
      </div>
    </>
  )
}

function MessageInput() {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        // TODO: Send message to AI
      }
    },
    []
  )

  return (
    <div className="new-message">
      <textarea
        placeholder={t('ask_ai_assistant')}
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

function AiAssistantFallbackError() {
  const { t } = useTranslation()
  return (
    <aside className="chat">
      <div className="chat-error">
        <p>{t('ai_assistant_error')}</p>
      </div>
    </aside>
  )
}

export default withErrorBoundary(AiAssistantPane, () => (
  <AiAssistantFallbackError />
))
