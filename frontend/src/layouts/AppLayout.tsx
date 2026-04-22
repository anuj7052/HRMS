import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Clock, Users, Monitor, BarChart3, Settings,
  CalendarDays, Menu, X, Sun, Moon, LogOut, Bell,
  Home, CheckSquare, UserCircle, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'HR', 'Manager', 'Employee'] },
  { to: '/attendance', label: 'Attendance',  icon: Clock,          roles: ['Admin', 'HR', 'Manager', 'Employee'] },
  { to: '/leaves',     label: 'Leaves',      icon: CalendarDays,   roles: ['Admin', 'HR', 'Manager', 'Employee'] },
  { to: '/approvals',  label: 'Approvals',   icon: CheckSquare,    roles: ['Admin', 'HR', 'Manager'] },
  { to: '/employees',  label: 'Employees',   icon: Users,          roles: ['Admin', 'HR'] },
  { to: '/devices',    label: 'Devices',     icon: Monitor,        roles: ['Admin', 'HR'] },
  { to: '/reports',    label: 'Reports',     icon: BarChart3,      roles: ['Admin', 'HR'] },
  { to: '/settings',   label: 'Settings',    icon: Settings,       roles: ['Admin'] },
];

// Bottom nav items (mobile — max 5)
const bottomNavItems = [
  { to: '/dashboard',  label: 'Home',       icon: LayoutDashboard },
  { to: '/attendance', label: 'Attendance', icon: Clock },
  { to: '/leaves',     label: 'Leaves',     icon: CalendarDays },
  { to: '/approvals',  label: 'Approvals',  icon: CheckSquare },
  { to: '/employees',  label: 'More',       icon: Menu },
];

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored ? JSON.parse(stored) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('darkMode', JSON.stringify(dark));
  }, [dark]);
  return { dark, toggle: () => setDark((d: boolean) => !d) };
}

function roleColor(role?: string) {
  const map: Record<string, string> = { Admin: '#F59E0B', HR: '#2E5A9E', Manager: '#16A34A', Employee: '#64748B' };
  return map[role || ''] || '#64748B';
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { dark, toggle } = useDarkMode();

  const visibleNav = navItems.filter((item) => user && item.roles.includes(user.role));

  // Close profile dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const pageTitle = visibleNav.find((n) => location.pathname.startsWith(n.to))?.label || 'HRMS';

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F7FB] dark:bg-[#0B1220]">

      {/* ════════════ DESKTOP SIDEBAR ════════════ */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen bg-[#1A3C6E] dark:bg-[#0F2747]">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-white text-lg tracking-wide">SmartHRMS</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-0.5">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isActive ? 'bg-white/20' : 'bg-transparent'}`}>
                    <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                  </div>
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-3 px-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0"
              style={{ backgroundColor: roleColor(user?.role) }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/50">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ════════════ MOBILE SIDEBAR OVERLAY ════════════ */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 flex flex-col h-full bg-[#1A3C6E] dark:bg-[#0F2747] animate-slide-in shadow-2xl">
            <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <span className="font-black text-white text-lg">SmartHRMS</span>
              <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-0.5">
              {visibleNav.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }: { isActive: boolean }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon style={{ width: 18, height: 18 }} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-white/10">
              <div className="flex items-center gap-3 px-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white" style={{ backgroundColor: roleColor(user?.role) }}>
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                  <p className="text-xs text-white/50">{user?.role}</p>
                </div>
                <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ════════════ MAIN AREA ════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Top Header ── */}
        <header className="h-14 lg:h-16 bg-white dark:bg-[#111B2E] border-b border-gray-100 dark:border-[#1F2E49] flex items-center gap-3 px-4 lg:px-6 shrink-0 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="lg:hidden font-black text-gray-900 dark:text-white text-base">{pageTitle}</h1>

          <div className="hidden lg:block font-black text-gray-900 dark:text-white text-lg">{pageTitle}</div>

          <div className="flex-1" />

          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {dark ? <Sun className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} /> : <Moon style={{ width: 18, height: 18 }} />}
          </button>

          {/* Notifications */}
          <button className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Bell style={{ width: 18, height: 18 }} />
          </button>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white"
                style={{ backgroundColor: roleColor(user?.role) }}
              >
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="hidden sm:block text-sm font-bold text-gray-800 dark:text-gray-100">{user?.name?.split(' ')[0]}</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-52 card py-1 z-10 animate-fade-in shadow-xl">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1F2E49]">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user?.email}</p>
                  <span className="mt-1.5 inline-block text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: roleColor(user?.role) }}>
                    {user?.role}
                  </span>
                </div>
                <button
                  onClick={() => { navigate('/profile'); setProfileOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors font-medium"
                >
                  <UserCircle className="w-4 h-4" /> My Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-danger-500 dark:text-danger-400 hover:bg-danger-500/5 transition-colors font-medium"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet />
        </main>

        {/* ── Mobile Bottom Navigation (matches React Native RootNavigator tabs) ── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-[#111B2E] border-t border-gray-100 dark:border-[#1F2E49] flex z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
          {[
            { to: '/dashboard',  label: 'Home',       icon: LayoutDashboard },
            { to: '/attendance', label: 'Attendance', icon: Clock },
            { to: '/leaves',     label: 'Leaves',     icon: CalendarDays },
            ...(user?.role !== 'Employee' ? [{ to: '/approvals', label: 'Approve', icon: CheckSquare }] : []),
            ...(user?.role === 'Admin' || user?.role === 'HR' ? [{ to: '/employees', label: 'Staff', icon: Users }] : []),
          ].slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }: { isActive: boolean }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold transition-colors min-h-[56px] ${
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}>
                    <Icon style={{ width: 18, height: 18 }} />
                  </div>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
