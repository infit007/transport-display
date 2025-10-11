import React, { useState } from 'react';

const BusSelector = ({ onDone }) => {
  const [busNumber, setBusNumber] = useState(localStorage.getItem('tv_bus_number') || '');
  const [depot, setDepot] = useState(localStorage.getItem('tv_depot') || '');
  const canContinue = !!(busNumber.trim() || depot.trim());

  const save = () => {
    console.log('BusSelector save called with:', busNumber, depot);
    if (busNumber.trim()) {
      localStorage.setItem('tv_bus_number', busNumber.trim());
      console.log('Saved bus number:', busNumber.trim());
    }
    if (depot.trim()) {
      localStorage.setItem('tv_depot', depot.trim());
      console.log('Saved depot:', depot.trim());
    }
    console.log('Calling onDone');
    onDone?.();
  };

  return (
    <div className="screen">
      <div className="panel">
        <h1>TV Display Setup</h1>
        <p className="hint">Enter bus number and depot to start displaying</p>
        <div className="row" style={{ marginTop: 24 }}>
          <div className="col">
            <input 
              className="input" 
              placeholder="Bus Number (e.g., UK-01-A-1001)" 
              value={busNumber} 
              onChange={(e) => setBusNumber(e.target.value)}
              autoFocus
            />
          </div>
          <div className="col">
            <input 
              className="input" 
              placeholder="Depot (e.g., Dehradun)" 
              value={depot} 
              onChange={(e) => setDepot(e.target.value)}
            />
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <button className="btn primary" disabled={!canContinue} onClick={save}>
            Start Display
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusSelector;


