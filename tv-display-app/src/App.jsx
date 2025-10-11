import { useEffect, useState } from 'react';
import screenfull from 'screenfull';
import Registration from './components/Registration';
import BusSelector from './components/BusSelector';
import Display from './components/Display';
import { isRegistered } from './services/auth';

const App = () => {
  const [step, setStep] = useState('loading');
  const [busNumber, setBusNumber] = useState('');
  const [depot, setDepot] = useState('');

  useEffect(() => {
    // Check what step we should be on
    const registered = isRegistered();
    const hasBus = localStorage.getItem('tv_bus_number');
    const hasDepot = localStorage.getItem('tv_depot');
    
    if (!registered) {
      setStep('registration');
    } else if (!hasBus && !hasDepot) {
      setStep('bus-selector');
    } else {
      setStep('display');
      setBusNumber(hasBus || '');
      setDepot(hasDepot || '');
      
      // Try fullscreen
      if (screenfull.isEnabled) {
        screenfull.request().catch(() => {});
      }
    }
  }, []);

  if (step === 'loading') {
    return (
      <div className="screen">
        <div className="panel">
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  if (step === 'registration') {
    return <Registration onRegistered={() => setStep('bus-selector')} />;
  }

  if (step === 'bus-selector') {
    return <BusSelector onDone={() => {
      setBusNumber(localStorage.getItem('tv_bus_number') || '');
      setDepot(localStorage.getItem('tv_depot') || '');
      setStep('display');
    }} />;
  }

  return <Display busNumber={busNumber} depot={depot} />;
};

export default App;


