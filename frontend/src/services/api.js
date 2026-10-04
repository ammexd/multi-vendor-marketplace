// ===== Checkout / cart API (orders integration) =====
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";
const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success) {
    const error = new Error(json?.message || "Request failed");
    error.status = res.status;
    error.errors = json?.errors || [];
    throw error;
  }
  return json.data;
}

export const login = (email, password) =>
  request("/auth/login", { method: "POST", body: { email, password }, auth: false });

export const getProducts = (query = "") => request(`/products${query}`, { auth: false });
export const createOrder = (payload) => request("/orders", { method: "POST", body: payload });

export const clearServerCart = () => request("/cart", { method: "DELETE" });
export const addServerCartItem = (productId, quantity) =>
  request("/cart/items", { method: "POST", body: { productId, quantity } });

// ===== Auth pages API (from main) =====
const API_URL = "https://multi-vendor-marketplace-kt9n.onrender.com";

export const registerUser = async (userData) => {
  const response = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application.json",
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage =
      data.errors?.map((err) => err.errorMessage).join(".") ||
      data.message ||
      "Registration failed";
    throw new Error(errorMessage);
  }
  return data;
};

export const loginUser = async (userData) => {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }
  return data;
};

export const forgotPassword = async (email) => {
  const response = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to send reset link");
  }
  return data;
};

// ===== Cart API =====
export const getServerCart = () => request("/cart");
export const updateServerCartItem = (itemId, quantity) =>
  request(`/cart/items/${itemId}`, { method: "PUT", body: { quantity } });
export const removeServerCartItem = (itemId) =>
  request(`/cart/items/${itemId}`, { method: "DELETE" });
export const getProduct = (id) =>
  request(`/products/${id}`, { auth: false }).then((d) => d.product);
