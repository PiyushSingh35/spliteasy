import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Modal from "../components/Modal";
import * as API from "../api/endpoints";
import { errorMessage } from "../utils/format";

export default function Dashboard() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.listGroups();
      setGroups(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createGroup = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { data } = await API.createGroup(form);
      setShowCreate(false);
      setForm({ name: "", description: "" });
      navigate(`/groups/${data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Your Groups</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg"
          >
            + New Group
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <p className="text-slate-500">No groups yet. Create your first group to start splitting expenses.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => navigate(`/groups/${g.id}`)}
                className="text-left bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 p-5 transition"
              >
                <h3 className="font-semibold text-slate-800 text-lg">{g.name}</h3>
                {g.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{g.description}</p>}
                <p className="text-xs text-slate-400 mt-3">{g.member_count} member{g.member_count !== 1 ? "s" : ""}</p>
              </button>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <Modal title="Create a group" onClose={() => setShowCreate(false)}>
          {error && <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <form onSubmit={createGroup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Group name</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Goa Trip"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <button disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2 rounded-lg">
              {saving ? "Creating…" : "Create group"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
