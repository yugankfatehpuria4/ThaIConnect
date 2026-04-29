'use client';
import { useState, useEffect, useMemo } from 'react';
import { Activity, Droplet, Star, Clock, Download, ChevronRight } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

type DonationRecord = {
  date: string;
  location: string;
  type: string;
  recipientType: string;
  status: 'Completed' | 'Scheduled' | 'Cancelled';
  verified: boolean;
  unitsDonated?: number;
};

const defaultDonationHistory: DonationRecord[] = [
  { date: '2025-02-28', location: 'AIIMS Delhi', type: 'Whole blood', recipientType: 'Thalassemia patient', status: 'Completed', verified: true, unitsDonated: 1 },
  { date: '2024-11-15', location: 'Safdarjung', type: 'Whole blood', recipientType: 'Emergency SOS', status: 'Completed', verified: true, unitsDonated: 1 },
  { date: '2024-08-03', location: 'Apollo Delhi', type: 'Platelets', recipientType: 'Thalassemia patient', status: 'Completed', verified: true, unitsDonated: 1 },
  { date: '2024-05-20', location: 'Max Hospital', type: 'Plasma', recipientType: 'Post-surgery recovery', status: 'Completed', verified: true, unitsDonated: 1 },
  { date: '2025-05-25', location: 'AIIMS Delhi', type: 'Whole blood', recipientType: 'Pending match', status: 'Scheduled', verified: false, unitsDonated: 1 },
];

