import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

router.get('/', authenticate, async (_req, res) => {
  const { data, error } = await supabase.from('schedules').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

router.post('/', authenticate, requireRole('admin', 'operator'), async (req, res) => {
  const { bus_id, media_id, start_time, end_time, priority, is_active } = req.body;
  const { error, data } = await supabase.from('schedules').insert([{ bus_id, media_id, start_time, end_time, priority, is_active }]).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json(data);
});

router.patch('/:id', authenticate, requireRole('admin', 'operator'), async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const { error, data } = await supabase.from('schedules').update(updates).eq('id', id).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('schedules').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  return res.status(204).send();
});

export default router;


