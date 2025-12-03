import {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
  FC,
  useRef,
  useEffect,
} from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import getMeta from '@/utils/meta'

export interface DiffLine {
  type: 'insert' | 'delete' | 'unchanged'
  text: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface PendingEdit {
  id: string
  filePath: string
  docId: string
  oldContent: string
  newContent: string
  timestamp: Date
  status: 'pending' | 'accepted' | 'rejected'
  diff: DiffLine[]
  // Position info for inline display
  startLine: number
  endLine: number
  // Whether this edit has been synced to the editor content
  synced: boolean
}

export interface PendingEditsContextValue {
  // All edits (including accepted/rejected for chat history)
  allEdits: PendingEdit[]
  // Only pending edits (for floating bar and inline editor)
  pendingEdits: PendingEdit[]
  addPendingEdit: (edit: Omit<PendingEdit, 'id' | 'status' | 'timestamp' | 'diff' | 'synced'>) => Promise<PendingEdit>
  acceptEdit: (editId: string) => void
  rejectEdit: (editId: string) => Promise<void>
  markAsSynced: (editId: string) => void
  acceptAllEdits: () => void
  rejectAllEdits: () => Promise<void>
  getPendingEditsForDoc: (docId: string) => PendingEdit[]
  getEditById: (editId: string) => PendingEdit | undefined
  // Find edit by content (for matching tool results to edits)
  getEditByContent: (docId: string, newContent: string) => PendingEdit | undefined
  hasPendingEdits: boolean
  // For compilation: get content with staged changes applied
  getStagedContent: (docId: string, originalContent: string) => string
  // Clear all pending edits (after session ends)
  clearAllEdits: () => void
}

const PendingEditsContext = createContext<PendingEditsContextValue | undefined>(undefined)

/**
 * Compute a simple line-based diff between two strings
 */
function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const diff: DiffLine[] = []

  // Use a simple LCS-based diff algorithm
  const lcs = computeLCS(oldLines, newLines)
  
  let oldIdx = 0
  let newIdx = 0
  let oldLineNum = 1
  let newLineNum = 1

  for (const commonLine of lcs) {
    // Add deletions (lines in old but not in new before common)
    while (oldIdx < oldLines.length && oldLines[oldIdx] !== commonLine) {
      diff.push({
        type: 'delete',
        text: oldLines[oldIdx],
        oldLineNumber: oldLineNum++,
      })
      oldIdx++
    }
    
    // Add insertions (lines in new but not in old before common)
    while (newIdx < newLines.length && newLines[newIdx] !== commonLine) {
      diff.push({
        type: 'insert',
        text: newLines[newIdx],
        newLineNumber: newLineNum++,
      })
      newIdx++
    }
    
    // Add unchanged line
    if (oldIdx < oldLines.length && newIdx < newLines.length) {
      diff.push({
        type: 'unchanged',
        text: commonLine,
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
      })
      oldIdx++
      newIdx++
    }
  }

  // Add remaining deletions
  while (oldIdx < oldLines.length) {
    diff.push({
      type: 'delete',
      text: oldLines[oldIdx],
      oldLineNumber: oldLineNum++,
    })
    oldIdx++
  }

  // Add remaining insertions
  while (newIdx < newLines.length) {
    diff.push({
      type: 'insert',
      text: newLines[newIdx],
      newLineNumber: newLineNum++,
    })
    newIdx++
  }

  return diff
}

/**
 * Compute longest common subsequence of lines
 */
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1])
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return lcs
}

/**
 * Find the line number where the edit starts
 */
function findEditStartLine(oldContent: string, newContent: string): number {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  
  for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
    if (oldLines[i] !== newLines[i]) {
      return i + 1 // 1-indexed
    }
  }
  
  return Math.min(oldLines.length, newLines.length) + 1
}

/**
 * Generate a unique ID for an edit
 */
