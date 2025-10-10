import { useEffect, useRef, useState } from 'react';
import { getContent, openSocket } from '../services/api';
import { getDeviceId, getToken, logout } from '../services/auth';

const Display = () => {
  const deviceId = getDeviceId();
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
      if (!payload || (payload.deviceId && payload.deviceId !== deviceId)) return;
      load();
    });
    return () => {
      clearInterval(timerRef.current);
      socket.close();
    };
  }, []);

  return (
    <div className="content">
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: '#000', borderRadius: 12, height: '100%' }}>
          {/* Simple renderer: show first video/image/text */}
          {items[0]?.type === 'video' && (
            <video src={items[0].url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay muted loop playsInline />
          )}
          {items[0]?.type === 'image' && (
            <img src={items[0].url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {items[0]?.type === 'text' && (
            <div className="screen" style={{ fontSize: 48, textAlign: 'center' }}>{items[0].text}</div>
          )}
        </div>
        <div style={{ background: '#0b0b0b', borderRadius: 12, padding: 16, overflow: 'auto' }}>
          <h2>Schedule</h2>
          <ul>
            {items.slice(1).map((it, i) => (
              <li key={i} style={{ margin: '12px 0' }}>{it.title || it.text || it.url}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="ticker">{ticker}</div>
    </div>
  );
};

export default Display;



