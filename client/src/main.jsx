import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { DismissableLayerProvider } from './context/DismissableLayerContext.jsx';
import { LocaleProvider } from './i18n/LocaleProvider.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LocaleProvider>
      <DismissableLayerProvider>
        <App />
      </DismissableLayerProvider>
    </LocaleProvider>
  </StrictMode>
);
