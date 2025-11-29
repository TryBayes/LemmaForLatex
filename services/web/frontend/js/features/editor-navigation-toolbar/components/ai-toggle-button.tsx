import React, { useState } from 'react'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import AIChatPane from '@/features/ai-assistant/components/ai-chat-pane'

function AIToggleButton() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const classes = classNames('btn', 'btn-full-height', { active: isOpen })

  return (
    <>
      <div className="toolbar-item">
        <button
          type="button"
          className={classes}
          onClick={() => setIsOpen(!isOpen)}
          title={t('ai_assistant')}
        >
          <MaterialIcon type="smart_toy" className="align-middle" />
          <p className="toolbar-label">{t('ai_assistant')}</p>
        </button>
      </div>

      {isOpen && (
        <div className="ai-chat-sidebar">
          <div className="ai-chat-sidebar-header">
            <span>{t('ai_assistant')}</span>
            <button
              type="button"
              className="ai-chat-sidebar-close"
              onClick={() => setIsOpen(false)}
            >
              <MaterialIcon type="close" />
            </button>
          </div>
          <AIChatPane />
        </div>
      )}
    </>
  )
}

export default AIToggleButton

