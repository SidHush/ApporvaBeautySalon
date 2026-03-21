const express = require('express');
const router = express.Router();
const store = require('../store');

router.get('/', (req, res) => res.json(store.getServices()));

router.get('/:id', (req, res) => {
  const row = store.getService(parseInt(req.params.id));
  if (!row) return res.status(404).json({ error: 'Service not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, description, duration_minutes, price } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  res.status(201).json(store.createService({ name, description, duration_minutes, price }));
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = store.getService(id);
  if (!existing) return res.status(404).json({ error: 'Service not found' });
  const { name, description, duration_minutes, price } = req.body;
  res.json(store.updateService(id, {
    name: name ?? existing.name,
    description: description !== undefined ? description : existing.description,
    duration_minutes: duration_minutes ?? existing.duration_minutes,
    price: price !== undefined ? price : existing.price,
  }));
});

router.delete('/:id', (req, res) => {
  if (!store.getService(parseInt(req.params.id))) return res.status(404).json({ error: 'Service not found' });
  store.deleteService(parseInt(req.params.id));
  res.json({ message: 'Deleted' });
});

module.exports = router;
