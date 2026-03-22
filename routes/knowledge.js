const express = require('express');
const router = express.Router();
const store = require('../store');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatTime(time) {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

router.get('/', (req, res) => {
  const about = store.getAbout();
  const services = store.getServices();
  const stylists = store.getStylists().map(stylist => ({
    name: stylist.name,
    services: stylist.services.map(s => s.name),
    working_days: stylist.schedule
      .filter(s => s.is_working)
      .map(s => ({ day: DAYS[s.day_of_week], hours: `${formatTime(s.start_time)} - ${formatTime(s.end_time)}` })),
  }));

  const data = {
    salon: about.name || 'Apoorva Hair Salon',
    about,
    services: services.map(s => ({ name: s.name, description: s.description, duration_minutes: s.duration_minutes, price: s.price })),
    stylists,
  };

  if (req.query.format === 'text') {
    return res.type('text/plain').send(buildText(data));
  }

  res.json(data);
});

function buildText(data) {
  const a = data.about;
  const lines = [`${data.salon} — Knowledge Base`, ''];

  // About
  lines.push('ABOUT THE SALON:');
  if (a.address)           lines.push(`  Address: ${a.address}`);
  if (a.phone)             lines.push(`  Phone: ${a.phone}`);
  if (a.email)             lines.push(`  Email: ${a.email}`);
  if (a.website)           lines.push(`  Website: ${a.website}`);
  if (a.working_hours)     lines.push(`  Working Hours: ${a.working_hours}`);
  if (a.payments_accepted?.length) lines.push(`  Payments Accepted: ${a.payments_accepted.join(', ')}`);
  if (a.languages?.length)         lines.push(`  Languages Spoken: ${a.languages.join(', ')}`);
  if (a.description)       lines.push(`\n  About Us: ${a.description}`);
  if (a.facts?.length) {
    lines.push('\n  Did you know?');
    for (const f of a.facts) lines.push(`    • ${f}`);
  }

  // Services
  lines.push('', 'SERVICES OFFERED:');
  if (!data.services.length) {
    lines.push('  No services listed yet.');
  } else {
    for (const s of data.services) {
      const price = s.price > 0 ? ` — $${s.price}` : '';
      const dur = s.duration_minutes ? ` (${s.duration_minutes} min)` : '';
      lines.push(`  • ${s.name}${price}${dur}`);
      if (s.description) lines.push(`    ${s.description}`);
    }
  }

  // Stylists
  lines.push('', 'STYLISTS:');
  if (!data.stylists.length) {
    lines.push('  No stylists listed yet.');
  } else {
    for (const s of data.stylists) {
      lines.push(`  ${s.name}`);
      if (s.services.length) lines.push(`    Services: ${s.services.join(', ')}`);
      if (s.working_days.length) {
        lines.push('    Schedule:');
        for (const d of s.working_days) lines.push(`      ${d.day}: ${d.hours}`);
      } else {
        lines.push('    Schedule: Not set');
      }
    }
  }

  return lines.join('\n');
}

module.exports = router;
