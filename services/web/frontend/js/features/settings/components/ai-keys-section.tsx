import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import { postJSON, deleteJSON, getJSON } from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'

interface ApiKey {
  id: string
  provider: string
  keyPreview: string
  createdAt: string
}

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
  { id: 'openai', name: 'OpenAI (GPT)', placeholder: 'sk-...' },
  { id: 'google', name: 'Google (Gemini)', placeholder: 'AIza...' },
]

export function AiKeysSection() {
  const { t } = useTranslation()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [selectedProvider, setSelectedProvider] = useState(PROVIDERS[0].id)
  const [apiKey, setApiKey] = useState('')

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true)
      const response = await getJSON('/api/user/ai-keys')
      setKeys(response.keys || [])
    } catch (err) {
      console.error('Failed to fetch API keys:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      await postJSON('/api/user/ai-keys', {
        body: {
          provider: selectedProvider,
          apiKey: apiKey.trim(),
        },
      })

      setSuccess('API key saved successfully')
      setApiKey('')
      fetchKeys()
    } catch (err: any) {
      setError(err.message || 'Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return

    try {
      setError(null)
      await deleteJSON(`/api/user/ai-keys/${keyId}`)
      setSuccess('API key deleted')
      fetchKeys()
    } catch (err: any) {
      setError(err.message || 'Failed to delete API key')
    }
  }

  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider)

  return (
    <div className="settings-section">
      <h3>
        <MaterialIcon type="key" />
        AI API Keys
      </h3>
      <p className="settings-section-description">
        Add your own API keys to use AI features without limits. Your keys are
        encrypted and stored securely.
      </p>

      {error && (
        <div className="alert alert-danger">
          <MaterialIcon type="error" />
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <MaterialIcon type="check_circle" />
          {success}
        </div>
      )}

      {/* Existing Keys */}
      {keys.length > 0 && (
        <div className="ai-keys-list">
          <h4>Your API Keys</h4>
          {keys.map(key => (
            <div key={key.id} className="ai-key-item">
              <div className="ai-key-info">
                <span className="ai-key-provider">
                  {PROVIDERS.find(p => p.id === key.provider)?.name ||
                    key.provider}
                </span>
                <span className="ai-key-preview">{key.keyPreview}</span>
                <span className="ai-key-date">
                  Added {new Date(key.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(key.id)}
              >
                <MaterialIcon type="delete" />
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Key Form */}
      <form onSubmit={handleSubmit} className="ai-keys-form">
        <h4>Add New API Key</h4>

        <div className="form-group">
          <label htmlFor="ai-provider">Provider</label>
          <select
            id="ai-provider"
            className="form-control"
            value={selectedProvider}
            onChange={e => setSelectedProvider(e.target.value)}
          >
            {PROVIDERS.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="ai-api-key">API Key</label>
          <input
            id="ai-api-key"
            type="password"
            className="form-control"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={currentProvider?.placeholder}
          />
          <small className="form-text text-muted">
            Your API key is encrypted and never shared.
          </small>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || !apiKey.trim()}
        >
          {saving ? 'Saving...' : 'Save API Key'}
        </button>
      </form>
    </div>
  )
}

export default AiKeysSection
