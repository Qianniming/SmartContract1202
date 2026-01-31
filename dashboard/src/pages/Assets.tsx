import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { useAgentStore } from '@/store/agentStore';
import AetheriaAgentDIDABI from '@/abis/AetheriaAgentDID.json';
import { Loader2, ArrowDownCircle, Wallet } from 'lucide-react';
import { parseEther, formatEther } from 'viem';
import { Link } from 'react-router-dom';

export default function Assets() {
  const { address } = useAccount();
  const { agentAddress } = useAgentStore();
  const [amount, setAmount] = useState('');

  const { data: balanceData, refetch } = useBalance({
    address: agentAddress as `0x${string}`,
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Refetch balance after deposit success
  if (isSuccess) {
    refetch();
  }

  const handleDeposit = () => {
    if (!amount) return;
    writeContract({
      address: agentAddress as `0x${string}`,
      abi: AetheriaAgentDIDABI.abi,
      functionName: 'depositToAgent',
      value: parseEther(amount),
    } as any);
  };

  if (!agentAddress) return <div className="p-4">Please select an agent in <Link to="/overview" className="text-indigo-600">Overview</Link>.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white shadow sm:rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-indigo-500" />
          Agent Assets
        </h3>

        <div className="bg-gray-50 p-4 rounded-lg mb-6 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Total Balance</p>
            <p className="text-2xl font-bold text-gray-900">
              {balanceData ? `${formatEther(balanceData.value)} ${balanceData.symbol}` : '...'}
            </p>
          </div>
          <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
             <span className="text-indigo-600 font-bold">ETH</span>
          </div>
        </div>

        <div className="border-t pt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4" /> Deposit Funds
          </h4>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount in ETH"
              className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
            />
            <button
              onClick={handleDeposit}
              disabled={!amount || isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Deposit'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Funds deposited here can be used by the AI Agent for execution.
          </p>
        </div>

        {isSuccess && (
          <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md">
            Deposit Successful!
          </div>
        )}
      </div>
    </div>
  );
}
