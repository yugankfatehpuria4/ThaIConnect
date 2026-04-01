'use client';
import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, MapPin, Phone, ChevronDown } from 'lucide-react';

type SOSAlert = {
  _id: string;
  bloodGroupRequired: string;
  hospital: string;
  status: 'pending' | 'accepted' | 'resolved';
  createdAt: string;
  patientId?: { name?: string; bloodGroup?: string } | null;
};

const mockAlerts: SOSAlert[] = [
  { _id: '1', bloodGroupRequired: 'B+', hospital: 'AIIMS Delhi', status: 'resolved', createdAt: '2025-03-25T10:30:00Z', patientId: { name: 'Rohan M.', bloodGroup: 'B+' } },
  { _id: '2', bloodGroupRequired: 'B+', hospital: 'Safdarjung Hospital', status: 'resolved', createdAt: '2025-03-10T14:15:00Z', patientId: { name: 'Rohan M.', bloodGroup: 'B+' } },
  { _id: '3', bloodGroupRequired: 'B+', hospital: 'AIIMS Delhi', status: 'accepted', createdAt: '2025-02-20T09:00:00Z', patientId: { name: 'Rohan M.', bloodGroup: 'B+' } },
  { _id: '4', bloodGroupRequired: 'B+', hospital: 'Apollo Delhi', status: 'resolved', createdAt: '2025-01-15T11:45:00Z', patientId: { name: 'Rohan M.', bloodGroup: 'B+' } },
];

const statusConfig = {
  pending: { label: 'Pending', chipClass: 'chip-amber', icon: <Clock size={12} /> },
  accepted: { label: 'Accepted', chipClass: 'chip-blue', icon: <CheckCircle2 size={12} /> },
  resolved: { label: 'Resolved', chipClass: 'chip-green', icon: <CheckCircle2 size={12} /> },
};

export default function SOSHistoryPage() {
  const [alerts, setAlerts] = useState<SOSAlert[]>(mockAlerts);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sos')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setAlerts(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: alerts.length,
    resolved: alerts.filter(a => a.status === 'resolved').length,
    pending: alerts.filter(a => a.status === 'pending').length,
    avgResponse: '18 min',
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">SOS History</h1>
        <p className="text-sm text-gray-500 mt-1">Track all your emergency blood requests and their statuses</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-[12px] p-4">
          <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
          <div className="text-xs text-gray-400 font-medium">Total SOS Alerts</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-[12px] p-4">
          <div className="text-2xl font-bold text-green">{stats.resolved}</div>
          <div className="text-xs text-gray-400 font-medium">Resolved</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-[12px] p-4">
          <div className="text-2xl font-bold text-amber">{stats.pending}</div>
          <div className="text-xs text-gray-400 font-medium">Pending</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-[12px] p-4">
          <div className="text-2xl font-bold text-blue">{stats.avgResponse}</div>
          <div className="text-xs text-gray-400 font-medium">Avg. Response Time</div>
        </div>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-red-glow border-t-red rounded-full animate-spin"></div>
          <span className="ml-3 text-sm text-gray-500">Loading SOS history...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map(alert => {
            const config = statusConfig[alert.status];
            const isExpanded = expanded === alert._id;
            return (
              <div key={alert._id} className="card hover:shadow-md transition-shadow">
                <div
                  className="flex items-center gap-4 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : alert._id)}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${alert.status === 'resolved' ? 'bg-green-bg text-green' : alert.status === 'accepted' ? 'bg-blue-bg text-blue' : 'bg-amber-bg text-amber'}`}>
                    <AlertCircle size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-gray-800">Emergency Blood Request</span>
                      <span className="bg-red-glow text-red text-[11px] font-bold px-2 py-0.5 rounded-md">{alert.bloodGroupRequired}</span>
                    </div>
                    <div className="text-[12px] text-gray-400 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1"><MapPin size={12} /> {alert.hospital}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(alert.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`chip ${config.chipClass}`}>{config.icon} {config.label}</span>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400 text-xs font-medium mb-1">Blood Group Required</div>
                        <div className="font-semibold text-gray-800">{alert.bloodGroupRequired}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-medium mb-1">Hospital</div>
                        <div className="font-semibold text-gray-800">{alert.hospital}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-medium mb-1">Created At</div>
                        <div className="font-semibold text-gray-800">{new Date(alert.createdAt).toLocaleString('en-IN')}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-medium mb-1">Status</div>
                        <div className="font-semibold text-gray-800 capitalize">{alert.status}</div>
                      </div>
                    </div>
                    {alert.status === 'resolved' && (
                      <div className="mt-3 bg-green-bg text-green px-3 py-2 rounded-lg text-[12px] font-semibold">
                        ✅ Donor responded in ~18 min. Blood delivered successfully.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
