import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

function AiAssistantToggleButton({
  aiAssistantIsOpen,
  onClick,
}: {
  aiAssistantIsOpen: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const classes = classNames('btn', 'btn-full-height', {
    active: aiAssistantIsOpen,
  })

  return (
    <div className="toolbar-item">
      <button type="button" className={classes} onClick={onClick}>
        <MaterialIcon type="smart_toy" className="align-middle" />
        <p className="toolbar-label">Assistant</p>
      </button>
    </div>
  )
}

export default AiAssistantToggleButton
