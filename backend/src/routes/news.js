import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate, requireRole } from '../middleware/auth.js';

export default function createNewsRoutes(io) {
  const router = Router();
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  router.get('/', authenticate, async (_req, res) => {
    const { data, error } = await supabase.from('news_feeds').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  router.post('/', authenticate, requireRole('admin', 'operator'), async (req, res) => {
    const { title, content, priority, is_active, expires_at } = req.body;
    const { error, data } = await supabase.from('news_feeds').insert([{ title, content, priority, is_active, expires_at }]).select('*').single();
    if (error) return res.status(400).json({ error: error.message });
    io.emit('news:broadcast', { title: data.title, content: data.content });
    return res.status(201).json(data);
  });

  return router;
}


