const express = require('express');
const router = express.Router();
const store = require('../store');

// Parse flexible time strings → minutes from midnight
function parseTimeToMins(t) {
  if (!t) return null;
  const s = String(t).trim().toUpperCase().replace(/\s+/g, '');
  const mil = s.match(/^(\d{1,2}):(\d{2})$/);
  if (mil) return parseInt(mil[1]) * 60 + parseInt(mil[2]);
  const twelve = s.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/);
  if (twelve) {
    let h = parseInt(twelve[1]);
    const m = parseInt(twelve[2] || '0');
    if (twelve[3] === 'PM' && h !== 12) h += 12;
    if (twelve[3] === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  return null;
}

// Minutes from midnight → "3:00 PM"
function minsToFmt(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${String(m).padStart(2, '0')} ${ampm}`;
}

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

// POST /api/bookings/lookup  — agent looks up customer bookings
router.post('/lookup', (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name && !phone) {
      return res.status(400).json({ success: false, message: 'Provide at least a name or phone number.' });
    }

    const all = store.getBookings();

    const matches = all.filter(b => {
      const nameMatch  = name  ? b.customer_name.toLowerCase().includes(name.trim().toLowerCase())  : true;
      const phoneMatch = phone ? (b.customer_phone || '').replace(/\D/g, '').includes(phone.replace(/\D/g, '')) : true;
      return nameMatch && phoneMatch;
    });

    if (!matches.length) {
      return res.status(404).json({
        success: false,
        message: `No bookings found for ${name || ''}${name && phone ? ' / ' : ''}${phone || ''}.`,
      });
    }

    res.json({
      success: true,
      count: matches.length,
      bookings: matches.map(b => ({
        booking_id:     b.id,
        customer_name:  b.customer_name,
        customer_phone: b.customer_phone,
        services:       b.services,
        date:           b.date,
        time:           b.time,
        duration_minutes: b.duration_minutes,
        stylist:        b.stylist,
        status:         b.status,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
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

    // Check for time slot conflicts with existing confirmed bookings
    const reqStart = parseTimeToMins(time);
    if (reqStart !== null) {
      const reqEnd = reqStart + (parseInt(duration_minutes) || 60);
      const conflicts = store.getBookings().filter(b => {
        if (b.status !== 'confirmed') return false;
        if (b.stylist.toLowerCase() !== matched.name.toLowerCase()) return false;
        if (toISO(b.date) !== iso) return false;
        const exStart = parseTimeToMins(b.time);
        if (exStart === null) return false;
        const exEnd = exStart + (b.duration_minutes || 60);
        return reqStart < exEnd && reqEnd > exStart; // overlap
      });

      if (conflicts.length > 0) {
        const taken = conflicts.map(b => {
          const s = parseTimeToMins(b.time);
          const e = s + (b.duration_minutes || 60);
          return `${minsToFmt(s)}–${minsToFmt(e)}`;
        }).join(', ');
        return res.status(409).json({
          success: false,
          message: `That slot is already taken. ${matched.name} is booked from ${taken} on ${date}. Please choose a different time.`,
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
