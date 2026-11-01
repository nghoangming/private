export type Role = "ADMIN" | "TEACHER" | "STUDENT";
export type DemoAccount = { id: number; name: string; email: string; role: Role };

// Demo-only adapter. This is NOT authentication or a security boundary.
// Replace with backend-issued sessions and server-side RBAC before real deployment.
const DEMO_PASSWORD = "Campus@2026";
const accounts: DemoAccount[] = [
  { id: 1, name: "Nguyễn Minh Anh", email: "admin@tdtu.edu.vn", role: "ADMIN" },
  { id: 2, name: "Trần Hoàng Nam", email: "teacher@tdtu.edu.vn", role: "TEACHER" },
  { id: 3, name: "Lê Thu Hà", email: "student@tdtu.edu.vn", role: "STUDENT" },
];
const SESSION_KEY = "tdtu-campus-demo-session";
export const demoAccounts = accounts.map(({ email, role, name }) => ({ email, role, name }));
export const demoPassword = DEMO_PASSWORD;

export const demoAuth = {
  async signIn(email: string, password: string, requestedRole: Role): Promise<DemoAccount> {
    await new Promise(resolve => setTimeout(resolve, 550));
    const account = accounts.find(item => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!account || password !== DEMO_PASSWORD) throw new Error("Email hoặc mật khẩu minh họa không đúng.");
    if (account.role !== requestedRole) throw new Error(`Tài khoản này có vai trò ${account.role}. Hãy chọn đúng vai trò để tiếp tục.`);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(account));
    return account;
  },
  current(): DemoAccount | null {
    try {
      const value = sessionStorage.getItem(SESSION_KEY);
      if (!value) return null;
      const account = JSON.parse(value) as Partial<DemoAccount>;
      // Resolve the role from the demo account registry, never from the role toggle or stored role.
      return accounts.find(item => item.id === account.id && item.email === account.email) ?? null;
    } catch { return null; }
  },
  signOut() { sessionStorage.removeItem(SESSION_KEY); },
};
export const rolePath = (role: Role) => `/${role.toLowerCase()}`;
