'use client';

import React from 'react';
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
  avatar: string;
  name: string;
  type: string;
  nav: NavSection[];
};

type NavConfigType = {
  [key: string]: RoleConfig;
};

const navConfig: NavConfigType = {
  patient: {
    avatar: 'RM', name: 'Rohan M.', type: 'Patient · B+',
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
    avatar: 'AS', name: 'Arjun S.', type: 'Donor · B+',
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
    avatar: 'AD', name: 'Admin', type: 'Administrator',
    nav: [
      { label: 'Management', items: [
        { id: 'overview', icon: <Home size={18} />, text: 'Overview', path: '/dashboard/admin' },
        { id: 'users', icon: <Users size={18} />, text: 'Users', path: '/dashboard/admin/users', badge: '18' },
      ]},
      { label: 'System', items: [
        { id: 'settings', icon: <Settings size={18} />, text: 'Settings', path: '/dashboard/admin/settings' },
      ]}
    ]
  }
};

export default function Sidebar({ role }: { role: 'patient' | 'donor' | 'admin' }) {
  const pathname = usePathname();
  const router = useRouter();
  const config = navConfig[role] || navConfig.patient;

  return (
    <nav className="w-[220px] bg-white border-r border-gray-100 flex flex-col fixed top-0 left-0 h-full z-50">
      <div className="p-5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-[34px] h-[34px] bg-red-glow rounded-lg flex items-center justify-center text-red">
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
              return (
                <button
                  key={item.id}
                  onClick={() => item.path && router.push(item.path)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-colors mb-0.5 ${isActive ? 'bg-red-glow text-red' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`}
                >
                  <span className={`opacity-70 ${isActive ? 'opacity-100' : ''}`}>{item.icon}</span>
                  {item.text}
                  {item.badge && (
                    <span className="ml-auto bg-red text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* no auth provider; no sign out button needed */}

      <div className="p-4 border-t border-gray-100 mt-auto">
        <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100" onClick={() => router.push('/')}>
          <div className="w-[30px] h-[30px] rounded-full bg-red flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {config.avatar}
          </div>
          <div className="flex-1 truncate">
            <div className="text-[12.5px] font-semibold text-gray-800 truncate">{config.name}</div>
            <div className="text-[10px] text-gray-400 truncate">{config.type}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
