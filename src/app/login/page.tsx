'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, isAuthenticated } from '@/lib/auth';

/* ── Osakidetza cross mark (anagrama simplificado) ── */
function OskMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      role="img"
    >
      <rect width="48" height="48" rx="10" fill="white" fillOpacity="0.15" />
      {/* Cruz / plus — evoca salud y la forma del anagrama corporativo */}
      <rect x="20" y="8"  width="8" height="32" rx="3" fill="white" />
      <rect x="8"  y="20" width="32" height="8" rx="3" fill="white" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [shake, setShake]       = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.push('/dashboard');
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const role = await login(username, password);
    if (role !== null) {
      router.push(role === 'admin' ? '/admin' : '/dashboard');
    } else {
      setError('Usuario o contraseña incorrectos');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #282182 0%, #1e1965 55%, #170f55 100%)' }}
    >
      {/* Decoración de fondo: cuadrículas sutiles */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="w-full max-w-sm relative z-10">

        {/* ── Cabecera de identidad ── */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center">
            <OskMark size={56} />
          </div>
          {/* Nombre corporativo */}
          <div>
            <p
              className="text-xs font-semibold tracking-[0.25em] uppercase mb-1"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Osakidetza
            </p>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Osakidetza OPEk
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.65)' }} className="mt-1 text-sm">
              Práctica de exámenes de ofimática
            </p>
          </div>
        </div>

        {/* ── Tarjeta de login ── */}
        <div
          className={`bg-white rounded-2xl shadow-2xl p-8 ${shake ? 'shake' : ''}`}
          style={{ boxShadow: '0 24px 64px rgba(22,15,85,0.4)' }}
        >
          <h2 className="text-lg font-semibold mb-6 text-center" style={{ color: '#1a1a2e' }}>
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#4a4a6a' }}
              >
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Nombre de usuario"
                className="w-full px-4 py-3 border rounded-xl transition text-gray-800 placeholder-gray-400"
                style={{
                  borderColor: '#e4e3f0',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = '#282182'; e.target.style.boxShadow = '0 0 0 3px rgba(40,33,130,0.12)'; }}
                onBlur={e  => { e.target.style.borderColor = '#e4e3f0'; e.target.style.boxShadow = 'none'; }}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#4a4a6a' }}
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full px-4 py-3 border rounded-xl transition text-gray-800 placeholder-gray-400"
                style={{ borderColor: '#e4e3f0', outline: 'none' }}
                onFocus={e => { e.target.style.borderColor = '#282182'; e.target.style.boxShadow = '0 0 0 3px rgba(40,33,130,0.12)'; }}
                onBlur={e  => { e.target.style.borderColor = '#e4e3f0'; e.target.style.boxShadow = 'none'; }}
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
              >
                <span aria-hidden="true">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed mt-2 text-white"
              style={{ background: '#282182', minHeight: '48px' }}
              onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#1e1965'; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#282182'; }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Entrando…
                </span>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p
          className="text-center text-xs mt-6"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Acceso restringido · Osakidetza
        </p>
      </div>
    </div>
  );
}
