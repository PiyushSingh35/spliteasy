import { useEffect, useState } from "react";
import Modal from "./Modal";
import * as API from "../api/endpoints";
import { formatINR, formatDate, errorMessage } from "../utils/format";

/** View an expense: splits, comments thread, add comment, delete. */
export default function ExpenseDetailModal({ expenseId, currentUser, onClose, onChanged }) {
  const [expense, setExpense] = useState(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    try {
      const { data } = await API.getExpense(expenseId);
      setExpense(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  useEffect(() => { load(); }, [expenseId]);

  const postComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await API.addComment(expenseId, comment.trim());
      setComment("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this expense? Balances will be recalculated.")) return;
    try {
      await API.deleteExpense(expenseId);
      onChanged();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!expense) {
    return <Modal title="Expense" onClose={onClose}><p className="text-slate-400">Loading…</p></Modal>;
  }

  return (
    <Modal title={expense.description} onClose={onClose}>
      {error && <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-800">{formatINR(expense.amount)}</p>
          <p className="text-sm text-slate-500">
            Paid by <span className="font-medium">{expense.payer.username}</span>
            {expense.category && <span> · {expense.category}</span>}
            <span> · {expense.split_type}</span>
          </p>
        </div>
        {expense.payer.id === currentUser.id && (
          <button onClick={remove} className="text-sm text-red-600 hover:underline">Delete</button>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Split breakdown</h3>
        <div className="space-y-1">
          {expense.splits.map((s) => (
            <div key={s.id} className="flex justify-between text-sm">
              <span className="text-slate-600">{s.user.username}{s.user.id === expense.payer.id ? " (payer)" : ""}</span>
              <span className="font-medium text-slate-800">{formatINR(s.amount_owed)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Comments</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
          {expense.comments.length === 0 ? (
            <p className="text-sm text-slate-400">No comments yet.</p>
          ) : (
            expense.comments.map((c) => (
              <div key={c.id} className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-sm text-slate-700">{c.comment_text}</p>
                <p className="text-xs text-slate-400 mt-0.5">{c.user.username} · {formatDate(c.created_at)}</p>
              </div>
            ))
          )}
        </div>
        <form onSubmit={postComment} className="flex gap-2">
          <input className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" />
          <button disabled={posting} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 rounded-lg text-sm font-medium">
            Send
          </button>
        </form>
      </div>
    </Modal>
  );
}
