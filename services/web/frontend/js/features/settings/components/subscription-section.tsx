import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { postJSON } from '@/infrastructure/fetch-json'
import OLButton from '@/shared/components/ol/ol-button'
import OLNotification from '@/shared/components/ol/ol-notification'

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--green-50, #138a07)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginRight: '6px', flexShrink: 0 }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

type SubscriptionStatus = {
  hasPaidPlan: boolean
  planName: string
  status: string
  loading: boolean
  error: string | null
}

function SubscriptionSection() {
  const { t } = useTranslation()
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    hasPaidPlan: false,
    planName: 'Free',
    status: 'active',
    loading: true,
    error: null,
  })
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    // Fetch subscription status from the AI message count endpoint (which includes hasPaidPlan)
    fetch('/ai-assistant/message-count')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then(data => {
        setSubscription({
          hasPaidPlan: data.hasPaidPlan || false,
          planName: data.hasPaidPlan ? 'Lemma Pro' : 'Free',
          status: 'active',
          loading: false,
          error: null,
        })
      })
      .catch(() => {
        // Default to showing free plan if we can't fetch status
        setSubscription({
          hasPaidPlan: false,
          planName: 'Free',
          status: 'active',
          loading: false,
          error: null,
        })
      })
  }, [])

  const handleManageSubscription = useCallback(async () => {
    setActionLoading(true)
    try {
      const response = await postJSON('/user/subscription/stripe/create-portal-session')
      if (response.url) {
        window.location.href = response.url
      }
    } catch (err: any) {
      setSubscription(prev => ({
        ...prev,
        error: err.message || 'Failed to open subscription management',
      }))
    } finally {
      setActionLoading(false)
    }
  }, [])

  const handleUpgrade = useCallback(async () => {
    setActionLoading(true)
    try {
      const response = await postJSON('/user/subscription/stripe/create-checkout-session')
      if (response.url) {
        window.location.href = response.url
      }
    } catch (err: any) {
      setSubscription(prev => ({
        ...prev,
        error: err.message || 'Failed to start checkout',
      }))
    } finally {
      setActionLoading(false)
    }
  }, [])

  if (subscription.loading) {
    return (
      <div className="settings-section">
        <h3>Subscription</h3>
        <p className="text-muted">Loading...</p>
      </div>
    )
  }

  return (
    <div className="settings-section" id="subscription-section">
      <h3>Subscription</h3>
      
      {subscription.error && (
        <OLNotification
          type="error"
          content={subscription.error}
          className="mb-3"
        />
      )}

      <div
        style={{
          background: 'var(--bg-light-secondary, #f9fafb)',
          borderRadius: '6px',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--content-secondary, #5d6879)', marginBottom: '4px' }}>
              Current Plan
            </div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--content-primary, #2c3645)' }}>
              {subscription.planName}
              {subscription.hasPaidPlan && (
                <span
                  style={{
                    display: 'inline-block',
                    marginLeft: '8px',
                    padding: '2px 8px',
                    background: 'var(--green-10, #e8f5e9)',
                    color: 'var(--green-50, #138a07)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                  }}
                >
                  Active
                </span>
              )}
            </div>
          </div>
          
          {subscription.hasPaidPlan ? (
            <OLButton
              variant="secondary"
              onClick={handleManageSubscription}
              disabled={actionLoading}
            >
              {actionLoading ? 'Loading...' : 'Manage Subscription'}
            </OLButton>
          ) : (
            <OLButton
              variant="primary"
              onClick={handleUpgrade}
              disabled={actionLoading}
            >
              {actionLoading ? 'Loading...' : 'Upgrade to Pro'}
            </OLButton>
          )}
        </div>
      </div>

      {subscription.hasPaidPlan ? (
        <div style={{ fontSize: '14px', color: 'var(--content-secondary, #5d6879)' }}>
          <p style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center' }}>
            <CheckIcon />
            Unlimited AI assistant messages
          </p>
          <p style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center' }}>
            <CheckIcon />
            Priority compile queue
          </p>
          <p style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center' }}>
            <CheckIcon />
            Priority support
          </p>
          <p style={{ margin: 0, marginTop: '16px', fontSize: '13px' }}>
            Click "Manage Subscription" to update payment method, view invoices, or cancel.
          </p>
        </div>
      ) : (
        <div style={{ fontSize: '14px', color: 'var(--content-secondary, #5d6879)' }}>
          <p style={{ margin: '0 0 12px' }}>
            Upgrade to <strong>Lemma Pro</strong> for $20/month to get:
          </p>
          <p style={{ margin: '0 0 8px' }}>
            • Unlimited AI assistant messages
          </p>
          <p style={{ margin: '0 0 8px' }}>
            • Priority compile queue
          </p>
          <p style={{ margin: '0 0 8px' }}>
            • Priority support
          </p>
          <p style={{ margin: '0 0 8px' }}>
            • Early access to new features
          </p>
        </div>
      )}
    </div>
  )
}

export default SubscriptionSection

