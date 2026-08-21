import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/syne/700.css';
import '@fontsource/syne/800.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/global.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
