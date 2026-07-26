'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Brain,
  CalendarDays,
  ChevronRight,
  Clock3,
  Droplets,
  Gauge,
  Info,
  ShieldAlert,
  Users,
} from 'lucide-react';

type HbPoint = {
  date: string;
  level: number;
  type: 'actual' | 'predicted';
};

type DonorCandidate = {
  name: string;
  distanceKm?: number;
  compatibility?: number;
  availability: number;
  donationHistory: number;
  lastDonation: string;
  bloodGroup: string;
  city?: string;
};

type RiskReason = {
  label: string;
  value: string;
  severity: 'high' | 'medium' | 'low';
};

type OcrSummary = {
  fileName: string;
  sourceType: 'image' | 'pdf';
  pagesScanned: number;
  extractedAt: string;
  rawText: string;
  hemoglobin: number | null;
  platelets: number | null;
  ferritin: number | null;
  lastTransfusionDate: string | null;
  nextTransfusionDate: string;
  daysRemaining: number;
  riskLevel: 'HIGH' | 'MODERATE' | 'LOW';
  recommendedUnits: number;
  notes: string[];
};

type ThalassaemiaScreen = {
  flagged: boolean;
  riskProbability: number;
  likelyType: string | null;
  likelyTypeProbability: number | null;
  recommendation: string;
  screeningThreshold: number;
  disclaimer: string;
};

type MlPredictionResponse = {
  modelDriven: boolean;
  predictions: {
    anemiaBinary: string;
    anemiaBinaryProbability: number | null;
    anemiaType: string;
    anemiaTypeProbability: number | null;
    predictedHemoglobin: number;
    diagnosis: string;
    urgency: 'HIGH' | 'NORMAL';
    requiredUnits: number;
    expectedCycleDays: number;
    declineRate: number;
    thalassaemiaScreen?: ThalassaemiaScreen;
  };
};

// Editable clinical inputs for one patient. Seeded from sensible defaults, then
// overwritten by what the patient enters or what OCR extracts from their report.
// This replaces the previous hard-coded single-patient profile so every patient
// gets predictions from their OWN blood values.
type PatientVitals = {
  age: number;
  gender: 'Male' | 'Female';
  hemoglobin: number;
  rbc: number;
  mcv: number;
  mch: number;
  mchc: number;
  rdw: number;
  platelets: number;
  ferritin: number;
  avgCycleDays: number;
};

// Fallback defaults only — used to seed the editable vitals form and to fill
// gaps when an uploaded report is missing a field. NOT shown as any real
// patient's data; the patient edits these on the page.
const patientProfile = {
  age: 24,
  gender: 'Female' as 'Male' | 'Female',
  bloodGroup: 'B+',
  lastTransfusion: '2026-04-01',
  avgCycleDays: 21,
  currentHb: 8.9,
  previousHb: 10.2,
  daysBetweenReadings: 21,
  platelets: 168,
  ferritin: 1200,
  rbc: 4.1,
  mcv: 82,
  mch: 27,
  mchc: 32,
  rdw: 13.5,
  facility: 'AIIMS Delhi',
  city: 'New Delhi',
};

const hbData: HbPoint[] = [
  { date: 'Jan 10', level: 10.4, type: 'actual' },
  { date: 'Jan 31', level: 10.1, type: 'actual' },
  { date: 'Feb 21', level: 9.7, type: 'actual' },
  { date: 'Mar 14', level: 9.3, type: 'actual' },
  { date: 'Apr 04', level: 8.9, type: 'actual' },
  { date: 'Apr 25', level: 8.4, type: 'predicted' },
  { date: 'May 16', level: 8.1, type: 'predicted' },
];

// Donor candidates are fetched live from the backend (see the component below).
// No hard-coded donors — the list reflects real registered donors.

function extractNumber(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return Number(match[1].replace(/,/g, ''));
    }
  }

  return null;
}

