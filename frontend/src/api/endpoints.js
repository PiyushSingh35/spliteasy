/**
 * All backend API calls in one place. Components import these functions
 * instead of using axios directly.
 */
import api from "./client";

// ---- Auth ----
export const signup = (payload) => api.post("/auth/signup/", payload);
export const login = (payload) => api.post("/auth/login/", payload);
export const logout = (refresh) => api.post("/auth/logout/", { refresh });

// ---- Users ----
export const getMe = () => api.get("/users/me/");
export const searchUser = (username) =>
  api.get("/users/search/", { params: { username } });

// ---- Groups ----
export const listGroups = () => api.get("/groups/");
export const createGroup = (payload) => api.post("/groups/", payload);
export const getGroup = (id) => api.get(`/groups/${id}/`);
export const deleteGroup = (id) => api.delete(`/groups/${id}/`);
export const addMember = (groupId, username) =>
  api.post(`/groups/${groupId}/members/`, { username });
export const removeMember = (groupId, userId) =>
  api.delete(`/groups/${groupId}/members/${userId}/`);

// ---- Expenses ----
export const listExpenses = (groupId) => api.get(`/groups/${groupId}/expenses/`);
export const createExpense = (groupId, payload) =>
  api.post(`/groups/${groupId}/expenses/`, payload);
export const getExpense = (id) => api.get(`/expenses/${id}/`);
export const deleteExpense = (id) => api.delete(`/expenses/${id}/`);

// ---- Comments ----
export const listComments = (expenseId) =>
  api.get(`/expenses/${expenseId}/comments/`);
export const addComment = (expenseId, comment_text) =>
  api.post(`/expenses/${expenseId}/comments/`, { comment_text });

// ---- Balances ----
export const getBalances = (groupId) => api.get(`/groups/${groupId}/balances/`);

// ---- Settlements ----
export const listSettlements = (groupId) =>
  api.get(`/groups/${groupId}/settlements/`);
export const createSettlement = (groupId, payload) =>
  api.post(`/groups/${groupId}/settlements/`, payload);

// ---- Notifications ----
export const listNotifications = () => api.get("/notifications/");
export const markNotificationRead = (id) =>
  api.put(`/notifications/${id}/read/`);
export const unreadCount = () => api.get("/notifications/unread-count/");
