import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'

export const zeroGTestnet = {
  id: 16602,
  name: '0G Testnet',
  nativeCurrency: { name: 'A0GI', symbol: 'A0GI', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc-testnet.0g.ai'] },
  },
  blockExplorers: {
    default: { name: '0G Explorer', url: 'https://chainscan-newton.0g.ai' },
  },
} as const

export const config = createConfig({
  chains: [zeroGTestnet],
  connectors: [injected()],
  transports: {
    [zeroGTestnet.id]: http(),
  },
})
