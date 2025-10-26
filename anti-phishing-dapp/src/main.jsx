import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // Your custom CSS

// Wagmi & RainbowKit imports
import '@rainbow-me/rainbowkit/styles.css';
import {
  RainbowKitProvider,
  darkTheme // Using darkTheme from RainbowKit, but customized below
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import wagmiConfig from './config/wagmi'; // Your wagmi config
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: 'var(--cyan-primary)', // Using your CSS variable
            accentColorForeground: 'var(--bg-primary)',
            borderRadius: 'large',
            fontStack: 'Rajdhani, sans-serif', // Using your font
            overlayBlur: 'small',
          })}
          chains={wagmiConfig.chains}
        >
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
