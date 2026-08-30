const DEFAULT_API_BASE = "http://localhost:5000";
const AUTH_TOKEN_KEY = "hs_auth_token";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  token?: string | null;
  headers?: HeadersInit;
};

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) || DEFAULT_API_BASE;

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);

const buildHeaders = (token?: string | null, headers?: HeadersInit) => {
  const merged = new Headers(headers);

  if (!merged.has("Content-Type")) {
    merged.set("Content-Type", "application/json");
  }

  if (token) {
    merged.set("Authorization", `Bearer ${token}`);
  }

  return merged;
};

async function apiRequest<T>(
  path: string,
  { method = "GET", body, token, headers }: RequestOptions = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: buildHeaders(token, headers),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

type SignUpPayload = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  enable2FA?: boolean;
};

type SignInPayload = {
  email: string;
  password: string;
};

type EmailPayload = {
  email: string;
};

type ResetPasswordEmailPayload = {
  token: string;
  newPassword: string;
};

type ResetPasswordPhonePayload = {
  phone: string;
  newPassword: string;
};

type VerifyPhonePayload = {
  email: string;
  phone: string;
  firebaseUid?: string;
};

type Verify2FAPayload = {
  email: string;
  firebaseUid?: string;
};

type VerifyEmailOtpPayload = {
  email: string;
  otp: string;
};

type CheckPhonePayload = {
  phone: string;
};

export const authApi = {
  signup: (payload: SignUpPayload) =>
    apiRequest<{
      message: string;
      pendingUser: { id: string; fullName: string; email: string; phone: string };
    }>("/api/auth/signup", {
      method: "POST",
      body: payload,
    }),
  signin: (payload: SignInPayload) =>
    apiRequest<{
      message: string;
      requires2FA?: boolean;
      twoFactorMethod?: "email" | "phone";
      email?: string;
      phone?: string;
      token?: string;
      user?: { id: string; fullName: string; email: string };
    }>("/api/auth/signin", {
      method: "POST",
      body: payload,
    }),
  verifyPhone: (payload: VerifyPhonePayload) =>
    apiRequest<{
      message: string;
      token: string;
      user: { id: string; fullName: string; email: string; phone: string };
    }>("/api/auth/verify-phone", {
      method: "POST",
      body: payload,
    }),
  verify2FAOtp: (payload: Verify2FAPayload) =>
    apiRequest<{
      message: string;
      token: string;
      user: { id: string; fullName: string; email: string };
    }>("/api/auth/verify-2fa-otp", {
      method: "POST",
      body: payload,
    }),
  resendEmailOtp: (payload: EmailPayload) =>
    apiRequest<{ message: string }>("/api/auth/resend-email-otp", {
      method: "POST",
      body: payload,
    }),
  verifyEmailOtp: (payload: VerifyEmailOtpPayload) =>
    apiRequest<{
      message: string;
      token: string;
      user: { id: string; fullName: string; email: string };
    }>("/api/auth/verify-email-otp", {
      method: "POST",
      body: payload,
    }),
  forgotPasswordEmail: (payload: EmailPayload) =>
    apiRequest<{ message: string; resetLink?: string }>(
      "/api/auth/forgot-password-email",
      {
        method: "POST",
        body: payload,
      }
    ),
  resetPasswordEmail: (payload: ResetPasswordEmailPayload) =>
    apiRequest<{ message: string }>("/api/auth/reset-password-email", {
      method: "POST",
      body: payload,
    }),
  checkPhone: (payload: CheckPhonePayload) =>
    apiRequest<{ message: string; exists: boolean }>("/api/auth/check-phone", {
      method: "POST",
      body: payload,
    }),
  resetPasswordPhone: (payload: ResetPasswordPhonePayload) =>
    apiRequest<{ message: string }>("/api/auth/reset-password-phone", {
      method: "POST",
      body: payload,
    }),
  logout: (token = getAuthToken()) =>
    apiRequest<{ message: string }>("/api/auth/logout", {
      method: "POST",
      token,
    }),
};

export const contactApi = {
  submit: <T extends Record<string, unknown>>(payload: T, token?: string | null) =>
    apiRequest<{ success: boolean; message: string; data?: unknown }>(
      token ? "/api/contact" : "/api/contact/public",
      {
        method: "POST",
        body: payload,
        token,
      }
    ),
};

export const scanApi = {
  aiStatus: (token = getAuthToken()) =>
    apiRequest<{ available: boolean; models: Record<string, unknown> }>(
      "/api/scan/ai-status",
      { token }
    ),
  passive: <T extends Record<string, unknown>>(payload: T, token = getAuthToken()) =>
    apiRequest<Record<string, unknown>>("/api/scan/passive", {
      method: "POST",
      body: payload,
      token,
    }),
  active: <T extends Record<string, unknown>>(payload: T, token = getAuthToken()) =>
    apiRequest<Record<string, unknown>>("/api/scan/active", {
      method: "POST",
      body: payload,
      token,
    }),
  history: (token = getAuthToken()) =>
    apiRequest<Record<string, unknown>[]>("/api/scan/history", { token }),
};

export const reportApi = {
  list: (token = getAuthToken()) =>
    apiRequest<Record<string, unknown>[]>("/api/report/list", { token }),
  generate: <T extends Record<string, unknown>>(payload: T, token = getAuthToken()) =>
    apiRequest<{
      reportId: string;
      fileName: string;
      format: string;
      fileSize: number;
      downloadUrl: string;
      viewUrl: string;
    }>("/api/report/generate", {
      method: "POST",
      body: payload,
      token,
    }),
};
