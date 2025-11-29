import '../../../utils/meta'
import '../../../utils/webpack-public-path'
import '../../../infrastructure/error-reporter'
import '@/i18n'
import { createRoot } from 'react-dom/client'
import getMeta from '@/utils/meta'

function StripeSuccessPage() {
  const planName = getMeta('ol-planName') || 'Lemma Pro'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-light-secondary, #f5f5f5)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-light-primary, #ffffff)',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Success Banner */}
        <div
          style={{
            background: 'var(--green-50, #138a07)',
            padding: '32px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 16px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1
            style={{
              color: 'white',
              fontSize: '24px',
              fontWeight: '600',
              margin: 0,
              fontFamily: 'var(--font-family-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
            }}
          >
            Welcome to {planName}!
          </h1>
        </div>

        {/* Content */}
        <div style={{ padding: '32px 24px' }}>
          <p
            style={{
              fontSize: '15px',
              color: 'var(--content-secondary, #5d6879)',
              lineHeight: '1.6',
              margin: '0 0 24px',
              textAlign: 'center',
            }}
          >
            Thank you for subscribing! Your account has been upgraded and you now
            have access to all premium features.
          </p>

          {/* Features List */}
          <div
            style={{
              background: 'var(--bg-light-secondary, #f9fafb)',
              borderRadius: '6px',
              padding: '20px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--content-secondary, #5d6879)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px',
              }}
            >
              Your plan includes
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
              }}
            >
              {[
                'Unlimited AI assistant messages',
                'Priority compile queue',
                'Priority support',
                'Early access to new features',
              ].map((feature, index) => (
                <li
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 0',
                    fontSize: '14px',
                    color: 'var(--content-primary, #2c3645)',
                    borderBottom: index < 3 ? '1px solid var(--border-color-01, #e7e9ee)' : 'none',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--green-50, #138a07)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA Button */}
          <a
            href="/project"
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 24px',
              background: 'var(--green-50, #138a07)',
              color: 'white',
              fontSize: '15px',
              fontWeight: '600',
              textAlign: 'center',
              textDecoration: 'none',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'var(--green-60, #0d6d06)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'var(--green-50, #138a07)')}
          >
            Go to your projects
          </a>

          {/* Secondary Link */}
          <p
            style={{
              fontSize: '13px',
              color: 'var(--content-secondary, #5d6879)',
              textAlign: 'center',
              margin: '16px 0 0',
            }}
          >
            Manage your subscription in{' '}
            <a
              href="/user/subscription"
              style={{
                color: 'var(--green-50, #138a07)',
                textDecoration: 'none',
              }}
            >
              account settings
            </a>
          </p>
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