function generateEditId(): string {
  return `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const PendingEditsProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const { projectId } = useProjectContext()
  // Store all edits (including accepted/rejected for chat history)
  const [allEdits, setAllEdits] = useState<PendingEdit[]>([])
  const applyingRef = useRef(false)
  
  // Computed: only pending edits (for floating bar and inline editor)
  const pendingEdits = useMemo(
    () => allEdits.filter(e => e.status === 'pending'),
    [allEdits]
  )

  // Add a pending edit - stores for sync by CodeMirror hook
  const addPendingEdit = useCallback(async (
    editData: Omit<PendingEdit, 'id' | 'status' | 'timestamp' | 'diff' | 'synced'>
  ): Promise<PendingEdit> => {
    console.log('[PendingEdits] addPendingEdit called with:', editData)
    
    const diff = computeDiff(editData.oldContent, editData.newContent)
    const startLine = findEditStartLine(editData.oldContent, editData.newContent)
    const endLine = startLine + diff.filter(d => d.type !== 'unchanged').length

    const edit: PendingEdit = {
      ...editData,
      id: generateEditId(),
      status: 'pending',
      timestamp: new Date(),
      diff,
      startLine,
      endLine,
      synced: false, // Needs to be applied to editor
    }

    console.log('[PendingEdits] Created edit object:', edit.id)
    setAllEdits(prev => [...prev, edit])
    console.log('[PendingEdits] Edit added to list')
    
    return edit
  }, [])

  // Mark edit as synced (content change applied/reverted in editor)
  const markAsSynced = useCallback((editId: string) => {
    setAllEdits(prev => prev.map(e => 
      e.id === editId ? { ...e, synced: true } : e
    ))
  }, [])

  // Accept edit - marks as accepted (keeps in list for chat history)
  const acceptEdit = useCallback((editId: string) => {
    setAllEdits(prev => prev.map(e => 
      e.id === editId ? { ...e, status: 'accepted' as const } : e
    ))
  }, [])

  // Reject edit - marks as rejected and needs revert (synced: false)
  const rejectEdit = useCallback(async (editId: string) => {
    setAllEdits(prev => prev.map(e => 
      e.id === editId ? { ...e, status: 'rejected' as const, synced: false } : e
    ))
  }, [])

  // Accept all edits - marks all pending as accepted
  const acceptAllEdits = useCallback(() => {
    setAllEdits(prev => prev.map(e => 
      e.status === 'pending' ? { ...e, status: 'accepted' as const } : e
    ))
  }, [])

  // Reject all edits - marks all pending as rejected and unsynced
  const rejectAllEdits = useCallback(async () => {
    setAllEdits(prev => prev.map(e => 
      e.status === 'pending' ? { ...e, status: 'rejected' as const, synced: false } : e
    ))
  }, [])

  const getPendingEditsForDoc = useCallback((docId: string) => {
    return pendingEdits.filter(e => e.docId === docId)
  }, [pendingEdits])

  const getEditById = useCallback((editId: string) => {
    return allEdits.find(e => e.id === editId)
  }, [allEdits])

  const getEditByContent = useCallback((docId: string, newContent: string) => {
    // Find edit by matching docId and newContent
    return allEdits.find(e => e.docId === docId && e.newContent === newContent)
  }, [allEdits])

  const getStagedContent = useCallback((docId: string, originalContent: string) => {
    // Apply all pending edits for this doc to get the staged content
    const editsForDoc = pendingEdits
      .filter(e => e.docId === docId && e.status === 'pending')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    if (editsForDoc.length === 0) {
      return originalContent
    }

    // For now, return the latest pending edit's new content
    // In a more complex implementation, we'd chain edits together
    const latestEdit = editsForDoc[editsForDoc.length - 1]
    return latestEdit.newContent
  }, [pendingEdits])

  const clearAllEdits = useCallback(() => {
    setAllEdits([])
  }, [])

  const hasPendingEdits = pendingEdits.some(e => e.status === 'pending')

  const value = useMemo(
    () => ({
      allEdits,
      pendingEdits,
      addPendingEdit,
      acceptEdit,
      rejectEdit,
      markAsSynced,
      acceptAllEdits,
      rejectAllEdits,
      getPendingEditsForDoc,
      getEditById,
      getEditByContent,
      hasPendingEdits,
      getStagedContent,
      clearAllEdits,
    }),
    [
      allEdits,
      pendingEdits,
      addPendingEdit,
      acceptEdit,
      rejectEdit,
      markAsSynced,
      acceptAllEdits,
      rejectAllEdits,
      getPendingEditsForDoc,
      getEditById,
      getEditByContent,
      hasPendingEdits,
      getStagedContent,
      clearAllEdits,
    ]
  )

  return (
    <PendingEditsContext.Provider value={value}>
      {children}
    </PendingEditsContext.Provider>
  )
}

export function usePendingEditsContext(): PendingEditsContextValue {
  const context = useContext(PendingEditsContext)
  if (!context) {
    throw new Error(
      'usePendingEditsContext is only available inside PendingEditsProvider'
    )
  }
  return context
}

// Optional version that returns undefined when context is not available
export function usePendingEditsContextOptional(): PendingEditsContextValue | undefined {
  return useContext(PendingEditsContext)
}

export default PendingEditsContext
