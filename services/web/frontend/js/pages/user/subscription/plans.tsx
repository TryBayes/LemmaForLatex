import './base'
import { createRoot } from 'react-dom/client'
import Root from '../../../features/subscription/components/plans-page/root'

const element = document.getElementById('plans-page-root')
if (element) {
  const root = createRoot(element)
  root.render(<Root />)
}

