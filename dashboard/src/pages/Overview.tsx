import { useState, useEffect } from 'react';
import { useAccount, useReadContracts, useBalance } from 'wagmi';
import { useAgentStore } from '@/store/agentStore';
import { Link } from 'react-router-dom';
import AetheriaAgentDIDABI from '@/abis/AetheriaAgentDID.json';
import { User, Key, Database, Lock, AlertTriangle, Wallet } from 'lucide-react';
import { formatEther } from 'viem';

export default function Overview() {
  const { agentAddress, setAgentAddress } = useAgentStore();
  const [inputAddress, setInputAddress] = useState('');
  
  // Fetch Agent Data
  const agentContractConfig = {
    address: agentAddress as `0x${string}`,
    abi: AetheriaAgentDIDABI.abi,
  };

  const { data: agentData, refetch } = useReadContracts({
    contracts: [
      { ...agentContractConfig, functionName: 'ownerOf' },
      { ...agentContractConfig, functionName: 'getAgentSigner' },
      { ...agentContractConfig, functionName: 'getMetadata' },
      { ...agentContractConfig, functionName: 'isFrozen' },
      { ...agentContractConfig, functionName: 'did' },
    ],
    query: {
      enabled: !!agentAddress,
    }
  });

  const { data: balanceData } = useBalance({
    address: agentAddress as `0x${string}`,
    query: {
      enabled: !!agentAddress,
    }
  });

  const [owner, signer, metadata, isFrozen, did] = agentData?.map(d => d.result) || [];

  const handleTrack = () => {
    if (inputAddress.startsWith('0x') && inputAddress.length === 42) {
      setAgentAddress(inputAddress);
    }
  };

  if (!agentAddress) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">No Agent Selected</h2>
        <p className="text-gray-600 mb-4">You haven't deployed or selected an agent yet.</p>
        <div className="space-y-4">
          <Link to="/deploy" className="block w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
            Deploy New Agent
          </Link>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or track existing</span>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="0x..."
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
            />
            <button
              onClick={handleTrack}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700"
            >
              Track
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Agent Overview</h2>
        <button onClick={() => setAgentAddress(null)} className="text-sm text-red-600 hover:text-red-800">
          Switch Agent
        </button>
      </div>

      {/* Main Info Card */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Agent Identity</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{agentAddress}</p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <User className="w-4 h-4 mr-2" /> Owner
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">{owner as string}</dd>
            </div>

            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Key className="w-4 h-4 mr-2" /> Signer (AI)
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">{signer as string}</dd>
            </div>

            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Database className="w-4 h-4 mr-2" /> Metadata
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 truncate">{metadata as string}</dd>
            </div>

            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Lock className="w-4 h-4 mr-2" /> Status
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {isFrozen ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Frozen
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                )}
              </dd>
            </div>

            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Wallet className="w-4 h-4 mr-2" /> Balance
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {balanceData ? `${formatEther(balanceData.value)} ${balanceData.symbol}` : 'Loading...'}
              </dd>
            </div>

            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">DID</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono text-xs">{did as string}</dd>
            </div>

          </dl>
        </div>
      </div>
    </div>
  );
}
