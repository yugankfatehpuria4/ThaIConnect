'use client';
import { Bell, AlertTriangle } from 'lucide-react';

export default function Topbar({ title, onSOSClick }: { title: string, onSOSClick: () => void }) {
  return (
    <div className="bg-white border-b border-gray-100 px-7 h-16 flex items-center justify-between sticky top-0 z-40 w-full">
      <div className="text-base font-semibold text-gray-800 tracking-tight">{title}</div>
      <div className="flex items-center gap-3">
        <div className="w-9.5 h-9.5 rounded-xl border border-gray-100 bg-white cursor-pointer flex items-center justify-center relative hover:bg-gray-50 transition-colors">
          <Bell size={18} className="text-gray-500" />
          <div className="absolute top-2 right-2 w-2 h-2 bg-red rounded-full border-[1.5px] border-white"></div>
        </div>
        <button 
          onClick={onSOSClick}
          className="bg-red hover:bg-red-dark text-white border-none rounded-xl px-4 py-2 text-[13px] font-semibold flex items-center gap-2 transition-transform active:scale-95 animate-sos-pulse shadow-sm"
        >
          <AlertTriangle size={15} fill="currentColor" />
          Emergency SOS
        </button>
      </div>
    </div>
  );
}
