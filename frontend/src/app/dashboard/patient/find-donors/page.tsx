'use client';
import { useState, useEffect } from 'react';
import { Search, MapPin, Filter, ChevronRight, Star } from 'lucide-react';

type Donor = {
  _id: string;
  name: string;
  bloodGroup?: string;
  distance?: number;
  lastDonated?: string;
  donationsCount?: number;
  score?: number;
  initials?: string;
  avail?: 'Available' | 'Maybe' | 'Offline';
};

export default function FindDonorsPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bloodFilter, setBloodFilter] = useState('all');
  const [selectedDonor, setSelectedDonor] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/donors')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDonors(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredDonors = donors.filter(d => {
    const matchesSearch = d.name?.toLowerCase().includes(search.toLowerCase());
    const matchesBlood = bloodFilter === 'all' || d.bloodGroup === bloodFilter;
    return matchesSearch && matchesBlood;
  });

  const bloodGroups = ['all', ...new Set(donors.map(d => d.bloodGroup).filter(Boolean))];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Find Donors</h1>
          <p className="text-sm text-gray-500 mt-1">Search and connect with compatible blood donors nearby</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip chip-green"><span className="chip-dot"></span>{filteredDonors.filter(d => d.avail === 'Available').length} Available</span>
          <span className="chip chip-amber"><span className="chip-dot"></span>{filteredDonors.length} Total</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search donors by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-red transition-colors"
            />
          </div>
          <select
            value={bloodFilter}
            onChange={e => setBloodFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red transition-colors bg-white"
          >
            {bloodGroups.map(bg => (
              <option key={bg} value={bg}>{bg === 'all' ? 'All Blood Groups' : bg}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Donor Map Mock */}
      <div className="card-sm h-[200px] relative overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <h2 className="card-title flex items-center gap-2"><MapPin size={14} className="text-red" /> Donor Map — Delhi NCR</h2>
          <span className="chip chip-green"><span className="chip-dot"></span>{filteredDonors.filter(d => d.avail === 'Available').length} Active</span>
        </div>
        <div className="flex-1 bg-gradient-to-br from-[#EAF0F8] to-[#F0E8E8] rounded-xl border border-gray-200 relative overflow-hidden flex items-center justify-center h-[130px]">
          <div className="absolute inset-0 opacity-40 bg-[linear-gradient(var(--color-gray-200)_1px,transparent_1px),linear-gradient(90deg,var(--color-gray-200)_1px,transparent_1px)] bg-[size:30px_30px]"></div>
          <div className="absolute w-32 h-32 rounded-full border-2 border-dashed border-red/30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
          <div className="w-3.5 h-3.5 rounded-full bg-red border-[3px] border-white shadow-lg absolute z-10" title="You"></div>
          {filteredDonors.slice(0, 4).map((d, i) => {
            const positions = [
              { top: '30%', left: '55%' },
              { top: '60%', left: '40%' },
              { top: '45%', left: '65%' },
              { top: '70%', left: '55%' },
            ];
            return (
              <div key={d._id || i} className="absolute" style={positions[i]}>
                <div className="w-5 h-5 rounded-[50%_50%_50%_0] -rotate-45 flex items-center justify-center shadow-md bg-blue">
                  <div className="rotate-45 w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Donor List */}
      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-red-glow border-t-red rounded-full animate-spin"></div>
          <span className="ml-3 text-sm text-gray-500">Loading donors...</span>
        </div>
      ) : filteredDonors.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No donors found matching your criteria.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredDonors.map((d) => (
            <div
              key={d._id}
              onClick={() => setSelectedDonor(selectedDonor === d._id ? null : d._id)}
              className={`card cursor-pointer transition-all hover:shadow-md ${selectedDonor === d._id ? 'border-red bg-red-glow/10' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-glow text-red font-bold text-sm flex items-center justify-center shrink-0">
                  {d.initials || d.name?.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-gray-800">{d.name}</span>
                    <span className="bg-red-glow text-red text-[11px] font-bold px-2 py-0.5 rounded-md">{d.bloodGroup || 'N/A'}</span>
                  </div>
                  <div className="text-[12px] text-gray-400 mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1"><MapPin size={12} />{d.distance || '—'} km</span>
                    <span>Last donated: {d.lastDonated ? new Date(d.lastDonated).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'N/A'}</span>
                    <span>{d.donationsCount || 0} donations</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`chip text-[10px] py-0.5 ${d.avail === 'Available' ? 'chip-green' : d.avail === 'Maybe' ? 'chip-amber' : 'chip-red'}`}>
                    <span className="chip-dot"></span>{d.avail || 'Unknown'}
                  </span>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-amber" fill="currentColor" />
                      <span className="text-lg font-bold text-green">{d.score || 0}</span>
                    </div>
                    <div className="w-14 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-green rounded-full" style={{ width: `${d.score || 0}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedDonor === d._id && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
                  <button className="flex-1 bg-red hover:bg-red-dark text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                    Request Donation
                  </button>
                  <button className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                    View Profile
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
