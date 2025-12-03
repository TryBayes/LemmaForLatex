import React from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'
import { DiffLine } from '../context/pending-edits-context'

interface PendingEditCardProps {
  editId: string
  filePath: string
  diff: DiffLine[]
  status: 'pending' | 'accepted' | 'rejected'
  onAccept: () => void
  onReject: () => void
}

export function PendingEditCard({
  editId,
  filePath,
  diff,
  status,
  onAccept,
  onReject,
}: PendingEditCardProps) {
  const insertCount = diff.filter(d => d.type === 'insert').length
  const deleteCount = diff.filter(d => d.type === 'delete').length

  const getStatusIcon = () => {
    switch (status) {
      case 'accepted':
        return 'check_circle'
      case 'rejected':
        return 'cancel'
      default:
        return 'pending'
    }
  }

  const getStatusLabel = () => {
    switch (status) {
      case 'accepted':
        return 'Accepted'
      case 'rejected':
        return 'Rejected'
      default:
        return 'Pending'
    }
  }

  return (
    <div
      className={classNames('ai-pending-edit-card', {
        'ai-status-accepted': status === 'accepted',
        'ai-status-rejected': status === 'rejected',
      })}
    >
      <div className="ai-pending-edit-header">
        <div className="ai-pending-edit-file">
          <MaterialIcon type="description" />
          <span>{filePath}</span>
        </div>
        <div
          className={classNames('ai-pending-edit-status', {
            'ai-status-accepted': status === 'accepted',
            'ai-status-rejected': status === 'rejected',
          })}
        >
          <MaterialIcon type={getStatusIcon()} />
          <span>{getStatusLabel()}</span>
        </div>
      </div>

      <div className="ai-pending-edit-diff">
        {diff.slice(0, 20).map((line, index) => (
          <div
            key={index}
            className={classNames('ai-pending-edit-line', line.type)}
          >
            <span className="ai-pending-edit-line-number">
              {line.type === 'delete'
                ? line.oldLineNumber
                : line.type === 'insert'
                  ? line.newLineNumber
                  : line.oldLineNumber}
            </span>
            {line.type === 'insert' && '+'}
            {line.type === 'delete' && '−'}
            {line.type === 'unchanged' && ' '}
            {line.text || ' '}
          </div>
        ))}
        {diff.length > 20 && (
          <div className="ai-pending-edit-line unchanged">
            ... {diff.length - 20} more lines
          </div>
        )}
      </div>

      <div className="ai-diff-stats">
        <span className="ai-diff-stat-insert">+{insertCount} insertions</span>
        <span className="ai-diff-stat-delete">−{deleteCount} deletions</span>
      </div>

      {status === 'pending' && (
        <div className="ai-pending-edit-actions">
          <button
            type="button"
            className="ai-pending-edit-accept"
            onClick={onAccept}
          >
            <MaterialIcon type="check" />
            Accept
          </button>
          <button
            type="button"
            className="ai-pending-edit-reject"
            onClick={onReject}
          >
            <MaterialIcon type="close" />
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

export default PendingEditCard
