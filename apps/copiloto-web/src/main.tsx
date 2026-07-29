import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './design-system/fonts.css';
import './design-system/fonts-web.css';
import './design-system/themes.css';
import './design-system/global.css';

import { App } from './App';
import { instalarCapturaGlobal } from './lib/errores-globales';

// ANTES de montar React, a propósito: un fallo durante el propio montaje (o en cualquier import con
// efecto de arriba) también tiene que dejar rastro. Cubre lo que un ErrorBoundary no puede — handlers,
// código asíncrono y promesas rechazadas sin `catch`, que es el modo de fallo natural de cada `fetch`.
instalarCapturaGlobal();

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root no encontrado en index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
