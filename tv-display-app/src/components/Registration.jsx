import React, { useEffect, useMemo, useState } from 'react';
import { registerDevice } from '../services/api';
import { saveRegistration } from '../services/auth';

const Registration = ({ onRegistered }) => {
  const [deviceName, setDeviceName] = useState('');
  const [location, setLocation] = useState('');
  const [approvalCode, setApprovalCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const canSubmit = deviceName.trim() && location.trim() && /^\w{4,}$/.test(approvalCode.trim());

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      // For now, skip backend registration and just mark as registered
      // In production, uncomment the lines below:
      // const res = await registerDevice({ deviceName, location, approvalCode });
      // if (!res?.token || !res?.deviceId) throw new Error('Invalid response');
      // saveRegistration(res.token, res.deviceId);
      
      // Mock registration for demo
      saveRegistration('demo-token-' + Date.now(), 'device-' + Date.now());
      onRegistered?.();
    } catch (e) {
      const next = attempts + 1;
      setAttempts(next);
      setError(e?.response?.data?.error || e.message || 'Registration failed');
      if (next < 3) {
        setTimeout(() => submit(), 1500 * next);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen">
      <div className="panel">
        <h1>Register Display</h1>
        <p className="hint">First-time setup. Enter details from your CMS admin.</p>
        <div className="row">
          <div className="col">
            <input className="input" placeholder="Device Name" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
          </div>
          <div className="col">
            <input className="input" placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="col">
            <input className="input" placeholder="Admin Approval Code" value={approvalCode} onChange={(e) => setApprovalCode(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <button className="btn primary" disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? 'Registering…' : 'Register'}
          </button>
          {error && <div className="error">{error} (attempt {attempts}/3)</div>}
        </div>
      </div>
    </div>
  );
};

export default Registration;



