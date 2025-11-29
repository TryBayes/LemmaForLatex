import React from 'react'
import { type Message } from '@ai-sdk/react'
import MaterialIcon from '@/shared/components/material-icon'
import classNames from 'classnames'

interface AIChatMessageProps {
  message: Message
}

export default function AIChatMessage({ message }: AIChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={classNames('ai-chat-message', {
        'ai-chat-message-user': isUser,
        'ai-chat-message-assistant': !isUser,
      })}
    >
      <div className="ai-chat-message-avatar">
        <MaterialIcon type={isUser ? 'person' : 'smart_toy'} />
      </div>

      <div className="ai-chat-message-content">
        {/* Render tool invocations if present */}
        {message.toolInvocations?.map((toolInvocation, index) => (
          <ToolInvocationDisplay key={index} toolInvocation={toolInvocation} />
        ))}

        {/* Render the text content */}
        {message.content && (
          <div className="ai-chat-message-text">{message.content}</div>
        )}
      </div>
    </div>
  )
}

interface ToolInvocationDisplayProps {
  toolInvocation: {
    toolName: string
    toolCallId: string
    state: 'partial-call' | 'call' | 'result'
    args?: Record<string, unknown>
    result?: unknown
  }
}

function ToolInvocationDisplay({ toolInvocation }: ToolInvocationDisplayProps) {
  const { toolName, state, args, result } = toolInvocation

  const getToolIcon = (name: string): string => {
    switch (name) {
      case 'listFiles':
        return 'folder_open'
      case 'readFile':
        return 'description'
      case 'editFile':
        return 'edit_document'
      case 'searchProject':
        return 'search'
      default:
        return 'build'
    }
  }

  const getToolLabel = (name: string): string => {
    switch (name) {
      case 'listFiles':
        return 'Listing project files...'
      case 'readFile':
        return `Reading ${(args as { path?: string })?.path || 'file'}...`
      case 'editFile':
        return `Editing ${(args as { path?: string })?.path || 'file'}...`
      case 'searchProject':
        return `Searching for "${(args as { query?: string })?.query || ''}"...`
      default:
        return `Running ${name}...`
    }
  }

  const isComplete = state === 'result'

  return (
    <div
      className={classNames('ai-tool-invocation', {
        'ai-tool-invocation-pending': !isComplete,
        'ai-tool-invocation-complete': isComplete,
      })}
    >
      <div className="ai-tool-invocation-header">
        <MaterialIcon type={getToolIcon(toolName)} />
        <span className="ai-tool-invocation-label">
          {isComplete ? getToolResultLabel(toolName, result) : getToolLabel(toolName)}
        </span>
        {!isComplete && <span className="ai-tool-invocation-spinner" />}
        {isComplete && (
          <MaterialIcon type="check_circle" className="ai-tool-invocation-check" />
        )}
      </div>

      {/* Show result summary for completed tools */}
      {isComplete && result && (
        <ToolResultSummary toolName={toolName} result={result} />
      )}
    </div>
  )
}

function getToolResultLabel(
  toolName: string,
  result: unknown
): string {
  if (!result || typeof result !== 'object') {
    return `Completed ${toolName}`
  }

  const r = result as Record<string, unknown>

  switch (toolName) {
    case 'listFiles':
      return `Found ${(r.files as unknown[])?.length || 0} files`
    case 'readFile':
      if (r.error) return `Error: ${r.error}`
      return `Read ${r.path}`
    case 'editFile':
      if (r.error) return `Error: ${r.error}`
      return `Edited ${r.path}`
    case 'searchProject':
      return `Found ${r.totalFiles || 0} matching files`
    default:
      return `Completed ${toolName}`
  }
}

interface ToolResultSummaryProps {
  toolName: string
  result: unknown
}

function ToolResultSummary({ toolName, result }: ToolResultSummaryProps) {
  if (!result || typeof result !== 'object') return null

  const r = result as Record<string, unknown>

  // Show error if present
  if (r.error) {
    return (
      <div className="ai-tool-result-error">
        <MaterialIcon type="error" />
        <span>{String(r.error)}</span>
      </div>
    )
  }

  // For listFiles, show file count
  if (toolName === 'listFiles' && Array.isArray(r.files)) {
    const files = r.files as Array<{ path: string; type: string }>
    return (
      <div className="ai-tool-result-files">
        {files.slice(0, 5).map((file, i) => (
          <div key={i} className="ai-tool-result-file">
            <MaterialIcon
              type={file.type === 'doc' ? 'description' : 'insert_drive_file'}
            />
            <span>{file.path}</span>
          </div>
        ))}
        {files.length > 5 && (
          <div className="ai-tool-result-more">
            +{files.length - 5} more files
          </div>
        )}
      </div>
    )
  }

  // For searchProject, show matches
  if (toolName === 'searchProject' && Array.isArray(r.results)) {
    const results = r.results as Array<{
      path: string
      matches: Array<{ lineNumber: number; line: string }>
      totalMatches: number
    }>
    return (
      <div className="ai-tool-result-search">
        {results.slice(0, 3).map((file, i) => (
          <div key={i} className="ai-tool-result-search-file">
            <div className="ai-tool-result-search-path">
              <MaterialIcon type="description" />
              <span>{file.path}</span>
              <span className="ai-tool-result-search-count">
                ({file.totalMatches} matches)
              </span>
            </div>
          </div>
        ))}
        {results.length > 3 && (
          <div className="ai-tool-result-more">
            +{results.length - 3} more files
          </div>
        )}
      </div>
    )
  }

  return null
}