export default function DonorDashboard() {
  const { socket } = useSocket();
  const [sosList, setSosList] = useState<Array<Record<string, unknown>>>([
    { sosId: 'demo1', bloodGroup: 'B+', hospital: 'AIIMS Delhi', patientName: 'Rohan M.' },
    { sosId: 'demo2', bloodGroup: 'O-', hospital: 'Safdarjung Hospital', patientName: 'Anita V.' },
  ]);
  const [dashboard, setDashboard] = useState<Record<string, unknown>>({
    totalDonations: 7, daysUntilEligible: 56, responseRate: '94%', impactPoints: 1260
  });
  const [history, setHistory] = useState<DonationRecord[]>(defaultDonationHistory);
  const [achievements, setAchievements] = useState<Record<string, unknown>>({
    badges: ['First Drop', 'SOS Hero', '5 Lives Saved'],
    milestones: { bronze: true, silver: false, gold: false }
  });

  useEffect(() => {
    if (!socket) return;
    const handleSOS = (data: Record<string, unknown>) => setSosList(prev => [...prev, data]);
    socket.on('sos-alert', handleSOS);
    return () => { socket.off('sos-alert', handleSOS); };
  }, [socket]);

  useEffect(() => {
    const fetchHeaders = { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` };

    fetch('/api/donor/dashboard', { headers: fetchHeaders })
      .then(res => res.json())
      .then(data => { if (data && !data.error) setDashboard(data); })
      .catch(console.error);

    fetch('/api/donor/history', { headers: fetchHeaders })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setHistory(data as DonationRecord[]);
        }
      })
      .catch(console.error);

    fetch('/api/donor/achievements', { headers: fetchHeaders })
      .then(res => res.json())
      .then(data => { if (data && data.badges) setAchievements(data); })
      .catch(console.error);
  }, []);

  const respondSOS = async (sosId: string, response: string) => {
    // If it's a mock ID (e.g. 'demo1'), handle it entirely on the frontend
    if (!/^[a-f\d]{24}$/i.test(sosId)) {
      setSosList(prev => prev.filter(s => String(s.sosId || s._id || '') !== sosId));
      if (response === 'accepted') alert('You are a hero! Patient notified.');
      return;
    }

    try {
      const res = await fetch('/api/sos/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ sosId, response })
      });
      if (res.ok) {
        setSosList(prev => prev.filter(s => String(s.sosId || s._id || '') !== sosId));
        if (response === 'accepted') alert('You are a hero! Patient notified.');
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn('SOS respond failed:', errData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const exportHistory = async (type: 'pdf' | 'csv') => {
    try {
      const res = await fetch(`/api/donor/export-${type}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `donation_history.${type}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  // dashboard always has defaults, no loading gate needed

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  };

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + (typeof dashboard.daysUntilEligible === 'number' ? dashboard.daysUntilEligible : 0));

  const goalPts = 2000;
  const impactProgress = Math.min(100, Math.round((((dashboard.impactPoints as number) || 0) / goalPts) * 100));

  // Determine earned badges natively
  const bList = [
    { label: 'First Drop', icon: '🩸' },
    { label: 'SOS Hero', icon: '⚡' },
    { label: '5 Lives Saved', icon: '🏅' },
    { label: '10 Lives Saved', icon: '🌟' }
  ];

  const normalizedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [history]
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<Droplet size={18} />} color="red" val={Number(dashboard.totalDonations) || 0} label="Total donations" change="Verified Track" changeColor="text-gray-500" />
        <StatCard icon={<Clock size={18} />} color="green" val={Number(dashboard.daysUntilEligible) || 0} label="Days until eligible" change={`Next: ${formatDate(nextDate)}`} changeColor="text-gray-500" />
        <StatCard icon={<Activity size={18} />} color="amber" val={String(dashboard.responseRate || '0%')} label="Response rate" change="Lifetime metrics" changeColor="text-gray-500" />
        <StatCard icon={<Star size={18} />} color="blue" val={Number(dashboard.impactPoints) || 0} label="Impact points" change="Gold tier track" changeColor="text-blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
        <div className="card">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-bold text-gray-800">Donation History</h2>
            <div className="flex gap-3">
              <span onClick={() => exportHistory('csv')} className="text-gray-500 hover:text-gray-800 text-xs font-medium cursor-pointer flex items-center transition-colors">CSV <Download size={12} className="ml-1" /></span>
              <span onClick={() => exportHistory('pdf')} className="text-red-500 text-xs font-medium cursor-pointer flex items-center">Export PDF <ChevronRight size={14} /></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="text-[11px] text-gray-400 uppercase border-b border-gray-100">
                <tr><th className="pb-3 font-semibold">Date</th><th className="pb-3 font-semibold">Location</th><th className="pb-3 font-semibold">Type</th><th className="pb-3 font-semibold">Recipient</th><th className="pb-3 font-semibold">Status</th></tr>
              </thead>
              <tbody className="text-gray-800">
                {normalizedHistory.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-400">No donations recorded yet.</td></tr>
                ) : (
                  normalizedHistory.map((h, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 font-medium">{formatDate(h.date)}</td>
                      <td>{h.location || 'N/A'}</td>
                      <td>{h.type || ''} {h.unitsDonated ? `(${String(h.unitsDonated)}u)` : ''}</td>
                      <td>{h.recipientType || 'N/A'}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${h.status === 'Completed' ? 'bg-green-100 text-green-700' : h.status === 'Scheduled' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>{h.status || 'N/A'}
                        </span>
                        {h.verified ? <span className="ml-2 text-green-600 text-[10px] items-center font-semibold">✓ Verified</span> : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="card-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Badges & Achievements</h2>
            <div className="grid grid-cols-4 gap-2 text-center mb-4">
              {bList.map(b => (
                <Badge key={b.label} icon={b.icon} label={b.label} earned={(achievements?.badges as Array<string> || [])?.includes(b.label)} />
              ))}
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                <span>Progress to Gold</span>
                <span className="font-bold text-gray-800">{String(dashboard.impactPoints || 0)} / {goalPts} pts</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full transition-all duration-1000" style={{ width: `${impactProgress}%` }}></div>
              </div>
            </div>
          </div>

          <div className="rounded-xl shadow-sm border border-red-200 bg-red-50/50 p-5 min-h-[150px]">
            <h2 className="text-lg font-bold text-gray-800 mb-3">Pending SOS Alerts</h2>
            {sosList.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-[12px] text-gray-500 font-medium">No active emergencies nearby</div>
            ) : (
              sosList.map((sos: Record<string, unknown>, i: number) => (
                <div key={i} className="mb-4 animate-in slide-in-from-top-2">
                  <div className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-[12px] font-semibold flex items-start gap-2 mb-3">
                    <AlertIcon />
                    <div>
                      <div className="font-bold">New SOS — {String(sos.bloodGroup || 'Blood')} needed!</div>
                      <div className="text-[10px] font-medium opacity-80">{String(sos.hospital || 'Nearby Hospital')}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => respondSOS(String(sos.sosId || sos._id || ''), 'accepted')} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-[12px] font-semibold transition-colors">Accept ✓</button>
                    <button onClick={() => respondSOS(String(sos.sosId || sos._id || ''), 'rejected')} className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 rounded-lg py-2 text-[12px] font-semibold transition-colors">Decline</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ icon, label, earned }: { icon: React.ReactNode; label: string; earned: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-11 h-11 transition-all rounded-full flex items-center justify-center text-lg ${earned ? 'bg-yellow-100 text-yellow-600 shadow-[0_0_0_3px_#fef08a]' : 'bg-gray-100 opacity-50 grayscale scale-95'}`}>{icon}</div>
      <div className="text-[10px] font-semibold text-gray-600 leading-tight">{label}</div>
    </div>
  );
}

function StatCard({ icon, color, val, label, change, changeColor }: { icon: React.ReactNode; color: string; val: number | string; label: string; change: string; changeColor: string }) {
  const bg = color === 'red' ? 'bg-red-50 text-red-500' : color === 'blue' ? 'bg-blue-50 text-blue-500' : color === 'green' ? 'bg-green-50 text-green-500' : 'bg-yellow-50 text-yellow-500';
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 relative overflow-hidden transition-all hover:shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${bg}`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-800 leading-none mb-1">{val}</div>
      <div className="text-xs text-gray-400 font-medium">{label}</div>
      <div className={`text-[11px] font-medium mt-1.5 ${changeColor.replace('text-blue', 'text-blue-500')}`}>{change}</div>
      <div className="absolute -right-2 -top-2 opacity-5 text-6xl pointer-events-none">❤</div>
    </div>
  );
}

const AlertIcon = () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor" /></svg>;
