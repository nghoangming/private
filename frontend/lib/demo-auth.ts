export type Role = "ADMIN" | "TEACHER" | "STUDENT";
export type DemoAccount = { id: number; name: string; email: string; role: Role };
type LoginResponse = { accessToken: string; expiresAt: string; id: number; name: string; email: string; roles: string[] };
type StoredSession = { account: DemoAccount; accessToken: string; expiresAt: string };

const SESSION_KEY = "tdtu-campus-auth-session";
export const demoAccounts: Array<{ email: string; role: Role; name: string }> = [
  { email: "admin@smartcampus.test", role: "ADMIN", name: "Campus Administrator" },
  { email: "teacher@smartcampus.test", role: "TEACHER", name: "Demo Teacher" },
  { email: "student@smartcampus.test", role: "STUDENT", name: "Demo Student" },
];

function stored(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredSession;
    if (!value.accessToken || !value.account?.role || Date.now() >= new Date(value.expiresAt).getTime()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return value;
  } catch { return null; }
}

export const demoAuth = {
  async signIn(email: string, password: string, requestedRole: Role): Promise<DemoAccount> {
    sessionStorage.removeItem(SESSION_KEY);
    const response = await fetch("/api/v1/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(body?.message ?? "Không thể đăng nhập. Kiểm tra email và mật khẩu.");
    }
    const data = await response.json() as LoginResponse;
    if (!data.roles.includes(requestedRole)) throw new Error("Tài khoản không có vai trò đã chọn.");
    const account: DemoAccount = { id: data.id, name: data.name, email: data.email, role: requestedRole };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ account, accessToken: data.accessToken, expiresAt: data.expiresAt } satisfies StoredSession));
    return account;
  },
  current(): DemoAccount | null { return stored()?.account ?? null; },
  token(): string | null { return stored()?.accessToken ?? null; },
  signOut() { sessionStorage.removeItem(SESSION_KEY); },
};
export const rolePath = (role: Role) => `/${role.toLowerCase()}`;
