'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  Activity, 
  Droplet, 
  Brain, 
  Info, 
  ChevronRight, 
  ArrowUpRight, 
  Calendar,
  AlertTriangle,
  Zap,
  BarChart3,
  Clock,
  ShieldCheck,
  Stethoscope
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────
   MOCK DATA & UTILS
   ────────────────────────────────────────────────────────── */
const hbData = [
  { date: 'Jan 10', level: 9.8, type: 'actual' },
  { date: 'Jan 31', level: 10.1, type: 'actual' },
  { date: 'Feb 21', level: 9.5, type: 'actual' },
  { date: 'Mar 14', level: 10.4, type: 'actual' },
  { date: 'Apr 04', level: 9.2, type: 'actual' },
  { date: 'Apr 25', level: 8.8, type: 'predicted' },
  { date: 'May 16', level: 10.2, type: 'predicted' },
];

const compatibilityScores = [
  { factor: 'Genetic Matching', score: 98, weight: 'Critical' },
  { factor: 'Recent Health History', score: 92, weight: 'High' },
  { factor: 'Blood Antigen Match', score: 100, weight: 'High' },
  { factor: 'Distance Compatibility', score: 75, weight: 'Medium' },
];

/* ──────────────────────────────────────────────────────────
   CUSTOM SVG CHART
   ────────────────────────────────────────────────────────── */
