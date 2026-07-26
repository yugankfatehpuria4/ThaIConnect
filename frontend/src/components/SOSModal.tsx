'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronRight, X, Loader2 } from 'lucide-react';

type SOSModalProps = {
  isOpen: boolean;
  onCloseAction: () => void;
};

const BLOOD_GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

export default function SOSModal({ isOpen, onCloseAction }: SOSModalProps) {
  const [step, setStep] = useState(0);
  const [bloodGroup, setBloodGroup] = useState('');
  const [hospital, setHospital] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [donorsNotified, setDonorsNotified] = useState(0);

  const cancel = () => {
    onCloseAction();
    setTimeout(() => {
      setStep(0);
      setBloodGroup('');
      setHospital('');
      setError(null);
      setLoading(false);
      setDonorsNotified(0);
    }, 300);
  };

  const sendSOS = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // auth via the httpOnly session cookie
        body: JSON.stringify({ hospital, bloodGroup }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send SOS alert. Please try again.');
        setLoading(false);
        return;
      }

      // Use emailDelivery.attempted or parse from message
      const notified =
        data.emailDelivery?.attempted ??
        (typeof data.message === 'string'
          ? parseInt(data.message.match(/(\d+)/)?.[1] || '0', 10)
          : 0);

      setDonorsNotified(notified);
      setStep(1);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    cancel();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={cancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[24px] w-full max-w-125 overflow-hidden shadow-2xl relative z-10"
          >
            <div className="bg-red p-6 text-white flex justify-between items-center">
              <div>
                <div className="text-lg font-bold flex items-center gap-2">
                  <AlertCircle size={22} fill="white" className="text-red" />
                  Emergency SOS
                </div>
                <div className="flex gap-1.5 mt-3">
                  {[0, 1].map((i) => (
                    <div key={i} className={`h-2 rounded-full transition-all duration-300 ${step >= i ? 'bg-white w-6' : 'bg-white/40 w-2'}`} />
                  ))}
                </div>
              </div>
              <button onClick={cancel} className="text-white/80 hover:text-white"><X size={20} /></button>
            </div>

            <div className="p-6">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h3 className="text-[15px] font-semibold mb-4">Confirm Emergency Details</h3>
                    <select
                      value={bloodGroup}
                      onChange={e => setBloodGroup(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3 outline-none focus:border-red transition-colors text-gray-800 bg-white appearance-none"
                    >
                      <option value="">Select Blood Group Required</option>
                      {BLOOD_GROUPS.map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={hospital}
                      onChange={e => setHospital(e.target.value)}
                      placeholder="Hospital name (e.g. AIIMS Delhi)"
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3 outline-none focus:border-red transition-colors text-gray-800 bg-white"
                    />
                    <div className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3 text-gray-800 bg-white flex items-center opacity-80 cursor-not-allowed">
                      📍 Location auto-detected from your profile
                    </div>
                    {error && (
                      <div className="bg-red/10 text-red text-[13px] px-3 py-2 rounded-xl mt-1">
                        {error}
                      </div>
                    )}
                  </motion.div>
                )}
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h3 className="text-[16px] font-bold text-green flex items-center gap-2 mb-4">
                      <CheckCircle2 size={18} /> SOS Sent!
                    </h3>
                    <div className="bg-green-bg text-green px-4 py-3 rounded-xl text-[13px] font-medium mb-5">
                      {donorsNotified > 0
                        ? `${donorsNotified} compatible donor${donorsNotified !== 1 ? 's' : ''} nearby alerted in real time`
                        : 'SOS alert sent · Nearby donors are being notified'}
                    </div>
                    <p className="text-[13px] text-gray-500">
                      You&apos;ll get a notification here the moment a donor accepts. If no one accepts within 30 seconds, the request is auto-escalated.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              {step === 0 && (
                <button onClick={cancel} className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium rounded-xl transition-colors">
                  Cancel
                </button>
              )}
              {step === 0 ? (
                <button
                  onClick={sendSOS}
                  disabled={loading || !bloodGroup || !hospital.trim()}
                  className="flex-1 py-3 bg-red hover:bg-red-dark text-white font-semibold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      🚨 Send SOS Alert
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleDone}
                  className="flex-1 py-3 bg-red hover:bg-red-dark text-white font-semibold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  Done
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
