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

  // Public list of active news (no auth): used by frontend dashboard when RLS prevents direct reads
  router.get('/public', async (_req, res) => {
    const { data, error } = await supabase
      .from('news_feeds')
      .select('id, title, content, priority, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  router.post('/', authenticate, requireRole('admin', 'operator'), async (req, res) => {
    const { title, content, priority, is_active, expires_at, targets } = req.body;
    const { error, data } = await supabase.from('news_feeds').insert([{ title, content, priority, is_active, expires_at }]).select('*').single();
    if (error) return res.status(400).json({ error: error.message });
    io.emit('news:broadcast', { title: data.title, content: data.content, targets: targets || {} });
    return res.status(201).json(data);
  });

  // Optional direct push endpoint (no DB write)
  router.post('/push', authenticate, requireRole('admin', 'operator'), async (req, res) => {
    const { title, content, targets } = req.body || {};
    io.emit('news:broadcast', { title, content, targets: targets || {} });
    return res.json({ ok: true });
  });

  // Public endpoint to create and broadcast (uses service role). Consider protecting with an API key.
  router.post('/public', async (req, res) => {
    const { title, content, priority, is_active, expires_at, targets } = req.body || {};
    const { error, data } = await supabase
      .from('news_feeds')
      .insert([{ title, content, priority, is_active, expires_at }])
      .select('*')
      .single();
    if (error) return res.status(400).json({ error: error.message });
    io.emit('news:broadcast', { title: data.title, content: data.content, targets: targets || {} });
    return res.status(201).json(data);
  });

  return router;
}


