import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import { authenticate, requireRole } from '../middleware/auth.js';

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

export default router;


