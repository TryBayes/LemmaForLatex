import React from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import MaterialIcon from '@/shared/components/material-icon'

interface PlansPageData {
  currentPlan: string
  hasPaidPlan: boolean
  weeklyMessages: number
  weeklyLimit: number
  remaining: number
}

function CheckIcon() {
  return (
    <svg className="plan-check-icon" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

export default function PlansPage() {
  const { t } = useTranslation()
  const data = getMeta('ol-plansPageData') as PlansPageData | undefined

  const currentPlan = data?.currentPlan || 'free'
  const hasPaidPlan = data?.hasPaidPlan || false
  const weeklyMessages = data?.weeklyMessages || 0
  const weeklyLimit = data?.weeklyLimit || 5
  const remaining = data?.remaining ?? (weeklyLimit - weeklyMessages)

  const isLimitReached = !hasPaidPlan && remaining <= 0

  return (
    <div className="plans-page">
      <div className="plans-page-container">
        {/* Header */}
        <div className="plans-header">
          <h1 className="plans-title">Choose your plan</h1>
          <p className="plans-subtitle">
            Upgrade for unlimited AI assistance with your LaTeX documents
          </p>
        </div>

        {/* Usage Alert for Free Users */}
        {!hasPaidPlan && (
          <div className={`plans-usage-alert ${isLimitReached ? 'plans-usage-alert-danger' : ''}`}>
            <div className="plans-usage-content">
              <MaterialIcon type={isLimitReached ? 'error' : 'info'} />
              <span>
                <strong>AI messages this week:</strong> {weeklyMessages} of {weeklyLimit} used
                {isLimitReached && <span className="plans-limit-text"> — Limit reached</span>}
              </span>
            </div>
            {!isLimitReached && (
              <div className="plans-usage-bar">
                <div 
                  className="plans-usage-progress" 
                  style={{ width: `${(weeklyMessages / weeklyLimit) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Plans Grid */}
        <div className="plans-grid">
          {/* Free Plan */}
          <div className={`plan-card ${currentPlan === 'free' ? 'plan-card-current' : ''}`}>
            {currentPlan === 'free' && (
              <div className="plan-badge plan-badge-current">Current plan</div>
            )}
            <div className="plan-card-header">
              <h2 className="plan-name">Free</h2>
              <div className="plan-price">
                <span className="plan-price-amount">$0</span>
                <span className="plan-price-period">/month</span>
              </div>
              <p className="plan-price-note">Forever free</p>
            </div>
            
            <div className="plan-card-body">
              <ul className="plan-features">
                <li>
                  <CheckIcon />
                  <span>Unlimited projects</span>
                </li>
                <li>
                  <CheckIcon />
                  <span>Unlimited collaborators</span>
                </li>
                <li>
                  <CheckIcon />
                  <span>Full LaTeX editor</span>
                </li>
                <li>
                  <CheckIcon />
                  <span>Real-time collaboration</span>
                </li>
                <li>
                  <CheckIcon />
                  <span>Version history</span>
                </li>
                <li className="plan-feature-highlight">
                  <CheckIcon />
                  <span><strong>5 AI messages per week</strong></span>
                </li>
              </ul>
            </div>

            <div className="plan-card-footer">
              {currentPlan === 'free' ? (
                <button className="plan-button plan-button-secondary" disabled>
                  Current plan
                </button>
              ) : (
                <a href="/user/subscription" className="plan-button plan-button-secondary">
                  Manage subscription
                </a>
              )}
            </div>
          </div>

          {/* Pro Plan */}
          <div className={`plan-card plan-card-featured ${hasPaidPlan ? 'plan-card-current' : ''}`}>
            <div className="plan-badge plan-badge-featured">
              {hasPaidPlan ? 'Current plan' : 'Recommended'}
            </div>
            <div className="plan-card-header">
              <h2 className="plan-name">Lemma Pro</h2>
              <div className="plan-price">
                <span className="plan-price-amount">$20</span>
                <span className="plan-price-period">/month</span>
              </div>
              <p className="plan-price-note">
                or $200/year <span className="plan-savings">(save 17%)</span>
              </p>
            </div>
            
            <div className="plan-card-body">
              <p className="plan-includes">Everything in Free, plus:</p>
              <ul className="plan-features">
                <li className="plan-feature-star">
                  <CheckIcon />
                  <span><strong>Unlimited AI messages</strong></span>
                </li>
                <li>
                  <CheckIcon />
                  <span>Priority compile queue</span>
                </li>
                <li>
                  <CheckIcon />
                  <span>Priority support</span>
                </li>
                <li>
                  <CheckIcon />
                  <span>Early access to new features</span>
                </li>
              </ul>
            </div>

            <div className="plan-card-footer">
              {hasPaidPlan ? (
                <a href="/user/subscription" className="plan-button plan-button-primary">
                  Manage subscription
                </a>
              ) : (
                <>
                  <a 
                    href="mailto:founders@lemmaforlatex.com?subject=Upgrade%20to%20Lemma%20Pro&body=Hi%2C%20I'd%20like%20to%20upgrade%20to%20Lemma%20Pro." 
                    className="plan-button plan-button-primary"
                  >
                    Upgrade to Pro
                  </a>
                  <p className="plan-cta-note">Contact us to get started</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="plans-faq">
          <h3 className="plans-faq-title">Questions?</h3>
          <p className="plans-faq-text">
            Contact us at{' '}
            <a href="mailto:founders@lemmaforlatex.com">founders@lemmaforlatex.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}
