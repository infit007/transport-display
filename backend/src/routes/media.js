import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import { authenticate, requireRole } from '../middleware/auth.js';

export default function createMediaRoutes(io) {
  const router = Router();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.get('/', authenticate, async (_req, res) => {
  const { data, error } = await supabase.from('media_content').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// Public endpoint for TV Display App (no auth required)
router.get('/public', async (_req, res) => {
  const { data, error } = await supabase
    .from('media_library')
    .select('url, type, name, bus_id')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// Public endpoint to get media for specific bus
router.get('/public/bus/:busId', async (req, res) => {
  const { busId } = req.params;
  const { data, error } = await supabase
    .from('media_library')
    .select('url, type, name, bus_id, created_at')
    .eq('bus_id', busId)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// Public endpoint to assign media items to multiple buses
// Body: { busIds: string[], items: { url: string, type: 'file'|'link', name?: string }[] }
router.post('/public/assign', async (req, res) => {
  try {
    const { busIds, items } = req.body || {};
    console.log('DEV Assigning media to buses:', busIds, items);
    if (!Array.isArray(busIds) || busIds.length === 0) return res.status(400).json({ error: 'busIds required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' });

    const rows = [];
    for (const busId of busIds) {
      for (const item of items) {
        if (!item?.url || !item?.type) continue;
        rows.push({
          name: item.name || 'Media',
          type: item.type,
          url: item.url,
          bus_id: busId,
        });
      }
    }

    if (rows.length === 0) return res.status(400).json({ error: 'No valid assignments' });

    const { error, data } = await supabase
      .from('media_library')
      .insert(rows)
      .select('id, name, type, url, bus_id');
    if (error) return res.status(400).json({ error: error.message });
    
    // Emit media update event to all connected clients
    if (io && data && data.length > 0) {
      io.emit('media:update', { 
        message: 'New media assigned to buses',
        busIds: busIds,
        mediaCount: data.length 
      });
    }
    
    return res.status(201).json({ inserted: data?.length || 0, items: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/upload', authenticate, requireRole('admin', 'operator'), upload.single('file'), async (req, res) => {
  try {
    const { title, type } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Missing file' });
    const uploaded = await cloudinary.uploader.upload_stream({ resource_type: 'auto', folder: 'fleetsignage' }, async (err, result) => {
      if (err || !result) return res.status(500).json({ error: err?.message || 'Upload failed' });
      const insert = await supabase.from('media_content').insert([{ title, type, file_url: result.secure_url, file_size_mb: req.file.size / (1024 * 1024) }]).select('*').single();
      if (insert.error) return res.status(400).json({ error: insert.error.message });
      return res.status(201).json(insert.data);
    });
    // pipe buffer
    const stream = uploaded;
    // @ts-ignore
    stream.end(req.file.buffer);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

  return router;
}


