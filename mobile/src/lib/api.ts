import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getItem } from './storage';

const TOKEN_KEY = 'ep_auth_token';

/**
 * In dev, reach the backend through the same machine that serves the JS bundle
 * (works on web, Android emulator via 10.0.2.2, and real devices on the LAN).
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

export const API_URL = resolveApiUrl();

export async function getToken(): Promise<string | null> {
  return getItem<string>(TOKEN_KEY);
}
export async function setToken(token: string): Promise<void> {
  await (await import('./storage')).setItem(TOKEN_KEY, token);
}
export async function clearToken(): Promise<void> {
  await (await import('./storage')).removeItem(TOKEN_KEY);
}

export type Role = 'admin' | 'employee';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  created_at?: string;
}

export interface WorkDocument {
  id: number;
  work_id: number;
  filename: string;
  original_name: string | null;
  uploaded_at: string;
}

export interface Work {
  id: number;
  title: string;
  description: string | null;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  venue: string | null;
  work_date: string;
  start_time: string | null;
  reminder_time: string | null;
  reminder_at: string | null;
  reminder_day_before_at: string | null;
  status: 'assigned' | 'completed';
  created_by: number;
  created_at: string;
  completed_at: string | null;
  payment_amount: number | null;
  expense_amount: number | null;
  payment_notes: string | null;
  assignee_count?: number;
  coworker_names?: string | null;
  assignees?: User[];
  documents?: WorkDocument[];
}

export interface QuotationItem {
  description: string;
  qty: number;
  unit_price: number;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  event_name: string | null;
  event_date: string | null;
  venue: string | null;
  items: QuotationItem[];
  notes: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  created_at: string;
}

export interface ReportRow {
  key: string;
  income: number;
  expense: number;
  profit: number;
  works: number;
  payments: number;       // total staff payments in this bucket
  payment_count: number;  // number of staff payments in this bucket
}

export interface Report {
  range: string;
  from: string;
  to: string;
  summary: {
    income: number;
    expense: number;
    profit: number;
    works: number;
    payments: number;       // total staff payments in this period
    payment_count: number;  // number of staff payments in this period
  };
  rows: ReportRow[];
}

export interface UserPayment {
  id: number;
  amount: number;
  given_on: string;      // YYYY-MM-DD
  given_at: string | null; // HH:MM or null
  source: string | null;  // e.g. 'work settlement', 'advance', 'bonus'
  notes: string | null;
  given_by: number;
  given_by_name: string | null;
  created_at: string;
}

export interface UserWorksList {
  user: User;
  works: Work[];
}

export interface UserPaymentsList {
  user: User;
  payments: UserPayment[];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: { method?: string; body?: unknown; formData?: FormData } = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request<{ user: User }>('/api/auth/me'),

  users: () => request<{ users: User[] }>('/api/users'),
  createUser: (body: { name: string; email: string; phone?: string; password: string; role: Role }) =>
    request<{ user: User }>('/api/users', { method: 'POST', body }),
  deleteUser: (id: number) => request<{ ok: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),

  // User works + payments (admin)
  userWorks: (userId: number) => request<UserWorksList>(`/api/users/${userId}/works`),
  userPayments: (userId: number) => request<UserPaymentsList>(`/api/users/${userId}/payments`),
  settlePayment: (userId: number, body: { amount: number; given_on: string; given_at?: string; source?: string; notes?: string }) =>
    request<{ payment: UserPayment }>(`/api/users/${userId}/payments`, { method: 'POST', body }),

  works: (query?: Record<string, string>) => {
    const qs = query ? '?' + new URLSearchParams(query).toString() : '';
    return request<{ works: Work[] }>(`/api/works${qs}`);
  },
  work: (id: number) => request<{ work: Work }>(`/api/works/${id}`),
  createWork: (body: Record<string, unknown>) => request<{ work: Work }>('/api/works', { method: 'POST', body }),
  completeWork: (id: number, body: { payment_amount: number; expense_amount: number; payment_notes?: string }) =>
    request<{ work: Work }>(`/api/works/${id}/complete`, { method: 'POST', body }),
  uploadDocuments: async (workId: number, files: { uri: string; name: string; type: string }[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('documents', f as unknown as Blob));
    return request<{ work: Work }>(`/api/works/${workId}/documents`, { method: 'POST', formData: form });
  },
  deleteDocument: (workId: number, docId: number) =>
    request<{ ok: boolean }>(`/api/works/${workId}/documents/${docId}`, { method: 'DELETE' }),

  reports: (query: Record<string, string>) =>
    request<Report>(`/api/reports?${new URLSearchParams(query).toString()}`),
  reportsPdfUrl: (query: Record<string, string>) =>
    `${API_URL}/api/reports/pdf?${new URLSearchParams(query).toString()}`,

  quotations: () => request<{ quotations: Quotation[] }>('/api/quotations'),
  createQuotation: (body: Record<string, unknown>) =>
    request<{ quotation: Quotation }>('/api/quotations', { method: 'POST', body }),
  quotationWhatsApp: (id: number) =>
    request<{ url: string; message: string }>(`/api/quotations/${id}/whatsapp`),
  quotationPdfUrl: (id: number) => `${API_URL}/api/quotations/${id}/pdf`,

  documentUrl: (filename: string) => `${API_URL}/uploads/${filename}`,
};