import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { getWallet, depositToWallet, transferFromWallet, getWalletMembers } from "../api/endpoints";
import { formatDate } from "../utils/format";

function DepositModal({ onClose, onSuccess }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const presets = [100, 500, 1000, 2000, 5000];

  const handleDeposit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    setLoading(true);
    setError("");
    try {
      await depositToWallet(amt);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.amount?.[0] || "Deposit failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Add Money to Wallet</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                amount === String(p)
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "border-slate-300 text-slate-600 hover:border-emerald-400"
              }`}
            >
              ₹{p.toLocaleString()}
            </button>
          ))}
        </div>

        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium">
            Cancel
          </button>
          <button
            onClick={handleDeposit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Money"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ onClose, onSuccess }) {
  const [members, setMembers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    getWalletMembers().then(({ data }) => setMembers(data)).catch(() => {});
  }, []);

  const filtered = members.filter(
    (m) =>
      m.username.toLowerCase().includes(search.toLowerCase()) ||
      m.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleTransfer = async () => {
    if (!selectedUser) return setError("Select a recipient.");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    setLoading(true);
    setError("");
    try {
      await transferFromWallet(selectedUser.id, amt, note);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Transfer failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Send Money</h2>

        {/* Recipient picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Send to</label>
          <input
            type="text"
            placeholder="Search group members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 mb-2"
          />
          <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 p-3 text-center">No group members found</p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedUser(m)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition ${
                    selectedUser?.id === m.id ? "bg-emerald-50 border-l-2 border-emerald-500" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm flex-shrink-0">
                    {m.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{m.username}</p>
                    {m.name && <p className="text-xs text-slate-400">{m.name}</p>}
                  </div>
                  {selectedUser?.id === m.id && <span className="ml-auto text-emerald-600 text-sm">✓</span>}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₹</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 mb-4"
        />

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium">
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={loading || !selectedUser}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const load = async () => {
    try {
      const { data } = await getWallet();
      setWallet(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const txColor = (tx) => {
    if (tx.transaction_type === "deposit") return "text-emerald-600";
    return parseFloat(tx.amount) >= 0 ? "text-emerald-600" : "text-red-500";
  };

  const txSign = (tx) => {
    if (tx.transaction_type === "deposit") return "+";
    return parseFloat(tx.amount) >= 0 ? "+" : "";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Balance card */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-6 text-white mb-6 shadow-lg">
          <p className="text-emerald-100 text-sm font-medium mb-1">Wallet Balance</p>
          {loading ? (
            <div className="h-10 w-40 bg-white/20 rounded-lg animate-pulse" />
          ) : (
            <p className="text-4xl font-bold tracking-tight">
              ₹{parseFloat(wallet?.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          )}
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setShowDeposit(true)}
              className="flex-1 bg-white text-emerald-700 font-semibold py-2.5 rounded-xl hover:bg-emerald-50 transition text-sm"
            >
              + Add Money
            </button>
            <button
              onClick={() => setShowTransfer(true)}
              className="flex-1 bg-emerald-600 border border-white/30 text-white font-semibold py-2.5 rounded-xl hover:bg-emerald-500 transition text-sm"
            >
              Send Money
            </button>
          </div>
        </div>

        {/* Transaction history */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Transaction History</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : !wallet?.transactions?.length ? (
            <div className="p-8 text-center">
              <p className="text-3xl mb-2">💸</p>
              <p className="text-slate-500 text-sm">No transactions yet. Add money to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {wallet.transactions.map((tx) => (
                <div key={tx.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                      tx.transaction_type === "deposit" ? "bg-emerald-50" : "bg-blue-50"
                    }`}>
                      {tx.transaction_type === "deposit" ? "💰" : parseFloat(tx.amount) >= 0 ? "📥" : "📤"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {tx.transaction_type === "deposit"
                          ? "Added to wallet"
                          : parseFloat(tx.amount) >= 0
                          ? `Received from ${tx.counterpart?.username}`
                          : `Sent to ${tx.counterpart?.username}`}
                      </p>
                      {tx.note && <p className="text-xs text-slate-400">{tx.note}</p>}
                      <p className="text-xs text-slate-400">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm ${txColor(tx)}`}>
                    {txSign(tx)}₹{Math.abs(parseFloat(tx.amount)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showDeposit && (
        <DepositModal onClose={() => setShowDeposit(false)} onSuccess={load} />
      )}
      {showTransfer && (
        <TransferModal onClose={() => setShowTransfer(false)} onSuccess={load} />
      )}
    </div>
  );
}
