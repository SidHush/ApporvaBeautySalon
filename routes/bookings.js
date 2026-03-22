const express = require('express');
const router = express.Router();
const store = require('../store');

// Parse "3/23/2026" or "2026-03-23" → "YYYY-MM-DD"
function toISO(dateStr) {
  if (!dateStr) return null;
  const mdy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return null;
}

// GET /api/bookings  — list all (admin UI)
router.get('/', (req, res) => {
  try {
    res.json(store.getBookings());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/bookings  — called by ElevenLabs voice agent
router.post('/', (req, res) => {
  try {
    const { services, date, time, duration_minutes, customer_name, customer_phone, stylist } = { ...req.query, ...req.body };

    // Required field checks
    if (!customer_name) return res.status(400).json({ success: false, message: 'Customer name is required.' });
    if (!date)          return res.status(400).json({ success: false, message: 'Date is required.' });
    if (!time)          return res.status(400).json({ success: false, message: 'Time is required.' });
    if (!stylist)       return res.status(400).json({ success: false, message: 'Stylist name is required.' });
    if (!services)      return res.status(400).json({ success: false, message: 'Service is required.' });

    // Validate stylist exists (case-insensitive)
    const allStylists = store.getStylists();
    const matched = allStylists.find(s => s.name.toLowerCase() === stylist.trim().toLowerCase());
    if (!matched) {
      return res.status(400).json({
        success: false,
        message: `Stylist "${stylist}" not found. Available stylists: ${allStylists.map(s => s.name).join(', ')}.`,
      });
    }

    // Check stylist availability on that date
    const iso = toISO(date);
    if (iso) {
      const grid = store.getAvailabilityGrid();
      const stylistGrid = grid.stylists.find(s => s.id === matched.id);
      const dayData = stylistGrid?.availability.find(a => a.date === iso);
      if (dayData && !dayData.available) {
        return res.status(400).json({
          success: false,
          message: `${matched.name} is not available on ${date}. Please choose a different date or stylist.`,
        });
      }
    }

    const booking = store.createBooking({
      services, date, time, duration_minutes,
      customer_name: customer_name.trim(),
      customer_phone,
      stylist: matched.name,
    });

    res.status(201).json({
      success: true,
      booking_id: booking.id,
      message: `Booking confirmed! ${booking.customer_name} is booked for ${booking.services} with ${booking.stylist} on ${booking.date} at ${booking.time}.`,
      booking,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// PATCH /api/bookings/:id/status  — admin update
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Status must be confirmed, completed, or cancelled' });
    }
    const booking = store.updateBookingStatus(parseInt(req.params.id), status);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/bookings/:id  — admin delete
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const all = store.getBookings();
    if (!all.find(b => b.id === id)) return res.status(404).json({ error: 'Booking not found' });
    store.deleteBooking(id);
    res.json({ message: 'Booking deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
