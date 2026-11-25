/** Thin API client for the existing ATA backend. No new backend endpoints. */

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'https://atasportslive.com/api').replace(/\/+$/, '');
export const APP_ORIGIN = API_BASE.replace(/\/api$/, '');

/** Backend stores media as relative `/uploads/...` paths; make them absolute for RN. */
export function resolveAssetUrl(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${APP_ORIGIN}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  id: number;
  email: string;
  username?: string | null;
  usernameChangesCount?: number;
  fullName: string;
  surname?: string | null;
  phone?: string | null;
  role: string;
  status?: string;
  avatarUrl?: string | null;
  googleLinked?: boolean;
  hasPassword?: boolean;
  referralCode?: string | null;
  createdAt?: string;
  dateOfBirth?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  country?: string | null;
  ficaCompleted?: boolean;
  isInfluencer?: boolean;
  referralCodeCustomized?: boolean;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface Transaction {
  id: number;
  transactionId?: string | null;
  type: string;
  amount: number;
  status: string;
  paymentMethod?: string | null;
  reference?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface Bet {
  id: number;
  ticketId?: string | null;
  gameId: number;
  game?: { playerA: string; playerB: string } | null;
  outcome: string;
  stake: number;
  potentialReturn?: number | null;
  status: string;
  createdAt: string;
}

export interface PromoValidation {
  valid: boolean;
  reason?: string;
  isBonus?: boolean;
  estimatedBonus?: number;
  promotion?: { id: number; name: string; type: string; bonusExpiryDays?: number | null; termsConditions?: string | null };
}

export type SubscriptionType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ActiveSubscription {
  hasSubscription: boolean;
  subscriptionType?: SubscriptionType;
  expiresAt?: string;
  secondsRemaining?: number;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* HTML error page */ }
  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export interface StreamItem {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  thumbnailUrl?: string | null;
  hlsUrl?: string | null;
  sport?: string | null;
  accessPrice?: string | number | null;
  viewerCount?: number;
  startTime?: string;
  city?: string | null;
  country?: string | null;
  playerA?: string | null;
  playerB?: string | null;
  secondsUntilStart?: number;
}

export interface StreamListResponse {
  streams: StreamItem[];
  total: number;
}

export interface AccessStatus {
  hasAccess: boolean;
  expiresAt?: string | null;
  secondsRemaining?: number;
}

export interface LiveComment {
  id: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (data: { email: string; username: string; password: string; fullName: string; phone?: string; referralCode?: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (email: string, token: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ email, token, newPassword }),
    }),

  logout: (token: string) => request<{ message: string }>('/auth/logout', { method: 'POST' }, token),

  refresh: (refreshToken: string) =>
    request<AuthResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  me: (token: string) => request<User>('/auth/me', {}, token),

  wallet: (token: string) =>
    request<{ balance: number; availableBalance: number; bonusBalance: number; pendingBalance: number; withdrawableBalance: number }>('/wallet', {}, token),

  streams: (token?: string | null) =>
    request<StreamListResponse>('/streams', {}, token),

  upcoming: (token?: string | null) =>
    request<StreamItem[]>('/streams/upcoming', {}, token),

  stream: (id: number, token?: string | null) =>
    request<StreamItem>(`/streams/${id}`, {}, token),

  accessCheck: (id: number, token: string) =>
    request<AccessStatus>(`/streams/${id}/access/check`, {}, token),

  purchaseAccess: (id: number, token: string, subscriptionType = 'daily') =>
    request<AccessStatus>(`/streams/${id}/access`, {
      method: 'POST',
      body: JSON.stringify({ subscriptionType }),
    }, token),

  publicSettings: () => request<Record<string, string>>('/settings/public'),

  // ── Live chat ──
  comments: (streamId: number) =>
    request<{ comments: LiveComment[] }>(`/streams/${streamId}/comments`),
  postComment: (streamId: number, token: string, content: string) =>
    request<LiveComment>(`/streams/${streamId}/comments`, {
      method: 'POST', body: JSON.stringify({ content }),
    }, token),

  slides: () => request<{
    id: number; title: string; subtitle?: string | null; buttonText?: string | null;
    buttonUrl?: string | null; imageUrl?: string | null;
  }[]>('/slides'),

  liveStreams: () => request<StreamListResponse>('/streams?status=live&limit=1'),

  // ── Wallet ──
  gatewayStatus: () => request<{ pesapalEnabled: boolean; pawapayEnabled: boolean; pawapayConfigured: boolean }>('/wallet/gateway-status'),
  transactions: (token: string, limit = 5) =>
    request<{ transactions: Transaction[]; total: number }>(`/wallet/transactions?limit=${limit}`, {}, token),
  pawapayDeposit: (token: string, amount: number, phoneNumber: string, provider: string) =>
    request<{ depositId: string; status: string }>('/wallet/pawapay/deposit', {
      method: 'POST', body: JSON.stringify({ amount, phoneNumber, provider }),
    }, token),
  pawapayDepositStatus: (token: string, depositId: string) =>
    request<{ status: string; amount: number }>(`/wallet/pawapay/deposit/status?depositId=${encodeURIComponent(depositId)}`, {}, token),
  pesapalInitiate: (token: string, amount: number) =>
    request<{ redirectUrl: string; transactionId: string }>('/wallet/pesapal/initiate', {
      method: 'POST', body: JSON.stringify({ amount }),
    }, token),
  pesapalStatus: (token: string, ref: string) =>
    request<{ status: string; amount: number }>(`/wallet/pesapal/status?ref=${encodeURIComponent(ref)}`, {}, token),
  payoutMethod: (token: string) =>
    request<{ payoutMethod: string | null; payoutAccount: string | null; payoutMethodSetAt: string | null }>('/wallet/payout-method', {}, token),
  savePayoutMethod: (token: string, payoutMethod: string, payoutAccount: string) =>
    request<{ ok: boolean; payoutMethod: string; payoutAccount: string }>('/wallet/payout-method', {
      method: 'POST', body: JSON.stringify({ payoutMethod, payoutAccount }),
    }, token),
  redeemVoucher: (token: string, code: string) =>
    request<{ success: boolean; amount: number }>('/wallet/redeem-voucher', {
      method: 'POST', body: JSON.stringify({ code }),
    }, token),
  withdraw: (token: string, amount: number) =>
    request<{ message?: string }>('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount }) }, token),

  // ── Promotions ──
  validatePromo: (token: string, code: string, depositAmount: number) =>
    request<PromoValidation>('/promotions/validate-code', {
      method: 'POST', body: JSON.stringify({ code, depositAmount }),
    }, token),
  applyPromo: (token: string, code: string, depositTransactionId?: string) =>
    request<{ ok: boolean; bonusAmount?: number; message?: string }>('/promotions/apply-code', {
      method: 'POST', body: JSON.stringify({ code, depositTransactionId }),
    }, token),
  myBonuses: (token: string) =>
    request<{ bonusBalance: number; transactions: {
      id: number; type: string; amount: number; description?: string | null;
      promotionName?: string | null; createdAt: string;
    }[] }>('/promotions/my-bonuses', {}, token),

  // ── Subscriptions ──
  subscriptionPrices: () => request<Record<SubscriptionType, number>>('/subscriptions/prices'),
  activeSubscription: (token: string) => request<ActiveSubscription>('/subscriptions/active', {}, token),
  purchaseSubscription: (token: string, subscriptionType: SubscriptionType) =>
    request<ActiveSubscription & { amount?: number }>('/subscriptions/purchase', {
      method: 'POST', body: JSON.stringify({ subscriptionType }),
    }, token),

  // ── Dashboard / profile ──
  myBets: (token: string, query = 'limit=5') => request<{ bets: Bet[]; total: number }>(`/bets/my?${query}`, {}, token),
  notifications: (token: string) =>
    request<{ unreadCount: number }>('/notifications?unreadOnly=true', {}, token),
  notificationsList: (token: string, page = 1, limit = 30) =>
    request<NotificationListResponse>(`/notifications?page=${page}&limit=${limit}`, {}, token),
  markNotificationRead: (token: string, id: number) =>
    request<AppNotification>(`/notifications/${id}/read`, { method: 'PATCH' }, token),
  markAllNotificationsRead: (token: string) =>
    request<{ message: string }>('/notifications/read-all', { method: 'PATCH' }, token),
  registerPushToken: (token: string, fcmToken: string, platform: string) =>
    request<{ ok: boolean }>('/notifications/token', {
      method: 'POST', body: JSON.stringify({ token: fcmToken, platform }),
    }, token),
  unregisterPushToken: (token: string, fcmToken?: string) =>
    request<{ ok: boolean }>('/notifications/token', {
      method: 'DELETE', body: JSON.stringify(fcmToken ? { token: fcmToken } : {}),
    }, token),
  highlights: () => request<{
    id: number; title: string; description: string | null; youtubeUrl: string;
    createdAt: string;
  }[]>('/highlights'),

  // ── Referrals (influencers only) ──
  commissionHistory: (token: string) =>
    request<{ id: number; amount: number; description: string | null; createdAt: string }[]>(
      '/influencers/my-commission-history', {}, token,
    ),
  updateReferralCode: (token: string, code: string) =>
    request<{ ok: boolean; referralCode: string; referralCodeCustomized: boolean }>('/influencers/my-referral-code', {
      method: 'PATCH', body: JSON.stringify({ code }),
    }, token),
  updateProfile: (token: string, data: { fullName: string; phone?: string | null; username?: string }) =>
    request<User>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }, token),
  updateFica: (token: string, data: Record<string, string>) =>
    request<User>('/auth/fica', { method: 'PATCH', body: JSON.stringify(data) }, token),
  deleteAccount: (token: string, confirmation: string) =>
    request<{ ok: boolean; message?: string }>('/auth/account', {
      method: 'DELETE', body: JSON.stringify({ confirmation }),
    }, token),
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/password', {
      method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }),
    }, token),
  myReferrals: (token: string) =>
    request<{ referrals: { id: number; fullName: string; username?: string | null; joinedAt: string }[]; totalReferrals: number; totalCommissionEarned: number }>('/influencers/my-referrals', {}, token),
};
