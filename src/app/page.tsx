'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-900">
      <div className="text-white text-center">
        <div className="text-4xl mb-4">💻</div>
        <p className="text-blue-200">Cargando...</p>
      </div>
    </div>
  );
}
