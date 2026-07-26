import 'dotenv/config';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import User from '../models/User';
import SOSAlert from '../models/SOSAlert';
import Appointment from '../models/Appointment';
import mockDonors from '../data/mockDonors';
import { matchDonors } from '../services/matchingService';
import { BloodGroup, DonorProfile, PatientInput } from '../types/matching';
import { isEmailServiceConfigured, sendEmail } from '../services/emailService';
import { isCompatible } from '../utils/bloodCompatibility';
import { calculateDistance } from '../utils/haversine';
import { calculateScore } from '../services/scoring';
import { sendSMS, sendWhatsApp } from '../services/notify';

const router = Router();

// ─── JWT Secret ──────────────────────────────────────────────────────────────
function resolveJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (configuredSecret && configuredSecret.length >= 32) {
    return configuredSecret;
  }

  if (isProd) {
    throw new Error('JWT_SECRET must be configured and at least 32 characters long.');
  }

  console.warn('JWT_SECRET is missing/short. Using ephemeral dev secret.');
  return crypto.randomBytes(48).toString('hex');
}

const JWT_SECRET = resolveJwtSecret();
const bloodGroups: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

// ─── Auth cookie (httpOnly — JWT is never exposed to browser JavaScript) ─────
const AUTH_COOKIE = 'token';
const IS_PROD = process.env.NODE_ENV === 'production';
const AUTH_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24h — matches JWT expiry

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PROD,          // require HTTPS in production
    sameSite: 'lax' as const, // API is same-origin via the Next.js proxy
    path: '/',
  };
}

function issueAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, { ...authCookieOptions(), maxAge: AUTH_COOKIE_MAX_AGE });
}

// ─── Dev auth bypass — NEVER allowed in production ───────────────────────────
const ALLOW_DEV_AUTH_BYPASS =
  process.env.ALLOW_DEV_AUTH_BYPASS === 'true' &&
  process.env.NODE_ENV !== 'production' &&
  process.env.NODE_ENV !== 'staging';

// ─── Rate limiters ────────────────────────────────────────────────────────────
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const sosLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: 'Too many SOS requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Zod validation schemas ───────────────────────────────────────────────────
const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8).max(128),
  // admin role is NOT allowed via self-registration
  role: z.enum(['patient', 'donor']),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SosRespondSchema = z.object({
  sosId: z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid sosId'),
  response: z.enum(['accepted', 'rejected']),
});

const ObjectIdSchema = z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid id');

