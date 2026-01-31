import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useSignTypedData, useWaitForTransactionReceipt } from 'wagmi';
import { useAgentStore } from '@/store/agentStore';
import AetheriaAgentDIDABI from '@/abis/AetheriaAgentDID.json';
import { Loader2, ShieldCheck, Terminal, Play, Key } from 'lucide-react';
import { keccak256, toHex, parseEther, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Link } from 'react-router-dom';

export default function Security() {
  const { address } = useAccount();
  const { agentAddress } = useAgentStore();
  
  const [target, setTarget] = useState('');
  const [value, setValue] = useState('0');
  const [data, setData] = useState('0x');
  const [signature, setSignature] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(0n);
  
  // Custom Signer State
  const [customPrivateKey, setCustomPrivateKey] = useState('');
  const [isUsingCustomSigner, setIsUsingCustomSigner] = useState(false);

  // Read Agent State
  const { data: signer } = useReadContract({
    address: agentAddress as `0x${string}`,
    abi: AetheriaAgentDIDABI.abi,
    functionName: 'getAgentSigner',
    query: { enabled: !!agentAddress }
  });

  const { data: nonce } = useReadContract({
    address: agentAddress as `0x${string}`,
    abi: AetheriaAgentDIDABI.abi,
    functionName: 'getNonce',
    query: { enabled: !!agentAddress }
  });

  // Sign Typed Data
  const { signTypedDataAsync, isPending: isSigning } = useSignTypedData();

  // Execute
  const { writeContract, data: txHash, isPending: isExecuting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const isSigner = address && signer && address.toLowerCase() === (signer as string).toLowerCase();

  const handleSign = async () => {
    if (!agentAddress || nonce === undefined) return;
    
    const dl = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour
    setDeadline(dl);
    const dataHash = keccak256(data as `0x${string}`);
    const val = parseEther(value);

    try {
      if (isUsingCustomSigner && customPrivateKey) {
        // Sign with custom private key (Local Account)
        const account = privateKeyToAccount(customPrivateKey as `0x${string}`);
        const sig = await account.signTypedData({
          domain: {
            name: 'AetheriaAgentDID',
            version: '1',
            chainId: 16602,
            verifyingContract: agentAddress as `0x${string}`,
          },
          types: {
            Execute: [
              { name: 'target', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'dataHash', type: 'bytes32' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          primaryType: 'Execute',
          message: {
            target: target as `0x${string}`,
            value: val,
            dataHash: dataHash,
            nonce: nonce as bigint,
            deadline: dl,
          },
        });
        setSignature(sig);
      } else {
        // Sign with connected wallet
        const sig = await signTypedDataAsync({
          domain: {
            name: 'AetheriaAgentDID',
            version: '1',
            chainId: 16602,
            verifyingContract: agentAddress as `0x${string}`,
          },
          types: {
            Execute: [
              { name: 'target', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'dataHash', type: 'bytes32' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          primaryType: 'Execute',
          message: {
            target: target as `0x${string}`,
            value: val,
            dataHash: dataHash,
            nonce: nonce as bigint,
            deadline: dl,
          },
        } as any);
        setSignature(sig);
      }
    } catch (err) {
      console.error(err);
      alert('Error signing message: ' + (err as Error).message);
    }
  };

  const handleExecute = () => {
    if (!agentAddress || !signature) return;
    
    try {
      writeContract({
        address: agentAddress as `0x${string}`,
        abi: AetheriaAgentDIDABI.abi,
        functionName: 'delegatedExecute',
        args: [
          target as `0x${string}`,
          parseEther(value),
          data as `0x${string}`,
          deadline,
          signature as `0x${string}`
        ],
      } as any);
    } catch (err) {
      console.error("Execute failed:", err);
      alert('Execution failed: ' + (err as Error).message);
    }
  };

  if (!agentAddress) return <div className="p-4">Please select an agent in <Link to="/overview" className="text-indigo-600">Overview</Link>.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white shadow sm:rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-500" />
          EIP-712 Execution Simulator
        </h3>
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <p className="text-sm text-blue-700">
            This tool simulates the AI Agent (Signer) creating a transaction and a Relayer submitting it.
          </p>
          <p className="text-sm text-blue-700 mt-1">
            Current Signer: <span className="font-mono font-bold">{signer ? (signer as string) : '...'}</span>
          </p>
          
          <div className="mt-3 flex items-center gap-2">
             <button
                onClick={() => setIsUsingCustomSigner(!isUsingCustomSigner)}
                className="text-xs flex items-center gap-1 text-blue-800 underline hover:text-blue-900"
             >
               <Key className="w-3 h-3" />
               {isUsingCustomSigner ? "Use Connected Wallet" : "Use Custom Private Key"}
             </button>
          </div>

          {isUsingCustomSigner && (
             <div className="mt-3">
               <label className="block text-xs font-medium text-blue-800">Private Key (Signer)</label>
               <input 
                 type="password"
                 value={customPrivateKey}
                 onChange={(e) => setCustomPrivateKey(e.target.value)}
                 placeholder="0x..."
                 className="mt-1 block w-full text-sm border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 border"
               />
               <p className="text-xs text-blue-600 mt-1">This key will only be used locally to sign the message.</p>
             </div>
          )}
        </div>

        {!isSigner && !isUsingCustomSigner && (
           <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
             <p className="text-sm text-yellow-700">
               You are not connected as the Signer. You can only act as a Relayer if you have a valid signature.
             </p>
           </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Target Contract</label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0x..."
              className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Value (ETH)</label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700">Data (Hex)</label>
              <input
                type="text"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="0x..."
                className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
              />
            </div>
          </div>

          {/* Step 1: Sign */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Step 1: Sign Message (Agent)</h4>
            <button
              onClick={handleSign}
              disabled={(!isSigner && !isUsingCustomSigner) || isSigning || !target}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSigning ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Terminal className="w-4 h-4 mr-2" />}
              Generate Signature
            </button>
            {signature && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono break-all text-gray-600">
                Signature: {signature}
              </div>
            )}
          </div>

          {/* Step 2: Execute */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Step 2: Submit to Chain (Relayer)</h4>
            <button
              onClick={handleExecute}
              disabled={!signature || isExecuting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {isExecuting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              Execute Transaction
            </button>
          </div>

          {isSuccess && (
            <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md">
              Execution Successful!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
