import React, { useState } from 'react';
import { ApiService } from '../apiService';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { EightyTwoBadge } from './ui/EightyTwoBadge';

interface AdminLoginPageProps {
  onLoginSuccess: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) return setError('Please fill in all required fields.');

    setIsSubmitting(true);
    try {
      const token = await ApiService.adminLogin({ username, password });
      localStorage.setItem('nccdb_admin_token', token);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Access denied: Invalid credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: '#07090f' }}>
      {/* Radial glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,107,53,0.07) 0%, transparent 70%)' }}
      />

      <div className="relative w-full max-w-sm animate-fade-slide-up">
        {/* Top accent stripe */}
        <div
          className="absolute -top-px left-0 right-0 h-[2px] rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg, #ff6b35 0%, rgba(255,107,53,0.15) 55%, transparent 100%)' }}
        />

        <div
          className="rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: '#0a0f1c', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Header */}
          <div
            className="flex flex-col items-center text-center px-6 pt-8 pb-6"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div style={{ filter: 'drop-shadow(0 0 20px rgba(255,107,53,0.4))' }} className="mb-4">
              <EightyTwoBadge size={60} speed={0.8} />
            </div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#ff6b35] mb-1">Admin Portal</p>
            <h1 className="text-sm font-bold text-white">NCCDB National Core Ledger</h1>
            <p className="text-[11px] text-slate-500 mt-1">Administrative authentication gateway</p>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            {error && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Username
                </label>
                <input
                  type="email"
                  placeholder="admin@nccdb.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-sm rounded-lg px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,107,53,0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm rounded-lg px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none transition-all font-mono"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,107,53,0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#ff6b35', boxShadow: '0 4px 16px rgba(255,107,53,0.25)' }}
                onMouseEnter={e => !isSubmitting && (e.currentTarget.style.background = '#e85c28')}
                onMouseLeave={e => !isSubmitting && (e.currentTarget.style.background = '#ff6b35')}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Authenticate <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center mt-5 text-[11px] text-slate-600">
          An <span style={{ color: '#ff6b35' }}>Eighty-Two Limited</span> product
        </p>
      </div>
    </div>
  );
};