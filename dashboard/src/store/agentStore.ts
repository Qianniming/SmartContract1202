import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AgentStore {
  agentAddress: string | null
  setAgentAddress: (address: string | null) => void
}

export const useAgentStore = create<AgentStore>()(
  persist(
    (set) => ({
      agentAddress: null,
      setAgentAddress: (address) => set({ agentAddress: address }),
    }),
    {
      name: 'aetheria-agent-storage',
    }
  )
)
