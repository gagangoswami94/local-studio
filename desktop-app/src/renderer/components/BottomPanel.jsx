import React from 'react';

const BottomPanel = ({ collapsed }) => {
  if (collapsed) {
    return null;
  }

  return (
    <div className="bottom-panel">
      <div style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '13px', marginBottom: '12px', textTransform: 'uppercase', opacity: 0.6 }}>
          Terminal
        </h3>
        <p style={{ fontSize: '12px', opacity: 0.5 }}>Ready</p>
      </div>
    </div>
  );
};

export default BottomPanel;
