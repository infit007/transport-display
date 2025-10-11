import React, { useEffect, useState } from 'react';
import screenfull from 'screenfull';
import BusSelector from './components/BusSelector';
import Display from './components/Display';
import { supabase } from './services/supabase';

const App = () => {
  const [step, setStep] = useState('loading');
  const [busNumber, setBusNumber] = useState('');
  const [depot, setDepot] = useState('');

  useEffect(() => {
    console.log('App useEffect running');
    // Add a small delay to ensure proper initialization
    const timer = setTimeout(() => {
      // Check if we have bus/depot info
      const hasBus = localStorage.getItem('tv_bus_number');
      const hasDepot = localStorage.getItem('tv_depot');
      
      console.log('Checking localStorage:', { hasBus, hasDepot });
      console.log('Supabase configured:', supabase !== null);
      
      if (!hasBus && !hasDepot) {
        console.log('Setting step to bus-selector');
        setStep('bus-selector');
      } else {
        console.log('Setting step to display');
        setStep('display');
        setBusNumber(hasBus || '');
        setDepot(hasDepot || '');
        
        // Try fullscreen
        if (screenfull.isEnabled) {
          screenfull.request().catch(() => {});
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  console.log('App rendering with step:', step, 'busNumber:', busNumber, 'depot:', depot);

  if (step === 'loading') {
    return (
      <div className="screen">
        <div className="panel">
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  if (step === 'bus-selector') {
    return <BusSelector onDone={() => {
      console.log('BusSelector onDone called');
      const bus = localStorage.getItem('tv_bus_number') || '';
      const depot = localStorage.getItem('tv_depot') || '';
      console.log('Setting bus:', bus, 'depot:', depot);
      setBusNumber(bus);
      setDepot(depot);
      setStep('display');
      console.log('Step set to display');
      
      // Try fullscreen after selection
      if (screenfull.isEnabled) {
        screenfull.request().catch(() => {});
      }
    }} />;
  }

  if (step === 'display') {
    console.log('Rendering Display component');
    return <Display busNumber={busNumber} depot={depot} />;
  }

  return (
    <div className="screen">
      <div className="panel">
        <h1>Unknown Step: {step}</h1>
        <button className="btn primary" onClick={() => setStep('bus-selector')}>
          Reset
        </button>
      </div>
    </div>
  );
};

export default App;


