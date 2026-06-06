import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../utils/format";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(form);
      navigate("/dashboard");
    } catch (err) {
      setError(errorMessage(err, "Could not create account."));
    } finally {
      setLoading(false);
    }
  };

  const field = (label, key, type = "text") => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        required
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-emerald-600 text-center">SplitEasy</h1>
        <p className="text-center text-slate-500 mt-1 mb-6">Create your account</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {field("Username", "username")}
          {field("Full name", "name")}
          {field("Email", "email", "email")}
          {field("Password", "password", "password")}
          <button
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2 rounded-lg transition"
          >
            {loading ? "Creating…" : "Sign up"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-emerald-600 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
