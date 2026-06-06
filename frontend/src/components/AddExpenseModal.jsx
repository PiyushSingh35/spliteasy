import { useMemo, useState } from "react";
import Modal from "./Modal";
import * as API from "../api/endpoints";
import { errorMessage, formatINR } from "../utils/format";

/**
 * Create-expense form supporting equal / unequal / percentage splits.
 * Members come from group.members (each = { user: {id, username, ...} }).
 */
export default function AddExpenseModal({ group, currentUser, onClose, onSaved }) {
  const members = group.members.map((m) => m.user);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [payer, setPayer] = useState(currentUser.id);
  const [splitType, setSplitType] = useState("equal");
  // selected participants -> true/false
  const [selected, setSelected] = useState(
    Object.fromEntries(members.map((m) => [m.id, true]))
  );
  // per-user manual values for unequal / percentage
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const participantIds = members.filter((m) => selected[m.id]).map((m) => m.id);
  const total = parseFloat(amount) || 0;

  // Live sum of manual entries (unequal=amounts, percentage=percents)
  const manualSum = useMemo(() => {
    return participantIds.reduce((s, id) => s + (parseFloat(values[id]) || 0), 0);
  }, [participantIds, values]);

  // Preview of equal split
  const equalPreview = useMemo(() => {
    if (splitType !== "equal" || participantIds.length === 0 || !total) return null;
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / participantIds.length);
    const rem = cents - base * participantIds.length;
    return { base: base / 100, withExtra: (base + 1) / 100, count: rem };
  }, [splitType, participantIds, total]);

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const setVal = (id, v) => setValues((m) => ({ ...m, [id]: v }));

  const validate = () => {
    if (!description.trim()) return "Description is required.";
    if (!(total > 0)) return "Amount must be greater than 0.";
    if (participantIds.length === 0) return "Select at least one participant.";
    if (!participantIds.includes(payer)) return "The payer must be a participant.";
    if (splitType === "unequal" && Math.abs(manualSum - total) > 0.001)
      return `Split amounts (${formatINR(manualSum)}) must equal the total (${formatINR(total)}).`;
    if (splitType === "percentage" && Math.abs(manualSum - 100) > 0.001)
      return `Percentages must sum to 100 (currently ${manualSum}).`;
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setError("");
    setSaving(true);

    const splits = participantIds.map((id) => {
      if (splitType === "unequal") return { user: id, amount: parseFloat(values[id]) || 0 };
      if (splitType === "percentage") return { user: id, percentage: parseFloat(values[id]) || 0 };
      return { user: id };
    });

    try {
      await API.createExpense(group.id, {
        payer, amount: total.toFixed(2), description, category, split_type: splitType, splits,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add an expense" onClose={onClose}>
      {error && <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      <form onSubmit={submit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Dinner" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
            <input type="number" step="0.01" min="0" className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Food" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Paid by</label>
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={payer} onChange={(e) => setPayer(Number(e.target.value))}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.username}{m.id === currentUser.id ? " (you)" : ""}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Split type</label>
          <div className="flex gap-2">
            {["equal", "unequal", "percentage"].map((t) => (
              <button type="button" key={t} onClick={() => setSplitType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border transition ${
                  splitType === t ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-300 hover:border-emerald-400"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Participants
            {splitType === "unequal" && <span className="text-xs text-slate-400"> — enter amounts (sum must = {formatINR(total)})</span>}
            {splitType === "percentage" && <span className="text-xs text-slate-400"> — enter % (sum must = 100)</span>}
          </label>
          <div className="space-y-2 border border-slate-200 rounded-lg p-3">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <input type="checkbox" checked={!!selected[m.id]} onChange={() => toggle(m.id)} className="h-4 w-4 accent-emerald-600" />
                <span className="flex-1 text-sm text-slate-700">{m.username}{m.id === currentUser.id ? " (you)" : ""}</span>
                {splitType !== "equal" && selected[m.id] && (
                  <input type="number" step="0.01" min="0"
                    className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={values[m.id] ?? ""} onChange={(e) => setVal(m.id, e.target.value)}
                    placeholder={splitType === "percentage" ? "%" : "₹"} />
                )}
              </div>
            ))}
          </div>

          {/* Live preview / running totals */}
          {splitType === "equal" && equalPreview && (
            <p className="text-xs text-slate-500 mt-2">
              Each pays ≈ {formatINR(equalPreview.base)}
              {equalPreview.count > 0 && ` (payer covers the extra paisa → ${formatINR(equalPreview.withExtra)})`}
            </p>
          )}
          {splitType === "unequal" && (
            <p className={`text-xs mt-2 ${Math.abs(manualSum - total) < 0.001 ? "text-emerald-600" : "text-red-500"}`}>
              Entered: {formatINR(manualSum)} / {formatINR(total)}
            </p>
          )}
          {splitType === "percentage" && (
            <p className={`text-xs mt-2 ${Math.abs(manualSum - 100) < 0.001 ? "text-emerald-600" : "text-red-500"}`}>
              Entered: {manualSum}% / 100%
            </p>
          )}
        </div>

        <button disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2 rounded-lg">
          {saving ? "Saving…" : "Add expense"}
        </button>
      </form>
    </Modal>
  );
}
