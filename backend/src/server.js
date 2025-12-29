import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { createClient } from '@supabase/supabase-js';
import busesRoutes from './routes/buses.js';
import devicesRoutes from './routes/devices.js';
import mediaRoutes from './routes/media.js';
import schedulesRoutes from './routes/schedules.js';
import createNewsRoutes from './routes/news.js';
import createAnnounceRoutes from './routes/announce.js';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: true, // Allow all origins for now
    credentials: true,
  },
});

app.use(cors({ 
  origin: true, // Allow all origins for now
  credentials: true
}));
app.use(express.json());

// Validate required env vars early with friendly messages
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
try {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL is missing');
  // Validate URL format
  // eslint-disable-next-line no-new
  new URL(SUPABASE_URL);
  if (!/^https?:\/\//i.test(SUPABASE_URL)) throw new Error('SUPABASE_URL must start with http(s)://');
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('\nEnvironment configuration error:\n', e.message, '\n\nExpected in backend/.env:\nSUPABASE_URL=https://<your-project-ref>.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=****************\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'transport-display-pro-backend' });
});

// Debug endpoint to check connected clients
app.get('/api/debug/clients', (_req, res) => {
  const clients = [];
  io.sockets.sockets.forEach((socket, id) => {
    clients.push({
      id: socket.id,
      rooms: Array.from(socket.rooms),
      connected: socket.connected
    });
  });
  res.json({ 
    totalClients: clients.length,
    clients: clients,
    rooms: Array.from(io.sockets.adapter.rooms.keys())
  });
});

// API routes
app.use('/api/buses', busesRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/media', mediaRoutes(io));
app.use('/api/schedules', schedulesRoutes);
app.use('/api/news', createNewsRoutes(io));
app.use('/api', createAnnounceRoutes(io));

// Socket.io basic channels
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // GPS position updates
  socket.on('gps:update', async (payload = {}) => {
    try {
      socket.broadcast.emit('gps:position', payload);
      const { deviceId, lat, lng } = payload;
      const latNum = Number(lat);
      const lngNum = Number(lng);
      if (!deviceId || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return;
      }

      const updates = {
        gps_latitude: latNum,
        gps_longitude: lngNum,
        last_location_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('buses')
        .update(updates)
        .eq('bus_number', deviceId);

      if (error) {
        console.error('Failed to persist GPS update:', error.message);
        return;
      }

      io.to(`bus:${deviceId}`).emit('gps:position', payload);
    } catch (err) {
      console.error('gps:update handler failed', err);
    }
  });
  
  // News broadcasting
  socket.on('news:push', (payload) => {
    console.log('Broadcasting news:', payload);
    io.emit('news:broadcast', payload);
  });
  
  // TV Display registration
  socket.on('tv:register', (payload) => {
    console.log('TV Display registered:', payload);
    socket.join(`bus:${payload.busNumber}`);
    socket.join(`depot:${payload.depot}`);
  });
  
  // Subscribe to specific bus/depot
  socket.on('subscribe', (payload) => {
    console.log('Client subscribed to:', payload);
    if (payload.busNumber) {
      socket.join(`bus:${payload.busNumber}`);
    }
    if (payload.depot) {
      socket.join(`depot:${payload.depot}`);
    }
  });
  
  // Join specific bus/depot
  socket.on('join', (payload) => {
    console.log('Client joined:', payload);
    if (payload.busNumber) {
      socket.join(`bus:${payload.busNumber}`);
    }
    if (payload.depot) {
      socket.join(`depot:${payload.depot}`);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, reason);
  });
});

const port = Number(process.env.PORT || 4000);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});


