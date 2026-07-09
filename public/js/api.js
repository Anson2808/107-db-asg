/**
 * api.js — Thin fetch wrapper for CoWork API
 * Reads JWT from localStorage, attaches Authorization header,
 * parses JSON, throws on non-ok status.
 */
const API_BASE = "/api";

async function api(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data;
}
