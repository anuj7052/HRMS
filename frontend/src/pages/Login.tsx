import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMsal } from '@azure/msal-react';
import { msalLoginRequest, msalConfigured } from '../lib/msal';
import toast from 'react-hot-toast';

const DEMO_ACCOUNTS = [
  { label: 'Employee',   email: 'rahul@foetron.com',    password: 'Employee@123', note: 'Self-service panel' },
  { label: 'Manager',    email: 'manager@foetron.com',  password: 'Manager@123',  note: 'Team management' },
  { label: 'HR',         email: 'hr@foetron.com',       password: 'Hr@123456',    note: 'HR admin panel' },
  { label: 'Admin',      email: 'anuj@foetron.com',     password: 'Admin@1234',   note: 'Full access' },
];

export default function LoginPage() {
  const { login, loginWithMicrosoftToken } = useAuth();
  const { instance: msalInstance } = useMsal();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string; general?: string }>({});

  function validate() {
    const e: typeof fieldErr = {};
    if (!email) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    return e;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErr(errs); return; }
    setFieldErr({});
    setLoading(true);
    try {
      await login(email.toLowerCase().trim(), password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
        || (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Invalid credentials. Please try again.';
      setFieldErr({ general: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(acc: typeof DEMO_ACCOUNTS[number]) {
    setEmail(acc.email);
    setPassword(acc.password);
    setFieldErr({});
  }

  async function handleMicrosoftLogin() {
    if (!msalConfigured) {
      toast.error('Microsoft login is not configured. Set VITE_AZURE_AD_CLIENT_ID in frontend/.env');
      return;
    }
    setMsLoading(true);
    try {
      const result = await msalInstance.loginPopup(msalLoginRequest);
      const idToken = result.idToken;
      if (!idToken) throw new Error('No ID token returned by Microsoft');
      await loginWithMicrosoftToken(idToken);
      toast.success(`Welcome, ${result.account?.name || result.account?.username || 'user'}!`);
      navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as { errorCode?: string; message?: string; response?: { data?: { message?: string } } };
      if (e?.errorCode === 'user_cancelled') {
        // user closed the popup — silently ignore
      } else {
        const msg = e?.response?.data?.message || e?.message || 'Microsoft sign-in failed';
        toast.error(msg);
      }
    } finally {
      setMsLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Welcome back 👋
        </h2>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Sign in to your workspace to continue
        </p>
      </div>

      {/* General error banner */}
      {fieldErr.general && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          <p className="text-sm text-red-700 dark:text-red-400">{fieldErr.general}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Company Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className={`w-4 h-4 ${fieldErr.email ? 'text-red-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErr(p => ({ ...p, email: undefined })); }}
              placeholder="you@yourcompany.com"
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none transition-all ${
                fieldErr.email
                  ? 'border-red-400 dark:border-red-600 ring-2 ring-red-100 dark:ring-red-900/40'
                  : 'border-gray-200 dark:border-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30'
              }`}
            />
          </div>
          {fieldErr.email && <p className="text-xs text-red-500 mt-1">⚠ {fieldErr.email}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className={`w-4 h-4 ${fieldErr.password ? 'text-red-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErr(p => ({ ...p, password: undefined })); }}
              placeholder="••••••••"
              className={`w-full pl-10 pr-11 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none transition-all ${
                fieldErr.password
                  ? 'border-red-400 dark:border-red-600 ring-2 ring-red-100 dark:ring-red-900/40'
                  : 'border-gray-200 dark:border-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {showPass ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {fieldErr.password && <p className="text-xs text-red-500 mt-1">⚠ {fieldErr.password}</p>}
        </div>

        {/* Remember me */}
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <div
            onClick={() => setRememberMe(v => !v)}
            className={`w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center shrink-0 transition-all ${
              rememberMe ? 'bg-primary-600 border-primary-600' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
            }`}
          >
            {rememberMe && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Keep me signed in</span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* ── OR divider ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
        <span className="text-xs text-gray-400 uppercase tracking-wider">or continue with</span>
        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
      </div>

      {/* ── Microsoft sign-in button ───────────────────────────── */}
      <button
        type="button"
        onClick={handleMicrosoftLogin}
        disabled={msLoading || loading}
        className="w-full py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm font-semibold transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {msLoading ? (
          <>
            <svg className="w-4 h-4 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Connecting to Microsoft…
          </>
        ) : (
          <>
            {/* Official Microsoft 4-square logo */}
            <svg className="w-[18px] h-[18px]" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Sign in with Microsoft
          </>
        )}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
        <span className="text-xs text-gray-400">New here?</span>
        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors">
          Create account
        </Link>
      </p>

      {/* Demo credentials */}
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          Demo accounts — click to fill
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.label}
              type="button"
              onClick={() => fillDemo(acc)}
              className="text-left p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
            >
              <p className="text-xs font-bold text-gray-700 dark:text-gray-200 group-hover:text-primary-700 dark:group-hover:text-primary-400">
                {acc.label}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{acc.note}</p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
          These accounts must exist in your backend. Register them first or seed the DB, then click any card above to auto-fill and sign in.
        </p>
      </div>
    </div>
  );
}
