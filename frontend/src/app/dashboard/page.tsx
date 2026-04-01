'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
// import { useUser } from '@clerk/nextjs';

type UserRole = 'patient' | 'donor' | 'admin';

const validRoles: UserRole[] = ['patient', 'donor', 'admin'];

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && validRoles.includes(value as UserRole);
}

export default function DashboardRedirectPage() {
  const router = useRouter();
  // const { user, isLoaded } = useUser();

  useEffect(() => {
    const localRole = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    const role = isUserRole(localRole) ? localRole : null;

    if (!role) {
      router.replace('/login');
      return;
    }

    localStorage.setItem('role', role);
    router.replace(`/dashboard/${role}`);
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
      Redirecting to your dashboard...
    </main>
  );
}
