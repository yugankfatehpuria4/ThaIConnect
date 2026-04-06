import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User';
import SOSAlert from '../models/SOSAlert';
import mockDonors from '../data/mockDonors';
import { matchDonors } from '../services/matchingService';
import { BloodGroup, DonorProfile, PatientInput } from '../types/matching';
import { isEmailServiceConfigured, sendEmail } from '../services/emailService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const bloodGroups: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

// JWT Auth Middleware
export const authMiddleware = async (req: Request, res: Response, next: Function) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      // Mock bypass for development if auth token is missing, picking default patient
      const mockPatient = await User.findOne({ role: 'patient' });
      (req as any).user = mockPatient;
      return next();
    }
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    (req as any).user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

function isBloodGroup(value: unknown): value is BloodGroup {
  return typeof value === 'string' && bloodGroups.includes(value as BloodGroup);
}

function isPatientInput(body: unknown): body is PatientInput {
  if (!body || typeof body !== 'object') return false;
  const candidate = body as { bloodGroup?: unknown; location?: { lat?: unknown; lng?: unknown } };

  return (
    isBloodGroup(candidate.bloodGroup) &&
    typeof candidate.location?.lat === 'number' &&
    typeof candidate.location?.lng === 'number'
  );
}

function parseQueryOrBody(req: Request): { bloodGroup?: string; lat?: number; lng?: number; requesterRole?: string } {
  const rawBloodGroup = req.query.bloodGroup || (req.body as any)?.bloodGroup;
  const rawLat = req.query.lat || (req.body as any)?.lat;
  const rawLng = req.query.lng || (req.body as any)?.lng;
  const rawRequesterRole = req.query.requesterRole || (req.body as any)?.requesterRole;

  return {
    bloodGroup: rawBloodGroup != null ? String(rawBloodGroup).toUpperCase() : undefined,
    lat: rawLat != null ? Number(rawLat) : undefined,
    lng: rawLng != null ? Number(rawLng) : undefined,
    requesterRole: rawRequesterRole != null ? String(rawRequesterRole).toLowerCase() : undefined,
  };
}

function mapUserToDonorProfile(user: {
  _id: unknown;
  name: string;
  bloodGroup?: string;
  location?: { coordinates?: number[] };
  avail?: 'Available' | 'Maybe' | 'Offline';
  lastDonated?: Date;
  score?: number;
}): DonorProfile | null {
  if (!isBloodGroup(user.bloodGroup)) return null;
  const coordinates = user.location?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;

  const [lng, lat] = coordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  return {
    id: String(user._id),
    name: user.name,
    bloodGroup: user.bloodGroup,
    location: { lat, lng },
    available: user.avail === 'Available',
    lastDonation: user.lastDonated ?? new Date('2024-01-01'),
    responseRate: typeof user.score === 'number' ? Math.max(0, Math.min(user.score / 100, 1)) : 0.5,
  };
}

