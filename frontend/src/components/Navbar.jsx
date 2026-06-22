import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as API from "../api/endpoints";
import { formatDate } from "../utils/format";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const loadNotifs = async () => {
    try {
      const { data } = await API.listNotifications();
      setNotifs(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadNotifs();
    const id = setInterval(loadNotifs, 15000); // light polling, no websockets
    return () => clearInterval(id);
  }, []);

  // Close dropdown on outside click.
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = notifs.filter((n) => !n.is_read).length;

  const openDropdown = async () => {
    setOpen((o) => !o);
    if (!open) {
      const unreadIds = notifs.filter((n) => !n.is_read).map((n) => n.id);
      await Promise.all(unreadIds.map((id) => API.markNotificationRead(id).catch(() => {})));
      if (unreadIds.length) loadNotifs();
    }
  };

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/dashboard" className="text-xl font-bold text-emerald-600">SplitEasy</Link>

        <div className="flex items-center gap-4">
          {/* Wallet */}
          <Link to="/wallet" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-emerald-600 transition">
            <span>💳</span>
            <span className="hidden sm:inline">Wallet</span>
          </Link>

          {/* Notifications */}
          <div className="relative" ref={ref}>
            <button onClick={openDropdown} className="relative p-2 rounded-full hover:bg-slate-100" title="Notifications">
              <span className="text-xl">🔔</span>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 max-h-96 overflow-y-auto">
                <div className="px-4 py-2 border-b border-slate-100 font-semibold text-slate-700">Notifications</div>
                {notifs.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-400 text-sm">No notifications yet</div>
                ) : (
                  notifs.map((n) => (
                    <div key={n.id} className="px-4 py-3 border-b border-slate-50 text-sm">
                      <p className="text-slate-700">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(n.created_at)}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <span className="text-sm text-slate-600 hidden sm:inline">
            Hi, <span className="font-medium">{user?.username}</span>
          </span>
          <button onClick={doLogout} className="text-sm text-slate-600 hover:text-red-600 font-medium">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
