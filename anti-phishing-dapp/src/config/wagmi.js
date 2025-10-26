import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  baseSepolia,
} from 'wagmi/chains';
import { http } from 'wagmi';
import { BASE_SEPOLIA_RPC_URL } from './contract-config'; // Import RPC URL

// Define your project ID for WalletConnect
// You can get one at cloud.walletconnect.com
const projectId = '9e40bdaa4ad54dda337d19b734967075'; // Replace with your actual Project ID

// Configure wagmi for Base Sepolia
const wagmiConfig = getDefaultConfig({
  appName: 'Anti-Phishing System',
  projectId,
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
