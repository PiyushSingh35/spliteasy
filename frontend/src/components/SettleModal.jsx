import { useState } from "react";
import Modal from "./Modal";
import * as API from "../api/endpoints";
import { errorMessage } from "../utils/format";

/** Record a payment from one member to another. `prefill` optionally seeds the form. */
export default function SettleModal({ group, currentUser, prefill, onClose, onSaved }) {
  const members = group.members.map((m) => m.user);
  const [fromUser, setFromUser] = useState(prefill?.from ?? currentUser.id);
  const [toUser, setToUser] = useState(prefill?.to ?? (members.find((m) => m.id !== currentUser.id)?.id ?? currentUser.id));
  const [amount, setAmount] = useState(prefill?.amount ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (fromUser === toUser) { setError("Payer and receiver must be different."); return; }
    if (!(parseFloat(amount) > 0)) { setError("Amount must be greater than 0."); return; }
    setError("");
    setSaving(true);
    try {
      await API.createSettlement(group.id, {
        from_user: fromUser, to_user: toUser, amount: parseFloat(amount).toFixed(2),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const select = (label, value, setter) => (
    <div className="flex-1">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        value={value} onChange={(e) => setter(Number(e.target.value))}>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.username}{m.id === currentUser.id ? " (you)" : ""}</option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal title="Record a payment" onClose={onClose}>
      {error && <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-3 items-end">
          {select("Payer", fromUser, setFromUser)}
          <span className="pb-2 text-slate-400">→</span>
          {select("Receiver", toUser, setToUser)}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
          <input type="number" step="0.01" min="0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
        </div>
        <button disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2 rounded-lg">
          {saving ? "Saving…" : "Record payment"}
        </button>
      </form>
    </Modal>
  );
}