// Register a user (simple auth layer)
router.post('/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  };

  if (!name || !email || !password || !role || !['patient', 'donor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'name, email, password, and role (patient|donor|admin) are required' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() }).exec();
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
    });

    const token = jwt.sign({ id: newUser._id, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });
    return res.status(201).json({
      message: 'User registered successfully',
      user: { id: newUser._id, name: newUser.name, role: newUser.role, email: newUser.email },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login a user
router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() }).exec();
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({
      message: 'Login successful',
      user: { id: user._id, name: user.name, role: user.role, email: user.email },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Get all donors for the map and list
router.get('/donors', async (req: Request, res: Response) => {
  try {
    const donors = await User.find({ role: 'donor' }).exec();
    res.json(donors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch donors' });
  }
});

// Get ALL users (for admin)
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await User.find().select('-password').exec();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update a user
router.put('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const updated = await User.findByIdAndUpdate(id, req.body, { new: true }).select('-password').exec();
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete a user
router.delete('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const deleted = await User.findByIdAndDelete(id).exec();
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

import DonorProfileModel from '../models/DonorProfile';
import Donation from '../models/Donation';
import Achievement from '../models/Achievement';

// Seed mock data
router.post('/seed', async (req: Request, res: Response) => {
  try {
    await User.deleteMany({});
    await DonorProfileModel.deleteMany({});
    await Donation.deleteMany({});
    await Achievement.deleteMany({});
    
    await User.syncIndexes();
    
    const donorsStr = [
      { name: 'Arjun Sharma', email: 'arjun@example.com', role: 'donor', bloodGroup: 'B+', location: { type: 'Point', coordinates: [77.1025, 28.7041] }, avail: 'Available', password: 'mockpasswordhashed' },
      { name: 'Priya Kapoor', email: 'priya@example.com', role: 'donor', bloodGroup: 'B+', location: { type: 'Point', coordinates: [77.1502 - 0.02, 28.9889 + 0.01] }, avail: 'Available', password: 'mockpasswordhashed' },
      { name: 'Vikram Mehta', email: 'vikram@example.com', role: 'donor', bloodGroup: 'O+', location: { type: 'Point', coordinates: [77.1502 + 0.03, 28.9889 + 0.02] }, avail: 'Maybe', password: 'mockpasswordhashed' }
    ];

    const insertedUsers = await User.insertMany(donorsStr);

    for (let i = 0; i < insertedUsers.length; i++) {
        const u = insertedUsers[i];
        const multiplier = 3 - i; // just cascading sample vars

        await DonorProfileModel.create({
            userId: u._id,
            totalDonations: 7 * multiplier,
            lastDonationDate: new Date('2025-02-01'),
            responseStats: { totalSOS: 10 * multiplier, acceptedSOS: 9 * multiplier },
            impactPoints: 1260 * multiplier
        });

        await Donation.insertMany([
            { donorId: u._id, date: new Date('2025-02-28'), location: 'AIIMS Delhi', type: 'Whole blood', recipientType: 'Thalassemia patient', status: 'Completed', verified: true, unitsDonated: 1 },
            { donorId: u._id, date: new Date('2024-11-15'), location: 'Safdarjung', type: 'Whole blood', recipientType: 'Emergency SOS', status: 'Completed', verified: true, unitsDonated: 2 },
            { donorId: u._id, date: new Date('2025-05-25'), location: 'Pending match location', type: 'Platelets', recipientType: 'Pending match', status: 'Scheduled', verified: false, unitsDonated: 1 }
        ]);

        await Achievement.create({
            donorId: u._id,
            badges: ['First Drop', 'SOS Hero', '5 Lives Saved'],
            milestones: { bronze: true, silver: false, gold: false }
        });
    }

    res.json({ message: 'Real-World Mock Data explicitly seeded bridging all schemas!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to cross-seed architecture schemas' });
  }
});

// Create SOS Alert
router.post('/sos', authMiddleware, async (req: Request, res: Response) => {
  const patient = (req as any).user;
  const io = (req as any).io;

  if (patient.role !== 'patient') {
    return res.status(403).json({ error: 'Only patients can send SOS' });
  }

  try {
    const lastSOS = await SOSAlert.findOne({ patientId: patient._id }).sort({ createdAt: -1 });

    if (lastSOS && Date.now() - lastSOS.createdAt.getTime() < 5 * 60 * 1000) {
      return res.status(400).json({ error: 'Wait before sending another SOS' });
    }

    // Identify nearby compatible donors
    const donorQuery: any = { role: 'donor', avail: { $ne: 'Offline' } };
    if (patient.bloodGroup) {
      // Basic compatibility fallback logic instead of complex mapping object
      donorQuery.bloodGroup = patient.bloodGroup;
    }

    const donors = await User.find(donorQuery).limit(10).exec();

    if (donors.length === 0) {
      return res.status(404).json({ error: 'No compatible donors found nearby' });
    }

    const alert = await SOSAlert.create({
      patientId: patient._id,
      bloodGroup: patient.bloodGroup || 'B+',
      location: patient.location || { type: 'Point', coordinates: [77.2090, 28.6139] },
      hospital: req.body.hospital || 'AIIMS Delhi',
      requestType: 'sos',
      deliveryLogs: [],
    });

    donors.forEach((donor) => {
      io.to(donor._id.toString()).emit('sos-alert', {
        sosId: alert._id,
        bloodGroup: alert.bloodGroup,
        location: alert.location,
        hospital: alert.hospital
      });
    });

    const socketLogs = donors.map((donor) => ({
      channel: 'socket' as const,
      recipientUserId: donor._id,
      recipientEmail: typeof donor.email === 'string' ? donor.email : undefined,
      event: 'sos-created',
      status: 'sent' as const,
      createdAt: new Date(),
    }));
    alert.deliveryLogs.push(...socketLogs);

    const emailPromises = donors.map((donor) => {
      const recipientEmail = typeof donor.email === 'string' ? donor.email : '';
      const donorName = donor.name || 'Donor';

      return sendEmail({
        to: recipientEmail,
        subject: `SOS Alert: ${alert.bloodGroup} needed at ${alert.hospital}`,
        text: `Emergency SOS request\n\nPatient: ${patient.name || 'Patient'}\nBlood Group Required: ${alert.bloodGroup}\nHospital: ${alert.hospital}\nPlease open ThalAI Connect and respond immediately.`,
        html: `<p><strong>Emergency SOS request</strong></p><p>Hi ${donorName},</p><p>A patient needs <strong>${alert.bloodGroup}</strong> blood at <strong>${alert.hospital}</strong>.</p><p>Please open ThalAI Connect and respond immediately.</p>`,
      });
    });

    const emailResults = await Promise.all(emailPromises);
    emailResults.forEach((result, index) => {
      const donor = donors[index];
      alert.deliveryLogs.push({
        channel: 'email',
        recipientUserId: donor._id,
        recipientEmail: typeof donor.email === 'string' ? donor.email : '',
        event: 'sos-created',
        status: result.ok ? 'sent' : result.skipped ? 'skipped' : 'failed',
        reason: result.reason,
        createdAt: new Date(),
      });
    });
    await alert.save();

    const emailsSent = emailResults.filter((entry) => entry.ok).length;
    const emailsSkipped = emailResults.filter((entry) => entry.skipped).length;
    const emailsFailed = emailResults.length - emailsSent - emailsSkipped;

    res.status(201).json({
      success: true,
      alert,
      message: `SOS sent to ${donors.length} donors`,
      emailDelivery: {
        configured: isEmailServiceConfigured(),
        attempted: emailResults.length,
        sent: emailsSent,
        skipped: emailsSkipped,
        failed: emailsFailed,
      },
    });
  } catch (error) {
    console.error('SOS create error:', error);
    res.status(500).json({ error: 'Failed to create SOS alert' });
  }
});

// Atomic Response to SOS
router.post('/sos/respond', authMiddleware, async (req: Request, res: Response) => {
  const { sosId, response } = req.body;
  const donor = (req as any).user;
  const io = (req as any).io;

  if (!sosId || !['accepted', 'rejected'].includes(response)) {
    return res.status(400).json({ error: 'sosId and valid response are required' });
  }

  if (!mongoose.Types.ObjectId.isValid(String(sosId))) {
    return res.status(400).json({ error: 'Invalid sosId format' });
  }

  if (!donor || !donor._id) {
    return res.status(401).json({ error: 'Unauthorized donor context' });
  }

  if (donor.role !== 'donor') {
    return res.status(403).json({ error: 'Only donors can respond to SOS alerts' });
  }

  try {
    const sos = await SOSAlert.findOneAndUpdate(
      {
        _id: sosId,
        status: 'active',
        acceptedDonor: null,
        'responders.donorId': { $ne: donor._id },
        $or: [{ targetedDonor: null }, { targetedDonor: donor._id }],
      },
      {
        $push: {
          responders: {
            donorId: donor._id,
            response,
            respondedAt: new Date(),
          },
        },
        ...(response === 'accepted' && {
          acceptedDonor: donor._id,
          status: 'resolved',
        }),
      },
      { new: true }
    );

    if (!sos) {
      return res.status(400).json({ error: 'Alert already handled or expired' });
    }

    if (response === 'accepted') {
      io?.to(sos.patientId.toString()).emit('sos-accepted', {
        donorId: donor._id,
        donorName: donor.name
      });

      if (!Array.isArray(sos.deliveryLogs)) {
        sos.deliveryLogs = [];
      }

      sos.deliveryLogs.push({
        channel: 'socket',
        recipientUserId: sos.patientId,
        event: 'sos-accepted',
        status: 'sent',
        createdAt: new Date(),
      });

      const patientUser = await User.findById(sos.patientId).exec();
      const patientEmail = typeof patientUser?.email === 'string' ? patientUser.email : '';
      const donorEmail = typeof donor.email === 'string' ? donor.email : '';

      const [patientEmailResult, donorEmailResult] = await Promise.all([
        sendEmail({
          to: patientEmail,
          subject: 'SOS Update: A donor accepted your emergency request',
          text: `Good news ${patientUser?.name || ''}!\n\nDonor ${donor.name} has accepted your SOS request for ${sos.bloodGroup}.\nHospital: ${sos.hospital}\nPlease coordinate in ThalAI Connect.`,
          html: `<p>Good news ${patientUser?.name || ''}!</p><p><strong>${donor.name}</strong> accepted your SOS request for <strong>${sos.bloodGroup}</strong>.</p><p>Hospital: <strong>${sos.hospital}</strong></p>`,
        }),
        sendEmail({
          to: donorEmail,
          subject: 'SOS Accepted Confirmation',
          text: `Thank you ${donor.name}.\n\nYou accepted an SOS request for ${sos.bloodGroup} at ${sos.hospital}.\nPlease proceed as soon as possible.`,
          html: `<p>Thank you ${donor.name}.</p><p>You accepted an SOS request for <strong>${sos.bloodGroup}</strong> at <strong>${sos.hospital}</strong>.</p><p>Please proceed as soon as possible.</p>`,
        }),
      ]);

      sos.deliveryLogs.push(
        {
          channel: 'email',
          recipientUserId: patientUser?._id,
          recipientEmail: patientEmail,
          event: 'sos-accepted',
          status: patientEmailResult.ok ? 'sent' : patientEmailResult.skipped ? 'skipped' : 'failed',
          reason: patientEmailResult.reason,
          createdAt: new Date(),
        },
        {
          channel: 'email',
          recipientUserId: donor._id,
          recipientEmail: donorEmail,
          event: 'sos-accepted-confirmation',
          status: donorEmailResult.ok ? 'sent' : donorEmailResult.skipped ? 'skipped' : 'failed',
          reason: donorEmailResult.reason,
          createdAt: new Date(),
        }
      );
      await sos.save();

      return res.json({
        message: 'Response recorded successfully',
        emailDelivery: {
          configured: isEmailServiceConfigured(),
          patientNotified: patientEmailResult.ok,
          donorNotified: donorEmailResult.ok,
          patientReason: patientEmailResult.reason || null,
          donorReason: donorEmailResult.reason || null,
        },
      });
    }

    if (sos.targetedDonor && sos.targetedDonor.toString() === donor._id.toString()) {
      sos.status = 'expired';
    }
    await sos.save();

    res.json({
      message: response === 'rejected' ? 'SOS request declined' : 'Response recorded successfully',
    });
  } catch (error) {
    console.error('SOS respond error:', error);
    res.status(500).json({ error: 'Failed to process response' });
  }
});

router.get('/donors/:id/profile', async (req: Request, res: Response) => {
  try {
    const donor = await User.findOne({ _id: req.params.id, role: 'donor' })
      .select('name bloodGroup avail location lastDonated donationsCount score initials email')
      .lean()
      .exec();

    if (!donor) {
      return res.status(404).json({ error: 'Donor not found' });
    }

    const profile = {
      _id: String(donor._id),
      name: donor.name,
      bloodGroup: donor.bloodGroup || 'Unknown',
      availability: donor.avail || 'Available',
      donationsCount: donor.donationsCount || 0,
      score: donor.score || 0,
      lastDonated: donor.lastDonated || null,
      initials: donor.initials || donor.name.slice(0, 2).toUpperCase(),
      location: donor.location,
      contactMasked: donor.email ? `${String(donor.email).slice(0, 3)}***` : null,
    };

    return res.json(profile);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch donor profile' });
  }
});

router.post('/patient/donation-request', authMiddleware, async (req: Request, res: Response) => {
  const patient = (req as any).user;
  const io = (req as any).io;

  if (patient.role !== 'patient') {
    return res.status(403).json({ error: 'Only patients can request donations' });
  }

  const { donorId, hospital, note } = req.body as { donorId?: string; hospital?: string; note?: string };
  if (!donorId) {
    return res.status(400).json({ error: 'donorId is required' });
  }

  try {
    const donor = await User.findOne({ _id: donorId, role: 'donor' }).exec();
    if (!donor) {
      return res.status(404).json({ error: 'Selected donor not found' });
    }

    const requestAlert = await SOSAlert.create({
      patientId: patient._id,
      bloodGroup: patient.bloodGroup || donor.bloodGroup || 'B+',
      location: patient.location || { type: 'Point', coordinates: [77.2090, 28.6139] },
      hospital: hospital || 'AIIMS Delhi',
      requestType: 'direct',
      targetedDonor: donor._id,
      deliveryLogs: [],
    });

    io.to(donor._id.toString()).emit('sos-alert', {
      sosId: requestAlert._id,
      bloodGroup: requestAlert.bloodGroup,
      location: requestAlert.location,
      hospital: requestAlert.hospital,
      note: note || null,
      requestType: 'direct',
      patientName: patient.name,
    });

    requestAlert.deliveryLogs.push({
      channel: 'socket',
      recipientUserId: donor._id,
      recipientEmail: typeof donor.email === 'string' ? donor.email : undefined,
      event: 'direct-request-created',
      status: 'sent',
      createdAt: new Date(),
    });

    const donorEmailResult = await sendEmail({
      to: typeof donor.email === 'string' ? donor.email : '',
      subject: `Direct Donation Request: ${requestAlert.bloodGroup} needed`,
      text: `${patient.name || 'A patient'} requested your donation support.\nHospital: ${requestAlert.hospital}\nBlood Group: ${requestAlert.bloodGroup}\n${note ? `Note: ${note}` : ''}`,
      html: `<p><strong>${patient.name || 'A patient'}</strong> requested your donation support.</p><p>Hospital: <strong>${requestAlert.hospital}</strong></p><p>Blood Group: <strong>${requestAlert.bloodGroup}</strong></p>${note ? `<p>Note: ${note}</p>` : ''}`,
    });

    requestAlert.deliveryLogs.push({
      channel: 'email',
      recipientUserId: donor._id,
      recipientEmail: typeof donor.email === 'string' ? donor.email : '',
      event: 'direct-request-created',
      status: donorEmailResult.ok ? 'sent' : donorEmailResult.skipped ? 'skipped' : 'failed',
      reason: donorEmailResult.reason,
      createdAt: new Date(),
    });

    await requestAlert.save();

    return res.status(201).json({
      success: true,
      message: `Donation request sent to ${donor.name}`,
      requestId: requestAlert._id,
      emailDelivery: {
        configured: isEmailServiceConfigured(),
        sent: donorEmailResult.ok,
        reason: donorEmailResult.reason || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to send donation request' });
  }
});

router.get('/admin/sos-delivery-logs', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can access SOS delivery logs' });
  }

  try {
    const alerts = await SOSAlert.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('patientId', 'name')
      .populate('acceptedDonor', 'name')
      .populate('targetedDonor', 'name')
      .lean()
      .exec();

    const logs = alerts.flatMap((alert: any) => {
      const base = {
        sosId: String(alert._id),
        requestType: alert.requestType || 'sos',
        bloodGroup: alert.bloodGroup,
        hospital: alert.hospital || 'N/A',
        status: alert.status,
        patientName: alert.patientId?.name || 'Unknown',
        targetedDonorName: alert.targetedDonor?.name || null,
        acceptedDonorName: alert.acceptedDonor?.name || null,
      };

      const deliveryRows = Array.isArray(alert.deliveryLogs)
        ? alert.deliveryLogs.map((entry: any) => ({
            ...base,
            channel: entry.channel,
            event: entry.event,
            recipientEmail: entry.recipientEmail || null,
            recipientUserId: entry.recipientUserId ? String(entry.recipientUserId) : null,
            statusDelivery: entry.status,
            reason: entry.reason || null,
            createdAt: entry.createdAt || alert.createdAt,
          }))
        : [];

      if (deliveryRows.length > 0) return deliveryRows;

      return [{
        ...base,
        channel: 'unknown',
        event: 'legacy-sos-record',
        recipientEmail: null,
        recipientUserId: null,
        statusDelivery: 'sent',
        reason: null,
        createdAt: alert.createdAt,
      }];
    });

    return res.json({ count: logs.length, logs });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch SOS delivery logs' });
  }
});

// Get all SOS alerts (Mocked fetch)
router.get('/sos', async (req: Request, res: Response) => {
  try {
    const alerts = await SOSAlert.find().sort({ createdAt: -1 }).populate('patientId', 'name bloodGroup').exec();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch SOS alerts' });
  }
});

// Match compatible donors for a patient profile
router.get('/match', async (req: Request, res: Response) => {
  const { bloodGroup, lat, lng, requesterRole } = parseQueryOrBody(req);

  if (!isBloodGroup(bloodGroup) || typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid query. Use GET /api/match?bloodGroup=A%2B&lat=28.6139&lng=77.2090',
      example: '/api/match?bloodGroup=A%2B&lat=28.6139&lng=77.2090&requesterRole=patient',
    });
  }

  if (requesterRole === 'donor') {
    return res.status(403).json({
      success: false,
      error: 'Donor accounts cannot request donor matching.',
    });
  }

  const patient: PatientInput = {
    bloodGroup,
    location: { lat, lng },
  };

  if (Number.isNaN(patient.location.lat) || Number.isNaN(patient.location.lng)) {
    return res.status(400).json({
      success: false,
      error: 'lat and lng must be valid numbers.',
    });
  }

  try {
    const dbDonors = await User.find({ role: 'donor' }).lean().exec();
    const normalizedDonors = dbDonors
      .map(mapUserToDonorProfile)
      .filter((donor): donor is DonorProfile => donor !== null);

    const donorPool = normalizedDonors.length > 0 ? normalizedDonors : mockDonors;
    const matches = matchDonors(patient, donorPool);

    return res.json({
      success: true,
      count: matches.length,
      source: normalizedDonors.length > 0 ? 'database' : 'mock',
      matches,
    });
  } catch (error) {
    console.error('Match GET error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to run matching engine',
    });
  }
});

router.post('/match', async (req: Request, res: Response) => {
  if (!isPatientInput(req.body)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payload. Expected { bloodGroup, location: { lat, lng } }',
    });
  }

  const requesterRole = (req.body as { requesterRole?: unknown }).requesterRole;
  if (requesterRole === 'donor') {
    return res.status(403).json({
      success: false,
      error: 'Donor accounts cannot request donor matching.',
    });
  }

  try {
    const dbDonors = await User.find({ role: 'donor' }).lean().exec();
    const normalizedDonors = dbDonors
      .map(mapUserToDonorProfile)
      .filter((donor): donor is DonorProfile => donor !== null);

    const donorPool = normalizedDonors.length > 0 ? normalizedDonors : mockDonors;
    const matches = matchDonors(req.body, donorPool);

    return res.json({
      success: true,
      count: matches.length,
      source: normalizedDonors.length > 0 ? 'database' : 'mock',
      matches,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to run matching engine',
    });
  }
});

function calculateApproxDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

router.get('/donors/nearby', async (req: Request, res: Response) => {
  const { lat, lng, bloodGroup, maxDistance = 10000 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  try {
    const query: any = {
      role: 'donor',
      avail: { $ne: 'Offline' },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(lng), Number(lat)]
          },
          $maxDistance: Number(maxDistance),
        },
      },
    };

    if (bloodGroup && bloodGroup !== 'all') {
      query.bloodGroup = bloodGroup;
    }

    const donors = await User.find(query).limit(20).exec();
    
    const formattedDonors = donors.map((d: any) => {
      const donorLat = d.location?.coordinates?.[1] || 0;
      const donorLng = d.location?.coordinates?.[0] || 0;
      
      const dist = d.distance || calculateApproxDistance(Number(lat), Number(lng), donorLat, donorLng);
      
      // Calculate Smart Match Score
      const isExactMatch = !bloodGroup || bloodGroup === 'all' || d.bloodGroup === bloodGroup;
      const compScore = isExactMatch ? 1 : 0.8;
      
      const distFactor = Math.max(0, 1 - (dist / (Number(maxDistance)/1000))); // normalize distance 0-1
      const donCountFactor = Math.min(1, (d.donationsCount || 0) / 10);
      const availFactor = d.avail === 'Available' ? 1 : 0.5;
      
      let rawScore = (0.4 * compScore) + (0.3 * distFactor) + (0.2 * donCountFactor) + (0.1 * availFactor);
      const finalScore = (rawScore * 100).toFixed(1);
      
      return {
        _id: d._id,
        name: d.name,
        bloodGroup: d.bloodGroup,
        location: d.location,
        distance: dist.toFixed(1),
        lastDonated: d.lastDonated,
        donationCount: d.donationsCount,
        status: d.avail,
        initials: d.initials,
        score: parseFloat(finalScore),
      };
    }).sort((a, b) => b.score - a.score);

    res.json(formattedDonors);
  } catch (error) {
    console.error('Nearby error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby donors' });
  }
});

