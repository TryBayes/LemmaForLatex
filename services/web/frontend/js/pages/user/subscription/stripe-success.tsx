import '../../../utils/meta'
import '../../../utils/webpack-public-path'
import '../../../infrastructure/error-reporter'
import '@/i18n'
import { createRoot } from 'react-dom/client'
import getMeta from '@/utils/meta'

function StripeSuccessPage() {
  const planName = getMeta('ol-planName') || 'Lemma Pro'

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      <div className="row">
        <div className="col-lg-8 col-lg-offset-2">
          <div className="card" style={{ 
            padding: '40px', 
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '24px' }}>
              <svg 
                width="64" 
                height="64" 
                viewBox="0 0 24 24" 
                fill="none" 
                style={{ color: '#22c55e' }}
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            
            <h1 style={{ fontSize: '28px', marginBottom: '16px', color: '#1a1a1a' }}>
              Welcome to {planName}!
            </h1>
            
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px', lineHeight: '1.6' }}>
              Thank you for subscribing. Your account has been upgraded and you now have access to unlimited AI messages and all premium features.
            </p>

            <div style={{ 
              background: '#f0fdf4', 
              border: '1px solid #bbf7d0',
              borderRadius: '8px', 
              padding: '16px',
              marginBottom: '24px'
            }}>
              <h3 style={{ fontSize: '16px', margin: '0 0 8px', color: '#166534' }}>
                What's included:
              </h3>
              <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: 0,
                textAlign: 'left',
                color: '#166534'
              }}>
                <li style={{ padding: '4px 0' }}>✓ Unlimited AI assistant messages</li>
                <li style={{ padding: '4px 0' }}>✓ Priority compile queue</li>
                <li style={{ padding: '4px 0' }}>✓ Priority support</li>
                <li style={{ padding: '4px 0' }}>✓ Early access to new features</li>
              </ul>
            </div>

            <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
              You can manage your subscription anytime from your{' '}
              <a href="/user/subscription" style={{ color: '#16a34a' }}>account settings</a>.
            </p>

            <a 
              href="/project" 
              style={{
                display: 'inline-block',
                background: '#16a34a',
                color: 'white',
                padding: '12px 32px',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '16px'
              }}
            >
              Start Writing
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

const element = document.getElementById('stripe-success-root')
if (element) {
  const root = createRoot(element)
  root.render(<StripeSuccessPage />)
}

