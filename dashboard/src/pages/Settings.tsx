import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useAgentStore } from '@/store/agentStore';
import AetheriaAgentDIDABI from '@/abis/AetheriaAgentDID.json';
import { Loader2, AlertTriangle, Key, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { address, chain } = useAccount();
  const { agentAddress } = useAgentStore();
  
  const [newSigner, setNewSigner] = useState('');
  const [newOwner, setNewOwner] = useState('');

  // Read State
  const { data: owner } = useReadContract({
    address: agentAddress as `0x${string}`,
    abi: AetheriaAgentDIDABI.abi,
    functionName: 'ownerOf',
    query: { enabled: !!agentAddress }
  });

  const { data: isFrozen } = useReadContract({
    address: agentAddress as `0x${string}`,
    abi: AetheriaAgentDIDABI.abi,
    functionName: 'isFrozen',
    query: { enabled: !!agentAddress }
  });

  // Write Hooks
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const isOwner = address && owner && address.toLowerCase() === (owner as string).toLowerCase();

  const handleSetSigner = () => {
    if (!address || !chain) return;
    writeContract({
      address: agentAddress as `0x${string}`,
      abi: AetheriaAgentDIDABI.abi as any,
      functionName: 'setAgentSigner',
      args: [newSigner],
      account: address,
      chain: chain,
    });
  };

  const handleFreeze = () => {
    if (!address || !chain) return;
    writeContract({
      address: agentAddress as `0x${string}`,
      abi: AetheriaAgentDIDABI.abi as any,
      functionName: isFrozen ? 'unfreezeAgent' : 'freezeAgent',
      account: address,
      chain: chain,
    });
  };

  const handleTransferOwnership = () => {
    if (!address || !chain) return;
    writeContract({
      address: agentAddress as `0x${string}`,
      abi: AetheriaAgentDIDABI.abi as any,
      functionName: 'transferAgentOwnership',
      args: [newOwner],
      account: address,
      chain: chain,
    });
  };

  if (!agentAddress) return <div className="p-4">Please select an agent in <Link to="/overview" className="text-indigo-600">Overview</Link>.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white shadow sm:rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Agent Management</h3>
        
        {!isOwner ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You are not the owner of this Agent. You cannot change settings.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Set Signer */}
            <div className="border-b pb-6">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Key className="w-4 h-4" /> Update Signer
              </h4>
              <p className="text-xs text-gray-500 mt-1">Change the AI Agent's hot wallet address.</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newSigner}
                  onChange={(e) => setNewSigner(e.target.value)}
                  placeholder="New Signer Address (0x...)"
                  className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                />
                <button
                  onClick={handleSetSigner}
                  disabled={!newSigner || isPending}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Update'}
                </button>
              </div>
            </div>

            {/* Transfer Ownership */}
            <div className="border-b pb-6">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> Transfer Ownership
              </h4>
              <p className="text-xs text-gray-500 mt-1">Transfer control of this Agent to another wallet.</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  placeholder="New Owner Address (0x...)"
                  className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                />
                <button
                  onClick={handleTransferOwnership}
                  disabled={!newOwner || isPending}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Transfer'}
                </button>
              </div>
            </div>

            {/* Freeze/Unfreeze */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Emergency Control
              </h4>
              <p className="text-xs text-gray-500 mt-1">Freeze the agent to block all operations if compromised.</p>
              <div className="mt-3">
                <button
                  onClick={handleFreeze}
                  disabled={isPending}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                    isFrozen 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  } disabled:opacity-50`}
                >
                  {isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                  {isFrozen ? 'Unfreeze Agent' : 'Freeze Agent'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isSuccess && (
          <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md">
            Transaction Successful!
          </div>
        )}
      </div>
    </div>
  );
}