const DonationRequestSchema = z.object({
  donorId: ObjectIdSchema,
  hospital: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

// Medical-data validation — reject clinically impossible values instead of
// storing them (a bad hb/units corrupts transfusion-cycle predictions).
const TimelineEntrySchema = z.object({
  hb: z.coerce.number().min(1).max(25),          // g/dL, physiologic range
  units: z.coerce.number().int().min(1).max(10),
  hospital: z.string().trim().min(1).max(200),
});

const AppointmentInputSchema = z.object({
  date: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), 'A valid date is required'),
  time: z.string().trim().max(20).optional(),
  type: z.enum(['transfusion', 'checkup', 'consultation']),
  hospital: z.string().trim().min(1).max(200),
  doctor: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────
type AuthenticatedRequest = Request & { user?: any; io?: any };

// Bounded pagination for list endpoints — caps result sets so a growing table
// can't cause memory spikes / slow responses. Keeps the array response shape,
// so existing clients keep working; they can opt into ?limit= & ?skip=.
function parsePagination(req: Request, defaultLimit = 100, maxLimit = 200) {
  const rawLimit = Number(req.query.limit);
  const rawSkip = Number(req.query.skip);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxLimit) : defaultLimit;
  const skip = Number.isFinite(rawSkip) && rawSkip > 0 ? Math.floor(rawSkip) : 0;
  return { limit, skip };
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
export const authMiddleware = async (req: Request, res: Response, next: Function) => {
  try {
    const reqWithUser = req as AuthenticatedRequest;
    // Prefer the httpOnly cookie; fall back to a Bearer header for API tooling.
    const token = (req as any).cookies?.[AUTH_COOKIE] || req.headers.authorization?.split(' ')[1];

    if (!token) {
      if (ALLOW_DEV_AUTH_BYPASS) {
        const devUserId = req.headers['x-dev-user-id'];
        if (typeof devUserId === 'string' && mongoose.Types.ObjectId.isValid(devUserId)) {
          const devUser = await User.findById(devUserId).exec();
          if (devUser) {
            reqWithUser.user = devUser;
            return next();
          }
        }
      }
      return res.status(401).json({ error: 'Authorization token is required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    reqWithUser.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

const requireRole = (...roles: Array<'patient' | 'donor' | 'admin'>) => (
  req: Request,
  res: Response,
  next: Function,
) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !roles.includes(user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
};

// Verify a short-lived Socket.IO handshake ticket (see /auth/socket-ticket).
// Returns the authenticated identity or null — the socket layer trusts this,
// never a client-supplied user id.
export function verifySocketTicket(token: string): { id: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded?.purpose !== 'socket' || !decoded?.id) return null;
    return { id: String(decoded.id), role: String(decoded.role) };
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isBloodGroup(value: unknown): value is BloodGroup {
  return typeof value === 'string' && bloodGroups.includes(value as BloodGroup);
}

function isPatientInput(body: unknown): body is PatientInput {
  if (!body || typeof body !== 'object') return false;
  const c = body as { bloodGroup?: unknown; location?: { lat?: unknown; lng?: unknown } };
  return (
    isBloodGroup(c.bloodGroup) &&
    typeof c.location?.lat === 'number' &&
    typeof c.location?.lng === 'number'
  );
}

function parseQueryOrBody(req: Request) {
  const rawBG = req.query.bloodGroup || (req.body as any)?.bloodGroup;
  const rawLat = req.query.lat || (req.body as any)?.lat;
  const rawLng = req.query.lng || (req.body as any)?.lng;
  const rawRole = req.query.requesterRole || (req.body as any)?.requesterRole;
  return {
    bloodGroup: rawBG != null ? String(rawBG).toUpperCase() : undefined,
    lat: rawLat != null ? Number(rawLat) : undefined,
    lng: rawLng != null ? Number(rawLng) : undefined,
    requesterRole: rawRole != null ? String(rawRole).toLowerCase() : undefined,
  };
}

function escapeHtml(value: unknown): string {
  const chars: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return String(value ?? '').replace(/[&<>"']/g, (char) => chars[char]);
}

function getAiServiceConfig() {
  const baseUrl = (process.env.AI_SERVICE_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5001')).trim();
  const apiKey = (process.env.AI_SERVICE_API_KEY || '').trim();

  if (!baseUrl) {
    throw new Error('AI_SERVICE_URL must be configured.');
  }

  if (!apiKey && process.env.NODE_ENV === 'production') {
    throw new Error('AI_SERVICE_API_KEY must be configured in production.');
  }

  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

function mapUserToDonorProfile(user: any): DonorProfile | null {
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

// ─── Auth Routes ──────────────────────────────────────────────────────────────

// Register — admin role blocked from self-registration
router.post('/auth/register', authLimiter, async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues ?? (parsed.error as any).errors ?? [];
    return res.status(400).json({ error: issues[0]?.message ?? 'Invalid input' });
  }
  const { name, email, phone, password, role } = parsed.data;

  try {
    const existing = await User.findOne({ email: email.toLowerCase() }).exec();
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      role,
    });

    const token = jwt.sign({ id: newUser._id, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });
    issueAuthCookie(res, token);
    return res.status(201).json({
      message: 'User registered successfully',
      user: { id: newUser._id, name: newUser.name, role: newUser.role, email: newUser.email },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/auth/login', authLimiter, async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const { email, password } = parsed.data;

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
    issueAuthCookie(res, token);
    return res.json({
      message: 'Login successful',
      user: { id: user._id, name: user.name, role: user.role, email: user.email },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Logout — clears the auth cookie so the session ends server-side too.
router.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE, authCookieOptions());
  return res.json({ message: 'Logged out' });
});

// Current session — lets the frontend confirm auth and fetch the user record
// without any token living in JavaScript.
router.get('/auth/me', authMiddleware, (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  return res.json({ user: { id: user._id, name: user.name, role: user.role, email: user.email } });
});

// Short-lived ticket to authenticate the (cross-origin) Socket.IO handshake.
// The httpOnly session cookie can't reach the socket's origin, so we mint a
// 60-second, single-purpose token the client passes in the handshake `auth`.
router.get('/auth/socket-ticket', authMiddleware, (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const ticket = jwt.sign(
    { id: user._id, role: user.role, purpose: 'socket' },
    JWT_SECRET,
    { expiresIn: '60s' },
  );
  return res.json({ ticket });
});

// Save the signed-in user's real location. Registration doesn't collect it, so
// without this a patient can't send an SOS (needs an origin) and a donor is
// never matched by the $near query. The frontend calls this once it has the
// browser geolocation.
const LocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
router.post('/me/location', authMiddleware, async (req: Request, res: Response) => {
  const parsed = LocationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }
  const user = (req as AuthenticatedRequest).user;
  const { lat, lng } = parsed.data;
  await User.findByIdAndUpdate(user._id, {
    location: { type: 'Point', coordinates: [lng, lat] }, // GeoJSON is [lng, lat]
  });
  return res.json({ success: true });
});

// ─── User / Donor Routes ──────────────────────────────────────────────────────

// Get all donors — now requires auth (issue #3)
router.get('/donors', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  try {
    const { limit, skip } = parsePagination(req);
    const donors = await User.find({ role: 'donor' })
      .select('name role bloodGroup location avail lastDonated donationsCount score initials')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
    res.json(donors);
  } catch {
    res.status(500).json({ error: 'Failed to fetch donors' });
  }
});

// Get ALL users (admin only)
router.get('/users', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { limit, skip } = parsePagination(req);
    const users = await User.find().select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).exec();
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update a user (admin only)
router.put('/users/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  const allowedKeys = new Set(['name', 'email', 'role', 'bloodGroup', 'location', 'avail', 'lastDonated', 'donationsCount', 'score', 'initials']);
  const updates = Object.fromEntries(
    Object.entries(req.body || {}).filter(([key]) => allowedKeys.has(key)),
  );
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No allowed fields provided for update' });
  }
  try {
    const updated = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select('-password').exec();
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete a user (admin only)
router.delete('/users/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  try {
    const deleted = await User.findByIdAndDelete(id).exec();
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'User deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Admin: get real user stats
router.get('/admin/stats', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const [totalUsers, totalDonors, totalPatients] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'donor' }),
      User.countDocuments({ role: 'patient' }),
    ]);
    const activeSOS = await SOSAlert.countDocuments({ status: 'active' });
    res.json({ totalUsers, totalDonors, totalPatients, activeSOS });
  } catch {
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

import DonorProfileModel from '../models/DonorProfile';
import Donation from '../models/Donation';
import Achievement from '../models/Achievement';

// Seed mock data (dev only)
router.post('/seed', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SEED_DATA !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    await User.deleteMany({});
    await DonorProfileModel.deleteMany({});
    await Donation.deleteMany({});
    await Achievement.deleteMany({});
    await User.syncIndexes();

    const donorsData = [
      { name: 'Arjun Sharma', email: 'arjun@example.com', role: 'donor', bloodGroup: 'B+', location: { type: 'Point', coordinates: [77.1025, 28.7041] }, avail: 'Available', password: await bcrypt.hash('password123', 12) },
      { name: 'Priya Kapoor', email: 'priya@example.com', role: 'donor', bloodGroup: 'B+', location: { type: 'Point', coordinates: [77.1302, 28.9989] }, avail: 'Available', password: await bcrypt.hash('password123', 12) },
      { name: 'Vikram Mehta', email: 'vikram@example.com', role: 'donor', bloodGroup: 'O+', location: { type: 'Point', coordinates: [77.1802, 28.9989] }, avail: 'Maybe', password: await bcrypt.hash('password123', 12) },
      { name: 'Neha Verma', email: 'neha@example.com', role: 'donor', bloodGroup: 'AB+', location: { type: 'Point', coordinates: [77.209, 28.6139] }, avail: 'Available', password: await bcrypt.hash('password123', 12) },
    ];

    const insertedUsers = await User.insertMany(donorsData);

    for (let i = 0; i < insertedUsers.length; i++) {
      const u = insertedUsers[i];
      const m = 3 - i;
      await DonorProfileModel.create({ userId: u._id, totalDonations: 7 * m, lastDonationDate: new Date('2025-02-01'), responseStats: { totalSOS: 10 * m, acceptedSOS: 9 * m }, impactPoints: 1260 * m });
      await Donation.insertMany([
        { donorId: u._id, date: new Date('2025-02-28'), location: 'AIIMS Delhi', type: 'Whole blood', recipientType: 'Thalassemia patient', status: 'Completed', verified: true, unitsDonated: 1 },
        { donorId: u._id, date: new Date('2024-11-15'), location: 'Safdarjung', type: 'Whole blood', recipientType: 'Emergency SOS', status: 'Completed', verified: true, unitsDonated: 2 },
      ]);
      await Achievement.create({ donorId: u._id, badges: ['First Drop', 'SOS Hero', '5 Lives Saved'], milestones: { bronze: true, silver: false, gold: false } });
    }

    res.json({ message: 'Seed data inserted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to seed data' });
  }
});

// ─── SOS Routes ───────────────────────────────────────────────────────────────

// Create SOS Alert (issue #19 — rate limit now checks resolved status too)
router.post('/sos', authMiddleware, requireRole('patient'), sosLimiter, async (req: Request, res: Response) => {
  const patient = (req as any).user;
  const io = (req as any).io;

  try {
    // Only block if there's an ACTIVE (unresolved) recent SOS
    const lastSOS = await SOSAlert.findOne({
      patientId: patient._id,
      status: { $in: ['active', 'dispatched'] },
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    }).sort({ createdAt: -1 });

    if (lastSOS) {
      return res.status(400).json({ error: 'You already have an active SOS. Wait for it to resolve before sending another.' });
    }

    const patientCoords = patient.location?.coordinates;
    if (!patientCoords || patientCoords.length < 2) {
      return res.status(400).json({ error: 'We could not detect your location. Please allow location access in your browser, reopen the dashboard, then try again.' });
    }
    const [patientLng, patientLat] = patientCoords;

    const requestedBlood = req.body?.bloodGroup;
    const bloodNeeded: BloodGroup | null = isBloodGroup(requestedBlood)
      ? requestedBlood
      : isBloodGroup(patient.bloodGroup)
        ? patient.bloodGroup
        : null;

    if (!bloodNeeded) {
      return res.status(400).json({ error: 'Blood group is required. Select one in the SOS form or update your profile.' });
    }

    const donors = await User.find({
      role: 'donor',
      avail: 'Available',
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [patientLng, patientLat] },
          $maxDistance: 15000,
        },
      },
    }).limit(25).exec();

    const compatibleDonorsObjs = donors
      .filter((donor) => {
        if (!isBloodGroup(donor.bloodGroup)) return false;
        return isCompatible(donor.bloodGroup, bloodNeeded);
      })
      .map((d) => ({ donor: d, score: calculateScore(d, patient) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const compatibleDonors = compatibleDonorsObjs.map((d) => d.donor);

    if (compatibleDonors.length === 0) {
      return res.status(404).json({
        error: `No compatible donors found nearby for ${bloodNeeded}. Register donors with matching blood types or try again later.`,
      });
    }

    const alert = await SOSAlert.create({
      patientId: patient._id,
      bloodGroup: bloodNeeded,
      // patient.location is guaranteed present here (validated above) — no fake fallback.
      location: patient.location,
      hospital: (typeof req.body.hospital === 'string' && req.body.hospital.trim()) || 'Not specified',
      requestType: 'sos',
      // The background sweeper escalates to the hospital if still unaccepted after 30s.
      escalateAt: new Date(Date.now() + 30 * 1000),
      deliveryLogs: [],
    });

    compatibleDonors.forEach((donor) => {
      io.to(donor._id.toString()).emit('sos-alert', {
        sosId: alert._id,
        bloodGroup: alert.bloodGroup,
        location: alert.location,
        hospital: alert.hospital,
        patientName: patient.name || 'Patient',
        requestType: 'sos',
      });
      if (donor.phone) {
        const msg = `🚨 URGENT: Blood needed (${alert.bloodGroup}) near you. Please respond in ThalAI Connect app.`;
        sendSMS(donor.phone, msg);
        sendWhatsApp(donor.phone, msg);
      }
    });

    // Auto-escalation is handled by the persistent SOS sweeper (services/sosSweeper.ts),
    // driven by alert.escalateAt — so it survives server restarts, unlike the old
    // in-memory setTimeout that silently dropped escalations on redeploy.

    const socketLogs = compatibleDonors.map((donor) => ({
      channel: 'socket' as const,
      recipientUserId: donor._id,
      recipientEmail: typeof donor.email === 'string' ? donor.email : undefined,
      event: 'sos-created',
      status: 'sent' as const,
      createdAt: new Date(),
    }));
    alert.deliveryLogs.push(...socketLogs);

    const emailResults = await Promise.all(
      compatibleDonors.map((donor) =>
        sendEmail({
          to: typeof donor.email === 'string' ? donor.email : '',
          subject: `SOS Alert: ${alert.bloodGroup} needed at ${alert.hospital}`,
          text: `Emergency SOS\n\nPatient: ${patient.name || 'Patient'}\nBlood Group: ${alert.bloodGroup}\nHospital: ${alert.hospital}\nPlease open ThalAI Connect and respond immediately.`,
          html: `<p><strong>Emergency SOS</strong></p><p>Hi ${escapeHtml(donor.name)},</p><p>A patient needs <strong>${escapeHtml(alert.bloodGroup)}</strong> blood at <strong>${escapeHtml(alert.hospital)}</strong>.</p>`,
        }),
      ),
    );

    emailResults.forEach((result, index) => {
      const donor = compatibleDonors[index];
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

    const emailsSent = emailResults.filter((e) => e.ok).length;
    const emailsSkipped = emailResults.filter((e) => e.skipped).length;

    res.status(201).json({
      success: true,
      alert,
      message: `SOS sent to ${compatibleDonors.length} compatible donors`,
      emailDelivery: {
        configured: isEmailServiceConfigured(),
        attempted: emailResults.length,
        sent: emailsSent,
        skipped: emailsSkipped,
        failed: emailResults.length - emailsSent - emailsSkipped,
      },
    });
  } catch (error) {
    console.error('SOS create error:', error);
    res.status(500).json({ error: 'Failed to create SOS alert' });
  }
});

// Respond to SOS
router.post('/sos/respond', authMiddleware, requireRole('donor'), async (req: Request, res: Response) => {
  const parsed = SosRespondSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues ?? (parsed.error as any).errors ?? [];
    return res.status(400).json({ error: issues[0]?.message ?? 'Invalid input' });
  }
  const { sosId, response } = parsed.data;
  const donor = (req as any).user;
  const io = (req as any).io;

  try {
    const sos = await SOSAlert.findOneAndUpdate(
      {
        _id: sosId,
        status: { $in: ['active', 'dispatched'] },
        acceptedDonor: null,
        'responders.donorId': { $ne: donor._id },
        $or: [{ targetedDonor: null }, { targetedDonor: donor._id }],
      },
      {
        $push: { responders: { donorId: donor._id, response, respondedAt: new Date() } },
        ...(response === 'accepted' && { acceptedDonor: donor._id, status: 'resolved' }),
      },
      { returnDocument: 'after' },
    );

    if (!sos) {
      return res.status(400).json({ error: 'Alert already handled or expired' });
    }

    if (response === 'accepted') {
      // The donor is now committed to this donation — take them out of the
      // available-donors pool so they aren't shown/requested again until free.
      await User.findByIdAndUpdate(donor._id, { avail: 'Maybe' });

      if (sos.patientId) {
        io?.to(sos.patientId.toString()).emit('sos-accepted', { donorId: donor._id, donorName: donor.name });
      }

      if (!Array.isArray(sos.deliveryLogs)) sos.deliveryLogs = [];
      sos.deliveryLogs.push({ channel: 'socket', recipientUserId: sos.patientId || undefined, event: 'sos-accepted', status: 'sent', createdAt: new Date() });

      const patientUser = await User.findById(sos.patientId).exec();
      const patientEmail = typeof patientUser?.email === 'string' ? patientUser.email : '';
      const donorEmail = typeof donor.email === 'string' ? donor.email : '';

      const [patientEmailResult, donorEmailResult] = await Promise.all([
        sendEmail({ to: patientEmail, subject: 'SOS Update: A donor accepted your request', text: `${donor.name} accepted your SOS for ${sos.bloodGroup} at ${sos.hospital}.`, html: `<p><strong>${escapeHtml(donor.name)}</strong> accepted your SOS for <strong>${escapeHtml(sos.bloodGroup)}</strong> at <strong>${escapeHtml(sos.hospital)}</strong>.</p>` }),
        sendEmail({ to: donorEmail, subject: 'SOS Accepted Confirmation', text: `Thank you ${donor.name}. You accepted an SOS for ${sos.bloodGroup} at ${sos.hospital}.`, html: `<p>Thank you ${escapeHtml(donor.name)}. You accepted an SOS for <strong>${escapeHtml(sos.bloodGroup)}</strong> at <strong>${escapeHtml(sos.hospital)}</strong>.</p>` }),
      ]);

      sos.deliveryLogs.push(
        { channel: 'email', recipientUserId: patientUser?._id, recipientEmail: patientEmail, event: 'sos-accepted', status: patientEmailResult.ok ? 'sent' : patientEmailResult.skipped ? 'skipped' : 'failed', reason: patientEmailResult.reason, createdAt: new Date() },
        { channel: 'email', recipientUserId: donor._id, recipientEmail: donorEmail, event: 'sos-accepted-confirmation', status: donorEmailResult.ok ? 'sent' : donorEmailResult.skipped ? 'skipped' : 'failed', reason: donorEmailResult.reason, createdAt: new Date() },
      );
      await sos.save();

      return res.json({ message: 'Response recorded successfully', emailDelivery: { configured: isEmailServiceConfigured(), patientNotified: patientEmailResult.ok, donorNotified: donorEmailResult.ok } });
    }

    if (sos.targetedDonor && sos.targetedDonor.toString() === donor._id.toString()) {
      sos.status = 'expired';
    }
    await sos.save();
    res.json({ message: 'SOS request declined' });
  } catch (error) {
    console.error('SOS respond error:', error);
    res.status(500).json({ error: 'Failed to process response' });
  }
});

// Get all SOS alerts — role-restricted (issue #6)
router.get('/sos', authMiddleware, requireRole('admin', 'patient'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { limit, skip } = parsePagination(req);
    const query = user.role === 'patient' ? { patientId: user._id } : {};
    const alerts = await SOSAlert.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patientId', 'name bloodGroup')
      .exec();
    res.json(alerts);
  } catch {
    res.status(500).json({ error: 'Failed to fetch SOS alerts' });
  }
});

// ─── Donor Profile ────────────────────────────────────────────────────────────
router.get('/donors/:id/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const donor = await User.findOne({ _id: req.params.id, role: 'donor' })
      .select('name bloodGroup avail location lastDonated donationsCount score initials email')
      .lean().exec();
    if (!donor) return res.status(404).json({ error: 'Donor not found' });
    return res.json({
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
    });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch donor profile' });
  }
});

// Nearby donors — now requires auth (issue #5)
router.get('/donors/nearby', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  const { lat, lng, bloodGroup, maxDistance = 10000 } = req.query;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const maxDistanceNum = Number(maxDistance);
  const requestedBloodGroup = typeof bloodGroup === 'string' && bloodGroup !== 'all'
    ? bloodGroup.toUpperCase()
    : undefined;

  if (
    !Number.isFinite(latNum) ||
    !Number.isFinite(lngNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lngNum < -180 ||
    lngNum > 180
  ) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }

  if (!Number.isFinite(maxDistanceNum) || maxDistanceNum <= 0 || maxDistanceNum > 100000) {
    return res.status(400).json({ error: 'maxDistance must be between 1 and 100000 meters' });
  }

  if (requestedBloodGroup && !isBloodGroup(requestedBloodGroup)) {
    return res.status(400).json({ error: 'Invalid bloodGroup' });
  }
  const compatibleBloodGroup = requestedBloodGroup as BloodGroup | undefined;

  try {
    const query: any = {
      role: 'donor',
      // Only truly-available donors. A donor who accepted a request is set to
      // 'Maybe' (committed) and thus drops out of find-donors here.
      avail: 'Available',
      location: { $near: { $geometry: { type: 'Point', coordinates: [lngNum, latNum] }, $maxDistance: maxDistanceNum } },
    };

    const donors = await User.find(query).limit(20).exec();
    const compatibleDonors = compatibleBloodGroup
      ? donors.filter((donor) => isBloodGroup(donor.bloodGroup) && isCompatible(donor.bloodGroup, compatibleBloodGroup))
      : donors;

    const formattedDonors = compatibleDonors.map((d: any) => {
      const donorLat = d.location?.coordinates?.[1] || 0;
      const donorLng = d.location?.coordinates?.[0] || 0;
      const dist = calculateDistance(latNum, lngNum, donorLat, donorLng);
      const compScore = compatibleBloodGroup ? 1 : 0.8;
      const distFactor = Math.max(0, 1 - dist / (maxDistanceNum / 1000));
      const donCountFactor = Math.min(1, (d.donationsCount || 0) / 10);
      const availFactor = d.avail === 'Available' ? 1 : 0.5;
      const rawScore = 0.4 * compScore + 0.3 * distFactor + 0.2 * donCountFactor + 0.1 * availFactor;
      return {
        _id: d._id, name: d.name, bloodGroup: d.bloodGroup, location: d.location,
        distance: dist.toFixed(1), lastDonated: d.lastDonated, donationCount: d.donationsCount,
        status: d.avail, initials: d.initials, score: parseFloat((rawScore * 100).toFixed(1)),
      };
    }).sort((a, b) => b.score - a.score);

    res.json(formattedDonors);
  } catch (error) {
    console.error('Nearby error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby donors' });
  }
});

// ─── Matching Routes — now requires auth (issue #4) ───────────────────────────
router.get('/match', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  const { bloodGroup, lat, lng, requesterRole } = parseQueryOrBody(req);
  if (!isBloodGroup(bloodGroup) || typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ success: false, error: 'Invalid query. Use GET /api/match?bloodGroup=A%2B&lat=28.6139&lng=77.2090' });
  }
  const requester = (req as AuthenticatedRequest).user;
  if (requester?.role === 'donor' || requesterRole === 'donor') return res.status(403).json({ success: false, error: 'Donor accounts cannot request donor matching.' });

  try {
    const dbDonors = await User.find({ role: 'donor' }).lean().exec();
    const normalizedDonors = dbDonors.map(mapUserToDonorProfile).filter((d): d is DonorProfile => d !== null);
    const donorPool = normalizedDonors.length > 0 ? normalizedDonors : mockDonors;
    const matches = matchDonors({ bloodGroup, location: { lat, lng } }, donorPool);
    return res.json({ success: true, count: matches.length, source: normalizedDonors.length > 0 ? 'database' : 'mock', matches });
  } catch (error) {
    console.error('Match GET error:', error);
    return res.status(500).json({ success: false, error: 'Failed to run matching engine' });
  }
});