let mockTransfusions = [
  { date: new Date('2025-02-14'), hb: 9.8, units: 2, hospital: 'Safdarjung' },
  { date: new Date('2025-03-28'), hb: 10.2, units: 2, hospital: 'AIIMS Delhi' }
];

const patientPlannedAppointments = new Map<
  string,
  Array<{
    id: string;
    date: string;
    time: string;
    type: 'transfusion' | 'checkup' | 'consultation';
    hospital: string;
    doctor?: string;
    notes?: string;
    source: 'planned';
  }>
>();

router.get('/patient/timeline', authMiddleware, async (req: Request, res: Response) => {
  try {
    const patient = (req as any).user;
    const fromProfile = Array.isArray(patient?.transfusions) ? patient.transfusions : [];
    const transfusions = (fromProfile.length > 0 ? fromProfile : mockTransfusions)
      .map((entry: any) => ({
        date: new Date(entry.date),
        hb: Number(entry.hb || 10),
        units: Number(entry.units || 2),
        hospital: entry.hospital || 'Unknown Hospital',
      }))
      .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
    
    if (transfusions.length < 2) {
      return res.json({
        lastTransfusion: transfusions[0]?.date || new Date(),
        avgCycle: 21,
        nextTransfusion: new Date(new Date().setDate(new Date().getDate() + 21)),
        status: 'Due Soon',
        history: transfusions
      });
    }

    let totalDays = 0;
    for (let i = 1; i < transfusions.length; i++) {
      const prev = new Date(transfusions[i - 1].date);
      const curr = new Date(transfusions[i].date);
      totalDays += (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    }
    
    const avgCycle = Math.max(14, Math.floor(totalDays / (transfusions.length - 1)));
    const last = transfusions[transfusions.length - 1];
    
    const nextDate = new Date(last.date);
    nextDate.setDate(nextDate.getDate() + avgCycle);

    res.json({
      lastTransfusion: last.date,
      avgCycle,
      nextTransfusion: nextDate,
      status: nextDate < new Date() ? 'Overdue' : 'Due Soon',
      history: transfusions
    });
  } catch (err) {
    res.status(500).json({ error: 'Timeline failed' });
  }
});

router.post('/patient/timeline', authMiddleware, async (req: Request, res: Response) => {
  try {
    const patient = (req as any).user;
    const { hb, units, hospital } = req.body;
    const newEntry = {
      date: new Date(),
      hb: hb || 10.5,
      units: units || 2,
      hospital: hospital || 'Local Clinic'
    };

    if (patient?.role === 'patient') {
      const transfusions = Array.isArray(patient.transfusions) ? patient.transfusions : [];
      transfusions.push(newEntry);
      patient.transfusions = transfusions;
      await patient.save();
    } else {
      mockTransfusions.push(newEntry);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add timeline record' });
  }
});

router.get('/patient/appointments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const patient = (req as any).user;
    const transfusions = Array.isArray(patient.transfusions) ? [...patient.transfusions] : [];
    transfusions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const completed = transfusions.map((item: any, index: number) => ({
      id: `tx-${index}-${new Date(item.date).getTime()}`,
      date: new Date(item.date).toISOString().slice(0, 10),
      time: '10:00 AM',
      type: 'transfusion' as const,
      hospital: item.hospital || 'Unknown Hospital',
      doctor: undefined,
      status: 'completed' as const,
      notes: `${item.units || 2} units · Hb ${item.hb ?? 'N/A'} g/dL`,
      source: 'history',
    }));

    const planned = patientPlannedAppointments.get(String(patient._id)) || [];

    let avgCycle = 21;
    if (transfusions.length >= 2) {
      let totalDays = 0;
      for (let i = 1; i < transfusions.length; i++) {
        const prev = new Date(transfusions[i - 1].date);
        const curr = new Date(transfusions[i].date);
        totalDays += (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      }
      avgCycle = Math.max(14, Math.round(totalDays / (transfusions.length - 1)));
    }

    const lastDate = transfusions.length > 0 ? new Date(transfusions[transfusions.length - 1].date) : new Date();
    const predictedNext = new Date(lastDate);
    predictedNext.setDate(predictedNext.getDate() + avgCycle);

    const systemUpcoming = {
      id: `next-${String(patient._id)}`,
      date: predictedNext.toISOString().slice(0, 10),
      time: '09:30 AM',
      type: 'transfusion' as const,
      hospital: transfusions[transfusions.length - 1]?.hospital || 'AIIMS Delhi',
      doctor: 'Assigned by care team',
      notes: `Predicted based on ${avgCycle}-day cycle`,
      source: 'predicted',
    };

    const merged = [...completed, ...planned, systemUpcoming]
      .map((item) => {
        const dt = new Date(`${item.date}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return {
          ...item,
          status: dt < today ? ('completed' as const) : ('upcoming' as const),
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return res.json({
      avgCycle,
      appointments: merged,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

router.post('/patient/appointments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const patient = (req as any).user;
    const { date, time, type, hospital, doctor, notes } = req.body as {
      date?: string;
      time?: string;
      type?: 'transfusion' | 'checkup' | 'consultation';
      hospital?: string;
      doctor?: string;
      notes?: string;
    };

    if (!date || !type || !hospital) {
      return res.status(400).json({ error: 'date, type and hospital are required' });
    }

    if (type === 'transfusion') {
      const transfusions = Array.isArray(patient.transfusions) ? patient.transfusions : [];
      transfusions.push({
        date: new Date(date),
        hb: 10.0,
        units: 2,
        hospital,
      });
      patient.transfusions = transfusions;
      await patient.save();
    } else {
      const patientId = String(patient._id);
      const existing = patientPlannedAppointments.get(patientId) || [];
      existing.push({
        id: `plan-${Date.now()}`,
        date,
        time: time || '10:00 AM',
        type,
        hospital,
        doctor,
        notes,
        source: 'planned',
      });
      patientPlannedAppointments.set(patientId, existing);
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create appointment' });
  }
});

router.post('/patient/predictions/model', async (req: Request, res: Response) => {
  try {
    const aiBaseUrl = process.env.AI_SERVICE_URL || 'http://localhost:5001';
    const upstream = await fetch(`${aiBaseUrl}/api/ml/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json(data);
    }

    return res.json(data);
  } catch (err) {
    console.error('ML prediction proxy failed:', err);
    return res.status(500).json({ error: 'Failed to run ML prediction service' });
  }
});

router.post('/patient/predictions/build-dataset', async (_req: Request, res: Response) => {
  try {
    const aiBaseUrl = process.env.AI_SERVICE_URL || 'http://localhost:5001';
    const upstream = await fetch(`${aiBaseUrl}/api/ml/build-dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json(data);
    }

    return res.json(data);
  } catch (err) {
    console.error('Dataset build proxy failed:', err);
    return res.status(500).json({ error: 'Failed to build dataset via ML service' });
  }
});

export default router;
