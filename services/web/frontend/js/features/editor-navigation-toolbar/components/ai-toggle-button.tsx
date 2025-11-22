import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

function AiToggleButton({
  aiIsOpen,
  onClick,
}: {
  aiIsOpen: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const classes = classNames('btn', 'btn-full-height', { active: aiIsOpen })

  return (
    <div className="toolbar-item">
      <button type="button" className={classes} onClick={onClick}>
        <MaterialIcon
          type="psychology"
          className="align-middle"
        />
        <p className="toolbar-label">{t('ai')}</p>
      </button>
    </div>
  )
}

export default AiToggleButton

