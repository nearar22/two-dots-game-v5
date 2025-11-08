import { createConfig } from '@wagmi/core'
import { http } from 'viem'
import { base } from '@wagmi/core/chains'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'

// Wagmi configuration for Farcaster Mini App
// Chains: Base mainnet; Transport: default http()
export const wagmiConfig = createConfig({
  chains: [base],
  transports: { [base.id]: http() },
  connectors: [
    // Farcaster Mini App connector auto-connects inside Warpcast
    miniAppConnector()
  ],
  // Avoid duplicate injected providers if you add others later
  multiInjectedProviderDiscovery: false,
})