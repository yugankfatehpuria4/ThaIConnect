'use client';
import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, MapPin, Navigation, Phone, X, Bell } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

type SOSAlert = {
  _id: string;
  bloodGroup: string;
  hospital?: string;
  status: 'active' | 'resolved' | 'expired';
  createdAt: string;
  patientId?: { name?: string; bloodGroup?: string } | null;
};

type SocketSOSPayload = {
  sosId?: string;
  bloodGroup?: string;
  hospital?: string;
};

function isValidMongoId(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value);
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const defaultAlerts: SOSAlert[] = [
  { _id: 'demo1', bloodGroup: 'B+', hospital: 'AIIMS Delhi', status: 'active', createdAt: new Date().toISOString(), patientId: { name: 'Rohan M.', bloodGroup: 'B+' } },
  { _id: 'demo2', bloodGroup: 'O-', hospital: 'Safdarjung Hospital', status: 'active', createdAt: new Date(Date.now() - 1800000).toISOString(), patientId: { name: 'Anita V.', bloodGroup: 'O-' } },
  { _id: 'demo3', bloodGroup: 'A+', hospital: 'Apollo Delhi', status: 'resolved', createdAt: new Date(Date.now() - 86400000).toISOString(), patientId: { name: 'Priya L.', bloodGroup: 'A+' } },
];

export default function SOSAlertsPage() {
  const { socket } = useSocket();
  const [alerts, setAlerts] = useState<SOSAlert[]>(defaultAlerts);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const headers: HeadersInit = { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` };
    fetch('/api/donor/sos-alerts', { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setAlerts(data);
        // if empty, keep defaultAlerts
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Listen for real-time SOS via socket
  useEffect(() => {
    if (!socket) return;
    const handleSOS = (data: SocketSOSPayload) => {
      if (!data?.sosId) return;
      // Convert socket payload to our alert shape
      const newAlert: SOSAlert = {
        _id: data.sosId,
        bloodGroup: data.bloodGroup || 'Unknown',
        hospital: data.hospital,
        status: 'active',
        createdAt: new Date().toISOString(),
        patientId: null,
      };
      setAlerts(prev => [newAlert, ...prev]);
    };
    socket.on('sos-alert', handleSOS);
    return () => { socket.off('sos-alert', handleSOS); };
  }, [socket]);

  const handleAccept = async (id: string) => {
    if (!isValidMongoId(id)) {
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, status: 'resolved' as const } : a));
      return;
    }

    setActionLoading(id);
    try {
      const res = await fetch('/api/sos/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ sosId: id, response: 'accepted' }),
      });
      if (res.ok) {
        setAlerts(prev => prev.map(a => a._id === id ? { ...a, status: 'resolved' as const } : a));
      } else {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        console.warn('Accept response failed:', body?.error || res.statusText);
      }
    } catch (error) {
      console.warn('Accept response failed:', error);
    }
    setActionLoading(null);
  };

  const handleDecline = async (id: string) => {
    if (!isValidMongoId(id)) {
      setAlerts(prev => prev.filter(a => a._id !== id));
      return;
    }

    try {
      const res = await fetch('/api/sos/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ sosId: id, response: 'rejected' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        console.warn('Decline response failed:', body?.error || res.statusText);
      }
    } catch (error) {
      console.warn('Decline response failed:', error);
    }
    setAlerts(prev => prev.filter(a => a._id !== id));
  };

  const pendingAlerts = alerts.filter(a => a.status === 'active');
  const resolvedAlerts = alerts.filter(a => a.status === 'resolved');

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">SOS Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">Respond to emergency blood requests from patients nearby</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip chip-red animate-sos-pulse"><span className="chip-dot"></span>{pendingAlerts.length} Pending</span>
          <span className="chip chip-green"><span className="chip-dot"></span>{resolvedAlerts.length} Resolved</span>
        </div>
      </div>

      {/* Urgent Banner */}
      {pendingAlerts.length > 0 && (
        <div className="bg-red-glow border border-red/20 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 bg-red rounded-xl flex items-center justify-center text-white shrink-0 animate-sos-pulse">
            <Bell size={22} />
          </div>
          <div>
            <div className="text-sm font-bold text-red mb-1">🚨 {pendingAlerts.length} Emergency Request{pendingAlerts.length > 1 ? 's' : ''} Nearby</div>
            <div className="text-xs text-gray-600">Patients are urgently looking for blood donors. Your response can save a life.</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-red-glow border-t-red rounded-full animate-spin"></div>
          <span className="ml-3 text-sm text-gray-500">Loading alerts...</span>
        </div>
      ) : (
        <>
          {/* Pending Alerts */}
          {pendingAlerts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-red" /> Pending Requests ({pendingAlerts.length})
              </h2>
              <div className="flex flex-col gap-3">
                {pendingAlerts.map(alert => (
                  <div key={alert._id} className="card border-red/20 bg-red-glow/5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-red-glow rounded-xl flex items-center justify-center text-red shrink-0">
                        <AlertCircle size={22} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[15px] font-bold text-gray-800">
                            {alert.patientId?.name || 'Patient in Need'}
                          </span>
                          <span className="bg-red text-white text-[11px] font-bold px-2 py-0.5 rounded-md">{alert.bloodGroup}</span>
                          <span className="text-[11px] text-gray-400">{timeAgo(alert.createdAt)}</span>
                        </div>
                        <div className="text-[12px] text-gray-500 flex items-center gap-3 mb-3">
                          <span className="flex items-center gap-1"><MapPin size={12} /> {alert.hospital || 'Nearby Hospital'}</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> Urgent</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAccept(alert._id)}
                            disabled={actionLoading === alert._id}
                            className="bg-red hover:bg-red-dark text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                          >
                            {actionLoading === alert._id ? 'Accepting...' : '✓ Accept & Respond'}
                          </button>
                          <button
                            onClick={() => handleDecline(alert._id)}
                            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolved Alerts */}
          {resolvedAlerts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green" /> Resolved ({resolvedAlerts.length})
              </h2>
              <div className="flex flex-col gap-3">
                {resolvedAlerts.map(alert => (
                  <div key={alert._id} className="card opacity-70">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-bg rounded-xl flex items-center justify-center text-green shrink-0">
                        <CheckCircle2 size={22} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">{alert.patientId?.name || 'Patient'}</span>
                          <span className="bg-green-bg text-green text-[11px] font-bold px-2 py-0.5 rounded-md">{alert.bloodGroup}</span>
                        </div>
                        <div className="text-[12px] text-gray-400 mt-1">{alert.hospital || 'Hospital'} · {timeAgo(alert.createdAt)}</div>
                      </div>
                      <span className="chip chip-green"><span className="chip-dot"></span>Resolved</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alerts.length === 0 && (
            <div className="card text-center py-12">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-gray-500 font-medium">No SOS alerts at the moment.</p>
              <p className="text-gray-400 text-sm mt-1">We'll notify you when a patient near you needs help.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

