'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/select-role');
  }, [router]);
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">Redirecting...</h1>
        <p className="text-gray-500 mt-2">Please select your role to continue.</p>
      </div>
    </main>
  );
}