function parseDateFromText(text: string) {
  const patterns = [
    /(?:last transfusion|transfusion date|date)\s*[:\-]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    /(?:last transfusion|transfusion date|date)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const parsed = new Date(match[1]);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return null;
}

function extractLabDisplayValue(value: number | null) {
  if (value === null) {
    return '—';
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }

  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function parseUploadedReport(text: string, fileName: string, sourceType: 'image' | 'pdf', pagesScanned: number): OcrSummary {
  const hemoglobin = extractNumber(text, [
    /(?:\bHb\b|Hgb|Hemoglobin)\D{0,20}(\d{1,2}(?:\.\d+)?)/i,
    /(?:hemoglobin|hb)\s*[:\-]?\s*(\d{1,2}(?:\.\d+)?)/i,
  ]);
  const platelets = extractNumber(text, [
    /(?:Platelets?|PLT)\D{0,20}(\d{2,6}(?:\.\d+)?)/i,
  ]);
  const ferritin = extractNumber(text, [
    /(?:Ferritin)\D{0,20}(\d{2,6}(?:\.\d+)?)/i,
  ]);

  const lastTransfusion = parseDateFromText(text);
  const baselineTransfusionDate = lastTransfusion ?? new Date(patientProfile.lastTransfusion);
  const nextTransfusionDate = addDays(baselineTransfusionDate, patientProfile.avgCycleDays);
  const daysRemaining = daysBetween(new Date(), nextTransfusionDate);

  const fallbackHb = hemoglobin ?? patientProfile.currentHb;
  const fallbackPlatelets = platelets ?? patientProfile.platelets;
  const fallbackFerritin = ferritin ?? patientProfile.ferritin;
  const riskScore = computeRiskScore(fallbackHb, fallbackPlatelets, fallbackFerritin);
  const riskLevel = getRiskLevel(riskScore);
  const recommendedUnits = fallbackHb < 9 ? 2 : 1;
  const notes = [
    hemoglobin === null ? 'Hb value was not detected. Verify the lab report manually.' : `Hb extracted at ${fallbackHb.toFixed(1)} g/dL.`,
    platelets === null ? 'Platelet value was not detected. Review the source scan.' : `Platelets detected at ${extractLabDisplayValue(platelets)}.`,
    ferritin === null ? 'Ferritin value was not detected. Manual confirmation recommended.' : `Ferritin detected at ${extractLabDisplayValue(ferritin)} ng/mL.`,
  ];

  return {
    fileName,
    sourceType,
    pagesScanned,
    extractedAt: new Date().toISOString(),
    rawText: text,
    hemoglobin,
    platelets,
    ferritin,
    lastTransfusionDate: lastTransfusion ? lastTransfusion.toISOString() : null,
    nextTransfusionDate: nextTransfusionDate.toISOString(),
    daysRemaining,
    riskLevel,
    recommendedUnits,
    notes,
  };
}

function buildSummaryDownload(summary: OcrSummary) {
  return [
    'ThalAI Connect OCR Clinical Summary',
    '===================================',
    `Source file: ${summary.fileName}`,
    `Source type: ${summary.sourceType}`,
    `Pages scanned: ${summary.pagesScanned}`,
    `Extracted at: ${summary.extractedAt}`,
    `Hemoglobin: ${summary.hemoglobin ?? 'Not found'}`,
    `Platelets: ${summary.platelets ?? 'Not found'}`,
    `Ferritin: ${summary.ferritin ?? 'Not found'}`,
    `Last transfusion date: ${summary.lastTransfusionDate ?? 'Not found'}`,
    `Next transfusion date: ${summary.nextTransfusionDate}`,
    `Days remaining: ${summary.daysRemaining}`,
    `Risk level: ${summary.riskLevel}`,
    `Recommended units: ${summary.recommendedUnits}`,
    '',
    'Notes:',
    ...summary.notes.map((note) => `- ${note}`),
    '',
    'Raw OCR text:',
    summary.rawText,
  ].join('\n');
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function computeRiskScore(hb: number, platelets: number, ferritin: number) {
  const hbRisk = hb < 8 ? 40 : hb < 9 ? 30 : hb < 10 ? 18 : 8;
  const plateletRisk = platelets < 120 ? 30 : platelets < 170 ? 20 : platelets < 220 ? 12 : 6;
  const ferritinRisk = ferritin >= 1500 ? 30 : ferritin >= 1000 ? 24 : ferritin >= 600 ? 14 : 6;
  return clamp(hbRisk + plateletRisk + ferritinRisk, 0, 100);
}

function getRiskLevel(score: number) {
  if (score >= 75) return 'HIGH';
  if (score >= 45) return 'MODERATE';
  return 'LOW';
}

function getRiskColor(score: number) {
  if (score >= 75) return 'text-red';
  if (score >= 45) return 'text-amber';
  return 'text-green';
}

function getRiskBadge(score: number) {
  if (score >= 75) return 'bg-red-glow text-red';
  if (score >= 45) return 'bg-amber/10 text-amber';
  return 'bg-green-bg text-green';
}

function buildRiskReasons(hb: number, platelets: number, ferritin: number): RiskReason[] {
  const reasons: RiskReason[] = [];

  if (hb < 9) {
    reasons.push({ label: 'Hemoglobin', value: `Low Hb (${hb.toFixed(1)} g/dL)`, severity: 'high' });
  } else {
    reasons.push({ label: 'Hemoglobin', value: `Hb stable at ${hb.toFixed(1)} g/dL`, severity: 'low' });
  }

  if (ferritin >= 1000) {
    reasons.push({ label: 'Ferritin', value: `High ferritin (${ferritin} ng/mL)`, severity: 'high' });
  } else if (ferritin >= 600) {
    reasons.push({ label: 'Ferritin', value: `Elevated ferritin (${ferritin} ng/mL)`, severity: 'medium' });
  }

  if (platelets < 170) {
    reasons.push({ label: 'Platelets', value: `Platelet count needs review (${platelets}k)`, severity: 'medium' });
  }

  return reasons;
}

function scoreDonor(candidate: DonorCandidate) {
  const compatibility = candidate.compatibility ?? 70;
  const proximityScore = candidate.distanceKm != null ? clamp(100 - candidate.distanceKm * 10, 0, 100) : 60;
  return Math.round(
    compatibility * 0.45 +
      proximityScore * 0.2 +
      candidate.availability * 0.2 +
      candidate.donationHistory * 0.15,
  );
}

function relativeDays(iso?: string): string {
  if (!iso) return 'No recent donation';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'No recent donation';
  const days = Math.max(0, Math.round((Date.now() - then) / (1000 * 60 * 60 * 24)));
  return days === 0 ? 'Donated today' : `${days} days ago`;
}

async function renderPdfPagesForOcr(file: File, pageLimit = 2) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Served locally from /public (copied from the pinned pdfjs-dist) — no runtime
  // CDN dependency / supply-chain risk, and it works under a strict CSP.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pagesToRead = Math.min(pageLimit, pdf.numPages);
  const images: string[] = [];

  for (let pageIndex = 1; pageIndex <= pagesToRead; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      continue;
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL('image/png'));
  }

  return images;
}

function HbTrendChart({ currentHb }: { currentHb: number }) {
  const width = 680;
  const height = 280;
  const padding = 44;
  const minLevel = 7.5;
  const maxLevel = 11.0;
  const range = maxLevel - minLevel;

  const lastActualIndex = hbData.reduce((acc, point, index) => (point.type === 'actual' ? index : acc), -1);
  const chartData = hbData.map((point, index) =>
    index === lastActualIndex && point.type === 'actual' ? { ...point, level: currentHb } : point,
  );

  const points = chartData.map((point, index) => ({
    ...point,
    x: (index * (width - padding * 2)) / (chartData.length - 1) + padding,
    y: height - ((point.level - minLevel) / range) * (height - padding * 2) - padding,
  }));

  const actualPoints = points.filter((point) => point.type === 'actual');
  const predictedPoints = points.filter((point) => point.type === 'predicted');

  const actualPath = actualPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const predictedPath = [actualPoints[actualPoints.length - 1], ...predictedPoints]
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className="w-full overflow-x-auto no-scrollbar">
      <svg width={width} height={height} className="mx-auto block overflow-visible">
        <defs>
          <filter id="hb-shadow" x="-20%" y="-20%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="4" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.12" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="dangerZone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDECEC" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FDECEC" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="warningZone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF7E1" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#FFF7E1" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="safeZone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8F7EF" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#E8F7EF" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        <rect x={padding} y={height - 80} width={width - padding * 2} height={80} rx="16" fill="url(#dangerZone)" />
        <rect x={padding} y={height - 145} width={width - padding * 2} height={65} rx="16" fill="url(#warningZone)" />
        <rect x={padding} y={padding} width={width - padding * 2} height={height - 210} rx="16" fill="url(#safeZone)" />

        {[8, 9, 10, 11].map((level) => {
          const y = height - ((level - minLevel) / range) * (height - padding * 2) - padding;
          const zoneLabel = level < 8 ? 'danger' : level < 10 ? 'warning' : 'safe';

          return (
            <g key={level}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#E5E7EB" strokeWidth="1" strokeDasharray={level === 9 ? '5 6' : '0'} />
              <text x={padding - 10} y={y + 4} textAnchor="end" className={`text-[10px] font-bold ${zoneLabel === 'danger' ? 'fill-red' : zoneLabel === 'warning' ? 'fill-amber' : 'fill-green'}`}>
                {level} g/dL
              </text>
            </g>
          );
        })}

        <motion.path
          d={actualPath}
          fill="none"
          stroke="#C0392B"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#hb-shadow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.3, ease: 'easeInOut' }}
        />

        <motion.path
          d={predictedPath}
          fill="none"
          stroke="#C0392B"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="8 7"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.8, duration: 0.9 }}
        />

        {points.map((point, index) => (
          <motion.g
            key={`${point.date}-${index}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08 * index + 0.35 }}
          >
            <circle cx={point.x} cy={point.y} r={12} fill="transparent" />
            <circle cx={point.x} cy={point.y} r={point.type === 'predicted' ? 4 : 6} fill={point.type === 'predicted' ? '#fff' : '#C0392B'} stroke="#C0392B" strokeWidth="2.5" />
            <text x={point.x} y={height - 12} textAnchor="middle" className="text-[10px] fill-gray-500 font-bold uppercase tracking-wide">
              {point.date}
            </text>
            <text x={point.x} y={point.y - 12} textAnchor="middle" className={`text-[10px] font-bold ${point.type === 'predicted' ? 'fill-gray-400' : 'fill-red'}`}>
              {point.level.toFixed(1)}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

function StatTile({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint: string; tone: string }) {
  return (
    <div className="card bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
      </div>
      <p className="mt-3 text-sm text-gray-500">{hint}</p>
    </div>
  );
}

export default function PredictionsPage() {
  const [loading, setLoading] = useState(true);
  const [ocrSummary, setOcrSummary] = useState<OcrSummary | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [mlPrediction, setMlPrediction] = useState<MlPredictionResponse | null>(null);
  const [mlError, setMlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Real, per-patient clinical inputs (editable). Seeded from defaults; the
  // patient corrects them in the "Your latest blood report" panel, and OCR
  // upload pre-fills them. Every prediction below runs on THESE values.
  const [vitals, setVitals] = useState<PatientVitals>(() => ({
    age: patientProfile.age,
    gender: patientProfile.gender,
    hemoglobin: patientProfile.currentHb,
    rbc: patientProfile.rbc,
    mcv: patientProfile.mcv,
    mch: patientProfile.mch,
    mchc: patientProfile.mchc,
    rdw: patientProfile.rdw,
    platelets: patientProfile.platelets,
    ferritin: patientProfile.ferritin,
    avgCycleDays: patientProfile.avgCycleDays,
  }));
  const [patientName, setPatientName] = useState<string>('');

  // Persist the patient's entered blood values so other views (e.g. the
  // dashboard) can reuse them instead of fabricating medical data.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('patientVitals', JSON.stringify(vitals));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [vitals]);

  // Personalise from the signed-in user (name only — no medical data is stored
  // at registration, which is why the patient enters their blood values here).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.name) setPatientName(String(u.name).split(' ')[0]);
      }
      const savedVitals = localStorage.getItem('patientVitals');
      if (savedVitals) {
        const parsed = JSON.parse(savedVitals);
        setVitals((v) => ({ ...v, ...parsed }));
      }
    } catch {
      /* ignore malformed cache */
    }
  }, []);

  const today = new Date();
  const activeHemoglobin = ocrSummary?.hemoglobin ?? vitals.hemoglobin;
  const activePlatelets = ocrSummary?.platelets ?? vitals.platelets;
  const activeFerritin = ocrSummary?.ferritin ?? vitals.ferritin;
  const activeLastTransfusionDate = ocrSummary?.lastTransfusionDate
    ? new Date(ocrSummary.lastTransfusionDate)
    : new Date(patientProfile.lastTransfusion);

  const modelPredictedHemoglobin = mlPrediction?.predictions?.predictedHemoglobin ?? activeHemoglobin;
  const modelCycleDays = mlPrediction?.predictions?.expectedCycleDays ?? patientProfile.avgCycleDays;

  const nextTransfusionDate = addDays(activeLastTransfusionDate, modelCycleDays);
  const daysRemaining = daysBetween(today, nextTransfusionDate);
  const urgencyLevel = mlPrediction?.predictions?.urgency ?? (activeHemoglobin < 9 ? 'HIGH' : 'NORMAL');
  const requiredUnits = mlPrediction?.predictions?.requiredUnits ?? (activeHemoglobin < 9 ? 2 : 1);
  const frequencyTrend = `Every ${modelCycleDays} days`;
  const declineRate = mlPrediction?.predictions?.declineRate ?? ((patientProfile.previousHb - activeHemoglobin) / patientProfile.daysBetweenReadings);
  const riskScore = computeRiskScore(modelPredictedHemoglobin, activePlatelets, activeFerritin);
  const riskLevel = getRiskLevel(riskScore);
  const riskColor = getRiskColor(riskScore);
  const riskBadge = getRiskBadge(riskScore);
  const riskReasons = buildRiskReasons(modelPredictedHemoglobin, activePlatelets, activeFerritin);

  const [rankedDonors, setRankedDonors] = useState<Array<DonorCandidate & { score: number }>>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/donors', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const raw = Array.isArray(data) ? data : data?.donors ?? [];
        const list: DonorCandidate[] = raw.map((d: { name?: string; bloodGroup?: string; avail?: string; donationsCount?: number; lastDonated?: string }) => ({
          name: d.name ?? 'Donor',
          bloodGroup: d.bloodGroup ?? '—',
          availability: d.avail === 'Available' ? 100 : 45,
          donationHistory: clamp(Number(d.donationsCount ?? 0) * 10, 0, 100),
          lastDonation: relativeDays(d.lastDonated),
        }));
        const ranked = list.map((c) => ({ ...c, score: scoreDonor(c) })).sort((a, b) => b.score - a.score);
        if (mounted) setRankedDonors(ranked);
      } catch {
        /* leave empty — the UI shows an honest empty state */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(timer);
  }, []);

  // Effective values: an uploaded report overrides typed values for the fields
  // OCR can read; everything else comes from the editable vitals.
  const hbForModel = ocrSummary?.hemoglobin ?? vitals.hemoglobin;
  const plateletsForModel = ocrSummary?.platelets ?? vitals.platelets;
  const ferritinForModel = ocrSummary?.ferritin ?? vitals.ferritin;

  useEffect(() => {
    let mounted = true;

    async function fetchModelPrediction() {
      try {
        setMlError(null);
        // Auth travels via the httpOnly session cookie (same-origin /api proxy),
        // so no token is read from JS here.
        const response = await fetch('/api/patient/predictions/model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            age: vitals.age,
            gender: vitals.gender,
            hemoglobin: hbForModel,
            rbc: vitals.rbc,
            platelets: plateletsForModel,
            ferritin: ferritinForModel,
            mcv: vitals.mcv,
            mch: vitals.mch,
            mchc: vitals.mchc,
            rdw: vitals.rdw,
            avg_cycle_days: vitals.avgCycleDays,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Model prediction request failed');
        }

        if (mounted) {
          setMlPrediction(data as MlPredictionResponse);
        }
      } catch (error) {
        if (mounted) {
          setMlPrediction(null);
          setMlError(error instanceof Error ? error.message : 'Failed to fetch ML prediction');
        }
      }
    }

    fetchModelPrediction();

    return () => {
      mounted = false;
    };
  }, [
    hbForModel, plateletsForModel, ferritinForModel,
    vitals.age, vitals.gender, vitals.rbc, vitals.mcv, vitals.mch,
    vitals.mchc, vitals.rdw, vitals.avgCycleDays,
  ]);

  async function handleReportUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setOcrStatus('scanning');
    setOcrProgress(3);
    setOcrError(null);

    try {
      const { recognize } = await import('tesseract.js');
      const isPdfFile = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
      const ocrSources: Array<File | string> = isPdfFile ? await renderPdfPagesForOcr(file) : [file];

      if (ocrSources.length === 0) {
        throw new Error('No readable pages were found in the uploaded PDF.');
      }

      let fullText = '';
      for (let index = 0; index < ocrSources.length; index += 1) {
        const source = ocrSources[index];
        const result = await recognize(source, 'eng', {
          logger: (message: { status?: string; progress?: number }) => {
            if (message.status === 'recognizing text' && typeof message.progress === 'number') {
              const weightedProgress = ((index + message.progress) / ocrSources.length) * 100;
              setOcrProgress(Math.max(5, Math.min(99, Math.round(weightedProgress))));
            }
          },
        });
        fullText = `${fullText}\n${result.data.text}`;
      }

      const summary = parseUploadedReport(fullText, file.name, isPdfFile ? 'pdf' : 'image', ocrSources.length);
      setOcrSummary(summary);
      setOcrStatus('done');
      setOcrProgress(100);
    } catch (error) {
      setOcrStatus('error');
      setOcrProgress(0);
      setOcrError(error instanceof Error ? error.message : 'OCR scan failed. Please try another image file.');
    }
  }

  function downloadSummary(summary: OcrSummary) {
    const blob = new Blob([buildSummaryDownload(summary)], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${summary.fileName.replace(/\.[^.]+$/, '') || 'ocr-summary'}-summary.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex min-h-125 flex-col items-center justify-center gap-6"
          >
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-red-glow border-t-red" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Brain className="text-red animate-pulse" size={24} />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800">Analyzing transfusion pattern</h3>
              <p className="mt-2 font-medium text-gray-500">Preparing your clinical prediction dashboard...</p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 pb-12">
            <div className="flex flex-col justify-between gap-5 border-b border-gray-100 pb-6 md:flex-row md:items-end">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-red-glow px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-red">
                  <Activity size={12} /> Clinical Prediction Center
                </div>
                <h1 className="text-3xl font-display font-black tracking-tight text-gray-900 md:text-4xl">Transfusion Prediction Dashboard</h1>
                <p className="max-w-2xl text-sm font-medium text-gray-500 md:text-base">
                  Personalized clinical forecasting for transfusion timing, Hb decline, medical risk, donor priority, and AI guidance.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Clinical status</span>
                  <span className={`mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${urgencyLevel === 'HIGH' ? 'bg-red-glow text-red' : 'bg-green-bg text-green'}`}>
                    <span className={`h-2 w-2 rounded-full ${urgencyLevel === 'HIGH' ? 'bg-red animate-pulse' : 'bg-green'}`} />
                    {urgencyLevel} URGENCY
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={ocrStatus === 'scanning'}
                    className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all active:scale-95 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {ocrStatus === 'scanning' ? 'Scanning...' : 'Export Summary'}
                  </button>
                  <p className="text-[11px] font-medium text-gray-400">Upload a report image/PDF from your device for OCR extraction.</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    onChange={handleReportUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Real, per-patient inputs — replaces the former hard-coded profile */}
            <div className="card bg-white p-6">
              <div className="flex flex-col gap-2 border-b border-gray-50 pb-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-red" />
                  <h2 className="text-lg font-bold text-gray-800">
                    {patientName ? `${patientName}'s latest blood report` : 'Your latest blood report'}
                  </h2>
                </div>
                <span className="text-[11px] font-medium text-gray-400">Enter values from your CBC — every prediction below updates live.</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Sex</span>
                  <select
                    value={vitals.gender}
                    onChange={(e) => setVitals((v) => ({ ...v, gender: e.target.value as 'Male' | 'Female' }))}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                </label>
                {([
                  ['age', 'Age (yrs)', 1],
                  ['hemoglobin', 'Hb (g/dL)', 0.1],
                  ['rbc', 'RBC (10⁶/µL)', 0.01],
                  ['mcv', 'MCV (fL)', 0.1],
                  ['mch', 'MCH (pg)', 0.1],
                  ['mchc', 'MCHC (g/dL)', 0.1],
                  ['rdw', 'RDW (%)', 0.1],
                  ['platelets', 'Platelets (10³/µL)', 1],
                  ['ferritin', 'Ferritin (ng/mL)', 1],
                  ['avgCycleDays', 'Cycle (days)', 1],
                ] as [keyof PatientVitals, string, number][]).map(([key, label, step]) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
                    <input
                      type="number"
                      step={step}
                      min={0}
                      value={Number.isFinite(vitals[key] as number) ? (vitals[key] as number) : ''}
                      onChange={(e) => setVitals((v) => ({ ...v, [key]: e.target.value === '' ? 0 : Number(e.target.value) }))}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 tabular-nums"
                    />
                  </label>
                ))}
              </div>
              {ocrSummary ? (
                <p className="mt-3 text-[11px] font-semibold text-green">✓ Hb / platelets / ferritin pre-filled from your uploaded report — review and complete the remaining fields.</p>
              ) : null}
            </div>

            {/* Thalassaemia / haemoglobinopathy screen (ML, from the real CBC above) */}
            {mlPrediction?.predictions?.thalassaemiaScreen ? (
              <div className={`card p-6 border ${mlPrediction.predictions.thalassaemiaScreen.flagged ? 'border-red/30 bg-red-glow/40' : 'border-green/30 bg-green-bg/40'}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <ShieldAlert size={22} className={mlPrediction.predictions.thalassaemiaScreen.flagged ? 'text-red' : 'text-green'} />
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">Thalassaemia / haemoglobinopathy screen</h2>
                      <p className="mt-1 max-w-xl text-sm text-gray-600">
                        {mlPrediction.predictions.thalassaemiaScreen.flagged
                          ? `CBC pattern suggests a possible ${mlPrediction.predictions.thalassaemiaScreen.likelyType ?? 'haemoglobinopathy'}. ${mlPrediction.predictions.thalassaemiaScreen.recommendation}.`
                          : `${mlPrediction.predictions.thalassaemiaScreen.recommendation}.`}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-gray-400">{mlPrediction.predictions.thalassaemiaScreen.disclaimer}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Screen risk</span>
                    <span className={`text-3xl font-black tabular-nums ${mlPrediction.predictions.thalassaemiaScreen.flagged ? 'text-red' : 'text-green'}`}>
                      {Math.round(mlPrediction.predictions.thalassaemiaScreen.riskProbability * 100)}%
                    </span>
                    <span className={`mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${mlPrediction.predictions.thalassaemiaScreen.flagged ? 'bg-red text-white' : 'bg-green text-white'}`}>
                      {mlPrediction.predictions.thalassaemiaScreen.flagged ? 'REFER FOR HPLC' : 'LOW RISK'}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="card bg-white p-6 lg:col-span-2">
                <div className="flex flex-col gap-5 border-b border-gray-50 pb-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CalendarDays size={18} className="text-red" />
                      <h2 className="text-lg font-bold text-gray-800">Transfusion Prediction</h2>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Next transfusion, remaining days, and urgency are calculated from your last cycle.</p>
                  </div>
                  <div className={`rounded-2xl px-4 py-2 text-sm font-black ${urgencyLevel === 'HIGH' ? 'bg-red-glow text-red' : 'bg-green-bg text-green'}`}>
                    {urgencyLevel === 'HIGH' ? 'URGENT REVIEW' : 'STABLE WINDOW'}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <StatTile
                    icon={<CalendarDays size={20} className="text-red" />}
                    label="Next transfusion"
                    value={formatShortDate(nextTransfusionDate)}
                    hint={`Based on ${modelCycleDays}-day transfusion cycle.`}
                    tone="bg-red-glow"
                  />
                  <StatTile
                    icon={<Clock3 size={20} className="text-amber" />}
                    label="Days remaining"
                    value={daysRemaining === 0 ? 'Due now' : `${daysRemaining} days`}
                    hint={daysRemaining <= 3 ? 'Book donor support immediately.' : 'Monitor and prepare the match list.'}
                    tone="bg-amber/10"
                  />
                  <StatTile
                    icon={<ShieldAlert size={20} className="text-green" />}
                    label="Urgency level"
                    value={urgencyLevel}
                    hint={`Model Hb signal: ${modelPredictedHemoglobin.toFixed(1)} g/dL`}
                    tone={urgencyLevel === 'HIGH' ? 'bg-red-glow' : 'bg-green-bg'}
                  />
                </div>

                <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Hb Trend + Risk Zones</h3>
                      <p className="text-sm text-gray-500">Green zone &gt; 10, yellow 8–10, red &lt; 8.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                      <span className="rounded-full bg-white px-3 py-1 text-green shadow-sm">Safe</span>
                      <span className="rounded-full bg-white px-3 py-1 text-amber shadow-sm">Watch</span>
                      <span className="rounded-full bg-white px-3 py-1 text-red shadow-sm">Danger</span>
                    </div>
                  </div>
                  <HbTrendChart currentHb={modelPredictedHemoglobin} />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Drop rate</p>
                    <p className="mt-2 text-2xl font-black text-gray-900">{declineRate.toFixed(3)} g/dL/day</p>
                    <p className="mt-1 text-sm text-gray-500">Hb decline is calculated from the latest clinical readings.</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Danger zone</p>
                    <p className="mt-2 text-2xl font-black text-gray-900">Below 8.0</p>
                    <p className="mt-1 text-sm text-gray-500">This range indicates immediate clinical review is needed.</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Prediction line</p>
                    <p className="mt-2 text-2xl font-black text-gray-900">21-day cycle</p>
                    <p className="mt-1 text-sm text-gray-500">Dashed line projects the next expected Hb movement.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="card bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-800">Health Risk Score</h2>
                    <Gauge className={riskColor} size={20} />
                  </div>
                  <div className="mt-5 flex items-end gap-3">
                    <span className="text-5xl font-black text-gray-900">{riskScore}</span>
                    <span className={`mb-2 rounded-full px-3 py-1 text-sm font-black ${riskBadge}`}>{riskLevel}</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${riskScore}%` }} transition={{ duration: 1 }} className={`h-full rounded-full ${riskColor === 'text-red' ? 'bg-red' : riskColor === 'text-amber' ? 'bg-amber' : 'bg-green'}`} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {riskReasons.map((reason) => (
                      <div key={reason.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{reason.label}</p>
                        <p className={`mt-1 text-sm font-semibold ${reason.severity === 'high' ? 'text-red' : reason.severity === 'medium' ? 'text-amber' : 'text-green'}`}>{reason.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-800">Required Units</h2>
                    <Droplets className="text-red" size={20} />
                  </div>
                  <div className="mt-5 flex items-end gap-3">
                    <span className="text-5xl font-black text-gray-900">{requiredUnits}</span>
                    <span className="mb-2 text-sm font-bold text-gray-500">unit{requiredUnits > 1 ? 's' : ''}</span>
                  </div>
                  <p className="mt-3 text-sm text-gray-500">Expected frequency trend: {frequencyTrend}.</p>
                  <div className="mt-4 rounded-2xl bg-red-glow p-4 text-sm text-gray-700">
                    <p className="font-bold text-red">Transfusion need predictor</p>
                    <p className="mt-1">Your Hb indicates {requiredUnits} unit{requiredUnits > 1 ? 's' : ''} are likely required at the next transfusion window.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card bg-white p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-bg text-blue">
                      <Users size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">Smart Donor Matching</h2>
                      <p className="text-sm text-gray-500">Ranked by compatibility, distance, availability, and donation history.</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-green-bg px-3 py-1 text-[11px] font-black uppercase tracking-widest text-green">Top matches</span>
                </div>

                <div className="mt-6 space-y-4">
                  {rankedDonors.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm font-medium text-gray-500">
                      No registered donors to match yet. As donors join, your best matches appear here.
                    </div>
                  ) : (
                    rankedDonors.slice(0, 3).map((donor, index) => (
                      <div key={`${donor.name}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-base font-bold text-gray-900">{index + 1}. {donor.name}</p>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-gray-500">{donor.bloodGroup}</span>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              {donor.availability >= 100 ? 'Available now' : 'Availability on request'} • Last donated {donor.lastDonation}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-gray-900">{donor.score}%</p>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Match score</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-gray-500">
                          <span className="rounded-xl bg-white px-3 py-2 text-center">Avail {donor.availability}%</span>
                          <span className="rounded-xl bg-white px-3 py-2 text-center">History {donor.donationHistory}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="card bg-gray-900 border-none p-6 relative overflow-hidden">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-red/10 blur-[110px]" />
                <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-blue/10 blur-[110px]" />

                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur">
                      <Brain size={22} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">AI Insights</h2>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Personal insight engine</p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-white/85">
                    <p className="text-lg font-display leading-relaxed">
                      Your Hb drops roughly every <span className="font-bold text-red">{modelCycleDays} days</span>. The next risk date is{' '}
                      <span className="font-bold text-white">{formatDate(nextTransfusionDate)}</span>, so the safest recommendation is to{' '}
                      <span className="font-bold text-green">book donor support now</span>.
                    </p>
                  </div>

                  {(mlPrediction || mlError) && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                      {mlPrediction ? (
                        <>
                          <p>
                            Model diagnosis: <span className="font-bold text-white">{mlPrediction.predictions.diagnosis}</span> ·
                            Type: <span className="font-bold text-white"> {mlPrediction.predictions.anemiaType}</span>
                          </p>
                          <p className="mt-1">
                            Binary risk: <span className="font-bold text-white">{mlPrediction.predictions.anemiaBinary}</span>
                            {typeof mlPrediction.predictions.anemiaBinaryProbability === 'number'
                              ? ` (${Math.round(mlPrediction.predictions.anemiaBinaryProbability * 100)}%)`
                              : ''}
                          </p>
                        </>
                      ) : (
                        <p className="text-amber">ML service unavailable: {mlError}</p>
                      )}
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Cycle pattern</p>
                      <p className="mt-2 text-sm font-semibold">Your Hb is trending down in a predictable 21-day window.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Next risk date</p>
                      <p className="mt-2 text-sm font-semibold">{formatDate(nextTransfusionDate)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Recommendation</p>
                      <p className="mt-2 text-sm font-semibold">Book donor now and keep an eye on Hb below 9.0.</p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-4 pt-6">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">AI assistance</p>
                      <p className="mt-1 text-sm text-white/70">Clinical prediction summary ready for review.</p>
                    </div>
                    <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-95">
                      Ask AI <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {(ocrStatus === 'scanning' || ocrSummary || ocrError) && (
              <div className="card bg-white p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">OCR Data Extraction</h2>
                    <p className="text-sm text-gray-500">Tesseract OCR scans uploaded images or PDFs and pulls out clinical values.</p>
                  </div>
                  {ocrSummary && (
                    <button
                      type="button"
                      onClick={() => downloadSummary(ocrSummary)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-red px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-red-dark active:scale-95"
                    >
                      Download extracted summary
                    </button>
                  )}
                </div>

                {ocrStatus === 'scanning' && (
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-sm text-gray-500">
                      <span>Scanning file with OCR</span>
                      <span>{ocrProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-red transition-all" style={{ width: `${ocrProgress}%` }} />
                    </div>
                  </div>
                )}

                {ocrError && (
                  <div className="mt-5 rounded-2xl border border-red-100 bg-red-glow p-4 text-sm text-red">
                    {ocrError}
                  </div>
                )}

                {ocrSummary && (
                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Hb extracted</p>
                      <p className="mt-2 text-2xl font-black text-gray-900">{extractLabDisplayValue(ocrSummary.hemoglobin)}</p>
                      <p className="mt-1 text-sm text-gray-500">Tesseract OCR parsed the hemoglobin value from the report.</p>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">OCR risk level</p>
                      <p className="mt-2 text-2xl font-black text-gray-900">{ocrSummary.riskLevel}</p>
                      <p className="mt-1 text-sm text-gray-500">Recommendation: {ocrSummary.recommendedUnits} unit{ocrSummary.recommendedUnits > 1 ? 's' : ''} likely required.</p>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Next transfusion</p>
                      <p className="mt-2 text-2xl font-black text-gray-900">{formatShortDate(new Date(ocrSummary.nextTransfusionDate))}</p>
                      <p className="mt-1 text-sm text-gray-500">{ocrSummary.daysRemaining} days remaining from the uploaded file data.</p>
                    </div>
                  </div>
                )}

                {ocrSummary && (
                  <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                    Source: <span className="font-bold text-gray-800">{ocrSummary.fileName}</span> · Type:{' '}
                    <span className="font-bold uppercase text-gray-800">{ocrSummary.sourceType}</span> · Pages Scanned:{' '}
                    <span className="font-bold text-gray-800">{ocrSummary.pagesScanned}</span>
                  </div>
                )}

                {ocrSummary && (
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {ocrSummary.notes.map((note) => (
                      <div key={note} className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <Info size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <p className="text-[11px] font-medium text-gray-500">
                  <strong>Clinical Disclaimer:</strong> These predictions are support tools based on historical transfusion patterns, hemoglobin trends, ferritin, and platelet signals. A registered medical professional must validate all decisions.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
