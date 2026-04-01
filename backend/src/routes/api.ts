import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import SOSAlert from '../models/SOSAlert';
import mockDonors from '../data/mockDonors';
import { matchDonors } from '../services/matchingService';
import { BloodGroup, DonorProfile, PatientInput } from '../types/matching';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const bloodGroups: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

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

// Seed mock data
router.post('/seed', async (req: Request, res: Response) => {
  try {
    await User.deleteMany({});
    await User.insertMany([
      { name: 'Arjun Sharma', role: 'donor', bloodGroup: 'B+', distance: 2.4, lastDonated: new Date('2025-02-15'), donationsCount: 7, score: 94, initials: 'AS', avail: 'Available' },
      { name: 'Priya Kapoor', role: 'donor', bloodGroup: 'B+', distance: 3.1, lastDonated: new Date('2025-01-20'), donationsCount: 5, score: 88, initials: 'PK', avail: 'Available' },
      { name: 'Vikram Mehta', role: 'donor', bloodGroup: 'O+', distance: 5.7, lastDonated: new Date('2024-11-10'), donationsCount: 12, score: 79, initials: 'VM', avail: 'Maybe' },
      { name: 'Deepika Rao', role: 'donor', bloodGroup: 'B+', distance: 8.2, lastDonated: new Date('2024-12-05'), donationsCount: 3, score: 71, initials: 'DR', avail: 'Offline' }
    ]);
    res.json({ message: 'Mock data seeded successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to seed data' });
  }
});

// Create SOS Alert
router.post('/sos', async (req: Request, res: Response) => {
  const { bloodGroupRequired, hospital, lat, lng, patientId } = req.body as {
    bloodGroupRequired?: string; hospital?: string; lat?: number; lng?: number; patientId?: string;
  };
  try {
    const alert = await SOSAlert.create({
      patientId: patientId || '000000000000000000000000',
      bloodGroupRequired: bloodGroupRequired || 'B+',
      location: { type: 'Point', coordinates: [lng || 77.2090, lat || 28.6139] },
      hospital: hospital || 'AIIMS Delhi',
      status: 'pending',
    });
    res.status(201).json({ success: true, alert });
  } catch (error) {
    console.error('SOS create error:', error);
    res.status(500).json({ error: 'Failed to create SOS alert' });
  }
});

// Get all SOS alerts
router.get('/sos', async (req: Request, res: Response) => {
  try {
    const alerts = await SOSAlert.find().sort({ createdAt: -1 }).populate('patientId', 'name bloodGroup').exec();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch SOS alerts' });
  }
});

// Update SOS alert status
router.put('/sos/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const updated = await SOSAlert.findByIdAndUpdate(id, { status: req.body.status }, { new: true }).exec();
    if (!updated) return res.status(404).json({ error: 'Alert not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update SOS alert' });
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

export default router;
