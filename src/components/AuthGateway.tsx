import React, { useState, useEffect, useRef } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2, KeyRound, Shield, HardHat } from 'lucide-react';
import { EightyTwoBadge } from './ui/EightyTwoBadge';

interface AuthGatewayProps {
  onAuthSuccess: (token: string, user: { id: string; fullName: string; email: string; role: string }) => void;
}

type PortalMode = 'SELECT' | 'ADMIN' | 'CONTRIBUTOR_LOGIN' | 'CONTRIBUTOR_REGISTER';

export const AuthGateway: React.FC<AuthGatewayProps> = ({ onAuthSuccess }) => {
  const [portalMode, setPortalMode] = useState<PortalMode>('SELECT');

  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [errorMessage, setErrorMessage]   = useState<string | null>(null);

  const googleButtonRef = useRef<HTMLDivElement>(null);

  // ─── Google OAuth helpers ───────────────────────────────────────────────────
  const handleGoogleCredentialResponse = async (response: any) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const backendRes = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential }),
      });
      const responseText = await backendRes.text();
      if (!responseText) throw new Error('The server returned an empty authentication response.');
      const data = JSON.parse(responseText);
      if (!backendRes.ok) throw new Error(data.error || 'Google authentication failed.');
      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      console.error('[GOOGLE HANDSHAKE EXCEPTION]:', err.message);
      setErrorMessage(err.message || 'Google handshake verification failed.');
      renderGoogleButton();
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderGoogleButton = () => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.id && googleButtonRef.current) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        (window as any).google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: googleButtonRef.current.offsetWidth || 384,
        });
      } catch (err) {
        console.error('[GOOGLE IDENTITY INITIALIZATION EXCEPTION]:', err);
      }
    }
  };

  useEffect(() => {
    if (portalMode !== 'CONTRIBUTOR_LOGIN' && portalMode !== 'CONTRIBUTOR_REGISTER') return;
    if ((window as any).google?.accounts?.id) {
      renderGoogleButton();
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          renderGoogleButton();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [portalMode]);

  const resetFields = () => {
    setAdminUsername('');
    setAdminPassword('');
    setEmail('');
    setPassword('');
    setFullName('');
    setErrorMessage(null);
  };

  // ─── Admin login handler ────────────────────────────────────────────────────
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Admin authentication failed.');
      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'A network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Contributor login / register handler ───────────────────────────────────
  const handleContributorAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    const isRegister = portalMode === 'CONTRIBUTOR_REGISTER';
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload  = isRegister ? { email, password, fullName } : { email, password };
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed. Please verify your inputs.');
      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'A network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Shared layout wrapper ──────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-[#07090f] flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Subtle radial background glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,107,53,0.06) 0%, transparent 70%)',
        }}
      />
      <div className="relative w-full max-w-sm animate-fade-slide-up">
        {/* Orange top-edge stripe */}
        <div
          className="absolute -top-px left-0 right-0 h-[2px] rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg, #ff6b35 0%, rgba(255,107,53,0.2) 60%, transparent 100%)' }}
        />
        <div className="bg-[#0a0f1c] border border-white/[0.07] rounded-2xl shadow-2xl overflow-hidden">
          {children}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-[11px] text-slate-600 font-medium tracking-wide">
        An <span className="text-[#ff6b35]">Eighty-Two Limited</span> product
      </p>
    </div>
  );

  // ─── Error banner ───────────────────────────────────────────────────────────
  const ErrorBanner = () =>
    errorMessage ? (
      <div className="mx-6 mb-1 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium flex items-start gap-2">
        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1" />
        <span>{errorMessage}</span>
      </div>
    ) : null;

  // ─── Shared field component ─────────────────────────────────────────────────
  const Field = ({
    label, icon: Icon, ...inputProps
  }: { label: string; icon: React.ElementType } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
        <input
          {...inputProps}
          className={`w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#ff6b35]/60 focus:bg-white/[0.07] transition-all ${inputProps.className || ''}`}
        />
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 1: Portal selector
  // ═══════════════════════════════════════════════════════════════════════════
  if (portalMode === 'SELECT') {
    return (
      <Shell>
        {/* Brand header */}
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-6 border-b border-white/[0.06]">
          <div style={{ filter: 'drop-shadow(0 0 20px rgba(255,107,53,0.4))' }} className="mb-4">
            <EightyTwoBadge size={64} speed={0.7} />
          </div>
          <h1 className="text-sm font-bold text-white tracking-widest uppercase">NCCDB</h1>
          <p className="text-[11px] text-slate-500 mt-1 font-medium tracking-wide">National Construction Cost Database</p>
        </div>

        {/* Portal selection */}
        <div className="p-6 space-y-3">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest text-center mb-4">Select access portal</p>

          {/* Admin */}
          <button
            type="button"
            onClick={() => { resetFields(); setPortalMode('ADMIN'); }}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07] hover:border-[#ff6b35]/30 transition-all group cursor-pointer text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#ff6b35]/10 border border-[#ff6b35]/20 flex items-center justify-center shrink-0 group-hover:bg-[#ff6b35]/20 transition-colors">
              <Shield className="h-4.5 w-4.5 text-[#ff6b35]" style={{ width: 18, height: 18 }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Admin Portal</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Audit dashboard & moderation</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-[#ff6b35] transition-colors shrink-0" />
          </button>

          {/* Contributor */}
          <button
            type="button"
            onClick={() => { resetFields(); setPortalMode('CONTRIBUTOR_LOGIN'); }}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07] hover:border-slate-500/40 transition-all group cursor-pointer text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/[0.1] transition-colors">
              <HardHat className="h-4.5 w-4.5 text-slate-400" style={{ width: 18, height: 18 }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Contributor Portal</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Price entry & submissions</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
          </button>
        </div>
      </Shell>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 2: Admin login
  // ═══════════════════════════════════════════════════════════════════════════
  if (portalMode === 'ADMIN') {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-5 border-b border-white/[0.06]">
          <div style={{ filter: 'drop-shadow(0 0 16px rgba(255,107,53,0.4))' }} className="mb-4">
            <EightyTwoBadge size={52} speed={0.8} />
          </div>
          <div className="inline-flex items-center gap-1.5 bg-[#ff6b35]/10 border border-[#ff6b35]/20 rounded-full px-3 py-1 mb-3">
            <Shield className="h-3 w-3 text-[#ff6b35]" />
            <span className="text-[10px] font-bold text-[#ff6b35] uppercase tracking-widest">Admin</span>
          </div>
          <h2 className="text-sm font-bold text-white">Administrative Access</h2>
          <p className="text-[11px] text-slate-500 mt-1">Restricted to authorised system operators</p>
        </div>

        <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
          <ErrorBanner />

          <Field
            label="Admin Username"
            icon={User}
            type="text"
            required
            autoComplete="username"
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value)}
            placeholder="Enter admin username"
          />
          <Field
            label="Password"
            icon={Lock}
            type="password"
            required
            autoComplete="current-password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="••••••••••••"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#ff6b35] hover:bg-[#e85c28] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-all shadow-lg shadow-[#ff6b35]/20 cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Authenticate<ArrowRight className="h-4 w-4" /></>}
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => { resetFields(); setPortalMode('SELECT'); }}
              className="text-[11px] text-slate-500 hover:text-slate-300 font-medium transition-colors cursor-pointer"
            >
              ← Back to portal select
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 3: Contributor login / register
  // ═══════════════════════════════════════════════════════════════════════════
  const isRegister = portalMode === 'CONTRIBUTOR_REGISTER';

  return (
    <Shell>
      <div className="flex flex-col items-center text-center px-6 pt-8 pb-5 border-b border-white/[0.06]">
        <div style={{ filter: 'drop-shadow(0 0 16px rgba(255,107,53,0.3))' }} className="mb-4">
          <EightyTwoBadge size={52} speed={0.8} />
        </div>
        <div className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/10 rounded-full px-3 py-1 mb-3">
          <HardHat className="h-3 w-3 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contributor</span>
        </div>
        <h2 className="text-sm font-bold text-white">
          {isRegister ? 'Create Account' : 'Sign In'}
        </h2>
        <p className="text-[11px] text-slate-500 mt-1">
          {isRegister ? 'Register as a price data contributor' : 'Access your contributor dashboard'}
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex mx-6 mt-5 mb-1 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
        <button
          type="button"
          onClick={() => { setErrorMessage(null); setPortalMode('CONTRIBUTOR_LOGIN'); }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            !isRegister ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setErrorMessage(null); setPortalMode('CONTRIBUTOR_REGISTER'); }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            isRegister ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleContributorAuth} className="p-6 pt-4 space-y-4">
        <ErrorBanner />

        {isRegister && (
          <Field
            label="Full Legal Name"
            icon={User}
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ciroma Chukwuma Adekunle"
          />
        )}

        <Field
          label="Email Address"
          icon={Mail}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="qs@nccdb.com"
        />

        <div>
          <Field
            label="Password"
            icon={Lock}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
          />
          {!isRegister && (
            <div className="text-right mt-1.5">
              <a
                href="#forgot-password"
                onClick={(e) => e.preventDefault()}
                className="text-[11px] text-slate-500 hover:text-[#ff6b35] font-medium transition-colors flex items-center gap-1 justify-end"
              >
                <KeyRound className="h-3 w-3" />
                Forgot password?
              </a>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/10 hover:bg-white/[0.15] border border-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-all cursor-pointer"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>{isRegister ? 'Create Account' : 'Sign In'}<ArrowRight className="h-4 w-4" /></>
          )}
        </button>

        {/* Google OAuth */}
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-white/[0.07]" />
          <span className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-white/[0.07]" />
        </div>
        <div ref={googleButtonRef} className="w-full flex justify-center min-h-[40px]" />

        <div className="text-center pt-0.5">
          <button
            type="button"
            onClick={() => { resetFields(); setPortalMode('SELECT'); }}
            className="text-[11px] text-slate-500 hover:text-slate-300 font-medium transition-colors cursor-pointer"
          >
            ← Back to portal select
          </button>
        </div>
      </form>
    </Shell>
  );
};