'use client';
import { useState } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';

type TopbarProps = {
  title: string;
  onSOSClickAction: () => void;
};

export default function Topbar({ title, onSOSClickAction }: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  
  const notifications = [
    { id: 1, title: 'Transfusion Due in 3 Days', time: '1 hr ago' },
    { id: 2, title: '2 Compatible Donors joined nearby', time: '5 hrs ago' },
  ];

  return (
    <div className="bg-white border-b border-gray-100 px-7 h-16 flex items-center justify-between sticky top-0 z-40 w-full">
      <div className="text-base font-semibold text-gray-800 tracking-tight">{title}</div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <div 
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-9.5 h-9.5 rounded-xl border border-gray-100 bg-white cursor-pointer flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <Bell size={18} className="text-gray-500" />
            <div className="absolute top-2 right-2 w-2 h-2 bg-red rounded-full border-[1.5px] border-white"></div>
          </div>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <span className="text-[13px] font-semibold text-gray-800">Notifications</span>
              </div>
              <div className="flex flex-col max-h-80 overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className="px-4 py-3 border-b border-gray-50 hover:bg-red-glow/10 cursor-pointer flex gap-3 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-red mt-1.5 shrink-0"></div>
                    <div>
                      <p className="text-[13px] font-medium text-gray-800 leading-tight block">{n.title}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 text-center bg-gray-50 border-t border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer">
                <span className="text-[12px] font-semibold text-red">Mark all as read</span>
              </div>
            </div>
          )}
        </div>
        <button 
          onClick={onSOSClickAction}
          className="bg-red hover:bg-red-dark text-white border-none rounded-xl px-4 py-2 text-[13px] font-semibold flex items-center gap-2 transition-transform active:scale-95 animate-sos-pulse shadow-sm"
        >
          <AlertTriangle size={15} fill="currentColor" />
          Emergency SOS
        </button>
      </div>
    </div>
  );
}
