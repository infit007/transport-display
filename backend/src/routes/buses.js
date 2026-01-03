import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

router.get('/', authenticate, async (_req, res) => {
  const { data, error } = await supabase.from('buses').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// Public endpoint for TV Display App (no auth required)
router.get('/public', async (_req, res) => {
  const { data, error } = await supabase
    .from('buses')
    .select('id, bus_number, route_name, start_point, end_point, depo, gps_latitude, gps_longitude, status, start_latitude, start_longitude, end_latitude, end_longitude')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// Public endpoint to get specific bus by number
router.get('/public/:busNumber', async (req, res) => {
  try {
    const { busNumber } = req.params;
    const { data: bus, error } = await supabase
      .from('buses')
      .select('id, bus_number, route_name, start_point, end_point, depo, gps_latitude, gps_longitude, status, start_latitude, start_longitude, end_latitude, end_longitude')
      .eq('bus_number', busNumber)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!bus) return res.status(404).json({ error: 'not_found' });

    // Attach active ordered midpoints for this bus number
    let midpoints = [];
    try {
      const { data: mps, error: mpErr } = await supabase
        .from('route_midpoints')
        .select('id,name,lat,lng,radius_m,order_index,active')
        .eq('bus_number', busNumber)
        .eq('active', true)
        .order('order_index', { ascending: true });
      if (!mpErr && Array.isArray(mps)) {
        midpoints = mps;
      }
    } catch {}

    return res.json({ ...bus, midpoints });
  } catch (e) {
    return res.status(500).json({ error: 'unexpected' });
  }
});

router.post('/', authenticate, requireRole('admin', 'operator'), async (req, res) => {
  const { bus_number, route_name, status } = req.body;
  const { error, data } = await supabase.from('buses').insert([{ bus_number, route_name, status }]).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(201).json(data);
});

router.patch('/:id', authenticate, requireRole('admin', 'operator'), async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const { error, data } = await supabase.from('buses').update(updates).eq('id', id).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('buses').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  return res.status(204).send();
});

export default router;


