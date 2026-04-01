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
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

app.use(cors());
app.use(express.json());

// Health-check root route (fixes 404 on GET /)
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'ThalAI Connect API', version: '1.0.0' });
});

// Routes
app.use('/api', apiRoutes);

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

  socket.on('join_room', (role) => {
    socket.join(role);
    console.log(`User joined room: ${role}`);
  });

  socket.on('sos_alert', (data) => {
    console.log('SOS Alert received:', data);
    // Broadcast to donors
    socket.to('donor').emit('new_sos_alert', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
