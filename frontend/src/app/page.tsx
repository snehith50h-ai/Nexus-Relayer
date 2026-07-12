'use client';
import { useState, useEffect } from 'react';
import { Lucid, Blockfrost } from '@lucid-evolution/lucid';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Send, CheckCircle2, AlertCircle, ArrowRight, Loader2, ExternalLink } from 'lucide-react';

const DEMO_TOKENS = [
  { ticker: 'tADA', id: 'lovelace' },
  { ticker: '$SCROLL', id: 'd9312da562da182b02322fd8acb536f37eb9d29fba7c49dc172555275343524f4c4c' },
  { ticker: '$SNEK', id: '279c909f348e533da58088cb3fd65494244243b6dcdd977b311fa89f534e454b' },
  { ticker: '$HOSKY', id: 'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235484f534b59' }
];

export default function Home() {
  const [lucid, setLucid] = useState<any>(null);
  const [address, setAddress] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [sendAmount, setSendAmount] = useState<string>('10');
  const [feeOffered, setFeeOffered] = useState<string>('1');
  
  // Status states
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string>('');
  const [balances, setBalances] = useState<Record<string, bigint>>({});

  const [sendTokenId, setSendTokenId] = useState<string>('lovelace');
  const [feeTokenId, setFeeTokenId] = useState<string>('lovelace');
  const [recommendedFee, setRecommendedFee] = useState<string>('');

  useEffect(() => {
    const fetchRecommendedFee = async () => {
      try {
        const response = await fetch('http://localhost:3001/quote-fee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feeTokenId })
        });
        const data = await response.json();
        if (data.success) {
          setRecommendedFee(data.recommendedAmount);
        }
      } catch (e) {
        console.error('Failed to fetch recommendation');
      }
    };
    fetchRecommendedFee();
  }, [feeTokenId]);

  const connectWallet = async () => {
    setIsLoading(true);
    setIsError(false);
    setStatus('Connecting to wallet...');
    try {
      if (!window.cardano) {
        throw new Error('No Cardano wallet extensions found. Please install Nami, Eternl, or Lace.');
      }
      
      const supportedWallets = ['nami', 'eternl', 'lace', 'flint', 'gerowallet', 'typhoncip30'];
      let selectedWallet = null;
      for (const w of supportedWallets) {
        if (window.cardano[w]) {
          selectedWallet = w;
          break;
        }
      }

      if (!selectedWallet) {
        throw new Error('Cardano extension object found, but no known wallet (Nami/Eternl/Lace) detected.');
      }

      const api = await window.cardano[selectedWallet].enable();
      const provider = new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", "preprodDQov7WNZuQfUoNl4iUMcDHCjb5de8PHn");
      const l = await Lucid(provider, "Preprod");
      l.selectWallet.fromAPI(api);
      setLucid(l);
      const addr = await l.wallet().address();
      setAddress(addr);

      const utxos = await l.wallet().getUtxos();
      const newBalances: Record<string, bigint> = {};
      utxos.forEach((utxo: any) => {
        if (utxo.assets) {
          for (const [unit, amount] of Object.entries(utxo.assets)) {
            newBalances[unit] = (newBalances[unit] || 0n) + (amount as bigint);
          }
        }
      });
      setBalances(newBalances);
      
      setStatus(`Connected with ${selectedWallet.charAt(0).toUpperCase() + selectedWallet.slice(1)}!`);
      setTimeout(() => setStatus(''), 2000);
    } catch (e: any) {
      console.error(e);
      setIsError(true);
      setStatus(e.message || 'Unknown error. Check wallet popups.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!lucid || !address) {
      setIsError(true);
      setStatus('Connect wallet first.');
      return;
    }
    if (!recipient) {
      setIsError(true);
      setStatus('Enter recipient address.');
      return;
    }
    
    setIsLoading(true);
    setIsError(false);
    setTxHash('');
    
    try {
      setStatus('Requesting backend to build Intent...');
      
      // Auto-convert tADA to lovelaces (1 ADA = 1,000,000 lovelaces)
      let finalSendAmount = sendAmount;
      if (sendTokenId === 'lovelace') {
        finalSendAmount = (Number(sendAmount) * 1000000).toString();
      }

      let finalFeeOffered = feeOffered;
      if (feeTokenId === 'lovelace') {
        finalFeeOffered = (Number(feeOffered) * 1000000).toString();
      }

      const response = await fetch('http://localhost:3001/build-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderAddress: address,
          recipientAddress: recipient,
          sendAmount: finalSendAmount,
          sendTokenId,
          feeOffered: finalFeeOffered,
          feeTokenId
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to build intent');
      }

      setStatus('Please sign the transaction in your wallet...');
      const unsignedTxCbor = data.unsignedTxCbor;
      
      const tx = lucid.fromTx(unsignedTxCbor);
      const signed = await tx.sign.withWallet().complete();
      
      setStatus('Submitting co-signed transaction to Relayer...');
      const submitResponse = await fetch('http://localhost:3001/submit-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTxCbor: signed.toCBOR()
        })
      });

      const submitData = await submitResponse.json();
      if (!submitResponse.ok) {
        throw new Error(submitData.error || 'Failed to submit intent');
      }

      setStatus('Transaction successfully submitted!');
      setTxHash(submitData.txHash);
    } catch (e: any) {
      console.error(e);
      setIsError(true);
      setStatus(e.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-transparent text-white overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/30 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="z-10 max-w-xl w-full flex flex-col items-center"
      >
        <div className="flex items-center gap-3 mb-2">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-purple-400 bg-gradient-to-tr from-purple-600 to-blue-500" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
            Nexus Relayer
          </h1>
        </div>
        <p className="text-zinc-400 mb-10 text-center max-w-md">
          A decentralized Babel Fee marketplace. Pay your transaction fees in any token.
        </p>
        
        <motion.div 
          className="w-full bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl shadow-purple-900/20"
          layout
        >
          <AnimatePresence mode="wait">
            {!address ? (
              <motion.div
                key="connect"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center mb-6 border border-white/10">
                  <Wallet className="w-10 h-10 text-purple-300" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
                <p className="text-zinc-400 text-center mb-8">Connect your Nami or Eternl wallet to get started with gasless transactions.</p>
                
                <button 
                  onClick={connectWallet}
                  disabled={isLoading}
                  className="group relative w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 overflow-hidden"
                >
                  <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 ease-out" />
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin relative z-10" /> : <Wallet className="w-5 h-5 relative z-10" />}
                  <span className="relative z-10">{isLoading ? 'Connecting...' : 'Connect Nami Wallet'}</span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="send"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col gap-6"
              >
                <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Connected</p>
                      <p className="text-sm text-zinc-200 font-mono">
                        {address.slice(0, 12)}...{address.slice(-6)}
                      </p>
                    </div>
                  </div>
                  <div className="w-3 h-3 bg-green-400 rounded-full shadow-[0_0_10px_rgba(74,222,128,0.5)] animate-pulse" />
                </div>
                
                <div className="space-y-4">
                  {/* Live Balances Dashboard */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {DEMO_TOKENS.map(token => {
                      const amount = balances[token.id] || 0n;
                      
                      const displayAmount = token.id === 'lovelace' 
                        ? (Number(amount) / 1000000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : Number(amount).toLocaleString();

                      return (
                        <div key={token.id} className="flex-shrink-0 bg-white/5 border border-white/10 rounded-full px-4 py-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                          <span className="text-xs text-zinc-400 font-bold">{token.ticker}</span>
                          <span className="text-sm font-mono text-white">{displayAmount}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1">Recipient Address</label>
                    <input 
                      type="text" 
                      value={recipient}
                      onChange={e => setRecipient(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all font-mono text-sm"
                      placeholder="addr_test..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1">Amount to send</label>
                      <div className="relative flex">
                        <input 
                          type="number" 
                          value={sendAmount}
                          onChange={e => setSendAmount(e.target.value)}
                          className="w-2/3 bg-black/30 border border-white/10 rounded-l-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-mono"
                        />
                        <select 
                          value={sendTokenId}
                          onChange={e => setSendTokenId(e.target.value)}
                          className="w-1/3 bg-black/50 border-y border-r border-white/10 rounded-r-xl p-4 text-zinc-300 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none cursor-pointer text-center"
                        >
                          {DEMO_TOKENS.map(t => <option key={t.id} value={t.id}>{t.ticker}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 ml-1">Fee Offered</label>
                      <div className="relative flex">
                        <input 
                          type="number" 
                          value={feeOffered}
                          onChange={e => setFeeOffered(e.target.value)}
                          className="w-2/3 bg-purple-900/20 border border-purple-500/30 rounded-l-xl p-4 text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-mono"
                        />
                        <select 
                          value={feeTokenId}
                          onChange={e => setFeeTokenId(e.target.value)}
                          className="w-1/3 bg-purple-900/40 border-y border-r border-purple-500/30 rounded-r-xl p-4 text-purple-300 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none cursor-pointer text-center"
                        >
                          {DEMO_TOKENS.map(t => <option key={t.id} value={t.id}>{t.ticker}</option>)}
                        </select>
                      </div>
                      {recommendedFee && (
                        <button 
                          onClick={() => setFeeOffered(recommendedFee)}
                          className="text-xs text-purple-400/70 hover:text-purple-300 mt-2 ml-1 transition-colors cursor-pointer block"
                        >
                          Recommended: ~{recommendedFee} {DEMO_TOKENS.find(t => t.id === feeTokenId)?.ticker}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSend}
                  disabled={isLoading}
                  className="relative group w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] overflow-hidden mt-2"
                >
                  <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 ease-out" />
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin relative z-10" /> : <Send className="w-5 h-5 relative z-10" />}
                  <span className="relative z-10">{isLoading ? 'Processing...' : 'Send with Babel Fees'}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {status && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isError ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                  txHash ? 'bg-green-500/10 border-green-500/20 text-green-400' : 
                  'bg-blue-500/10 border-blue-500/20 text-blue-400'
                }`}>
                  <div className="mt-0.5 flex-shrink-0">
                    {isError ? <AlertCircle className="w-5 h-5" /> : 
                     txHash ? <CheckCircle2 className="w-5 h-5" /> : 
                     <Loader2 className="w-5 h-5 animate-spin" />}
                  </div>
                  <p className="text-sm font-medium leading-tight">{status}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {txHash && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-4"
              >
                <a 
                  href={`https://preprod.cardanoscan.io/transaction/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-bold py-3 px-4 rounded-xl transition-all hover:text-white"
                >
                  <span>View on Cardanoscan</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </motion.div>
            )}
          </AnimatePresence>
          
        </motion.div>
      </motion.div>
    </main>
  );
}
