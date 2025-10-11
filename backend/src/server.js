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

// API routes
app.use('/api/buses', busesRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/news', createNewsRoutes(io));

// Socket.io basic channels
io.on('connection', (socket) => {
  socket.on('gps:update', (payload) => {
    socket.broadcast.emit('gps:position', payload);
  });
  socket.on('news:push', (payload) => {
    io.emit('news:broadcast', payload);
  });
});

const port = Number(process.env.PORT || 4000);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});


