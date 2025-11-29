import React from 'react'
import PlansPage from './plans-page'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'

export default function Root() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return <PlansPage />
}

