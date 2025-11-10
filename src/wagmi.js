import { createConfig } from '@wagmi/core'
import { http } from 'viem'
import { base } from '@wagmi/core/chains'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'
import { injected, walletConnect } from 'wagmi/connectors'

// Wagmi configuration for Farcaster Mini App
// Chains: Base mainnet; Transport: default http()
// Optional WalletConnect (requires VITE_WC_PROJECT_ID)
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID;

// Build connectors list: Farcaster + Injected (+ WalletConnect if configured)
const connectors = [
  // Farcaster Mini App connector auto-connects inside Warpcast
  miniAppConnector(),
  // EVM injected provider (MetaMask/Brave/etc.)
  injected({ shimDisconnect: true }),
  // WalletConnect (QR) for non-injected wallets
  ...(WALLETCONNECT_PROJECT_ID ? [walletConnect({ projectId: WALLETCONNECT_PROJECT_ID })] : [])
];

export const wagmiConfig = createConfig({
  chains: [base],
  transports: { [base.id]: http() },
  connectors,
  // Keep single injected provider to avoid duplicates in multi-injection environments
  multiInjectedProviderDiscovery: false,
})