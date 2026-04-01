'use client';
import { useState, useEffect } from 'react';
import { Shield, MapPin, Search, Calendar, Activity, Battery, Droplet, ArrowUp, ArrowRight, Clock } from 'lucide-react';

const donorsData = [
  { name: 'Arjun Sharma', meta: '2.4 km · Last donated Feb 2025 · 7 donations', bg: 'B+', score: 94, initials: 'AS', avail: 'Available' },
  { name: 'Priya Kapoor', meta: '3.1 km · Last donated Jan 2025 · 5 donations', bg: 'B+', score: 88, initials: 'PK', avail: 'Available' },
  { name: 'Vikram Mehta', meta: '5.7 km · Last donated Nov 2024 · 12 donations', bg: 'O+', score: 79, initials: 'VM', avail: 'Maybe' },
  { name: 'Deepika Rao', meta: '8.2 km · Last donated Dec 2024 · 3 donations', bg: 'B+', score: 71, initials: 'DR', avail: 'Offline' },
];

export default function PatientDashboard() {
  const [selectedDonor, setSelectedDonor] = useState<number | null>(null);
  const [chatMsgs, setChatMsgs] = useState([
    { sender: 'AI', text: "Hello Rohan! I'm your ThalAI health assistant. I can help with transfusion reminders, thalassemia FAQs, and emotional support. How can I help today?" },
    { sender: 'User', text: "When should I get my next transfusion?" },
    { sender: 'AI', text: "Based on your history, your next transfusion is due **Apr 2** — just 3 days away! Your last Hb was 10.2 g/dL. I've found 4 compatible B+ donors nearby. Shall I send them a request?" }
  ]);
  const [chatInput, setChatInput] = useState('');

  const sendChat = () => {
    if(!chatInput.trim()) return;
    setChatMsgs(prev => [...prev, { sender: 'User', text: chatInput }]);
    setChatInput('');
    setTimeout(() => {
      setChatMsgs(prev => [...prev, { sender: 'AI', text: "I've noted that! I will schedule a reminder. Stay hydrated and prioritize iron-free meals." }]);
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-500">
      <div className="bg-amber-bg text-amber border border-amber/20 px-4 py-3 rounded-[12px] flex items-center gap-3 text-[13px] font-medium">
        <AlertIcon />
        <span>Next transfusion due in <strong>3 days</strong> — 4 compatible donors found nearby. <strong className="underline cursor-pointer ml-1 hover:text-amber/80">Book now →</strong></span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<Shield size={18} />} color="red" val="12" label="Transfusions done" change="↑ On schedule" changeColor="text-green" />
        <StatCard icon={<Users2 size={18} />} color="blue" val="4" label="Donors nearby" change="↑ 2 new today" changeColor="text-green" />
        <StatCard icon={<Activity size={18} />} color="green" val="96%" label="Haemoglobin stable" change="↑ Good range" changeColor="text-green" />
        <StatCard icon={<Calendar size={18} />} color="amber" val="Mar 28" label="Last transfusion" change="Due Apr 2" changeColor="text-red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="card-title">AI Donor Matches</h2>
            <span className="text-red text-xs font-medium cursor-pointer">View all →</span>
          </div>
          <div className="flex gap-2 mb-4">
            <select className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 outline-none"><option>B+</option><option>O+</option></select>
            <select className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 outline-none"><option>Within 10 km</option><option>5 km</option></select>
            <input placeholder="Search donors..." className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-red transition-colors" />
          </div>
          <div className="flex flex-col gap-2">
            {donorsData.map((d, i) => (
              <div key={i} onClick={() => setSelectedDonor(i)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedDonor === i ? 'border-red bg-red-glow/20' : 'border-gray-100 bg-white hover:border-red-light hover:shadow-sm'}`}>
                <div className="w-10 h-10 rounded-full bg-red-glow text-red font-bold text-xs flex items-center justify-center shrink-0">{d.initials}</div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold text-gray-800">{d.name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{d.meta}</div>
                  <div className="mt-1"><span className={`chip text-[9px] py-0.5 ${d.avail === 'Available' ? 'chip-green' : d.avail === 'Maybe' ? 'chip-amber' : 'chip-red'}`}><span className="chip-dot"></span>{d.avail}</span></div>
                </div>
                <div className="text-right shrink-0">
                  <div className="bg-red-glow text-red text-[11px] font-bold px-2 py-1 rounded-md mb-1 inline-block">{d.bg}</div>
                  <div className="text-[15px] font-bold text-green">{d.score}</div>
                  <div className="w-12 h-1 bg-gray-100 rounded-full mt-1 ml-auto overflow-hidden"><div className="h-full bg-green rounded-full" style={{width: `${d.score}%`}}></div></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-5">
            <h2 className="card-title">Transfusion Timeline</h2>
            <span className="text-red text-xs font-medium cursor-pointer">Add record</span>
          </div>
          <div className="relative pl-5 border-l-2 border-gray-100 flex flex-col gap-4">
             <TimelineItem dot="bg-green" date="Mar 28, 2025" title="Transfusion #12" desc="2 units B+ · AIIMS Delhi · Hb 10.2" />
             <TimelineItem dot="bg-green" date="Feb 14, 2025" title="Transfusion #11" desc="2 units B+ · Safdarjung · Hb 9.8" />
             <TimelineItem dot="bg-red animate-sos-pulse" date="Apr 2, 2025" title="Transfusion #13 — DUE" desc="Target: 2 units B+ · Book donor now" highlight />
             <TimelineItem dot="bg-gray-200" date="Apr 25, 2025" title="Transfusion #14" desc="Estimated · 21-day cycle" fade />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
        <div className="card-sm flex flex-col h-[320px]">
          <div className="flex justify-between items-center mb-3">
             <h2 className="card-title">Donor Map — Delhi NCR</h2>
             <span className="chip chip-green"><span className="chip-dot"></span>4 Active</span>
          </div>
          <div className="flex-1 bg-gradient-to-br from-[#EAF0F8] to-[#F0E8E8] rounded-xl border border-gray-200 relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 opacity-40 bg-[linear-gradient(var(--color-gray-200)_1px,transparent_1px),linear-gradient(90deg,var(--color-gray-200)_1px,transparent_1px)] bg-[size:30px_30px]"></div>
            <div className="absolute w-40 h-40 rounded-full border-2 border-dashed border-red/30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
            {/* Map Pins Mock */}
            <div className="w-3.5 h-3.5 rounded-full bg-red border-[3px] border-white shadow-lg absolute z-10" title="You"></div>
            <div className="absolute top-[38%] left-[52%]"><Pin isDonor /></div>
            <div className="absolute top-[55%] left-[42%]"><Pin isDonor /></div>
            <div className="absolute top-[60%] left-[62%]"><Pin isDonor /></div>
          </div>
        </div>

        <div className="card-sm flex flex-col h-[320px]">
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

function StatCard({ icon, color, val, label, change, changeColor }: any) {
  const bg = color === 'red' ? 'bg-red-glow text-red' : color === 'blue' ? 'bg-blue-bg text-blue' : color === 'green' ? 'bg-green-bg text-green' : 'bg-amber-bg text-amber';
  return (
    <div className="bg-white border border-gray-100 rounded-[12px] p-4 relative overflow-hidden">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${bg}`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-800 leading-none mb-1">{val}</div>
      <div className="text-xs text-gray-400 font-medium">{label}</div>
      <div className={`text-[11px] font-medium mt-1.5 ${changeColor}`}>{change}</div>
      <div className="absolute -right-2 -top-2 opacity-5 text-6xl">❤</div>
    </div>
  );
}

function TimelineItem({ dot, date, title, desc, highlight, fade }: any) {
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
const Users2 = ({size}:any) => <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>;
const Pin = ({isDonor}:any) => <div className="absolute -translate-x-1/2 -translate-y-full cursor-pointer hover:scale-110 transition-transform"><div className={`w-5 h-5 rounded-[50%_50%_50%_0] -rotate-45 flex items-center justify-center shadow-md ${isDonor?'bg-blue':'bg-red'}`}><div className="rotate-45 w-1.5 h-1.5 bg-white rounded-full"></div></div></div>;
