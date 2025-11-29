import { useTranslation } from 'react-i18next'

function FreePlan() {
  const { t } = useTranslation()

  return (
    <div className="lemma-free-plan">
      <div className="mb-4">
        <h2 className="h4 mb-3">Your Current Plan: <strong>Lemma Free</strong></h2>
        <p className="text-muted">
          You're on the free plan with 5 AI assistant messages per week.
        </p>
      </div>
      
      <div className="plan-features mb-4">
        <h3 className="h5 mb-2">Free Plan Includes:</h3>
        <ul className="list-unstyled">
          <li className="mb-1">✓ Unlimited projects</li>
          <li className="mb-1">✓ Unlimited collaborators</li>
          <li className="mb-1">✓ Full LaTeX editor features</li>
          <li className="mb-1">✓ Version history</li>
          <li className="mb-1">✓ <strong>5 AI messages per week</strong></li>
        </ul>
      </div>

      <div className="upgrade-prompt p-3 rounded mb-3" style={{ backgroundColor: 'var(--bg-light-secondary, #f8f9fa)', border: '1px solid var(--border-color-01, #dee2e6)' }}>
        <h3 className="h5 mb-2">🚀 Upgrade to Lemma Pro</h3>
        <ul className="list-unstyled mb-3">
          <li className="mb-1">✓ <strong>Unlimited AI messages</strong></li>
          <li className="mb-1">✓ Priority compile queue</li>
          <li className="mb-1">✓ Priority support</li>
        </ul>
        <p className="mb-2 text-muted">
          <strong>$20/month</strong> or <strong>$200/year</strong> (save 17%)
        </p>
        <a className="btn btn-primary" href="/user/subscription/plans">
          Upgrade to Pro
        </a>
      </div>
    </div>
  )
}

export default FreePlan
