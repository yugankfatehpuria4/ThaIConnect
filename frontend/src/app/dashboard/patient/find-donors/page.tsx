'use client';
import { useState, useEffect } from 'react';
import { Search, MapPin, Filter, ChevronRight, Star } from 'lucide-react';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false });

type Donor = {
  _id: string;
  name: string;
  bloodGroup?: string;
  distance?: number;
  lastDonated?: string;
  donationsCount?: number;
  score?: number;
  initials?: string;
  status?: 'Available' | 'Maybe' | 'Offline';
  avail?: 'Available' | 'Maybe' | 'Offline';
  location?: { coordinates: [number, number] };
};

type DonorProfile = {
  _id: string;
  name: string;
  bloodGroup: string;
  availability: string;
  donationsCount: number;
  score: number;
  lastDonated: string | null;
  contactMasked: string | null;
};

export default function FindDonorsPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bloodFilter, setBloodFilter] = useState('all');
  const [selectedDonor, setSelectedDonor] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [requestLoadingId, setRequestLoadingId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeProfile, setActiveProfile] = useState<DonorProfile | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          fetchDonors(loc.lat, loc.lng);
        },
        (err) => {
          console.warn('Geolocation failed. Using placeholder location', err);
          const loc = { lat: 28.6139, lng: 77.2090 };
          setUserLocation(loc);
          fetchDonors(loc.lat, loc.lng);
        }
      );
    } else {
      fetchDonors(28.6139, 77.2090);
    }
  }, []);

  const fetchDonors = (lat: number, lng: number) => {
    setLoading(true);
    fetch(`/api/donors/nearby?lat=${lat}&lng=${lng}&maxDistance=10000`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDonors(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const filteredDonors = donors.filter(d => {
    const matchesSearch = d.name?.toLowerCase().includes(search.toLowerCase());
    const matchesBlood = bloodFilter === 'all' || d.bloodGroup === bloodFilter;
    return matchesSearch && matchesBlood;
  });

  const bloodGroups = ['all', ...new Set(donors.map(d => d.bloodGroup).filter(Boolean))];

  const handleRequestDonation = async (donor: Donor) => {
    setRequestLoadingId(donor._id);
    setRequestMessage(null);
    try {
      const res = await fetch('/api/patient/donation-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ donorId: donor._id, hospital: 'AIIMS Delhi' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send donation request');
      }
      setRequestMessage(data?.message || `Donation request sent to ${donor.name}`);
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : 'Failed to send donation request');
    } finally {
      setRequestLoadingId(null);
    }
  };

  const handleViewProfile = async (donorId: string) => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/donors/${donorId}/profile`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to fetch donor profile');
      }
      setActiveProfile(data as DonorProfile);
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : 'Failed to fetch donor profile');
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Find Donors</h1>
          <p className="text-sm text-gray-500 mt-1">Search and connect with compatible blood donors nearby</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip chip-green"><span className="chip-dot"></span>{filteredDonors.filter(d => d.status === 'Available' || d.avail === 'Available').length} Available</span>
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

      {/* Real Map */}
      <div className="card-sm h-87.5 relative overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-3 shrink-0">
          <h2 className="card-title flex items-center gap-2"><MapPin size={14} className="text-red" /> Nearby Donors Map</h2>
          <span className="chip chip-green"><span className="chip-dot"></span>{filteredDonors.filter(d => d.status === 'Available' || d.avail === 'Available').length} Active</span>
        </div>
        <div className="flex-1 w-full rounded-xl overflow-hidden relative border border-gray-200">
          <MapComponent userLocation={userLocation} donors={filteredDonors} />
        </div>
      </div>

      {/* Donor List */}
      {requestMessage && (
        <div className="chip chip-green w-fit">{requestMessage}</div>
      )}
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
                  <span className={`chip text-[10px] py-0.5 ${d.status === 'Available' || d.avail === 'Available' ? 'chip-green' : d.status === 'Maybe' || d.avail === 'Maybe' ? 'chip-amber' : 'chip-red'}`}>
                    <span className="chip-dot"></span>{d.status || d.avail || 'Unknown'}
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequestDonation(d);
                    }}
                    disabled={requestLoadingId === d._id}
                    className="flex-1 bg-red hover:bg-red-dark text-white py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    {requestLoadingId === d._id ? 'Sending Request...' : 'Request Donation'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewProfile(d._id);
                    }}
                    className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    View Profile
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeProfile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setActiveProfile(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-4">Donor Profile</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div><span className="font-semibold">Name:</span> {activeProfile.name}</div>
              <div><span className="font-semibold">Blood Group:</span> {activeProfile.bloodGroup}</div>
              <div><span className="font-semibold">Availability:</span> {activeProfile.availability}</div>
              <div><span className="font-semibold">Donations:</span> {activeProfile.donationsCount}</div>
              <div><span className="font-semibold">Score:</span> {activeProfile.score}</div>
              <div><span className="font-semibold">Last Donated:</span> {activeProfile.lastDonated ? new Date(activeProfile.lastDonated).toLocaleDateString('en-IN') : 'N/A'}</div>
              <div><span className="font-semibold">Contact:</span> {activeProfile.contactMasked || 'Private'}</div>
            </div>
            <button onClick={() => setActiveProfile(null)} className="mt-5 w-full bg-red text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-dark transition-colors">Close</button>
          </div>
        </div>
      )}

      {profileLoading && (
        <div className="fixed bottom-4 right-4 chip chip-amber">Loading profile...</div>
      )}
    </div>
  );
}
