 'use client';
 import { useState } from 'react';
 import { useEffect } from 'react';
 import { usePathname, useRouter } from 'next/navigation';
 // import { useUser } from '@clerk/nextjs';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import SOSModal from '@/components/SOSModal';
import SOSPopup from '@/components/SOSPopup';
import { SocketProvider } from '@/context/SocketContext';

type UserRole = 'patient' | 'donor' | 'admin';

const validRoles: UserRole[] = ['patient', 'donor', 'admin'];

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && validRoles.includes(value as UserRole);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sosOpen, setSosOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  // const { user, isLoaded } = useUser();
  const role = pathname.includes('/admin') ? 'admin' : pathname.includes('/donor') ? 'donor' : 'patient';

  useEffect(() => {
    const localRole = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const userRole = isUserRole(localRole) ? localRole : null;

    if (!userRole || !token) {
      router.replace('/login');
      return;
    }

    if (localRole !== userRole) {
      localStorage.setItem('role', userRole);
    }

    // Ensure they are on their correct role dashboard
    if (pathname.includes('/dashboard/') && !pathname.includes(`/dashboard/${userRole}`)) {
      router.replace(`/dashboard/${userRole}`);
    } else if (pathname === '/dashboard') {
      router.replace(`/dashboard/${userRole}`);
    }
  }, [pathname, router]);
  
  const getTitle = () => {
    if (role === 'admin') return 'Admin Dashboard';
    if (role === 'donor') return 'Donor Dashboard';
    return 'Patient Dashboard';
  };

  return (
    <SocketProvider>
      <div className="flex w-full">
        <Sidebar role={role} />
        <div className="ml-55 flex-1 flex flex-col min-h-screen">
          <Topbar title={getTitle()} onSOSClickAction={() => setSosOpen(true)} />
          <main className="p-7 flex-1">
            {children}
          </main>
        </div>
        <SOSModal isOpen={sosOpen} onCloseAction={() => setSosOpen(false)} />
        <SOSPopup />
      </div>
    </SocketProvider>
  );
}
