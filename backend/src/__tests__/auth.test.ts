import request from 'supertest';
import express from 'express';
import apiRoutes from '../routes/api';

// Helper: wraps a resolved value so .exec() works on the mock
const withExec = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });

// Mock mongoose
jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  connect: jest.fn().mockResolvedValue(undefined),
  Types: { ObjectId: { isValid: jest.fn().mockReturnValue(true) } },
}));

// Mock User model — all query methods return objects with .exec()
jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
  countDocuments: jest.fn().mockResolvedValue(0),
  syncIndexes: jest.fn().mockResolvedValue(undefined),
  deleteMany: jest.fn().mockResolvedValue(undefined),
  insertMany: jest.fn().mockResolvedValue([]),
}));

jest.mock('../models/SOSAlert', () => ({
  findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
  create: jest.fn(),
  find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
  countDocuments: jest.fn().mockResolvedValue(0),
}));

jest.mock('../models/Appointment', () => ({
  find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
  create: jest.fn(),
}));

jest.mock('../models/DonorProfile', () => ({
  deleteMany: jest.fn().mockResolvedValue(undefined),
  create: jest.fn(),
}));

jest.mock('../models/Donation', () => ({
  deleteMany: jest.fn().mockResolvedValue(undefined),
  insertMany: jest.fn().mockResolvedValue([]),
}));

jest.mock('../models/Achievement', () => ({
  deleteMany: jest.fn().mockResolvedValue(undefined),
  create: jest.fn(),
}));

jest.mock('../services/emailService', () => ({
  isEmailServiceConfigured: jest.fn().mockReturnValue(false),
  sendEmail: jest.fn().mockResolvedValue({ ok: false, skipped: true, reason: 'not configured' }),
}));

jest.mock('../services/notify', () => ({
  sendSMS: jest.fn().mockResolvedValue(undefined),
  sendWhatsApp: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock_token'),
  verify: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use((req: any, _res: any, next: any) => {
  req.io = { to: () => ({ emit: jest.fn() }) };
  next();
});
app.use('/api', apiRoutes);

const UserMock = require('../models/User');
const bcryptMock = require('bcrypt');

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset find to default empty
    UserMock.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
  });

  describe('POST /api/auth/register', () => {
    it('should register a patient successfully', async () => {
      // findOne returns null (no existing user) — must include .exec()
      UserMock.findOne.mockReturnValue(withExec(null));
      UserMock.create.mockResolvedValue({
        _id: 'user123',
        name: 'Test Patient',
        email: 'patient@test.com',
        role: 'patient',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Patient',
          email: 'patient@test.com',
          phone: '+1234567890',
          password: 'password123',
          role: 'patient',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.role).toBe('patient');
    });

    it('should return 409 for duplicate email', async () => {
      // findOne returns an existing user
      UserMock.findOne.mockReturnValue(withExec({
        _id: 'existing123',
        email: 'existing@test.com',
      }));

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate User',
          email: 'existing@test.com',
          password: 'password123',
          role: 'patient',
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 when admin role is requested', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'password123',
          role: 'admin',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'Test User',
        email: 'user@test.com',
        role: 'patient',
        password: 'hashed_password',
      };
      UserMock.findOne.mockReturnValue(withExec(mockUser));
      bcryptMock.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('user@test.com');
    });

    it('should return 401 for wrong password', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'Test User',
        email: 'user@test.com',
        role: 'patient',
        password: 'hashed_password',
      };
      UserMock.findOne.mockReturnValue(withExec(mockUser));
      bcryptMock.compare.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });
});

describe('Protected Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/donors should return 401 without token', async () => {
    const res = await request(app).get('/api/donors');
    expect(res.status).toBe(401);
  });

  it('GET /api/donors/nearby should return 401 without token', async () => {
    const res = await request(app).get('/api/donors/nearby?lat=28.6&lng=77.2');
    expect(res.status).toBe(401);
  });

  it('GET /api/match should return 401 without token', async () => {
    const res = await request(app).get('/api/match?bloodGroup=B%2B&lat=28.6139&lng=77.2090');
    expect(res.status).toBe(401);
  });
});
