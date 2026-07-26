'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useToast } from '@/context/ToastContext';
import { AlertTriangle, UserCircle2, MapPin } from 'lucide-react';

type SOSPayload = {
  sosId: string;
  patientName?: string;
  bloodGroup?: string;
  hospital?: string;
};

function isSOSPayload(value: unknown): value is SOSPayload {
  return Boolean(value && typeof value === 'object' && typeof (value as SOSPayload).sosId === 'string');
}

// Urgent two-tone beep generated in-browser (no audio file dependency, so it
// never silently fails on a missing /alarm.mp3).
function playAlertBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const beep = (startAt: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + startAt + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + 0.36);
    };
    beep(0, 880);
    beep(0.4, 988);
  } catch {
    /* audio not available — non-fatal */
  }
}

export default function SOSPopup() {
  const { socket } = useSocket();
  const { showToast } = useToast();
  const [sosData, setSosData] = useState<SOSPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const activeAlertRef = useRef(false);

  useEffect(() => {
    activeAlertRef.current = Boolean(sosData);
  }, [sosData]);

  useEffect(() => {
    if (!socket) return;

    const handleAlert = (data: unknown) => {
      if (!isSOSPayload(data)) return;
      // Only show if we don't already have an active unhandled alert
      if (!activeAlertRef.current) {
        activeAlertRef.current = true;
        setSosData(data);
        setTimeLeft(30);
        setError(null);
        playAlertBeep();
      }
    };

    socket.on('sos-alert', handleAlert);

    return () => {
      socket.off('sos-alert', handleAlert);
    };
  }, [socket]);

  const handleResponse = useCallback(async (status: 'accepted' | 'rejected') => {
    if (!sosData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sos/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // auth via the httpOnly session cookie
        body: JSON.stringify({ sosId: sosData.sosId, response: status }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to respond. Please try again.');
        return;
      }

      // Only clear on success
      activeAlertRef.current = false;
      setSosData(null);
      setError(null);

      // Booking confirmation to the donor who just accepted (previously they got
      // nothing in-app — the confirmation email is skipped unless SMTP is set up).
      if (status === 'accepted') {
        showToast('✅ You accepted the request. The patient has been notified — thank you for saving a life! 🩸', 'success', 8000);
      }
    } catch (err) {
      console.error('Failed to respond to SOS', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [sosData, showToast]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sosData && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (sosData && timeLeft === 0) {
      // Auto-ignore if timeout reached
      handleResponse('rejected');
    }
    return () => clearTimeout(timer);
  }, [handleResponse, sosData, timeLeft]);

  return (
    <AnimatePresence>
      {sosData && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            className="bg-zinc-950 border border-red/40 rounded-[2rem] shadow-[0_0_80px_rgba(220,38,38,0.4)] w-[400px] overflow-hidden text-center"
          >
            <div className="bg-gradient-to-b from-red/30 to-transparent pt-8 pb-4">
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-20 h-20 bg-red rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(220,38,38,0.8)]"
              >
                <AlertTriangle size={36} className="text-white" />
              </motion.div>
              <h2 className="text-3xl font-black text-white tracking-wider uppercase">Emergency SOS</h2>
              <p className="text-red-400 font-medium tracking-widest mt-1">URGENT BLOOD REQUIRED</p>
            </div>

            <div className="px-8 py-6 space-y-6">
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2 text-white/70">
                    <UserCircle2 size={18} />
                    <span className="text-sm">Patient</span>
                  </div>
                  <div className="font-bold text-white tracking-wide">{sosData.patientName}</div>
                </div>
                
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2 text-white/70">
                    <span className="text-sm font-medium pl-1">Blood Group</span>
                  </div>
                  <div className="font-black text-2xl text-red">{sosData.bloodGroup}</div>
                </div>

                <div className="flex justify-between items-center pt-1 text-left">
                  <div className="flex items-start gap-2 text-white/70 w-full">
                    <MapPin size={18} className="shrink-0 mt-0.5 text-red-500" />
                    <div className="flex-1 text-sm font-medium text-white/90 leading-snug">
                      {sosData.hospital || 'Nearest Hospital'}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red/20 border border-red/40 text-red-300 text-sm px-4 py-2 rounded-xl">
                  {error}
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => handleResponse('accepted')}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red hover:from-red-500 hover:to-red-400 text-white font-bold py-4 rounded-2xl shadow-xl transition-all shadow-red/20 active:scale-95 disabled:opacity-60"
                >
                  {loading ? 'Confirming...' : 'ACCEPT NOW'}
                </button>
                <button
                  onClick={() => handleResponse('rejected')}
                  disabled={loading}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 font-bold px-6 py-4 rounded-2xl transition-all active:scale-95 text-sm uppercase tracking-wider disabled:opacity-60"
                >
                  Ignore ({timeLeft}s)
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
