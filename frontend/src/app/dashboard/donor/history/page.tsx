'use client';
import { useState } from 'react';
import { Activity, Download, ChevronRight, Calendar, MapPin, Clock, Filter, Droplet } from 'lucide-react';

type Donation = {
  id: string;
  date: string;
  location: string;
  type: 'Whole blood' | 'Platelets' | 'Plasma';
  recipient: string;
  status: 'completed' | 'scheduled' | 'cancelled';
  units?: number;
  hbLevel?: string;
};

const donationHistory: Donation[] = [
  { id: '1', date: '2025-02-28', location: 'AIIMS Delhi', type: 'Whole blood', recipient: 'Thalassemia patient', status: 'completed', units: 1, hbLevel: '14.2 g/dL' },
  { id: '2', date: '2024-11-15', location: 'Safdarjung Hospital', type: 'Whole blood', recipient: 'Emergency SOS', status: 'completed', units: 1, hbLevel: '13.8 g/dL' },
  { id: '3', date: '2024-08-03', location: 'Apollo Delhi', type: 'Platelets', recipient: 'Thalassemia patient', status: 'completed', units: 1, hbLevel: '14.0 g/dL' },
  { id: '4', date: '2024-05-20', location: 'AIIMS Delhi', type: 'Whole blood', recipient: 'Emergency SOS', status: 'completed', units: 1, hbLevel: '13.5 g/dL' },
  { id: '5', date: '2024-02-10', location: 'Max Hospital', type: 'Plasma', recipient: 'Post-surgery patient', status: 'completed', units: 1, hbLevel: '14.1 g/dL' },
  { id: '6', date: '2023-11-05', location: 'Fortis Hospital', type: 'Whole blood', recipient: 'Thalassemia patient', status: 'completed', units: 1, hbLevel: '13.9 g/dL' },
  { id: '7', date: '2023-08-22', location: 'AIIMS Delhi', type: 'Whole blood', recipient: 'Emergency SOS', status: 'completed', units: 1, hbLevel: '14.3 g/dL' },
  { id: '8', date: '2025-05-25', location: 'AIIMS Delhi', type: 'Whole blood', recipient: 'Pending match', status: 'scheduled' },
];

const typeConfig: Record<string, { color: string; icon: string }> = {
  'Whole blood': { color: 'chip-red', icon: '🩸' },
  'Platelets': { color: 'chip-amber', icon: '🔬' },
  'Plasma': { color: 'chip-blue', icon: '💧' },
};

export default function DonationHistoryPage() {
  const [filter, setFilter] = useState<'all' | 'completed' | 'scheduled'>('all');
  const [typeF, setTypeF] = useState('all');

  const filtered = donationHistory.filter(d => {
    const matchStatus = filter === 'all' || d.status === filter;
    const matchType = typeF === 'all' || d.type === typeF;
    return matchStatus && matchType;
  });

  const totalDonations = donationHistory.filter(d => d.status === 'completed').length;
  const totalThisYear = donationHistory.filter(d => d.status === 'completed' && d.date.startsWith('2025')).length;
  const nextEligible = '2025-05-25';

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Donation History</h1>
          <p className="text-sm text-gray-500 mt-1">Track all your blood donations and upcoming appointments</p>
        </div>
        <button className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <Download size={16} /> Export History
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-[12px] p-4 relative overflow-hidden">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 bg-red-glow text-red"><Droplet size={18} /></div>
          <div className="text-2xl font-bold text-gray-800">{totalDonations}</div>
          <div className="text-xs text-gray-400 font-medium">Total Donations</div>
          <div className="text-[11px] font-medium mt-1.5 text-green">↑ {totalThisYear} this year</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-[12px] p-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 bg-green-bg text-green"><Activity size={18} /></div>
          <div className="text-2xl font-bold text-gray-800">{totalDonations * 3}</div>
          <div className="text-xs text-gray-400 font-medium">Lives Impacted</div>
          <div className="text-[11px] font-medium mt-1.5 text-green">↑ Each donation saves 3 lives</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-[12px] p-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 bg-blue-bg text-blue"><Calendar size={18} /></div>
          <div className="text-2xl font-bold text-gray-800">56</div>
          <div className="text-xs text-gray-400 font-medium">Days Until Eligible</div>
          <div className="text-[11px] font-medium mt-1.5 text-gray-500">Next: {new Date(nextEligible).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-[12px] p-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 bg-amber-bg text-amber"><Clock size={18} /></div>
          <div className="text-2xl font-bold text-gray-800">B+</div>
          <div className="text-xs text-gray-400 font-medium">Blood Type</div>
          <div className="text-[11px] font-medium mt-1.5 text-green">High demand group</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'completed', 'scheduled'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f ? 'bg-red text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div className="ml-auto">
          <select value={typeF} onChange={e => setTypeF(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white">
            <option value="all">All Types</option>
            <option value="Whole blood">Whole Blood</option>
            <option value="Platelets">Platelets</option>
            <option value="Plasma">Plasma</option>
          </select>
        </div>
      </div>

      {/* Donation Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="text-[11px] text-gray-400 uppercase border-b border-gray-100">
              <tr>
                <th className="pb-3 font-semibold">Date</th>
                <th className="pb-3 font-semibold">Location</th>
                <th className="pb-3 font-semibold">Type</th>
                <th className="pb-3 font-semibold">Recipient</th>
                <th className="pb-3 font-semibold">Hb Level</th>
                <th className="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {filtered.map(d => {
                const tc = typeConfig[d.type] || typeConfig['Whole blood'];
                return (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 font-medium">
                      {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 flex items-center gap-1.5"><MapPin size={12} className="text-gray-400" />{d.location}</td>
                    <td className="py-3"><span className={`chip text-[10px] py-0.5 ${tc.color}`}>{tc.icon} {d.type}</span></td>
                    <td className="py-3">{d.recipient}</td>
                    <td className="py-3 font-semibold text-green">{d.hbLevel || '—'}</td>
                    <td className="py-3">
                      <span className={`chip ${d.status === 'completed' ? 'chip-green' : d.status === 'scheduled' ? 'chip-amber' : 'chip-red'}`}>
                        <span className="chip-dot"></span>{d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
