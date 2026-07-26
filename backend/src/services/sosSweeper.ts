import SOSAlert from '../models/SOSAlert';
import { sendWhatsApp } from './notify';

// Persistent SOS auto-escalation.
//
// The old design used an in-process `setTimeout` per alert, so a server restart
// within the window silently dropped the escalation — unacceptable for a medical
// emergency. Escalation state now lives on the SOSAlert document (`escalateAt`,
// `escalated`) and this sweeper reconciles it on a fixed interval, so pending
// escalations survive restarts and multiple instances converge on the same DB.

let timer: ReturnType<typeof setInterval> | null = null;

export async function runSosSweep(): Promise<void> {
  const now = new Date();

  // 1. Escalate active, not-yet-escalated alerts whose escalateAt has passed.
  const toEscalate = await SOSAlert.find({
    status: 'active',
    escalated: false,
    escalateAt: { $lte: now },
  }).limit(50).exec();

  for (const sos of toEscalate) {
    try {
      const hospitalPhone = (process.env.HOSPITAL_PHONE || '').trim();
      if (hospitalPhone) {
        await sendWhatsApp(
          hospitalPhone,
          `Emergency blood (${sos.bloodGroup}) required at ${sos.hospital || 'the requested hospital'}. No donor has accepted — please escalate.`,
        );
      }
      // Mark escalated regardless of whether a hospital phone is configured, so
      // we don't re-attempt every tick. (No phone configured => nothing to send.)
      sos.escalated = true;
      await sos.save();
    } catch (err) {
      console.error(`SOS escalation failed for ${String(sos._id)}:`, err);
      // leave escalated=false so the next sweep retries.
    }
  }

  // 2. Expire active alerts that nobody accepted before expiresAt. We mark them
  //    'expired' (not delete) to preserve the medical/audit trail.
  await SOSAlert.updateMany(
    { status: 'active', expiresAt: { $lte: now } },
    { $set: { status: 'expired' } },
  ).exec();
}

export function startSosSweeper(intervalMs = 15000): void {
  if (timer) return;
  timer = setInterval(() => {
    void runSosSweep().catch((err) => console.error('SOS sweep error:', err));
  }, intervalMs);
  // Don't keep the event loop alive just for the sweeper.
  if (typeof (timer as any).unref === 'function') (timer as any).unref();
  console.log(`🔁 SOS escalation sweeper started (every ${intervalMs / 1000}s)`);
}

export function stopSosSweeper(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
