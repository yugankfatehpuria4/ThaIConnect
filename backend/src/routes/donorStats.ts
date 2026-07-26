import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import DonorProfile from '../models/DonorProfile';
import Donation from '../models/Donation';
import Achievement from '../models/Achievement';
import SOSAlert from '../models/SOSAlert';
import { authMiddleware } from './api';

const router = Router();

function daysUntilEligible(lastDonationDate?: Date) {
  if (!lastDonationDate) return 0;
  const gap = 90;
  const nextDate = new Date(lastDonationDate);
  nextDate.setDate(nextDate.getDate() + gap);
  return Math.max(0, Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function calculateResponseRate(profile: any) {
  // Guard against a profile that exists but has no responseStats sub-doc —
  // accessing .totalSOS on undefined used to throw a 500.
  const total = profile?.responseStats?.totalSOS ?? 0;
  const accepted = profile?.responseStats?.acceptedSOS ?? 0;
  if (!total) return '0%';
  return Math.round((accepted / total) * 100) + '%';
}

// 1. Dashboard Metrics — returns real data, no fake seeding (issue #11)
router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const donor = await DonorProfile.findOne({ userId: user._id });

    // Return real zeros for new donors — no fake data injection
    res.json({
      totalDonations: donor?.totalDonations || 0,
      daysUntilEligible: daysUntilEligible(donor?.lastDonationDate),
      responseRate: calculateResponseRate(donor),
      impactPoints: donor?.impactPoints || 0,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch donor metrics' });
  }
});

// 2. Donation History — returns real data, no fake seeding (issue #12)
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const limit = Math.min(Math.max(Math.floor(Number(req.query.limit)) || 100, 1), 200);
    const skip = Math.max(Math.floor(Number(req.query.skip)) || 0, 0);
    const history = await Donation.find({ donorId: user._id }).sort({ date: -1 }).skip(skip).limit(limit);
    res.json(history);
  } catch {
    res.status(500).json({ error: 'Failed to fetch donation history' });
  }
});

// 3. Export PDF
router.get('/export-pdf', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = await Donation.find({ donorId: user._id }).sort({ date: -1 });
    const doc = new PDFDocument({ margin: 50 });

    // Strip everything but safe filename chars — a name containing " or newline
    // could otherwise inject into the Content-Disposition header.
    const safeName = String(user.name || 'donor').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Donation_History_${safeName}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).text('ThalAI Connect', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('Donation History Report', { align: 'center' });
    doc.fontSize(12).text(`Donor: ${user.name}`, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(14).text('Donation Logs:', { underline: true });
    doc.moveDown();

    if (data.length === 0) {
      doc.fontSize(12).text('No donation history found.');
    } else {
      data.forEach((d, index) => {
        doc.fontSize(12).text(`${index + 1}. ${d.date.toLocaleDateString()}`);
        doc.fontSize(10).text(`Location: ${d.location} | Type: ${d.type}`);
        doc.text(`Recipient: ${d.recipientType} | Status: ${d.status}`);
        doc.moveDown();
      });
    }
    doc.end();
  } catch {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// 4. Export CSV — upgraded from alpha json2csv (issue #29)
router.get('/export-csv', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = await Donation.find({ donorId: user._id }).lean();
    const formattedData = data.map((d) => ({
      Date: d.date ? new Date(d.date).toLocaleDateString() : 'N/A',
      Location: d.location,
      Type: d.type,
      Recipient: d.recipientType,
      Status: d.status,
      Units: d.unitsDonated,
      Verified: d.verified ? 'Yes' : 'No',
    }));

    const parser = new Parser();
    const csv = parser.parse(formattedData);
    res.header('Content-Type', 'text/csv');
    res.attachment('donation-history.csv');
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Failed to generate CSV' });
  }
});

// 5. Achievement System
router.get('/achievements', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const profile = await DonorProfile.findOneAndUpdate(
      { userId: user._id },
      { $setOnInsert: { userId: user._id, totalDonations: 0, responseStats: { totalSOS: 0, acceptedSOS: 0 }, impactPoints: 0 } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    const donations = profile!.totalDonations;
    const acceptedSOS = profile!.responseStats.acceptedSOS;

    let achievement = await Achievement.findOne({ donorId: user._id });
    if (!achievement) {
      achievement = await Achievement.create({ donorId: user._id, badges: [], milestones: { bronze: false, silver: false, gold: false } });
    }

    const newBadges = new Set(achievement.badges);
    if (donations >= 1) newBadges.add('First Drop');
    if (donations >= 5) newBadges.add('5 Lives Saved');
    if (donations >= 10) newBadges.add('10 Lives Saved');
    if (acceptedSOS >= 3) newBadges.add('SOS Hero');

    const badgesArray = Array.from(newBadges);
    if (badgesArray.length !== achievement.badges.length) {
      achievement.badges = badgesArray;
      if (donations >= 5) achievement.milestones.bronze = true;
      if (donations >= 15) achievement.milestones.silver = true;
      if (donations >= 30) achievement.milestones.gold = true;
      // Use $set with explicit fields — passing the whole Mongoose doc as the
      // update operator injects internal fields (__v/_id) and can error.
      await Achievement.updateOne(
        { _id: achievement._id },
        { $set: { badges: badgesArray, milestones: achievement.milestones } },
      );
    }

    res.json(achievement);
  } catch {
    res.status(500).json({ error: 'Failed to compute achievements' });
  }
});

// 6. Active SOS for donors
router.get('/sos-alerts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'donor') return res.status(403).json({ error: 'Only donors can view SOS alerts' });

    const sosList = await SOSAlert.find({
      status: 'active',
      acceptedDonor: null,
      $or: [{ targetedDonor: null }, { targetedDonor: user._id }],
      'responders.donorId': { $ne: user._id },
    }).populate('patientId', 'name bloodGroup').sort({ createdAt: -1 });

    res.json(sosList);
  } catch {
    res.status(500).json({ error: 'Failed to fetch SOS list' });
  }
});

// 7. Leaderboard — now requires auth (was exposing donor names + userIds to anyone)
router.get('/leaderboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const topDonors = await DonorProfile.find().populate('userId', 'name').sort({ impactPoints: -1 }).limit(5);
    const leaderboard = topDonors.map((donor, index) => {
      const userObj = donor.userId as any;
      return { rank: index + 1, name: userObj?.name || 'Anonymous', points: donor.impactPoints, userId: userObj?._id?.toString() || '' };
    });
    res.json(leaderboard);
  } catch {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
