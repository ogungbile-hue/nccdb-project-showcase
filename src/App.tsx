import React, { useState, useEffect } from 'react';
import { AuthGateway } from './components/AuthGateway';
import { AdminDashboard } from './components/AdminDashboard';
import { PublicPortal } from './components/public/PublicPortal';

interface UserSession {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('nccdb_token'));
  const [user, setUser] = useState<UserSession | null>(() => {
    const savedUser = localStorage.getItem('nccdb_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [showPublicPortal, setShowPublicPortal] = useState(true);

  useEffect(() => {
    const onLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', onLocationChange);
    return () => window.removeEventListener('popstate', onLocationChange);
  }, []);

  const handleAuthSuccess = (newToken: string, userData: UserSession) => {
    localStorage.setItem('nccdb_token', newToken);
    localStorage.setItem('nccdb_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);

    const newPath = userData.role === 'SUPER_ADMIN' ? '/admin' : '/contributor';
    window.history.pushState({}, '', newPath);
    setCurrentPath(newPath);
    setShowPublicPortal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('nccdb_token');
    localStorage.removeItem('nccdb_user');
    setToken(null);
    setUser(null);
    
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
    setShowPublicPortal(true);
  };

  const isAuthenticated = !!token && !!user;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 antialiased relative">
      {/* Global Testing Toggle */}
      <div className="fixed top-0 inset-x-0 z-[9999] flex justify-center mt-2 pointer-events-none">
        <button 
          onClick={() => setShowPublicPortal(!showPublicPortal)}
          className="pointer-events-auto bg-slate-800/80 hover:bg-slate-700 backdrop-blur text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg border border-slate-600 transition-colors opacity-90 hover:opacity-100"
        >
          {showPublicPortal ? 'Switch to Admin / Contributor View' : 'Switch to Public Portal View'}
        </button>
      </div>

      {showPublicPortal ? (
        <PublicPortal />
      ) : (
        !isAuthenticated ? (
          <AuthGateway onAuthSuccess={handleAuthSuccess} />
        ) : (
          <AdminDashboard user={user!} onLogout={handleLogout} />
        )
      )}
    </div>
  );
}