router.post('/match', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  if (!isPatientInput(req.body)) {
    return res.status(400).json({ success: false, error: 'Invalid payload. Expected { bloodGroup, location: { lat, lng } }' });
  }
  const requesterRole = (req.body as any).requesterRole;
  const requester = (req as AuthenticatedRequest).user;
  if (requester?.role === 'donor' || requesterRole === 'donor') return res.status(403).json({ success: false, error: 'Donor accounts cannot request donor matching.' });

  try {
    const dbDonors = await User.find({ role: 'donor' }).lean().exec();
    const normalizedDonors = dbDonors.map(mapUserToDonorProfile).filter((d): d is DonorProfile => d !== null);
    const donorPool = normalizedDonors.length > 0 ? normalizedDonors : mockDonors;
    const matches = matchDonors(req.body, donorPool);
    return res.json({ success: true, count: matches.length, source: normalizedDonors.length > 0 ? 'database' : 'mock', matches });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to run matching engine' });
  }
});

// ─── Patient Donation Request ─────────────────────────────────────────────────
router.post('/patient/donation-request', authMiddleware, requireRole('patient'), async (req: Request, res: Response) => {
  const patient = (req as any).user;
  const io = (req as any).io;
  const parsed = DonationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues ?? (parsed.error as any).errors ?? [];
    return res.status(400).json({ error: issues[0]?.message ?? 'Invalid donation request' });
  }
  const { donorId, hospital, note } = parsed.data;

  try {
    const donor = await User.findOne({ _id: donorId, role: 'donor' }).exec();
    if (!donor) return res.status(404).json({ error: 'Selected donor not found' });
    if (donor.avail === 'Offline') return res.status(400).json({ error: 'Selected donor is not available' });
    if (isBloodGroup(patient.bloodGroup) && isBloodGroup(donor.bloodGroup) && !isCompatible(donor.bloodGroup, patient.bloodGroup)) {
      return res.status(400).json({ error: `${donor.bloodGroup} is not compatible with ${patient.bloodGroup}` });
    }

    // One request per donor: block a duplicate while an earlier request to this
    // same donor is still pending, or has already been accepted.
    const existingRequest = await SOSAlert.findOne({
      patientId: patient._id,
      targetedDonor: donor._id,
      requestType: 'direct',
      status: { $in: ['active', 'dispatched', 'resolved'] },
    }).exec();
    if (existingRequest) {
      return res.status(409).json({
        error: existingRequest.status === 'resolved'
          ? 'This donor has already accepted your request.'
          : 'You already have a pending request with this donor.',
      });
    }

    const requestAlert = await SOSAlert.create({
      patientId: patient._id,
      bloodGroup: patient.bloodGroup || donor.bloodGroup || 'B+',
      location: patient.location || { type: 'Point', coordinates: [77.209, 28.6139] },
      hospital: hospital || 'AIIMS Delhi',
      requestType: 'direct',
      targetedDonor: donor._id,
      deliveryLogs: [],
    });

    io.to(donor._id.toString()).emit('sos-alert', { sosId: requestAlert._id, bloodGroup: requestAlert.bloodGroup, location: requestAlert.location, hospital: requestAlert.hospital, note: note || null, requestType: 'direct', patientName: patient.name });

    requestAlert.deliveryLogs.push({ channel: 'socket', recipientUserId: donor._id, recipientEmail: typeof donor.email === 'string' ? donor.email : undefined, event: 'direct-request-created', status: 'sent', createdAt: new Date() });

    const donorEmailResult = await sendEmail({
      to: typeof donor.email === 'string' ? donor.email : '',
      subject: `Direct Donation Request: ${requestAlert.bloodGroup} needed`,
      text: `${patient.name || 'A patient'} requested your donation support.\nHospital: ${requestAlert.hospital}\nBlood Group: ${requestAlert.bloodGroup}${note ? `\nNote: ${note}` : ''}`,
      html: `<p><strong>${escapeHtml(patient.name || 'A patient')}</strong> requested your donation support.</p><p>Hospital: <strong>${escapeHtml(requestAlert.hospital)}</strong></p><p>Blood Group: <strong>${escapeHtml(requestAlert.bloodGroup)}</strong></p>${note ? `<p>Note: ${escapeHtml(note)}</p>` : ''}`,
    });

    requestAlert.deliveryLogs.push({ channel: 'email', recipientUserId: donor._id, recipientEmail: typeof donor.email === 'string' ? donor.email : '', event: 'direct-request-created', status: donorEmailResult.ok ? 'sent' : donorEmailResult.skipped ? 'skipped' : 'failed', reason: donorEmailResult.reason, createdAt: new Date() });
    await requestAlert.save();

    return res.status(201).json({ success: true, message: `Donation request sent to ${donor.name}`, requestId: requestAlert._id, emailDelivery: { configured: isEmailServiceConfigured(), sent: donorEmailResult.ok } });
  } catch {
    return res.status(500).json({ error: 'Failed to send donation request' });
  }
});

