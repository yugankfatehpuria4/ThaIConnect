import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import apiRoutes from './routes/api';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3010';
const io = new Server(httpServer, {
  cors: {
    origin: [frontendOrigin, 'http://localhost:3000', 'http://localhost:3010'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
});

app.use(cors());
app.use((req, res, next) => {
  (req as any).io = io;
  next();
});
app.use(express.json());

// Health-check root route (fixes 404 on GET /)
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'ThalAI Connect API', version: '1.0.0' });
});

// Routes
import donorStatsRoutes from './routes/donorStats';

app.use('/api', apiRoutes);
app.use('/api/donor', donorStatsRoutes);

// Database Connection — tries Atlas first, falls back to local MongoDB
const ATLAS_URI = (process.env.MONGODB_URI || '').trim();
const LOCAL_URI = 'mongodb://127.0.0.1:27017/thaiconnect';

mongoose.set('strictQuery', true);

async function connectDB() {
  // Try Atlas first (if configured)
  if (ATLAS_URI) {
    try {
      await mongoose.connect(ATLAS_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('✅ Connected to MongoDB Atlas');
      return;
    } catch (err) {
      console.warn('⚠️  Atlas connection failed (SSL/IP whitelist issue?). Falling back to local MongoDB...');
    }
  }

  // Fallback to local MongoDB
  try {
    await mongoose.connect(LOCAL_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to local MongoDB:', LOCAL_URI);
  } catch (err) {
    console.error('❌ Could not connect to any MongoDB instance.');
    console.error('   Please start local MongoDB or whitelist your IP in Atlas.');
  }
}

connectDB();

mongoose.connection.on('connected', () => {
  console.log('Mongoose connection established.');
});
mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error event:', err.message);
});

// Socket.io for Real-Time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User joined personal room: ${userId}`);
  });

  socket.on('sos_alert', (data) => {
    console.log('SOS Alert received mapping directly:', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
