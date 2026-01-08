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

// Public: last known positions for all buses (for fleet dashboard)
router.get('/public/positions', async (_req, res) => {
  const { data, error } = await supabase
    .from('buses')
    .select('bus_number, gps_latitude, gps_longitude, last_location_update, status, depo');
  if (error) return res.status(500).json({ error: error.message });
  return res.json(
    (data || []).map((b) => ({
      bus_number: b.bus_number,
      lat: b.gps_latitude,
      lng: b.gps_longitude,
      last_location_update: b.last_location_update,
      status: b.status,
      depot: b.depo,
    }))
  );
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

// Public: last known position for a specific bus
router.get('/public/:busNumber/position', async (req, res) => {
  try {
    const { busNumber } = req.params;
    const { data, error } = await supabase
      .from('buses')
      .select('bus_number, gps_latitude, gps_longitude, last_location_update, status, depo')
      .eq('bus_number', busNumber)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'not_found' });
    return res.json({
      bus_number: data.bus_number,
      lat: data.gps_latitude,
      lng: data.gps_longitude,
      last_location_update: data.last_location_update,
      status: data.status,
      depot: data.depo,
    });
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


// --- Extra: Flip endpoints (secured and public) ---
// These call a SQL function that performs an atomic swap of start/end
// and reverses midpoints' order_index for the given bus_number.
// You must first create the function in your database (see assistant message).

// Secured (admin/operator)
router.post('/flip', authenticate, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const { busNumber } = req.body || {};
    if (!busNumber) return res.status(400).json({ error: 'busNumber_required' });
    console.log('[flip] secured request', { busNumber, at: new Date().toISOString() });
    const { data, error } = await supabase.rpc('flip_route_for_bus', { p_bus_number: busNumber });
    if (error) {
      console.error('[flip] secured RPC error', error?.message || error);
      return res.status(500).json({ error: error.message });
    }
    console.log('[flip] secured RPC ok', { result: data });
    return res.json({ ok: true, result: data });
  } catch (e) {
    return res.status(500).json({ error: 'unexpected' });
  }
});

// Public variant for TV app (use only if you cannot authenticate TV clients)
router.post('/flip/public', async (req, res) => {
  try {
    const { busNumber } = req.body || {};
    if (!busNumber) return res.status(400).json({ error: 'busNumber_required' });
    console.log('[flip] public request', { busNumber, at: new Date().toISOString() });
    const { data, error } = await supabase.rpc('flip_route_for_bus', { p_bus_number: busNumber });
    if (error) {
      console.error('[flip] public RPC error', error?.message || error);
      return res.status(500).json({ error: error.message });
    }
    console.log('[flip] public RPC ok', { result: data });
    return res.json({ ok: true, result: data });
  } catch (e) {
    return res.status(500).json({ error: 'unexpected' });
  }
});