// ─── Patient Timeline ─────────────────────────────────────────────────────────
router.get('/patient/timeline', authMiddleware, requireRole('patient'), async (req: Request, res: Response) => {
  try {
    const patient = (req as any).user;
    const transfusions = (Array.isArray(patient.transfusions) ? patient.transfusions : [])
      .map((e: any) => ({ date: new Date(e.date), hb: Number(e.hb || 10), units: Number(e.units || 2), hospital: e.hospital || 'Unknown Hospital' }))
      .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

    if (transfusions.length < 2) {
      return res.json({ lastTransfusion: transfusions[0]?.date || new Date(), avgCycle: 21, nextTransfusion: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), status: 'Due Soon', history: transfusions });
    }

    let totalDays = 0;
    for (let i = 1; i < transfusions.length; i++) {
      totalDays += (transfusions[i].date.getTime() - transfusions[i - 1].date.getTime()) / (1000 * 60 * 60 * 24);
    }
    const avgCycle = Math.max(14, Math.floor(totalDays / (transfusions.length - 1)));
    const last = transfusions[transfusions.length - 1];
    const nextDate = new Date(last.date);
    nextDate.setDate(nextDate.getDate() + avgCycle);

    res.json({ lastTransfusion: last.date, avgCycle, nextTransfusion: nextDate, status: nextDate < new Date() ? 'Overdue' : 'Due Soon', history: transfusions });
  } catch {
    res.status(500).json({ error: 'Timeline failed' });
  }
});

