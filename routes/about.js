const express = require('express');
const router = express.Router();
const store = require('../store');

router.get('/', (req, res) => {
  try {
    res.json(store.getAbout());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/', (req, res) => {
  try {
    const { name, address, phone, email, website, description, facts, working_hours, payments_accepted, languages } = req.body;
    res.json(store.saveAbout({ name, address, phone, email, website, description, facts, working_hours, payments_accepted, languages }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
