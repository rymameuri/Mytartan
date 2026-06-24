const API_BASE = process.env.REACT_APP_API_URL || "";

export async function submitFeedback(payload, token) {
  const response = await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Failed to submit feedback");
  }
  return data;
}