router.post('/patient/timeline', authMiddleware, requireRole('patient'), async (req: Request, res: Response) => {
  try {
    const parsed = TimelineEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid transfusion record' });
    }
    const patient = (req as any).user;
    const { hb, units, hospital } = parsed.data;
    const newEntry = { date: new Date(), hb, units, hospital };

    await User.findByIdAndUpdate(patient._id, { $push: { transfusions: newEntry } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Failed to add timeline record' });
  }
});

// ─── Patient Appointments (now persisted in MongoDB — issue #10) ──────────────
router.get('/patient/appointments', authMiddleware, requireRole('patient'), async (req: Request, res: Response) => {
  try {
    const patient = (req as any).user;
    const freshUser = await User.findById(patient._id).exec();
    const transfusions = Array.isArray(freshUser?.transfusions) ? [...freshUser!.transfusions] : [];
    transfusions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const completed = transfusions.map((item: any, index: number) => ({
      id: `tx-${index}-${new Date(item.date).getTime()}`,
      date: new Date(item.date).toISOString().slice(0, 10),
      time: '10:00 AM',
      type: 'transfusion' as const,
      hospital: item.hospital || 'Unknown Hospital',
      status: 'completed' as const,
      notes: `${item.units || 2} units · Hb ${item.hb ?? 'N/A'} g/dL`,
      source: 'history',
    }));

    const planned = await Appointment.find({ patientId: patient._id }).lean().exec();

    let avgCycle = 21;
    if (transfusions.length >= 2) {
      let totalDays = 0;
      for (let i = 1; i < transfusions.length; i++) {
        totalDays += (new Date(transfusions[i].date).getTime() - new Date(transfusions[i - 1].date).getTime()) / (1000 * 60 * 60 * 24);
      }
      avgCycle = Math.max(14, Math.round(totalDays / (transfusions.length - 1)));
    }

    const lastDate = transfusions.length > 0 ? new Date(transfusions[transfusions.length - 1].date) : new Date();
    const predictedNext = new Date(lastDate);
    predictedNext.setDate(predictedNext.getDate() + avgCycle);

    const systemUpcoming = { id: `next-${String(patient._id)}`, date: predictedNext.toISOString().slice(0, 10), time: '09:30 AM', type: 'transfusion' as const, hospital: transfusions[transfusions.length - 1]?.hospital || 'AIIMS Delhi', doctor: 'Assigned by care team', notes: `Predicted based on ${avgCycle}-day cycle`, source: 'predicted' };

    const merged = [...completed, ...planned.map((p: any) => ({ id: String(p._id), date: p.date, time: p.time, type: p.type, hospital: p.hospital, doctor: p.doctor, notes: p.notes, source: p.source })), systemUpcoming]
      .map((item) => {
        const dt = new Date(`${item.date}T00:00:00`);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return { ...item, status: dt < today ? 'completed' as const : 'upcoming' as const };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return res.json({ avgCycle, appointments: merged });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

router.post('/patient/appointments', authMiddleware, requireRole('patient'), async (req: Request, res: Response) => {
  try {
    const parsed = AppointmentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid appointment' });
    }
    const patient = (req as any).user;
    const { date, time, type, hospital, doctor, notes } = parsed.data;

    // All appointment types (including transfusion) are stored as PLANNED
    // appointments. We no longer fabricate a completed-transfusion record with
    // hb:10/units:2 — real values are recorded via /patient/timeline once the
    // transfusion actually happens, keeping the cycle prediction honest.
    await Appointment.create({
      patientId: patient._id,
      date, time: time || '10:00 AM', type, hospital, doctor, notes,
      source: 'planned',
    });
    return res.status(201).json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// ─── ML Prediction Proxy ──────────────────────────────────────────────────────
router.post('/patient/predictions/model', authMiddleware, requireRole('patient'), async (req: Request, res: Response) => {
  try {
    const ai = getAiServiceConfig();
    const upstream = await fetch(`${ai.baseUrl}/api/ml/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': ai.apiKey },
      body: JSON.stringify(req.body || {}),
    });
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(data);
    return res.json(data);
  } catch (err) {
    console.error('ML prediction proxy failed:', err);
    return res.status(500).json({ error: 'Failed to run ML prediction service' });
  }
});

router.post('/patient/predictions/build-dataset', authMiddleware, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const ai = getAiServiceConfig();
    const upstream = await fetch(`${ai.baseUrl}/api/ml/build-dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': ai.apiKey },
    });
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(data);
    return res.json(data);
  } catch (err) {
    console.error('Dataset build proxy failed:', err);
    return res.status(500).json({ error: 'Failed to build dataset via ML service' });
  }
});

// ─── AI Chat Proxy (issue #18 — frontend now calls /api/ai/chat, not localhost) ─
router.post('/ai/chat', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }
    const ai = getAiServiceConfig();
    const upstream = await fetch(`${ai.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': ai.apiKey },
      body: JSON.stringify({ message }),
    });
    const data = await upstream.json();
    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (err) {
    console.error('AI chat proxy failed:', err);
    return res.status(500).json({ error: 'AI service unavailable' });
  }
});

// ─── Admin SOS Delivery Logs ──────────────────────────────────────────────────
router.get('/admin/sos-delivery-logs', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const alerts = await SOSAlert.find().sort({ createdAt: -1 }).limit(100).populate('patientId', 'name').populate('acceptedDonor', 'name').populate('targetedDonor', 'name').lean().exec();
    const logs = (alerts as any[]).flatMap((alert) => {
      const base = { sosId: String(alert._id), requestType: alert.requestType || 'sos', bloodGroup: alert.bloodGroup, hospital: alert.hospital || 'N/A', status: alert.status, patientName: alert.patientId?.name || 'Unknown', targetedDonorName: alert.targetedDonor?.name || null, acceptedDonorName: alert.acceptedDonor?.name || null };
      const rows = Array.isArray(alert.deliveryLogs) ? alert.deliveryLogs.map((entry: any) => ({ ...base, channel: entry.channel, event: entry.event, recipientEmail: entry.recipientEmail || null, recipientUserId: entry.recipientUserId ? String(entry.recipientUserId) : null, statusDelivery: entry.status, reason: entry.reason || null, createdAt: entry.createdAt || alert.createdAt })) : [];
      return rows.length > 0 ? rows : [{ ...base, channel: 'unknown', event: 'legacy-sos-record', recipientEmail: null, recipientUserId: null, statusDelivery: 'sent', reason: null, createdAt: alert.createdAt }];
    });
    return res.json({ count: logs.length, logs });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch SOS delivery logs' });
  }
});

export default router;
