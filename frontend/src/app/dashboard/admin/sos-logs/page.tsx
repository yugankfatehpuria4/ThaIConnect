'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Clock, Mail, Radio } from 'lucide-react';

type DeliveryLog = {
  sosId: string;
  requestType: 'sos' | 'direct';
  bloodGroup: string;
  hospital: string;
  status: 'active' | 'resolved' | 'expired';
  patientName: string;
  targetedDonorName: string | null;
  acceptedDonorName: string | null;
  channel: string;
  event: string;
  recipientEmail: string | null;
  statusDelivery: 'sent' | 'failed' | 'skipped';
  reason: string | null;
  createdAt: string;
};

export default function AdminSOSLogsPage() {
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = () => {
    setLoading(true);
    fetch('/api/admin/sos-delivery-logs', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.logs)) {
          setLogs(data.logs);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 0);
    return () => clearTimeout(timer);
  }, []);

  const sentCount = logs.filter((item) => item.statusDelivery === 'sent').length;
  const failedCount = logs.filter((item) => item.statusDelivery === 'failed').length;
  const skippedCount = logs.filter((item) => item.statusDelivery === 'skipped').length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">SOS Delivery Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Track socket/email delivery status for SOS notifications</p>
        </div>
        <button onClick={fetchLogs} className="bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Refresh Logs
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<CheckCircle2 size={18} />} title="Sent" value={sentCount} color="text-green" />
        <StatCard icon={<AlertCircle size={18} />} title="Failed" value={failedCount} color="text-red" />
        <StatCard icon={<Clock size={18} />} title="Skipped" value={skippedCount} color="text-amber" />
      </div>

      {loading ? (
        <div className="card text-center py-10 text-sm text-gray-500">Loading SOS delivery logs...</div>
      ) : logs.length === 0 ? (
        <div className="card text-center py-10 text-sm text-gray-500">No SOS delivery logs found.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="text-[11px] text-gray-400 uppercase border-b border-gray-100">
              <tr>
                <th className="pb-3 font-semibold">Time</th>
                <th className="pb-3 font-semibold">Request</th>
                <th className="pb-3 font-semibold">Patient</th>
                <th className="pb-3 font-semibold">Channel</th>
                <th className="pb-3 font-semibold">Recipient</th>
                <th className="pb-3 font-semibold">Delivery</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {logs.map((log, index) => (
                <tr key={`${log.sosId}-${index}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3">{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                  <td className="py-3">
                    <div className="font-semibold">{log.requestType.toUpperCase()} · {log.bloodGroup}</div>
                    <div className="text-[11px] text-gray-400">{log.hospital}</div>
                  </td>
                  <td className="py-3">
                    <div>{log.patientName}</div>
                    <div className="text-[11px] text-gray-400">{log.targetedDonorName ? `Targeted: ${log.targetedDonorName}` : 'Open broadcast'}</div>
                  </td>
                  <td className="py-3">
                    <span className={`chip ${log.channel === 'email' ? 'chip-blue' : 'chip-green'}`}>
                      {log.channel === 'email' ? <Mail size={12} /> : <Radio size={12} />} {log.channel}
                    </span>
                  </td>
                  <td className="py-3">{log.recipientEmail || 'User notification'}</td>
                  <td className="py-3">
                    <span className={`chip ${log.statusDelivery === 'sent' ? 'chip-green' : log.statusDelivery === 'failed' ? 'chip-red' : 'chip-amber'}`}>
                      {log.statusDelivery}
                    </span>
                    {log.reason ? <div className="text-[10px] text-gray-400 mt-1">{log.reason}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, title, value, color }: { icon: ReactNode; title: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-sm p-4">
      <div className="flex items-center gap-2 text-gray-500 mb-2">{icon}<span className="text-xs font-medium">{title}</span></div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
