import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  baseSepolia,
} from 'wagmi/chains';
import { http } from 'wagmi';
import { BASE_SEPOLIA_RPC_URL } from './contract-config'; // Import RPC URL

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID; // NEW: Read from .env

// Configure wagmi for Base Sepolia
const wagmiConfig = getDefaultConfig({
  appName: 'Anti-Phishing System',
  projectId, // This will now use the value from the .env file
  chains: [
    baseSepolia,
  ],
  transports: {
    // Use your custom RPC URL for Base Sepolia
    [baseSepolia.id]: http(BASE_SEPOLIA_RPC_URL),
  },
  ssr: true, // Set to true if you are using Server-Side Rendering
});

export default wagmiConfig;
