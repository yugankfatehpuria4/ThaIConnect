'use client';
import { useState, useEffect, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Users, ShieldCheck, Clock, Activity, Wand2 } from 'lucide-react';

const posts = {
  instagram: '🩸 **Did you know?** Thalassemia affects 100,000+ children born in India every year. Regular blood transfusions are life-saving. Join ThalAI Connect and donate today — your one donation can sustain a child for 3 weeks. 💪 #ThalassemiaAwareness #BloodDonation #ThalAIConnect',
  twitter: 'Every 30 min, a child with thalassemia needs a transfusion in India. Be the hero — register as a donor on ThalAI Connect. Your B+ or O+ blood could be the difference between life and death. 🩸 #DonateBlood #Thalassemia',
  whatsapp: '🙏 Dear friend,\n\nA thalassemia patient near you needs B+ blood urgently.\n\nDonating takes only 30 minutes and can save a life. If you are eligible, please register on ThalAI Connect.\n\nThank you for caring. ❤️'
};

type PlatformType = keyof typeof posts;

export default function AdminDashboard() {
  const [platform, setPlatform] = useState<PlatformType>('instagram');
  const [loading, setLoading] = useState(false);
  const [dbUsers, setDbUsers] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    fetch('/api/donors')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDbUsers(data);
      })
      .catch(console.error);
  }, []);

  const regenerate = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<Users size={18} />} color="red" val="2,847" label="Total users" change="↑ 12% this month" changeColor="text-green" />
        <StatCard icon={<ShieldCheck size={18} />} color="green" val="1,203" label="Verified donors" change="↑ 34 new today" changeColor="text-green" />
        <StatCard icon={<Clock size={18} />} color="amber" val="18" label="Pending verifications" change="Needs review" changeColor="text-red" />
        <StatCard icon={<Activity size={18} />} color="blue" val="97.3%" label="System uptime" change="↑ All systems go" changeColor="text-green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
        <div className="card">
           <div className="flex justify-between items-center mb-5">
              <h2 className="card-title">User Verification Queue</h2>
              <span className="chip chip-red">18 pending</span>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-[13px] text-left">
                <thead className="text-[11px] text-gray-400 uppercase border-b border-gray-100">
                  <tr><th className="pb-3 font-semibold">User</th><th className="pb-3 font-semibold">Role</th><th className="pb-3 font-semibold">Blood Group</th><th className="pb-3 font-semibold">Location</th><th className="pb-3 font-semibold">Action</th></tr>
                </thead>
                <tbody className="text-gray-800">
                  {dbUsers.length > 0 ? (
                    dbUsers.map((u, i) => (
                      <UserRow 
                        key={String(u._id || i)} 
                        name={String(u.name || 'Unknown')} 
                        id={String((u._id as string) || '0000').slice(-4)} 
                        role={u.role && typeof u.role === 'string' ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'Donor'} 
                        color={u.role === 'patient' ? 'amber' : 'blue'} 
                        bg={String(u.bloodGroup || 'N/A')} 
                        loc="India" 
                      />
                    ))
                  ) : (
                    <>
                      <UserRow name="Kavya Nair" id="4291" role="Donor" color="blue" bg="O+" loc="Mumbai" />
                      <UserRow name="Rahul Gupta" id="4292" role="Patient" color="amber" bg="A-" loc="Bengaluru" />
                      <UserRow name="Anjali Singh" id="4293" role="Donor" color="blue" bg="B+" loc="Delhi" />
                      <UserRow name="Deepak Patel" id="4294" role="Donor" color="blue" bg="AB+" loc="Hyderabad" />
                    </>
                  )}
                </tbody>
             </table>
           </div>
        </div>

        <div className="flex flex-col gap-5">
           <div className="card-sm">
             <h2 className="card-title mb-4">Campaign Generator <span className="text-[9px] bg-red text-white px-1.5 py-0.5 rounded-sm ml-1 relative -top-0.5">AI</span></h2>
             <div className="flex gap-2 mb-3 flex-wrap">
               <PlatformTab active={platform} type="instagram" onClick={setPlatform} label="Instagram" />
               <PlatformTab active={platform} type="twitter" onClick={setPlatform} label="Twitter/X" />
               <PlatformTab active={platform} type="whatsapp" onClick={setPlatform} label="WhatsApp" />
             </div>
             <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 min-h-30 text-[13px] leading-relaxed text-gray-600 whitespace-pre-wrap">
               {loading ? (
                 <div className="typing mt-2"><span></span><span></span><span></span></div>
               ) : (
                 <span dangerouslySetInnerHTML={{__html: posts[platform].replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}}></span>
               )}
             </div>
             <button onClick={regenerate} className="mt-3 w-full bg-red text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-red-dark transition-colors flex items-center justify-center gap-1.5">
               <Wand2 size={14}/> Regenerate with AI
             </button>
           </div>

           <div className="card-sm">
              <h2 className="card-title mb-4">System Health</h2>
              <div className="flex flex-col gap-3">
                 <HealthBar label="API Response" val="142ms" pct="88%" color="bg-green" valColor="text-green" />
                 <HealthBar label="Matching Engine" val="Online" pct="100%" color="bg-green" valColor="text-green" />
                 <HealthBar label="AI Assistant" val="Online" pct="100%" color="bg-green" valColor="text-green" />
                 <HealthBar label="SOS System" val="1 Active" pct="75%" color="bg-amber" valColor="text-amber" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function UserRow({name, id, role, color, bg, loc}: { name: string; id: string; role: string; color: string; bg: string; loc: string }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="py-3"><strong>{name}</strong><br/><span className="text-[11px] text-gray-400">ID: #{id}</span></td>
      <td><span className={`chip chip-${color}`}>{role}</span></td>
      <td className="font-semibold text-red">{bg}</td>
      <td>{loc}</td>
      <td>
        <button className="bg-green-bg text-green px-3 py-1 rounded-lg text-[11px] font-bold mr-1 hover:bg-green/20 transition-colors">Verify</button>
        <button className="bg-red-glow text-red px-3 py-1 rounded-lg text-[11px] font-bold hover:bg-red/20 transition-colors">Reject</button>
      </td>
    </tr>
  );
}

type PlatformTabProps = {
  active: PlatformType;
  type: PlatformType;
  onClick: Dispatch<SetStateAction<PlatformType>>;
  label: string;
};

function PlatformTab({active, type, onClick, label}: PlatformTabProps) {
  return (
    <button onClick={() => onClick(type)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active === type ? 'bg-red text-white border-red' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
      {label}
    </button>
  );
}

type HealthBarProps = {
  label: string;
  val: string;
  pct: string;
  color: string;
  valColor: string;
};

function HealthBar({label, val, pct, color, valColor}: HealthBarProps) {
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={`font-semibold ${valColor}`}>{val}</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{width: pct}}></div>
      </div>
    </div>
  );
}

type StatCardProps = {
  icon: ReactNode;
  color: 'red' | 'blue' | 'green' | 'amber';
  val: string;
  label: string;
  change: string;
  changeColor: string;
};

function StatCard({ icon, color, val, label, change, changeColor }: StatCardProps) {
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
