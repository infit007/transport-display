import { useEffect, useRef, useState } from 'react';
import { getContent, openSocket } from '../services/api';
import { supabase } from '../services/supabase';
import { getDeviceId, getToken, logout } from '../services/auth';

const Display = () => {
  const deviceId = getDeviceId();
  const selectedBusNumber = localStorage.getItem('tv_bus_number') || '';
  const selectedDepot = localStorage.getItem('tv_depot') || '';
  const [items, setItems] = useState([]);
  const [ticker, setTicker] = useState('');
  const timerRef = useRef(null);

  const load = async () => {
    try {
      const res = await getContent(deviceId);
      setItems(res?.items || []);
      setTicker(res?.ticker || '');
    } catch (e) {
      // token invalid or other error
      if (e?.response?.status === 401) {
        logout();
        window.location.reload();
      }
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30000);
    const socket = openSocket();
    socket.on('content:update', (payload) => {
      if (!payload) return;
      if (payload.deviceId && deviceId && payload.deviceId !== deviceId) return;
      if (payload.targets) {
        const ids = Array.isArray(payload.targets.deviceIds) ? payload.targets.deviceIds : [];
        const depos = Array.isArray(payload.targets.depots) ? payload.targets.depots : [];
        const okId = ids.length === 0 || ids.includes(selectedBusNumber);
        const okDepot = depos.length === 0 || (selectedDepot && depos.includes(selectedDepot));
        if (!okId || !okDepot) return;
      }
      load();
    });
    // Live news/ticker via Supabase (optional)
    if (supabase) {
      const channel = supabase
        .channel('tv-news')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'news_feeds' }, (payload) => {
          const row = payload.new || {};
          if (row.is_active) setTicker(row.title || row.content || '');
        })
        .subscribe();
      return () => {
        clearInterval(timerRef.current);
        socket.close();
        supabase.removeChannel(channel);
      };
    }
    return () => {
      clearInterval(timerRef.current);
      socket.close();
    };
  }, []);

  const primary = items[0] || { type: 'text', text: 'Awaiting content…' };
  const schedule = items.slice(1);

  return (
    <div className="content">
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: '#000', borderRadius: 12, height: '100%' }}>
          {primary.type === 'video' ? (
            <video src={primary.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay muted loop playsInline />
          ) : primary.type === 'image' ? (
            <img src={primary.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div className="screen" style={{ fontSize: 48, textAlign: 'center' }}>{primary.text}</div>
          )}
        </div>
        <div style={{ background: '#0b0b0b', borderRadius: 12, padding: 16, overflow: 'auto' }}>
          <h2>Schedule</h2>
          {schedule.length === 0 ? (
            <div className="hint">No schedule yet. Configure in CMS.</div>
          ) : (
            <ul>
              {schedule.map((it, i) => (
                <li key={i} style={{ margin: '12px 0' }}>{it.title || it.text || it.url}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="ticker">{ticker || 'Welcome'}</div>
    </div>
  );
};

export default Display;



