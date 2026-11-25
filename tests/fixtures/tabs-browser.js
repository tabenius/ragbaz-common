import React from 'react';
import { createRoot } from 'react-dom/client';
import { Tabs } from '../../src/widgets/primitives';

function App() {
  const [value, setValue] = React.useState('all');
  window.__tabValue = value;
  return React.createElement(Tabs, {
    label: 'Audience',
    value,
    onChange: next => { setValue(next); window.__tabValue = next; },
    items: [
      { id: 'all', label: 'All' },
      { id: 'smb', label: 'SMB' },
      { id: 'lab', label: 'Lab' },
    ],
  });
}

createRoot(document.getElementById('app')).render(React.createElement(App));
