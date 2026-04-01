'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronRight, X } from 'lucide-react';

export default function SOSModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [step, setStep] = useState(0);

  const nextStep = () => {
    if (step >= 2) {
      onClose();
      setTimeout(() => setStep(0), 300);
      return;
    }
    setStep(s => s + 1);
  };

  const cancel = () => {
    onClose();
    setTimeout(() => setStep(0), 300);
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
                  {[0, 1, 2].map((i) => (
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
                    <select className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3 outline-none focus:border-red transition-colors text-gray-800 bg-white appearance-none">
                      <option value="">Select Blood Group Required</option>
                      <option>O+ (Universal Donor)</option>
                      <option>B+</option>
                      <option>A+</option>
                      <option>AB+</option>
                    </select>
                    <div className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3 text-gray-800 bg-white flex items-center opacity-80 cursor-not-allowed">
                      📍 Auto-detect location (Delhi, India)
                    </div>
                  </motion.div>
                )}
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                     <h3 className="text-[15px] font-semibold mb-4">Matching Donors...</h3>
                     <div className="text-center py-6">
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-4xl mb-3">🔍</motion.div>
                        <div className="text-sm text-gray-500">AI matching engine active — scanning 1,203 donors...</div>
                     </div>
                     <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-red-glow text-red font-bold flex items-center justify-center text-sm shrink-0">AS</div>
                        <div className="flex-1">
                          <div className="text-[13px] font-bold text-gray-800">Arjun Sharma</div>
                          <div className="text-[11px] text-gray-500">B+ · 2.4 km · ETA 18 min</div>
                        </div>
                        <span className="chip chip-green">Accepted</span>
                     </div>
                  </motion.div>
                )}
                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                     <h3 className="text-[16px] font-bold text-green flex items-center gap-2 mb-4"><CheckCircle2 size={18} /> SOS Alert Sent Successfully!</h3>
                     <div className="bg-green-bg text-green px-4 py-3 rounded-xl text-[13px] font-medium mb-5">
                       2 donors notified · WhatsApp alerts sent · Hospital informed
                     </div>
                     <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-glow text-red font-bold flex items-center justify-center text-sm shrink-0">AS</div>
                        <div className="flex-1">
                          <div className="text-[13px] font-bold text-gray-800">Arjun Sharma</div>
                          <div className="text-[11px] text-gray-500">En route to AIIMS Delhi · ETA 18 min</div>
                        </div>
                        <span className="chip chip-green">Accepted ✓</span>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              {step < 2 && <button onClick={cancel} className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium rounded-xl transition-colors">Cancel</button>}
              <button onClick={nextStep} className="flex-1 py-3 bg-red hover:bg-red-dark text-white font-semibold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2">
                {step === 0 ? '🚨 Send SOS Alert' : step === 1 ? 'Confirm & Notify All' : 'Done'}
                {step < 2 && <ChevronRight size={16} />}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
