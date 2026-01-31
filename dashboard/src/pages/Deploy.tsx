import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSimulateContract, useSwitchChain } from 'wagmi';
import { AETHERIA_FACTORY_ADDRESS } from '@/constants';
import AetheriaFactoryABI from '@/abis/AetheriaFactory.json';
import { keccak256, toHex, encodePacked } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { useAgentStore } from '@/store/agentStore';
import { useNavigate } from 'react-router-dom';
import { Loader2, Rocket, RefreshCw, Copy, Check, AlertTriangle } from 'lucide-react';
import { zeroGTestnet } from '@/config';

export default function Deploy() {
  const { address, chainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const navigate = useNavigate();
  const setAgentAddress = useAgentStore((state) => state.setAgentAddress);
  
  const [signer, setSigner] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [metadataURI, setMetadataURI] = useState('https://ipfs.io/ipfs/Qm...');
  const [saltString, setSaltString] = useState(Date.now().toString());
  
  const salt = keccak256(toHex(saltString));

  // Compute Address
  const { data: computedAddress } = useReadContract({
    address: AETHERIA_FACTORY_ADDRESS,
    abi: AetheriaFactoryABI.abi,
    functionName: 'computeAddress',
    args: [address, signer || '0x0000000000000000000000000000000000000000', metadataURI, salt],
    query: {
      enabled: !!address && !!signer,
    }
  });

  // Simulate Deployment
  const { data: simulateData, error: simulateError } = useSimulateContract({
    address: AETHERIA_FACTORY_ADDRESS,
    abi: AetheriaFactoryABI.abi,
    functionName: 'deployAgent',
    args: [address!, signer as `0x${string}`, metadataURI, salt],
    query: {
      enabled: !!address && !!signer,
    },
  });

  // Deploy
  const { writeContract, data: hash, isPending, error: writeError, isError: isWriteError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, error: receiptError, isError: isReceiptError } = useWaitForTransactionReceipt({
    hash,
  });

  const error = writeError || receiptError || (simulateError as any);
  const isError = isWriteError || isReceiptError || !!simulateError;

  useEffect(() => {
    if (isSuccess && computedAddress) {
      // Save to store and redirect
      setAgentAddress(computedAddress as string);
      // Add a small delay so user sees success
      const timer = setTimeout(() => navigate('/overview'), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, computedAddress, navigate, setAgentAddress]);

  const handleGenerateSigner = () => {
    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk);
    setSigner(account.address);
    setGeneratedKey(pk);
    setCopied(false);
  };

  const copyToClipboard = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeploy = () => {
    if (!address || !signer) return;
    
    // Check network first
    if (chainId !== zeroGTestnet.id) {
      console.log("Switching network...");
      switchChain({ chainId: zeroGTestnet.id });
      return;
    }
    
    if (simulateError) {
      console.error("Simulation failed:", simulateError);
      return;
    }

    try {
      console.log("Initiating deployment with simulated request...");
      if (simulateData?.request) {
        writeContract(simulateData.request);
      } else {
        // Fallback if simulation data is missing but no error
         writeContract({
          address: AETHERIA_FACTORY_ADDRESS as `0x${string}`,
          abi: AetheriaFactoryABI.abi,
          functionName: 'deployAgent',
          args: [address!, signer as `0x${string}`, metadataURI, salt],
        } as any);
      }
    } catch (err) {
      console.error("Deploy failed:", err);
    }
  };

  // Status text helper
  const getButtonText = () => {
    if (isSwitching) return 'Switching Network...';
    if (chainId !== zeroGTestnet.id) return 'Switch to 0G Testnet';
    if (isPending) return 'Check Wallet...';
    if (isConfirming) return 'Confirming...';
    if (isSuccess) return 'Deployed Successfully!';
    return 'Deploy Agent';
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
            <Rocket className="h-5 w-5 text-indigo-500" />
            Deploy New Agent
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Create a new Aetheria Identity for your AI Agent.
          </p>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-6 space-y-6">
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Owner Address</label>
            <div className="mt-1">
              <input
                type="text"
                disabled
                value={address || 'Please connect wallet'}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-gray-50 p-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Signer Address (AI Agent Key)</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={signer}
                onChange={(e) => setSigner(e.target.value)}
                placeholder="0x..."
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
              />
              <button
                type="button"
                onClick={handleGenerateSigner}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate
              </button>
            </div>
            
            {generatedKey && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex justify-between items-start">
                  <div className="text-sm text-yellow-800 break-all">
                    <span className="font-bold block mb-1">Private Key (Save this!):</span>
                    {generatedKey}
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="ml-2 text-yellow-600 hover:text-yellow-800 p-1"
                    title="Copy Private Key"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-yellow-600">
                  This key controls your agent. Store it securely!
                </p>
              </div>
            )}

            <p className="mt-1 text-xs text-gray-500">The hot wallet address that your AI Agent controls.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Metadata URI</label>
            <div className="mt-1">
              <input
                type="text"
                value={metadataURI}
                onChange={(e) => setMetadataURI(e.target.value)}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Salt (for deterministic address)</label>
            <div className="mt-1">
              <input
                type="text"
                value={saltString}
                onChange={(e) => setSaltString(e.target.value)}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md">
            <p className="text-sm text-gray-700">Predicted Address:</p>
            <p className="font-mono text-sm text-indigo-600 break-all">
              {computedAddress ? (computedAddress as string) : 'Fill details to compute...'}
            </p>
          </div>

          <div className="pt-4">
            {chainId !== zeroGTestnet.id && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2">
                 <AlertTriangle className="h-5 w-5 text-yellow-500" />
                 <p className="text-sm text-yellow-700">
                   You are on the wrong network. Please switch to 0G Testnet to deploy.
                 </p>
              </div>
            )}

            {isError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">
                  <span className="font-bold">Error:</span> {error?.message || 'Transaction failed'}
                </p>
              </div>
            )}
            
            <button
              onClick={handleDeploy}
              disabled={!address || !signer || isPending || isConfirming || isSwitching}
              className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50
                ${chainId !== zeroGTestnet.id ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'}
              `}
            >
              {isPending || isConfirming || isSwitching ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  {getButtonText()}
                </>
              ) : isSuccess ? (
                'Deployed Successfully!'
              ) : (
                getButtonText()
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
