import { useEffect, useMemo, useState } from 'react';
import screenfull from 'screenfull';
import Registration from './components/Registration';
import Display from './components/Display';
import { getToken, isRegistered, validateToken } from './services/auth';

const App = () => {
  const [registered, setRegistered] = useState(isRegistered());
  const [tokenValid, setTokenValid] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const token = getToken();
      const ok = await validateToken(token);
      setTokenValid(ok);
      setChecking(false);
      if (ok && screenfull.isEnabled) {
        // attempt fullscreen once app is interactive
        screenfull.request().catch(() => {});
      }
    };
    check();
  }, [registered]);

  if (checking) return null;
  if (!registered || !tokenValid) {
    return <Registration onRegistered={() => setRegistered(true)} />;
  }
  return <Display />;
};

export default App;


