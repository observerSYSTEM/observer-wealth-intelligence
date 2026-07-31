const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
const defaultApiUrl = process.env.NODE_ENV === "production" ? "" : "http://localhost:8000";

export const apiBaseUrl = (configuredApiUrl ?? defaultApiUrl).replace(/\/$/, "");
