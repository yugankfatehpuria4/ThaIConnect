'use client';
import { useState } from 'react';
import { Calendar, Clock, MapPin, Plus, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';

type Appointment = {
  id: string;
  date: string;
  time: string;
  type: 'transfusion' | 'checkup' | 'consultation';
  hospital: string;
  doctor?: string;
  status: 'completed' | 'upcoming' | 'overdue';
  notes?: string;
};

const mockAppointments: Appointment[] = [
  { id: '1', date: '2025-03-28', time: '10:00 AM', type: 'transfusion', hospital: 'AIIMS Delhi', doctor: 'Dr. Sharma', status: 'completed', notes: '2 units B+ · Hb post: 10.2 g/dL' },
  { id: '2', date: '2025-04-02', time: '09:30 AM', type: 'transfusion', hospital: 'AIIMS Delhi', doctor: 'Dr. Sharma', status: 'upcoming', notes: '2 units B+ required' },
  { id: '3', date: '2025-04-05', time: '02:00 PM', type: 'checkup', hospital: 'Safdarjung Hospital', doctor: 'Dr. Kapoor', status: 'upcoming' },
  { id: '4', date: '2025-04-15', time: '11:00 AM', type: 'consultation', hospital: 'Apollo Delhi', doctor: 'Dr. Mehta', status: 'upcoming', notes: 'Iron chelation review' },
  { id: '5', date: '2025-04-25', time: '10:00 AM', type: 'transfusion', hospital: 'AIIMS Delhi', doctor: 'Dr. Sharma', status: 'upcoming', notes: 'Estimated · 21-day cycle' },
  { id: '6', date: '2025-03-07', time: '10:00 AM', type: 'transfusion', hospital: 'AIIMS Delhi', doctor: 'Dr. Sharma', status: 'completed', notes: '2 units B+ · Hb post: 9.8 g/dL' },
  { id: '7', date: '2025-02-14', time: '10:00 AM', type: 'transfusion', hospital: 'Safdarjung Hospital', status: 'completed', notes: '2 units B+ · Hb post: 10.1 g/dL' },
];

const typeConfig = {
  transfusion: { label: 'Transfusion', color: 'chip-red', icon: '🩸' },
  checkup: { label: 'Health Checkup', color: 'chip-blue', icon: '🔬' },
  consultation: { label: 'Consultation', color: 'chip-green', icon: '🩺' },
};

export default function SchedulePage() {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [showAdd, setShowAdd] = useState(false);

  const upcoming = mockAppointments.filter(a => a.status === 'upcoming');
  const nextAppointment = upcoming[0];

  const filteredAppointments = mockAppointments.filter(a => filter === 'all' || a.status === filter);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Schedule</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your transfusion schedule and appointments</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-red hover:bg-red-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Add Appointment
        </button>
      </div>

      {/* Next Appointment Banner */}
      {nextAppointment && (
        <div className="bg-gradient-to-r from-red to-red-dark text-white rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="relative z-10">
            <div className="text-xs font-semibold opacity-80 uppercase tracking-wider mb-2">Next Appointment</div>
            <div className="text-2xl font-bold mb-1">
              {new Date(nextAppointment.date).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm opacity-90">
              <span className="flex items-center gap-1.5"><Clock size={14} /> {nextAppointment.time}</span>
              <span className="flex items-center gap-1.5"><MapPin size={14} /> {nextAppointment.hospital}</span>
              {nextAppointment.doctor && <span>with {nextAppointment.doctor}</span>}
            </div>
            {nextAppointment.notes && (
              <div className="mt-3 bg-white/15 backdrop-blur-sm px-3 py-2 rounded-lg text-sm">{nextAppointment.notes}</div>
            )}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-[12px] p-4">
          <div className="text-2xl font-bold text-gray-800">{upcoming.length}</div>
          <div className="text-xs text-gray-400 font-medium">Upcoming Appointments</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-[12px] p-4">
          <div className="text-2xl font-bold text-gray-800">{mockAppointments.filter(a => a.status === 'completed').length}</div>
          <div className="text-xs text-gray-400 font-medium">Completed This Year</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-[12px] p-4">
          <div className="text-2xl font-bold text-red">21 Days</div>
          <div className="text-xs text-gray-400 font-medium">Average Cycle Duration</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'upcoming', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f ? 'bg-red text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Appointments List */}
      <div className="flex flex-col gap-3">
        {filteredAppointments.map(apt => {
          const config = typeConfig[apt.type];
          return (
            <div key={apt.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-50 rounded-xl flex flex-col items-center justify-center shrink-0 border border-gray-100">
                  <span className="text-lg leading-none">{config.icon}</span>
                  <span className="text-[9px] text-gray-400 font-bold mt-0.5">{new Date(apt.date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-gray-800">{config.label}</span>
                    <span className={`chip text-[10px] py-0.5 ${config.color}`}>
                      <span className="chip-dot"></span>{apt.type}
                    </span>
                  </div>
                  <div className="text-[12px] text-gray-400 mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(apt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="flex items-center gap-1"><Clock size={11} /> {apt.time}</span>
                    <span className="flex items-center gap-1"><MapPin size={11} /> {apt.hospital}</span>
                  </div>
                  {apt.notes && <div className="text-[12px] text-gray-500 mt-1.5 bg-gray-50 px-2 py-1 rounded-md inline-block">{apt.notes}</div>}
                </div>
                <div className="shrink-0">
                  {apt.status === 'completed' ? (
                    <span className="chip chip-green"><CheckCircle2 size={12} /> Done</span>
                  ) : (
                    <span className="chip chip-amber"><AlertCircle size={12} /> Upcoming</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Appointment Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-4">Add Appointment</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Type</label>
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red bg-white">
                  <option>Transfusion</option>
                  <option>Health Checkup</option>
                  <option>Consultation</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Date</label>
                <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Hospital</label>
                <input placeholder="e.g. AIIMS Delhi" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
                <textarea placeholder="Optional notes..." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red resize-none h-20" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-gray-50 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-red text-white rounded-xl text-sm font-semibold hover:bg-red-dark transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
