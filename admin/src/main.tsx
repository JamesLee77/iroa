import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import App from './App';
import { AdminProvider } from './context/AdminContext';
import { queryClient, wagmiConfig } from './lib/wagmi';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('ROOT_ELEMENT_REQUIRED');

createRoot(root).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AdminProvider><App /></AdminProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
