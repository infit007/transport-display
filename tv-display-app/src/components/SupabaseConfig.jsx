import React, { useState } from 'react';
import { configureSupabase } from '../services/supabase';

const SupabaseConfig = ({ onConfigured }) => {
  const [url, setUrl] = useState('https://eunaapesqbukbsrbgwna.supabase.co');
  const [anonKey, setAnonKey] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);

  const handleConfigure = () => {
    if (!url.trim() || !anonKey.trim()) {
      alert('Please enter both URL and API key');
      return;
    }

    setIsConfiguring(true);
    configureSupabase(url.trim(), anonKey.trim());
    
    setTimeout(() => {
      setIsConfiguring(false);
      onConfigured?.();
    }, 1000);
  };

  return (
    <div className="screen">
      <div className="panel">
        <h1>Supabase Configuration</h1>
        <p className="hint">Configure Supabase connection for real-time data</p>
        
        <div className="row" style={{ marginTop: 24 }}>
          <div className="col">
            <label>Supabase URL</label>
            <input 
              className="input" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
            />
          </div>
        </div>
        
        <div className="row" style={{ marginTop: 16 }}>
          <div className="col">
            <label>Supabase Anon Key</label>
            <input 
              className="input" 
              type="password"
              value={anonKey} 
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            />
          </div>
        </div>
        
        <div style={{ marginTop: 24 }}>
          <button 
            className="btn primary" 
            onClick={handleConfigure}
            disabled={isConfiguring || !url.trim() || !anonKey.trim()}
          >
            {isConfiguring ? 'Configuring...' : 'Configure Supabase'}
          </button>
        </div>
        
        <div style={{ marginTop: 16, fontSize: '12px', color: '#666' }}>
          <p><strong>How to get your Supabase credentials:</strong></p>
          <ol>
            <li>Go to your Supabase project dashboard</li>
            <li>Click on "Settings" → "API"</li>
            <li>Copy the "Project URL" and "anon public" key</li>
            <li>Paste them above and click "Configure Supabase"</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default SupabaseConfig;
