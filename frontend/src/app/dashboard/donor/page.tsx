'use client';
import { Activity, Droplet, Star, Clock, Download, ChevronRight } from 'lucide-react';

export default function DonorDashboard() {
  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<Droplet size={18} />} color="red" val="7" label="Total donations" change="↑ 2 this year" changeColor="text-green" />
        <StatCard icon={<Clock size={18} />} color="green" val="56" label="Days until eligible" change="Next: May 25, 2025" changeColor="text-gray-500" />
        <StatCard icon={<Activity size={18} />} color="amber" val="94%" label="Response rate" change="↑ Top 5%" changeColor="text-green" />
        <StatCard icon={<Star size={18} />} color="blue" val="1,260" label="Impact points" change="↑ Gold tier" changeColor="text-green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
        <div className="card">
           <div className="flex justify-between items-center mb-5">
              <h2 className="card-title">Donation History</h2>
              <span className="text-red text-xs font-medium cursor-pointer flex items-center">Export <ChevronRight size={14}/></span>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-[13px] text-left">
                <thead className="text-[11px] text-gray-400 uppercase border-b border-gray-100">
                  <tr><th className="pb-3 font-semibold">Date</th><th className="pb-3 font-semibold">Location</th><th className="pb-3 font-semibold">Type</th><th className="pb-3 font-semibold">Recipient</th><th className="pb-3 font-semibold">Status</th></tr>
                </thead>
                <tbody className="text-gray-800">
                  <tr className="border-b border-gray-50 hover:bg-gray-50/50"><td className="py-3">Feb 28, 2025</td><td>AIIMS Delhi</td><td>Whole blood</td><td>Thalassemia patient</td><td><span className="chip chip-green"><span className="chip-dot"></span>Completed</span></td></tr>
                  <tr className="border-b border-gray-50 hover:bg-gray-50/50"><td className="py-3">Nov 15, 2024</td><td>Safdarjung</td><td>Whole blood</td><td>Emergency SOS</td><td><span className="chip chip-green"><span className="chip-dot"></span>Completed</span></td></tr>
                  <tr className="border-b border-gray-50 hover:bg-gray-50/50"><td className="py-3">Aug 3, 2024</td><td>Apollo Delhi</td><td>Platelets</td><td>Thalassemia patient</td><td><span className="chip chip-green"><span className="chip-dot"></span>Completed</span></td></tr>
                  <tr className="hover:bg-gray-50/50"><td className="py-3">May 25, 2025</td><td>—</td><td>Whole blood</td><td>Pending match</td><td><span className="chip chip-amber"><span className="chip-dot"></span>Scheduled</span></td></tr>
                </tbody>
             </table>
           </div>
        </div>

        <div className="flex flex-col gap-5">
           <div className="card-sm">
             <h2 className="card-title mb-4">Badges & Achievements</h2>
             <div className="grid grid-cols-4 gap-2 text-center mb-4">
                <Badge icon="🩸" label="First Drop" earned />
                <Badge icon="⚡" label="SOS Hero" earned />
                <Badge icon="🏅" label="5 Lives" earned />
                <Badge icon="🌟" label="10 Lives" earned={false} />
             </div>
             <div>
                <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>Progress to Gold</span><span className="font-bold text-gray-800">1,260 / 2,000 pts</span></div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-amber w-[63%] rounded-full"></div></div>
             </div>
           </div>

           <div className="card-sm border-red-light bg-red-glow/10">
              <h2 className="card-title mb-3">Pending SOS Alerts</h2>
              <div className="bg-red-glow text-red border border-red-light px-3 py-2 rounded-lg text-[12px] font-semibold flex items-center gap-2 mb-3">
                 <AlertIcon /> New SOS — B+ needed · 3.2 km
              </div>
              <div className="flex gap-2">
                 <button className="flex-1 bg-red hover:bg-red-dark text-white rounded-lg py-2 text-[12px] font-semibold transition-colors">Accept ✓</button>
                 <button className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 rounded-lg py-2 text-[12px] font-semibold transition-colors">Decline</button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ icon, label, earned }: any) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg ${earned ? 'bg-amber-bg shadow-[0_0_0_3px_var(--color-amber-bg)]' : 'bg-gray-100 opacity-50 grayscale'}`}>{icon}</div>
      <div className="text-[10px] font-semibold text-gray-600 leading-tight">{label}</div>
    </div>
  );
}

function StatCard({ icon, color, val, label, change, changeColor }: any) {
  const bg = color === 'red' ? 'bg-red-glow text-red' : color === 'blue' ? 'bg-blue-bg text-blue' : color === 'green' ? 'bg-green-bg text-green' : 'bg-amber-bg text-amber';
  return (
    <div className="bg-white border border-gray-100 rounded-sm p-4 relative overflow-hidden">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${bg}`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-800 leading-none mb-1">{val}</div>
      <div className="text-xs text-gray-400 font-medium">{label}</div>
      <div className={`text-[11px] font-medium mt-1.5 ${changeColor}`}>{change}</div>
      <div className="absolute -right-2 -top-2 opacity-5 text-6xl">❤</div>
    </div>
  );
}

const AlertIcon = () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/></svg>;
