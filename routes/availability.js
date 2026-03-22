const express = require('express');
const router = express.Router();
const store = require('../store');

// GET  /api/availability  — full 14-day grid for all stylists
router.get('/', (req, res) => {
  try {
    res.json(store.getAvailabilityGrid());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET  /api/availability/openings  — voice agent: stylists with remaining open time per day
// Returns only days that are available AND still have unbooked time remaining.
// Use this before booking to confirm a stylist has capacity on the requested date.
router.get('/openings', (req, res) => {
  try {
    res.json(store.getOpenings());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT  /api/availability/:stylist_id/:date  — toggle one cell
// body: { available: true | false }
router.put('/:stylist_id/:date', (req, res) => {
  try {
    const stylist_id = parseInt(req.params.stylist_id);
    const { date } = req.params;
    const { available } = req.body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    store.setAvailabilityOverride(stylist_id, date, !!available);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
