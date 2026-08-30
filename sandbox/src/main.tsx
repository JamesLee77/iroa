import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('ROOT_ELEMENT_REQUIRED');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