function HbTrendChart() {
  const width = 600;
  const height = 240;
  const padding = 40;
  
  const minLevel = 8;
  const maxLevel = 11;
  const range = maxLevel - minLevel;
  
  const points = hbData.map((d, i) => ({
    x: (i * (width - padding * 2)) / (hbData.length - 1) + padding,
    y: height - ((d.level - minLevel) / range) * (height - padding * 2) - padding,
    ...d
  }));

  const linePath = points
    .filter(p => p.type === 'actual')
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const predictionPath = points
    .filter((p, i) => p.type === 'predicted' || (i > 0 && points[i-1].type === 'actual' && points[i].type === 'predicted'))
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <div className="w-full overflow-x-auto py-4 no-scrollbar">
      <svg width={width} height={height} className="overflow-visible mx-auto">
        {/* Shadow Drop Effect */}
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="4" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.1" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {[8, 9, 10, 11].map((level) => {
          const y = height - ((level - minLevel) / range) * (height - padding * 2) - padding;
          return (
            <g key={level}>
              <line 
                x1={padding} y1={y} x2={width - padding} y2={y} 
                stroke="#F3F4F6" strokeWidth="1" 
              />
              <text x={padding - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-gray-400 font-bold">{level} g/dL</text>
            </g>
          );
        })}

        {/* Actual Line Area (Gradient) */}
        <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%" stopColor="#C0392B" stopOpacity="0.15" />
           <stop offset="100%" stopColor="#C0392B" stopOpacity="0" />
        </linearGradient>

        {/* Actual Line */}
        <motion.path
          d={linePath}
          fill="none"
          stroke="#C0392B"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#shadow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />

        {/* Prediction Line (Dashed) */}
        <motion.path
          d={predictionPath}
          fill="none"
          stroke="#C0392B"
          strokeWidth="3"
          strokeDasharray="8 6"
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1, duration: 1 }}
        />

        {/* Points */}
        {points.map((p, i) => (
          <motion.g 
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 * i + 0.5 }}
          >
            {/* Tooltip trigger area */}
            <circle cx={p.x} cy={p.y} r={12} fill="transparent" className="cursor-pointer" />
            
            <circle 
              cx={p.x} cy={p.y} r={p.type === 'predicted' ? 4 : 6} 
              fill={p.type === 'predicted' ? '#fff' : '#C0392B'} 
              stroke="#C0392B" strokeWidth="2.5" 
            />
            {/* Date Label */}
            <text x={p.x} y={height - 10} textAnchor="middle" className="text-[10px] fill-gray-500 font-bold uppercase tracking-tight">
              {p.date}
            </text>
            {/* Value Label */}
            <text x={p.x} y={p.y - 12} textAnchor="middle" className={`text-[10px] font-bold ${p.type==='predicted'?'fill-gray-400':'fill-red'}`}>
              {p.level}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   MAIN PAGE COMPONENT
   ────────────────────────────────────────────────────────── */
export default function PredictionsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center min-h-125 gap-6"
          >
            <div className="relative">
              <div className="w-16 h-16 border-4 border-red-glow border-t-red rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Brain className="text-red animate-pulse" size={24} />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800">Analyzing Biological Markers</h3>
              <p className="text-gray-500 font-medium mt-2">Connecting to ThalAI Diagnostic Engine...</p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-gray-100">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2">
                  <Zap size={12} fill="currentColor" /> Neural Health Forecasting
                </div>
                <h1 className="text-3xl font-display font-black text-gray-900 tracking-tight">Machine Learning Trends</h1>
                <p className="text-gray-500 font-medium">Predictive diagnostics based on clinical history and real-time markers.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end mr-4">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">System Status</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-green">
                    <span className="w-2 h-2 rounded-full bg-green animate-pulse" /> AI Engine Active
                  </span>
                </div>
                <button className="bg-white hover:bg-gray-50 text-gray-700 font-bold px-6 py-3 rounded-2xl border border-gray-200 shadow-sm transition-all active:scale-95 text-sm">
                  Export Data
                </button>
              </div>
            </div>

            {/* Visual Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Hb Analysis Block */}
              <div className="lg:col-span-2 card bg-white overflow-hidden p-0">
                <div className="p-6 pb-0 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <TrendingUp size={20} className="text-red" /> Hemoglobin Projection
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Based on last 5 transfusion cycles (Clarity: High)</p>
                  </div>
                  <div className="bg-red-glow text-red px-3 py-1.5 rounded-xl text-[11px] font-black tracking-widest uppercase">
                    Alert Mode
                  </div>
                </div>
                
                <HbTrendChart />
                
                <div className="p-6 bg-linear-to-r from-red-glow/10 to-transparent border-t border-gray-50">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red shadow-md border border-red-light/20 shrink-0">
                       <BarChart3 size={24} />
                    </div>
                    <div>
                       <p className="text-sm font-bold text-gray-800 tracking-tight">Predictive Insight #401</p>
                       <p className="text-[13px] text-gray-600 mt-1 leading-relaxed">
                         The model identifies a <strong>consistent cycle duration of 21 days</strong>. Based on current attrition, your Hb will cross the safety threshold of 9.0 g/dL on <span className="text-red font-bold underline decoration-red/30">April 22nd</span>.
                       </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="flex flex-col gap-6">
                 {/* Stability Card */}
                 <div className="card bg-white p-6 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 rounded-full w-24 h-24 bg-gray-50 group-hover:scale-110 transition-transform duration-500" />
                    <div className="relative z-10">
                       <div className="flex justify-between items-center mb-6">
                          <h3 className="card-title text-gray-700">Health Stability</h3>
                          <ShieldCheck className="text-green opacity-40" />
                       </div>
                       <div className="flex items-end gap-2 mb-2">
                          <span className="text-4xl font-black text-gray-900">94</span>
                          <span className="text-lg font-bold text-green mb-1">/ 100</span>
                       </div>
                       <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '94%' }}
                            transition={{ duration: 1.5 }}
                            className="h-full bg-green"
                          />
                       </div>
                       <p className="text-[11px] font-medium text-gray-400 mt-3 italic">
                         "Strong biological response to chelation therapy detected."
                       </p>
                    </div>
                 </div>

                 {/* Urgency Card */}
                 <div className="card bg-white p-6 border-red-light bg-linear-to-br from-white to-red-glow/5">
                    <h3 className="card-title text-gray-700 mb-6">Match Priority</h3>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 flex items-center gap-1.5"><Clock size={14}/> Time Range</span>
                          <span className="font-bold text-gray-800">3-6 Days</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 flex items-center gap-1.5"><Droplet size={14}/> Required units</span>
                          <span className="font-bold text-gray-800">2 Units (B+)</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 flex items-center gap-1.5"><Stethoscope size={14}/> Facility</span>
                          <span className="font-bold text-gray-800">AIIMS Delhi</span>
                       </div>
                    </div>
                    <button className="w-full bg-red text-white font-bold py-3.5 rounded-2xl mt-6 shadow-lg shadow-red/25 hover:shadow-xl hover:shadow-red/35 transition-all active:scale-95 text-xs uppercase tracking-widest">
                       Trigger Match Now
                    </button>
                 </div>
              </div>
            </div>

            {/* Matching Diagnostics & AI Chatbot Interaction */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
               
               {/* Compatibility Diagnostics */}
               <div className="card bg-white p-6">
                 <div className="flex items-center gap-2 mb-6">
                    <div className="w-9 h-9 bg-blue-bg rounded-xl flex items-center justify-center text-blue">
                       <Activity size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Matching Engine 2.0</h3>
                 </div>
                 
                 <div className="space-y-6">
                    {compatibilityScores.map((c, i) => (
                       <div key={i}>
                          <div className="flex justify-between items-center mb-2">
                             <div className="flex flex-col">
                                <span className="text-[13px] font-bold text-gray-800">{c.factor}</span>
                                <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider">{c.weight} priority</span>
                             </div>
                             <span className="text-[15px] font-black text-gray-900">{c.score}%</span>
                          </div>
                          <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100 p-px">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${c.score}%` }}
                               transition={{ delay: i * 0.1 + 1, duration: 1 }}
                               className={`h-full rounded-full ${c.score > 90 ? 'bg-green' : c.score > 75 ? 'bg-blue' : 'bg-amber'}`}
                             />
                          </div>
                       </div>
                    ))}
                 </div>

                 <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex -space-x-3">
                       {[1, 2, 3, 4].map(i => (
                         <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                           {String.fromCharCode(64 + i)}
                         </div>
                       ))}
                    </div>
                    <p className="text-xs text-gray-500 font-medium">4 Highly compatible matches found</p>
                 </div>
               </div>

               {/* AI Neural Summary */}
               <div className="card bg-gray-900 border-none p-8 flex flex-col relative overflow-hidden group">
                  <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-red/10 rounded-full blur-[100px] group-hover:bg-red/20 transition-all duration-700" />
                  <div className="absolute -left-20 -top-20 w-64 h-64 bg-blue/10 rounded-full blur-[100px] group-hover:bg-blue/20 transition-all duration-700" />
                  
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-8">
                       <div className="w-10 h-10 bg-white/10 backdrop-blur-lg rounded-2xl flex items-center justify-center text-white border border-white/10">
                          <Brain size={22} />
                       </div>
                       <div>
                          <h3 className="text-lg font-bold text-white leading-tight">Neural Diagnosis</h3>
                          <p className="text-[11px] text-white/40 font-black uppercase tracking-widest">Active Insight</p>
                       </div>
                    </div>

                    <div className="flex-1 italic text-white/80 text-lg font-display leading-relaxed mb-8">
                      "Analyzing your clinical patterns from the past 6 months, our models detect a <span className="text-red font-bold">92% correlation</span> between your diet and Hb attrition rate. Increasing iron-neutral protein intake by <span className="text-blue font-bold">15%</span> could potentially extend your transfusion cycle by <span className="text-green font-bold">3-4 days</span>."
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                       <div className="flex flex-col">
                          <span className="text-[10px] text-white/30 font-black uppercase tracking-tighter">Model Version</span>
                          <span className="text-sm font-bold text-white/60">GPT-4 Medical v2.1</span>
                       </div>
                       <button className="flex items-center gap-2 text-white font-bold group bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/5 transition-all">
                          Ask AI <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                       </button>
                    </div>
                  </div>
               </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Footer Disclaimer */}
      {!loading && (
        <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl mb-12 border border-gray-100">
           <Info size={16} className="text-gray-400 shrink-0" />
           <p className="text-[11px] text-gray-500 font-medium">
             <strong>Clinical Disclaimer:</strong> Predictions are generated using historical clinical data and biological markers. These insights are intended for support and must be validated by a registered medical professional.
           </p>
        </div>
      )}

      {/* Style Overrides for custom fonts/scrollbars */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
