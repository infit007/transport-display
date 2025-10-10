import { useState } from 'react';

const BusSelector = ({ onDone }) => {
  const [busNumber, setBusNumber] = useState(localStorage.getItem('tv_bus_number') || '');
  const [depot, setDepot] = useState(localStorage.getItem('tv_depot') || '');
  const canContinue = !!(busNumber.trim() || depot.trim());

  const save = () => {
    if (busNumber.trim()) localStorage.setItem('tv_bus_number', busNumber.trim());
    if (depot.trim()) localStorage.setItem('tv_depot', depot.trim());
    onDone?.();
  };

  return (
    <div className="screen">
      <div className="panel">
        <h1>Select Bus or Depot</h1>
        <div className="row" style={{ marginTop: 12 }}>
          <div className="col">
            <input className="input" placeholder="Bus Number (e.g., UK-01-A-1001)" value={busNumber} onChange={(e) => setBusNumber(e.target.value)} />
          </div>
          <div className="col">
            <input className="input" placeholder="Depot (optional)" value={depot} onChange={(e) => setDepot(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" disabled={!canContinue} onClick={save}>Continue</button>
        </div>
      </div>
    </div>
  );
};

export default BusSelector;


