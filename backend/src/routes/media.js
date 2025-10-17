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
  // Return a unique list by URL so the same asset isn't repeated in selectors
  const { data, error } = await supabase
    .from('media_library')
    .select('url, type, name')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const seen = new Set();
  const unique = [];
  for (const row of data || []) {
    if (row?.url && !seen.has(row.url)) {
      seen.add(row.url);
      unique.push({ url: row.url, type: row.type, name: row.name });
    }
  }
  return res.json(unique);
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

// Public endpoint to get media by bus number directly (defensive against ID mapping issues)
router.get('/public/bus-number/:busNumber', async (req, res) => {
  try {
    const { busNumber } = req.params;
    const { data: buses, error: busErr } = await supabase
      .from('buses')
      .select('id, bus_number')
      .eq('bus_number', busNumber)
      .limit(1);
    if (busErr) return res.status(500).json({ error: busErr.message });
    const bus = Array.isArray(buses) && buses[0] ? buses[0] : null;
    if (!bus) return res.json([]);
    const { data, error } = await supabase
      .from('media_library')
      .select('url, type, name, bus_id, created_at')
      .eq('bus_id', bus.id)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Debug: return counts of media rows per provided bus numbers or IDs
router.get('/public/debug/assignments', async (req, res) => {
  try {
    const { busNumbers, busIds } = req.query;
    let ids = [];
    if (busIds) {
      ids = String(busIds).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (busNumbers) {
      const nums = String(busNumbers).split(',').map((s) => s.trim()).filter(Boolean);
      const { data: buses, error: busErr } = await supabase
        .from('buses')
        .select('id, bus_number')
        .in('bus_number', nums);
      if (busErr) return res.status(500).json({ error: busErr.message });
      ids = (buses || []).map((b) => b.id);
    }
    if (!ids.length) return res.json({ items: [], counts: {}, ids: [] });
    const { data, error } = await supabase
      .from('media_library')
      .select('id, name, type, url, bus_id, created_at')
      .in('bus_id', ids)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    const counts = {};
    for (const row of data || []) counts[row.bus_id] = (counts[row.bus_id] || 0) + 1;
    return res.json({ items: data || [], counts, ids });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Public endpoint to assign media items to multiple buses
// Body: { busIds: string[], items: { url: string, type: 'file'|'link', name?: string }[] }
router.post('/public/assign', async (req, res) => {
  try {
    const { busIds, items } = req.body || {};
    console.log('DEV Assigning media to buses:', busIds, items);
    if (!Array.isArray(busIds) || busIds.length === 0) return res.status(400).json({ error: 'busIds required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' });

    // Build candidate rows from request
    const candidateRows = [];
    for (const busId of busIds) {
      for (const item of items) {
        if (!item?.url || !item?.type) continue;
        candidateRows.push({
          name: item.name || 'Media',
          type: item.type,
          url: item.url,
          bus_id: busId,
        });
      }
    }

    if (candidateRows.length === 0) return res.status(400).json({ error: 'No valid assignments' });

    // Clear existing media for selected buses first (replace behavior)
    console.log('Clearing existing media for buses:', busIds);
    const { error: deleteError } = await supabase
      .from('media_library')
      .delete()
      .in('bus_id', busIds);
    
    if (deleteError) {
      console.error('Error clearing existing media:', deleteError);
      return res.status(500).json({ error: `Failed to clear existing media: ${deleteError.message}` });
    }

    console.log('Cleared existing media, now inserting new media...');

    const { error, data } = await supabase
      .from('media_library')
      .insert(candidateRows)
      .select('id, name, type, url, bus_id');
    if (error) return res.status(400).json({ error: error.message });

    // Emit targeted media update events to specific buses only when new rows were inserted
    if (io && data && data.length > 0) {
      console.log('Emitting media updates for buses:', busIds);
      
      // Get bus numbers for the bus IDs to emit to the correct rooms
      const { data: busData, error: busError } = await supabase
        .from('buses')
        .select('id, bus_number')
        .in('id', busIds);
      
      if (!busError && busData) {
        // Emit to specific buses using both bus ID and bus number
        for (const bus of busData) {
          const busMediaItems = data.filter(item => item.bus_id === bus.id);
          
          // Emit to bus ID room
          io.to(`bus:${bus.id}`).emit('media:update', {
            message: 'New media assigned to your bus',
            busId: bus.id,
            busNumber: bus.bus_number,
            mediaCount: busMediaItems.length,
            mediaItems: busMediaItems
          });
          
          // Emit to bus number room (for TV displays using bus numbers)
          io.to(`bus:${bus.bus_number}`).emit('media:update', {
            message: 'New media assigned to your bus',
            busId: bus.id,
            busNumber: bus.bus_number,
            mediaCount: busMediaItems.length,
            mediaItems: busMediaItems
          });
          
          // Also emit playlist update to both rooms
          io.to(`bus:${bus.id}`).emit('playlist:update', {
            message: 'Playlist updated',
            busId: bus.id,
            busNumber: bus.bus_number,
            mediaItems: busMediaItems
          });
          
          io.to(`bus:${bus.bus_number}`).emit('playlist:update', {
            message: 'Playlist updated',
            busId: bus.id,
            busNumber: bus.bus_number,
            mediaItems: busMediaItems
          });
        }
      }
      
      // Emit general media refresh to all connected clients
      io.emit('media:refresh', {
        message: 'Media library updated',
        busIds: busIds,
        mediaCount: data.length,
      });
    }

    return res.status(201).json({ 
      inserted: data?.length || 0, 
      items: data, 
      replaced: true,
      message: `Replaced all existing media for ${busIds.length} bus(es) with ${data?.length || 0} new media item(s)`
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/upload', authenticate, requireRole('admin', 'operator'), upload.single('file'), async (req, res) => {
  try {
    const { title, type } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Missing file' });
    // De-duplication: if a file with same title and approx. size already exists, reuse it
    const sizeMb = req.file.size / (1024 * 1024);
    const { data: existingAsset, error: findErr } = await supabase
      .from('media_content')
      .select('*')
      .ilike('title', title || '')
      .limit(10);
    if (findErr) {
      // continue with upload on read error
    } else if (existingAsset && existingAsset.length) {
      const match = existingAsset.find((row) => {
        const diff = Math.abs((row.file_size_mb || 0) - sizeMb);
        return diff <= 0.05; // within ~50KB for typical assets
      });
      if (match) {
        return res.status(200).json(match);
      }
    }
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

// Notify TV clients to purge local caches after replace action
router.post('/public/notify-purge', async (req, res) => {
  try {
    const { busIds } = req.body || {};
    if (!io) return res.status(200).json({ ok: true });
    if (Array.isArray(busIds) && busIds.length) {
      const { data: busData } = await supabase
        .from('buses')
        .select('id, bus_number')
        .in('id', busIds);
      for (const bus of busData || []) {
        io.to(`bus:${bus.id}`).emit('playlist:update', { message: 'purge' });
        io.to(`bus:${bus.bus_number}`).emit('playlist:update', { message: 'purge' });
      }
    } else {
      io.emit('playlist:update', { message: 'purge' });
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: true });
  }
});

// Simple proxy to fetch public media files with appropriate headers to improve SW caching
router.get('/public/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' });
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(502).json({ error: `Upstream ${upstream.status}` });
    // Stream response with cache-friendly headers
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Accept-Ranges', 'bytes');
    upstream.body.pipe(res);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

  return router;
}


