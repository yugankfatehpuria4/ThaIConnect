 'use client';
 import { useState } from 'react';
 import { useEffect } from 'react';
 import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import SOSModal from '@/components/SOSModal';
import SOSPopup from '@/components/SOSPopup';
import LocationSync from '@/components/LocationSync';
import NotificationBridge from '@/components/NotificationBridge';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SocketProvider } from '@/context/SocketContext';
import { ToastProvider } from '@/context/ToastContext';
import { NotificationProvider } from '@/context/NotificationContext';

type UserRole = 'patient' | 'donor' | 'admin';

const validRoles: UserRole[] = ['patient', 'donor', 'admin'];

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && validRoles.includes(value as UserRole);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sosOpen, setSosOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const role = pathname.includes('/admin') ? 'admin' : pathname.includes('/donor') ? 'donor' : 'patient';

  useEffect(() => {
    // This is only UI-level routing. Real authorization is enforced two ways
    // the browser can't forge: the Next proxy redirects when the httpOnly
    // session cookie is absent, and every API route re-verifies the JWT +
    // role server-side (requireRole). The stored role is just a display hint.
    const localRole = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    const userRole = isUserRole(localRole) ? localRole : null;

    if (!userRole) {
      // No session (e.g. after logout, or a reload with the cookie cleared) —
      // send the user to the public landing page.
      router.replace('/');
      return;
    }

    // Keep users on their own role's dashboard.
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
      <NotificationProvider>
        <ToastProvider>
          <ErrorBoundary>
            <div className="flex w-full">
              <Sidebar role={role} mobileOpen={mobileNavOpen} onCloseAction={() => setMobileNavOpen(false)} />
              <div className="md:ml-55 flex-1 flex flex-col min-h-screen min-w-0">
                <Topbar
                  title={getTitle()}
                  onSOSClickAction={() => setSosOpen(true)}
                  onMenuClickAction={() => setMobileNavOpen(true)}
                />
                <main className="p-4 md:p-7 flex-1">
                  {children}
                </main>
              </div>
              <SOSModal isOpen={sosOpen} onCloseAction={() => setSosOpen(false)} />
              <SOSPopup />
              <LocationSync />
              <NotificationBridge />
            </div>
          </ErrorBoundary>
        </ToastProvider>
      </NotificationProvider>
    </SocketProvider>
  );
}
