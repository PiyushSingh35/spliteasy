/**
 * Global auth state via Context API (Q15).
 * Persists the user + tokens in localStorage so a refresh keeps you logged in.
 */
import { createContext, useContext, useState } from "react";
import * as API from "../api/endpoints";
import { tokenStore } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  const persist = (data) => {
    tokenStore.set({ access: data.access, refresh: data.refresh });
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const signup = async (payload) => {
    const { data } = await API.signup(payload);
    persist(data);
    return data;
  };

  const login = async (payload) => {
    const { data } = await API.login(payload);
    persist(data);
    return data;
  };

  const logout = async () => {
    try { await API.logout(tokenStore.refresh); } catch { /* ignore */ }
    tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
