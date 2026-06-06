import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import AddExpenseModal from "../components/AddExpenseModal";
import SettleModal from "../components/SettleModal";
import ExpenseDetailModal from "../components/ExpenseDetailModal";
import { useAuth } from "../context/AuthContext";
import * as API from "../api/endpoints";
import { formatINR, formatDate, errorMessage } from "../utils/format";

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [tab, setTab] = useState("expenses");
  const [error, setError] = useState("");

  const [showExpense, setShowExpense] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [settlePrefill, setSettlePrefill] = useState(null);
  const [openExpenseId, setOpenExpenseId] = useState(null);
  const [memberName, setMemberName] = useState("");

  const loadAll = async () => {
    try {
      const [g, e, b] = await Promise.all([
        API.getGroup(id), API.listExpenses(id), API.getBalances(id),
      ]);
      setGroup(g.data);
      setExpenses(e.data);
      setBalances(b.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  const addMember = async (e) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    setError("");
    try {
      await API.addMember(id, memberName.trim());
      setMemberName("");
      await loadAll();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removeMember = async (userId) => {
    if (!confirm("Remove this member from the group?")) return;
    try {
      await API.removeMember(id, userId);
      await loadAll();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!group) {
    return (
      <div className="min-h-screen"><Navbar />
        <p className="max-w-5xl mx-auto px-4 py-8 text-slate-400">Loading…</p>
      </div>
    );
  }

  const TabButton = ({ id: t, label }) => (
    <button onClick={() => setTab(t)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
        tab === t ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <button onClick={() => navigate("/dashboard")} className="text-sm text-slate-500 hover:text-slate-700 mb-3">← Back to groups</button>

        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{group.name}</h1>
            {group.description && <p className="text-slate-500">{group.description}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowExpense(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-sm">+ Add expense</button>
            <button onClick={() => { setSettlePrefill(null); setShowSettle(true); }} className="bg-white border border-slate-300 hover:border-emerald-400 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm">Settle up</button>
          </div>
        </div>

        {error && <div className="mt-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

        <div className="border-b border-slate-200 mt-5 flex gap-1">
          <TabButton id="expenses" label="Expenses" />
          <TabButton id="balances" label="Balances" />
          <TabButton id="members" label={`Members (${group.members.length})`} />
        </div>

        {/* EXPENSES TAB */}
        {tab === "expenses" && (
          <div className="mt-4 space-y-2">
            {expenses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No expenses yet. Add the first one!</div>
            ) : expenses.map((ex) => (
              <button key={ex.id} onClick={() => setOpenExpenseId(ex.id)}
                className="w-full text-left bg-white rounded-xl shadow-sm hover:shadow-md border border-slate-100 px-4 py-3 flex items-center justify-between transition">
                <div>
                  <p className="font-medium text-slate-800">{ex.description}</p>
                  <p className="text-xs text-slate-400">
                    {ex.payer.username} paid · {formatDate(ex.created_at)}
                    {ex.category && ` · ${ex.category}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">{formatINR(ex.amount)}</p>
                  <p className="text-xs text-slate-400 capitalize">{ex.split_type}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* BALANCES TAB */}
        {tab === "balances" && (
          <div className="mt-4 space-y-2">
            {balances.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">All settled up! 🎉</div>
            ) : balances.map((b, i) => {
              const youOwe = b.from_user.id === user.id;
              const youGet = b.to_user.id === user.id;
              return (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-slate-700">
                    <span className={`font-semibold ${youOwe ? "text-red-600" : "text-slate-800"}`}>{youOwe ? "You" : b.from_user.username}</span>
                    {" owe"}{youOwe ? "" : "s"}{" "}
                    <span className={`font-semibold ${youGet ? "text-emerald-600" : "text-slate-800"}`}>{youGet ? "you" : b.to_user.username}</span>
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-800">{formatINR(b.amount)}</span>
                    <button
                      onClick={() => { setSettlePrefill({ from: b.from_user.id, to: b.to_user.id, amount: b.amount }); setShowSettle(true); }}
                      className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg hover:bg-emerald-100 font-medium">
                      Settle
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MEMBERS TAB */}
        {tab === "members" && (
          <div className="mt-4">
            <form onSubmit={addMember} className="flex gap-2 mb-4">
              <input className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Add member by username" />
              <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-lg text-sm font-medium">Add</button>
            </form>
            <div className="space-y-2">
              {group.members.map((m) => (
                <div key={m.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{m.user.username}{m.user.id === user.id ? " (you)" : ""}</p>
                    <p className="text-xs text-slate-400">{m.user.email}</p>
                  </div>
                  {m.user.id !== group.created_by.id && (
                    <button onClick={() => removeMember(m.user.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showExpense && (
        <AddExpenseModal group={group} currentUser={user} onClose={() => setShowExpense(false)} onSaved={loadAll} />
      )}
      {showSettle && (
        <SettleModal group={group} currentUser={user} prefill={settlePrefill} onClose={() => setShowSettle(false)} onSaved={loadAll} />
      )}
      {openExpenseId && (
        <ExpenseDetailModal expenseId={openExpenseId} currentUser={user} onClose={() => setOpenExpenseId(null)} onChanged={loadAll} />
      )}
    </div>
  );
}
