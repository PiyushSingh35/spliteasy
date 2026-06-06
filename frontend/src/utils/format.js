/** Format a number/string as Indian Rupees, e.g. 1234.5 -> "₹1,234.50". */
export function formatINR(amount) {
  const n = Number(amount || 0);
  return "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format an ISO timestamp into a short readable date/time. */
export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Extract a human-friendly error message from an axios error. */
export function errorMessage(err, fallback = "Something went wrong.") {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d === "string") return d;
  if (d.detail) return Array.isArray(d.detail) ? d.detail.join(" ") : d.detail;
  // DRF field errors: {"field": ["msg"]}
  const first = Object.values(d)[0];
  if (Array.isArray(first)) return first[0];
  if (typeof first === "string") return first;
  return fallback;
}
