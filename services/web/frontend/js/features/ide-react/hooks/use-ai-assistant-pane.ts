import { useLayoutContext } from '@/shared/context/layout-context'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import { useCallback, useRef, useState } from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'

export const useAiAssistantPane = () => {
  const { aiAssistantIsOpen: isOpen, setAiAssistantIsOpen: setIsOpen } =
    useLayoutContext()
  const [resizing, setResizing] = useState(false)
  const panelRef = useRef<ImperativePanelHandle>(null)

  useCollapsiblePanel(isOpen, panelRef)

  const togglePane = useCallback(() => {
    setIsOpen(value => !value)
  }, [setIsOpen])

  // These handlers are called by react-resizable-panels but we don't
  // want them to affect the global state - only the toolbar button should
  // control the panel state. This prevents the issue where collapsing one
  // panel causes the other to expand.
  const handlePaneExpand = useCallback(() => {
    // No-op: state is controlled via toolbar button only
  }, [])

  const handlePaneCollapse = useCallback(() => {
    // No-op: state is controlled via toolbar button only
  }, [])

  return {
    isOpen,
    panelRef,
    resizing,
    setResizing,
    togglePane,
    handlePaneExpand,
    handlePaneCollapse,
  }
}
