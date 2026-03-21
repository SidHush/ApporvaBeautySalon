const express = require('express');
const router = express.Router();
const store = require('../store');

router.get('/', (req, res) => res.json(store.getStylists()));

router.get('/:id', (req, res) => {
  const stylist = store.getStylist(parseInt(req.params.id));
  if (!stylist) return res.status(404).json({ error: 'Stylist not found' });
  res.json(stylist);
});

router.post('/', (req, res) => {
  const { name, phone, email, service_ids } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  res.status(201).json(store.createStylist({ name, phone, email, service_ids }));
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!store.getStylist(id)) return res.status(404).json({ error: 'Stylist not found' });
  const { name, phone, email, service_ids } = req.body;
  res.json(store.updateStylist(id, { name, phone, email, service_ids }));
});

router.put('/:id/schedule', (req, res) => {
  const id = parseInt(req.params.id);
  if (!store.getStylist(id)) return res.status(404).json({ error: 'Stylist not found' });
  const { schedule } = req.body;
  if (!Array.isArray(schedule)) return res.status(400).json({ error: 'schedule must be an array' });
  res.json(store.updateSchedule(id, schedule));
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!store.getStylist(id)) return res.status(404).json({ error: 'Stylist not found' });
  store.deleteStylist(id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
