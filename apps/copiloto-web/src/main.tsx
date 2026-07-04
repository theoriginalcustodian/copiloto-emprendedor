import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './design-system/fonts.css';
import './design-system/themes.css';
import './design-system/global.css';

import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root no encontrado en index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
