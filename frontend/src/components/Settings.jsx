import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../api';

const Settings = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [tolerance, setTolerance] = useState(0.75);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const settings = await getSettings();
      setWebhookUrl(settings.webhook_url || '');
      setWebhookEnabled(settings.webhook_enabled || false);
      setTolerance(settings.tolerance !== undefined ? settings.tolerance : 0.75);
    } catch (err) {
      setError(`Failed to load settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validate URL if enabled
    if (webhookEnabled && webhookUrl.trim()) {
      try {
        new URL(webhookUrl.trim());
      } catch {
        setError('Please enter a valid URL');
        return;
      }
    }

    // Validate tolerance
    if (tolerance < 0 || tolerance > 1) {
      setError('Tolerance must be between 0.0 and 1.0');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      await updateSettings({
        webhook_url: webhookUrl.trim(),
        webhook_enabled: webhookEnabled,
        tolerance: tolerance
      });
      
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="card">
      <h2>Settings</h2>

      {error && <div className="error">{error}</div>}
      {success && <div className="success" style={{ backgroundColor: '#27ae60', color: 'white', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{success}</div>}

      <form onSubmit={handleSave}>
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="webhook-url" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Webhook URL
          </label>
          <input
            id="webhook-url"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
            disabled={saving}
          />
          <p style={{ fontSize: '0.85em', color: '#666', marginTop: '5px' }}>
            When a known face is recognized, a GET request will be sent to this URL with query parameters:
            <code style={{ display: 'block', marginTop: '5px', padding: '5px', backgroundColor: '#f5f5f5', borderRadius: '3px' }}>
              ?tag=John,Doe
            </code>
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={webhookEnabled}
              onChange={(e) => setWebhookEnabled(e.target.checked)}
              disabled={saving}
              style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 'bold' }}>Enable Webhook</span>
          </label>
          <p style={{ fontSize: '0.85em', color: '#666', marginTop: '5px', marginLeft: '26px' }}>
            When enabled, webhook requests will be sent when known faces are recognized.
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="tolerance" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Recognition Sensitivity: {tolerance.toFixed(2)}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <input
              id="tolerance"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={tolerance}
              onChange={(e) => setTolerance(parseFloat(e.target.value))}
              disabled={saving}
              style={{
                flex: 1,
                height: '8px',
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            />
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={tolerance}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0 && val <= 1) {
                  setTolerance(val);
                }
              }}
              disabled={saving}
              style={{
                width: '80px',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                textAlign: 'center'
              }}
            />
          </div>
          <p style={{ fontSize: '0.85em', color: '#666', marginTop: '5px' }}>
            <strong>Lower values (0.3-0.6)</strong> = More strict, fewer false positives (recommended for door automation)<br />
            <strong>Higher values (0.6-1.0)</strong> = More lenient, might have more false positives<br />
            <strong>Default: 0.75</strong> - Balanced setting
          </p>
        </div>

        <button
          type="submit"
          className="button"
          disabled={saving}
          style={{
            backgroundColor: saving ? '#ccc' : '#667eea',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
};

export default Settings;

