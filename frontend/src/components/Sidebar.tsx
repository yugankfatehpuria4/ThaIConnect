'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, Users, Calendar, MessageSquare, AlertCircle, Settings, Home, Activity, Trophy, BarChart3, LogOut } from 'lucide-react';

type NavItem = {
  id: string;
  icon: React.ReactNode;
  text: string;
  path?: string;
  badge?: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

type RoleConfig = {
  nav: NavSection[];
};

type NavConfigType = {
  [key: string]: RoleConfig;
};

type UserSnapshot = {
  name: string;
  role: 'patient' | 'donor' | 'admin';
  initials: string;
};

function readUserSnapshot(fallbackRole: 'patient' | 'donor' | 'admin'): UserSnapshot {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) {
      return { name: 'User', role: fallbackRole, initials: 'U' };
    }

    const user = JSON.parse(stored) as { name?: string; role?: 'patient' | 'donor' | 'admin' };
    const name = user.name || 'User';
    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

    return { name, role: user.role || fallbackRole, initials };
  } catch {
    return { name: 'User', role: fallbackRole, initials: 'U' };
  }
}

const navConfig: NavConfigType = {
  patient: {
    nav: [
      { label: 'Main', items: [
        { id: 'overview', icon: <Home size={18} />, text: 'Dashboard', path: '/dashboard/patient' },
        { id: 'predictions', icon: <BarChart3 size={18} />, text: 'ML Predictions', path: '/dashboard/patient/predictions' },
        { id: 'donors', icon: <Users size={18} />, text: 'Find Donors', path: '/dashboard/patient/find-donors', badge: '4' },
        { id: 'schedule', icon: <Calendar size={18} />, text: 'My Schedule', path: '/dashboard/patient/schedule' },
      ]},
      { label: 'Support', items: [
        { id: 'chat', icon: <MessageSquare size={18} />, text: 'AI Assistant', path: '/dashboard/patient/ai-assistant' },
        { id: 'sos', icon: <AlertCircle size={18} />, text: 'SOS History', path: '/dashboard/patient/sos-history' },
      ]}
    ]
  },
  donor: {
    nav: [
      { label: 'Main', items: [
        { id: 'overview', icon: <Home size={18} />, text: 'Dashboard', path: '/dashboard/donor' },
        { id: 'history', icon: <Activity size={18} />, text: 'Donation History', path: '/dashboard/donor/history' },
        { id: 'badges', icon: <Trophy size={18} />, text: 'Achievements', path: '/dashboard/donor/achievements' },
      ]},
      { label: 'Alerts', items: [
        { id: 'sos', icon: <AlertCircle size={18} />, text: 'SOS Alerts', path: '/dashboard/donor/sos-alerts', badge: '1' },
      ]}
    ]
  },
  admin: {
    nav: [
      { label: 'Management', items: [
        { id: 'overview', icon: <Home size={18} />, text: 'Overview', path: '/dashboard/admin' },
        { id: 'users', icon: <Users size={18} />, text: 'Users', path: '/dashboard/admin/users', badge: '18' },
        { id: 'sos-logs', icon: <AlertCircle size={18} />, text: 'SOS Logs', path: '/dashboard/admin/sos-logs' },
      ]},
      { label: 'System', items: [
        { id: 'settings', icon: <Settings size={18} />, text: 'Settings', path: '/dashboard/admin/settings' },
      ]}
    ]
  }
};

type SidebarProps = {
  role: 'patient' | 'donor' | 'admin';
  mobileOpen?: boolean;
  onCloseAction?: () => void;
};

export default function Sidebar({ role, mobileOpen = false, onCloseAction }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const config = navConfig[role] || navConfig.patient;
  const [userSnapshot, setUserSnapshot] = useState<UserSnapshot>({ name: 'User', role, initials: 'U' });

  const [availableDonorBadge, setAvailableDonorBadge] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUserSnapshot(readUserSnapshot(role));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [role]);

  useEffect(() => {
    if (role !== 'patient') {
      return;
    }

    const fetchNearbyDonorCount = (lat: number, lng: number) => {
      const token = localStorage.getItem('token') || '';
      fetch(`/api/donors/nearby?lat=${lat}&lng=${lng}&maxDistance=10000`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => response.json())
        .then((data) => {
          if (!Array.isArray(data)) {
            return;
          }

          const available = data.filter((entry: { status?: string; avail?: string }) => {
            const status = (entry.status || entry.avail || '').toLowerCase();
            return status === 'available';
          }).length;

          setAvailableDonorBadge(String(available));
        })
        .catch(() => {
          setAvailableDonorBadge('0');
        });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchNearbyDonorCount(position.coords.latitude, position.coords.longitude);
        },
        () => {
          fetchNearbyDonorCount(28.6139, 77.2090);
        },
      );
      return;
    }

    fetchNearbyDonorCount(28.6139, 77.2090);
  }, [role]);

  const handleLogout = async () => {
    // Clear the httpOnly session cookie server-side (JS can't touch it), then
    // drop local display state and leave.
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* even if the call fails, still clear local state below */
    }
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    localStorage.removeItem('patientVitals');
    router.replace('/');
  };

  const roleLabel = userSnapshot.role === 'patient' ? 'Patient' : userSnapshot.role === 'donor' ? 'Donor' : 'Administrator';

  return (
    <>
      {/* Mobile backdrop — tap to close the drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onCloseAction} aria-hidden="true" />
      )}
      <nav
        className={`w-55 bg-white border-r border-gray-100 flex flex-col fixed top-0 left-0 h-full z-50 transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
      <div className="p-5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-8.5 h-8.5 bg-red-glow rounded-lg flex items-center justify-center text-red">
          <Shield size={18} fill="currentColor" />
        </div>
        <div>
          <div className="font-display font-bold text-[17px] text-gray-800 leading-tight">ThalAI</div>
          <div className="text-[10px] text-gray-400 tracking-wider uppercase font-medium">Connect</div>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {config.nav.map((section, idx) => (
          <div key={idx} className="mb-4">
            <div className="text-[10px] text-gray-400 tracking-wider uppercase px-2 mb-1.5 mt-2">{section.label}</div>
            {section.items.map((item) => {
              const isActive = pathname === item.path;
              const itemBadge =
                role === 'patient' && item.id === 'donors' && availableDonorBadge !== null
                  ? availableDonorBadge
                  : item.badge;
              return (
                <button
                  key={item.id}
                  onClick={() => { if (item.path) { router.push(item.path); onCloseAction?.(); } }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-colors mb-0.5 ${isActive ? 'bg-red-glow text-red' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`}
                >
                  <span className={`opacity-70 ${isActive ? 'opacity-100' : ''}`}>{item.icon}</span>
                  {item.text}
                  {itemBadge && (
                    <span className="ml-auto bg-red text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-4.5 text-center">
                      {itemBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100 mt-auto">
        <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg mb-2">
          <div className="w-7.5 h-7.5 rounded-full bg-red flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {userSnapshot.initials}
          </div>
          <div className="flex-1 truncate">
            <div className="text-[12.5px] font-semibold text-gray-800 truncate">{userSnapshot.name}</div>
            <div className="text-[10px] text-gray-400 truncate">{roleLabel}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-medium text-gray-500 hover:bg-red-glow hover:text-red transition-colors"
        >
          <LogOut size={14} />
          Log Out
        </button>
      </div>
      </nav>
    </>
  );
}
