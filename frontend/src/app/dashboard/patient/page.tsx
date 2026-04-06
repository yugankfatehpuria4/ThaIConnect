'use client';
import { useState, useEffect } from 'react';
import { Shield, Calendar, Activity, ArrowUp } from 'lucide-react';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false });
const DASHBOARD_RENDER_REFERENCE_TIME = Date.now();

import { useSocket } from '@/context/SocketContext';

type SosAcceptedPayload = {
  donorName?: string;
};

type DonorMatch = {
  _id: string;
  name: string;
  bloodGroup?: string;
  distance?: number | string;
  lastDonated?: string;
  donationCount?: number;
  status?: 'Available' | 'Maybe' | 'Offline';
  initials?: string;
  score?: number;
  location?: { coordinates: [number, number] };
};

type TimelineEntry = {
  date: string;
  hb: number;
  units: number;
  hospital: string;
};

type TimelineResponse = {
  lastTransfusion: string;
  avgCycle: number;
  nextTransfusion: string;
  status: string;
  history: TimelineEntry[];
};

type DashboardMlPrediction = {
  predictions?: {
    predictedHemoglobin?: number;
    urgency?: 'HIGH' | 'NORMAL';
  };
};

export default function PatientDashboard() {
  const { socket } = useSocket();
  const [selectedDonor, setSelectedDonor] = useState<string | null>(null);
  const [chatMsgs, setChatMsgs] = useState([
    { sender: 'AI', text: "Hello Rohan! I'm your ThalAI health assistant. I can help with transfusion reminders, thalassemia FAQs, and emotional support. How can I help today?" },
    { sender: 'User', text: "When should I get my next transfusion?" },
    { sender: 'AI', text: "Based on your history, your next transfusion is due **Apr 2** — just 3 days away! Your last Hb was 10.2 g/dL. I've found 4 compatible B+ donors nearby. Shall I send them a request?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [donors, setDonors] = useState<DonorMatch[]>([]);
  const [bloodFilter, setBloodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mlPrediction, setMlPrediction] = useState<DashboardMlPrediction | null>(null);
  // const [sosAccepts, setSosAccepts] = useState<SosAcceptedPayload[]>([]);

  function fetchTimeline() {
    fetch('/api/patient/timeline', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then(res => res.json())
      .then(data => setTimeline(data))
      .catch(console.error);
  }

  function fetchDonors(lat: number, lng: number) {
    fetch(`/api/donors/nearby?lat=${lat}&lng=${lng}&maxDistance=10000`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDonors(data);
        }
      })
      .catch(console.error);
  }

  useEffect(() => {
    if (!socket) return;
    
    const handleAccepted = (data: SosAcceptedPayload) => {
      console.log('Donor Acceptance Recieved:', data);
      // setSosAccepts(prev => [...prev, data]);
      alert(`Fantastic news! ${data.donorName || 'A brave donor'} has accepted your URGENT SOS blood request. They will be in touch shortly.`);
    };

    socket.on('sos-accepted', handleAccepted);

    return () => {
      socket.off('sos-accepted', handleAccepted);
    };
  }, [socket]);

  useEffect(() => {
    fetchTimeline();

    // Use a separate callback to avoid synchronous setState in effect
    const setupLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserLocation(location);
            fetchDonors(location.lat, location.lng);
          },
          () => {
            const fallback = { lat: 28.6139, lng: 77.2090 };
            setUserLocation(fallback);
            fetchDonors(fallback.lat, fallback.lng);
          }
        );
      } else {
        const fallback = { lat: 28.6139, lng: 77.2090 };
        setUserLocation(fallback);
        fetchDonors(fallback.lat, fallback.lng);
      }
    };
    
    setupLocation();
  }, []);

  useEffect(() => {
    let mounted = true;

    const latestHistory = timeline?.history?.length
      ? timeline.history[timeline.history.length - 1]
      : null;

    const requestBody = {
      age: 24,
      gender: 'Female',
      hemoglobin: latestHistory?.hb ?? 9.0,
      platelets: 168,
      ferritin: 1200,
      mcv: 82,
      mch: 27,
      mchc: 32,
      avg_cycle_days: timeline?.avgCycle ?? 21,
    };

    fetch('/api/patient/predictions/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
      .then((response) => response.json())
      .then((data) => {
        if (mounted) {
          setMlPrediction(data as DashboardMlPrediction);
        }
      })
      .catch(() => {
        if (mounted) {
          setMlPrediction(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [timeline]);

  const addTransfusion = () => {
    fetch('/api/patient/timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hb: 11.0, units: 1, hospital: 'Local Clinic' })
    })
      .then(res => res.json())
      .then(() => fetchTimeline())
      .catch(console.error);
  };

  const sendChat = () => {
    if(!chatInput.trim()) return;
    setChatMsgs(prev => [...prev, { sender: 'User', text: chatInput }]);
    setChatInput('');
    setTimeout(() => {
      setChatMsgs(prev => [...prev, { sender: 'AI', text: "I've noted that! I will schedule a reminder. Stay hydrated and prioritize iron-free meals." }]);
    }, 1200);
  };

  const filteredDonors = donors.filter((donor) => {
    const bloodMatches = bloodFilter === 'all' || donor.bloodGroup === bloodFilter;
    const query = searchQuery.trim().toLowerCase();
    const searchMatches = query.length === 0 || donor.name.toLowerCase().includes(query);
    return bloodMatches && searchMatches;
  });

  const donorBloodGroups = ['all', ...new Set(donors.map((entry) => entry.bloodGroup).filter(Boolean))] as string[];

  const diffDays = timeline ? Math.ceil((new Date(timeline.nextTransfusion).getTime() - DASHBOARD_RENDER_REFERENCE_TIME) / (1000 * 3600 * 24)) : 0;
  const daysLabel = diffDays >= 0 ? `${diffDays} days` : `${Math.abs(diffDays)} days overdue`;
  const lastDonationDay = timeline ? new Date(timeline.lastTransfusion).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A';
  const nextDonationDay = timeline ? new Date(timeline.nextTransfusion).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A';
  const transfusionCount = timeline?.history?.length || 0;
  const donorsNearbyCount = filteredDonors.length;
  const latestHb = timeline?.history?.length ? timeline.history[timeline.history.length - 1].hb : null;
  const predictedHb = mlPrediction?.predictions?.predictedHemoglobin ?? latestHb;
  const hbUrgency = mlPrediction?.predictions?.urgency ?? (predictedHb != null && predictedHb < 9 ? 'HIGH' : 'NORMAL');

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-500">
      <div className="bg-amber-bg text-amber border border-amber/20 px-4 py-3 rounded-sm flex items-center gap-3 text-[13px] font-medium">
        <AlertIcon />
        <span>Next transfusion due in <strong>{daysLabel}</strong> — {donorsNearbyCount} compatible donors found nearby. <strong className="underline cursor-pointer ml-1 hover:text-amber/80">Book now →</strong></span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<Shield size={18} />} color="red" val={transfusionCount} label="Transfusions done" change={timeline?.status || 'On schedule'} changeColor={timeline?.status === 'Overdue' ? 'text-red' : 'text-green'} />
        <StatCard icon={<Users2 size={18} />} color="blue" val={donorsNearbyCount} label="Donors nearby" change={donorsNearbyCount > 0 ? 'Live nearby matches' : 'No matches nearby'} changeColor={donorsNearbyCount > 0 ? 'text-green' : 'text-red'} />
        <StatCard icon={<Activity size={18} />} color="green" val={predictedHb != null ? `${predictedHb.toFixed(1)} g/dL` : 'N/A'} label="Haemoglobin (ML)" change={hbUrgency === 'HIGH' ? 'High risk (model)' : 'Stable range (model)'} changeColor={hbUrgency === 'HIGH' ? 'text-red' : 'text-green'} />
        <StatCard icon={<Calendar size={18} />} color="amber" val={lastDonationDay} label="Last transfusion" change={`Due ${nextDonationDay}`} changeColor="text-red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">AI Donor Matches</h2>
            <span className="text-red text-xs font-medium cursor-pointer">View all →</span>
          </div>
          <div className="flex gap-2 mb-4">
            <select value={bloodFilter} onChange={(e) => setBloodFilter(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 outline-none">
              {donorBloodGroups.map((group) => (
                <option key={group} value={group}>{group === 'all' ? 'All Groups' : group}</option>
              ))}
            </select>
            <select className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 outline-none"><option>Within 10 km</option></select>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search donors..." className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-red transition-colors" />
          </div>
          <div className="flex flex-col gap-2">
            {filteredDonors.map((d) => (
              <div key={d._id} onClick={() => setSelectedDonor(d._id)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedDonor === d._id ? 'border-red bg-red-glow/20' : 'border-gray-100 bg-white hover:border-red-light hover:shadow-sm'}`}>
                <div className="w-10 h-10 rounded-full bg-red-glow text-red font-bold text-xs flex items-center justify-center shrink-0">{d.initials || d.name.slice(0, 2).toUpperCase()}</div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold text-gray-800">{d.name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{d.distance || '—'} km · Last donated {d.lastDonated ? new Date(d.lastDonated).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'} · {d.donationCount || 0} donations</div>
                  <div className="mt-1"><span className={`chip text-[9px] py-0.5 ${d.status === 'Available' ? 'chip-green' : d.status === 'Maybe' ? 'chip-amber' : 'chip-red'}`}><span className="chip-dot"></span>{d.status || 'Unknown'}</span></div>
                </div>
                <div className="text-right shrink-0">
                  <div className="bg-red-glow text-red text-[11px] font-bold px-2 py-1 rounded-md mb-1 inline-block">{d.bloodGroup || 'N/A'}</div>
                  <div className="text-[15px] font-bold text-green">{d.score || 0}</div>
                  <div className="w-12 h-1 bg-gray-100 rounded-full mt-1 ml-auto overflow-hidden"><div className="h-full bg-green rounded-full" style={{width: `${d.score || 0}%`}}></div></div>
                </div>
              </div>
            ))}
            {filteredDonors.length === 0 && (
              <div className="text-xs text-gray-500 py-4 text-center">No nearby donors match your filters.</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-5">
            <h2 className="card-title">Transfusion Timeline</h2>
            <span className="text-red text-xs font-medium cursor-pointer" onClick={addTransfusion}>Add record</span>
          </div>
          <div className="relative pl-5 border-l-2 border-gray-100 flex flex-col gap-4">
            {timeline?.history ? timeline.history.map((t, i) => (
              <TimelineItem key={i} dot="bg-green" date={new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} title={`Transfusion #${i + 1}`} desc={`${t.units} units · ${t.hospital} · Hb ${t.hb}`} />
            )) : (
              <>
               <TimelineItem dot="bg-green" date="Mar 28, 2025" title="Transfusion #12" desc="2 units B+ · AIIMS Delhi · Hb 10.2" />
               <TimelineItem dot="bg-green" date="Feb 14, 2025" title="Transfusion #11" desc="2 units B+ · Safdarjung · Hb 9.8" />
              </>
            )}
            {timeline?.nextTransfusion ? (
              <TimelineItem dot="bg-red animate-sos-pulse" date={new Date(timeline.nextTransfusion).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} title={`Transfusion #${(timeline.history?.length || 0) + 1} — ${(timeline.status || 'pending').toUpperCase()}`} desc={`Target: 2 units B+ · Cycle: ${timeline.avgCycle} days`} highlight />
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
        <div className="card-sm flex flex-col h-80">
          <div className="flex justify-between items-center mb-3 shrink-0">
             <h2 className="card-title">Nearby Donors Map</h2>
             <span className="chip chip-green"><span className="chip-dot"></span>{filteredDonors.filter((entry) => entry.status === 'Available').length} Active</span>
          </div>
          <div className="flex-1 w-full rounded-xl overflow-hidden relative border border-gray-200">
            <MapComponent userLocation={userLocation} donors={filteredDonors} />
          </div>
        </div>

        <div className="card-sm flex flex-col h-80">
          <div className="flex justify-between items-center mb-3 border-b border-gray-50 pb-2">
             <h2 className="card-title flex items-center gap-2"><span>AI Health Assistant</span><span className="chip chip-green text-[10px]"><span className="chip-dot"></span>Online</span></h2>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 pb-2 flex flex-col gap-3">
             {chatMsgs.map((msg, i) => (
               <div key={i} className={`flex gap-2 max-w-[85%] ${msg.sender === 'User' ? 'ml-auto flex-row-reverse' : ''}`}>
                 <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${msg.sender === 'User' ? 'bg-blue-bg text-blue' : 'bg-red-glow text-red'}`}>{msg.sender === 'User' ? 'R' : 'AI'}</div>
                 <div className={`p-2.5 rounded-xl text-[13px] leading-relaxed ${msg.sender === 'User' ? 'bg-red text-white' : 'bg-gray-50 text-gray-800 border border-gray-100'}`}>
                    {msg.text.includes('**') ? <span dangerouslySetInnerHTML={{__html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}}></span> : msg.text}
                 </div>
               </div>
             ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Ask about thalassemia, diet..." className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-red transition-colors" />
            <button onClick={sendChat} className="w-9 h-9 bg-red text-white flex items-center justify-center rounded-xl hover:bg-red-dark transition-colors"><ArrowUp size={16}/></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, color, val, label, change, changeColor }: { icon: React.ReactNode; color: string; val: number | string; label: string; change: string; changeColor: string }) {
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

function TimelineItem({ dot, date, title, desc, highlight, fade }: { dot: string; date: string; title: React.ReactNode; desc?: string; highlight?: boolean; fade?: boolean }) {
  return (
    <div className="relative">
      <div className={`absolute -left-6.75 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-[0_0_0_2px_var(--color-red-light)] ${dot}`}></div>
      <div className="text-[11px] text-gray-400 font-medium">{date}</div>
      <div className={`text-[13px] font-semibold mt-0.5 ${highlight ? 'text-red' : fade ? 'text-gray-400' : 'text-gray-800'}`}>{title}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{desc}</div>
    </div>
  );
}

const AlertIcon = () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/></svg>;
const Users2 = ({size}:{ size: number }) => <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>;
// const Pin = ({isDonor}:{ isDonor: boolean }) => <div className="absolute -translate-x-1/2 -translate-y-full cursor-pointer hover:scale-110 transition-transform"><div className={`w-5 h-5 rounded-[50%_50%_50%_0] -rotate-45 flex items-center justify-center shadow-md ${isDonor?'bg-blue':'bg-red'}`}><div className="rotate-45 w-1.5 h-1.5 bg-white rounded-full"></div></div></div>;
