import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { StoreProvider } from './state/store';
import './theme.css';

// Amplify wiring (uncomment once `ampx sandbox` / hosting emits amplify_outputs.json):
// import { Amplify } from 'aws-amplify';
// import outputs from '../amplify_outputs.json';
// Amplify.configure(outputs);

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
