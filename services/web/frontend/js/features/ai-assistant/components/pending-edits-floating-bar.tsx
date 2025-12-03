import React from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'
import { usePendingEditsContextOptional } from '../context/pending-edits-context'

/**
 * Floating bar that appears at the bottom of the editor when there are pending AI edits.
 * Allows users to accept or reject all pending edits at once.
 */
export function PendingEditsFloatingBar() {
  const pendingEditsContext = usePendingEditsContextOptional()

  if (!pendingEditsContext) {
    return null
  }

  const { pendingEdits, acceptAllEdits, rejectAllEdits, hasPendingEdits } =
    pendingEditsContext

  const pendingCount = pendingEdits.filter(e => e.status === 'pending').length

  if (pendingCount === 0) {
    return null
  }

  return (
    <div
      className={classNames('ai-floating-bar', {
        'ai-floating-bar-visible': hasPendingEdits,
      })}
    >
      <div className="ai-floating-bar-content">
        <div className="ai-floating-bar-info">
          <MaterialIcon type="edit_document" />
          <span>
            <strong>{pendingCount}</strong> pending{' '}
            {pendingCount === 1 ? 'edit' : 'edits'}
          </span>
        </div>
        <div className="ai-floating-bar-actions">
          <button
            type="button"
            className="ai-floating-bar-accept"
            onClick={acceptAllEdits}
          >
            <MaterialIcon type="check" />
            Accept All
          </button>
          <button
            type="button"
            className="ai-floating-bar-reject"
            onClick={rejectAllEdits}
          >
            <MaterialIcon type="close" />
            Reject All
          </button>
        </div>
      </div>
    </div>
  )
}

export default PendingEditsFloatingBar
