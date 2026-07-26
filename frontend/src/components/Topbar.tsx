'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, AlertTriangle, Menu } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';

type TopbarProps = {
  title: string;
  onSOSClickAction: () => void;
  onMenuClickAction?: () => void;
};

function relativeTime(epoch: number): string {
  const secs = Math.max(0, Math.round((Date.now() - epoch) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export default function Topbar({ title, onSOSClickAction, onMenuClickAction }: TopbarProps) {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    if (!showNotifications) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showNotifications]);

  return (
    <div className="bg-white border-b border-gray-100 px-4 md:px-7 h-16 flex items-center justify-between sticky top-0 z-40 w-full">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger — opens the sidebar drawer */}
        <button
          onClick={onMenuClickAction}
          className="md:hidden w-9.5 h-9.5 rounded-xl border border-gray-100 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu size={18} className="text-gray-600" />
        </button>
        <div className="text-base font-semibold text-gray-800 tracking-tight truncate">{title}</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative" ref={dropdownRef}>
          <div
            onClick={() => {
              const next = !showNotifications;
              setShowNotifications(next);
              if (next) markAllRead();
            }}
            className="w-9.5 h-9.5 rounded-xl border border-gray-100 bg-white cursor-pointer flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <Bell size={18} className="text-gray-500" />
            {unreadCount > 0 && (
              <div className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-red rounded-full border-[1.5px] border-white flex items-center justify-center">
                <span className="text-[9px] font-bold text-white leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>
              </div>
            )}
          </div>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <span className="text-[13px] font-semibold text-gray-800">Notifications</span>
              </div>
              <div className="flex flex-col max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[12.5px] text-gray-400">
                    No notifications yet. Real-time SOS updates will appear here.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="px-4 py-3 border-b border-gray-50 hover:bg-red-glow/10 flex gap-3 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-red mt-1.5 shrink-0"></div>
                      <div>
                        <p className="text-[13px] font-medium text-gray-800 leading-tight block">{n.title}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{relativeTime(n.time)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onSOSClickAction}
          className="bg-red hover:bg-red-dark text-white border-none rounded-xl px-3 md:px-4 py-2 text-[13px] font-semibold flex items-center gap-2 transition-transform active:scale-95 animate-sos-pulse shadow-sm"
        >
          <AlertTriangle size={15} fill="currentColor" />
          <span className="hidden sm:inline">Emergency SOS</span>
          <span className="sm:hidden">SOS</span>
        </button>
      </div>
    </div>
  );
}
