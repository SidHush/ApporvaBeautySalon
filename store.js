const fs = require('fs');
const path = require('path');

// On Render, RENDER env var is automatically set — use persistent disk path
// Locally, store next to server file
const DATA_PATH = process.env.DATA_PATH ||
  (process.env.RENDER ? '/var/data/salon.json' : path.join(__dirname, 'salon.json'));

const DEFAULTS = { services: [], stylists: [], stylist_services: [], stylist_schedule: [] };

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return { ...DEFAULTS };
  }
}

function save(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function nextId(rows) {
  return rows.length === 0 ? 1 : Math.max(...rows.map(r => r.id)) + 1;
}

// ── Services ──────────────────────────────────────────────────────────────────

function getServices() {
  return load().services.sort((a, b) => a.name.localeCompare(b.name));
}

function getService(id) {
  return load().services.find(s => s.id === id) || null;
}

function createService({ name, description, duration_minutes, price }) {
  const data = load();
  const row = { id: nextId(data.services), name, description: description || null, duration_minutes: duration_minutes || 60, price: price || 0 };
  data.services.push(row);
  save(data);
  return row;
}

function updateService(id, fields) {
  const data = load();
  const idx = data.services.findIndex(s => s.id === id);
  if (idx === -1) return null;
  data.services[idx] = { ...data.services[idx], ...fields };
  save(data);
  return data.services[idx];
}

function deleteService(id) {
  const data = load();
  data.services = data.services.filter(s => s.id !== id);
  data.stylist_services = data.stylist_services.filter(ss => ss.service_id !== id);
  save(data);
}

// ── Stylists ──────────────────────────────────────────────────────────────────

function getStylistFull(data, id) {
  const stylist = data.stylists.find(s => s.id === id);
  if (!stylist) return null;
  const serviceIds = data.stylist_services.filter(ss => ss.stylist_id === id).map(ss => ss.service_id);
  const services = data.services.filter(s => serviceIds.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  const schedule = data.stylist_schedule.filter(s => s.stylist_id === id).sort((a, b) => a.day_of_week - b.day_of_week);
  return { ...stylist, services, schedule };
}

function getStylists() {
  const data = load();
  return data.stylists.sort((a, b) => a.name.localeCompare(b.name)).map(s => getStylistFull(data, s.id));
}

function getStylist(id) {
  return getStylistFull(load(), id);
}

function createStylist({ name, phone, email, service_ids }) {
  const data = load();
  const id = nextId(data.stylists);
  data.stylists.push({ id, name, phone: phone || null, email: email || null });

  // Default schedule: Mon–Fri working, Sat–Sun off
  for (let i = 0; i < 7; i++) {
    data.stylist_schedule.push({ id: nextId(data.stylist_schedule), stylist_id: id, day_of_week: i, start_time: '09:00', end_time: '17:00', is_working: i < 5 ? 1 : 0 });
  }

  if (service_ids?.length) {
    for (const sid of service_ids) {
      if (!data.stylist_services.find(ss => ss.stylist_id === id && ss.service_id === sid)) {
        data.stylist_services.push({ stylist_id: id, service_id: sid });
      }
    }
  }

  save(data);
  return getStylistFull(data, id);
}

function updateStylist(id, { name, phone, email, service_ids }) {
  const data = load();
  const idx = data.stylists.findIndex(s => s.id === id);
  if (idx === -1) return null;
  if (name !== undefined) data.stylists[idx].name = name;
  if (phone !== undefined) data.stylists[idx].phone = phone;
  if (email !== undefined) data.stylists[idx].email = email;

  if (service_ids !== undefined) {
    data.stylist_services = data.stylist_services.filter(ss => ss.stylist_id !== id);
    for (const sid of service_ids) {
      data.stylist_services.push({ stylist_id: id, service_id: sid });
    }
  }

  save(data);
  return getStylistFull(data, id);
}

function updateSchedule(stylist_id, schedule) {
  const data = load();
  for (const s of schedule) {
    const idx = data.stylist_schedule.findIndex(r => r.stylist_id === stylist_id && r.day_of_week === s.day_of_week);
    if (idx !== -1) {
      data.stylist_schedule[idx] = { ...data.stylist_schedule[idx], start_time: s.start_time || '09:00', end_time: s.end_time || '17:00', is_working: s.is_working ? 1 : 0 };
    } else {
      data.stylist_schedule.push({ id: nextId(data.stylist_schedule), stylist_id, day_of_week: s.day_of_week, start_time: s.start_time || '09:00', end_time: s.end_time || '17:00', is_working: s.is_working ? 1 : 0 });
    }
  }
  save(data);
  return getStylistFull(data, stylist_id);
}

function deleteStylist(id) {
  const data = load();
  data.stylists = data.stylists.filter(s => s.id !== id);
  data.stylist_services = data.stylist_services.filter(ss => ss.stylist_id !== id);
  data.stylist_schedule = data.stylist_schedule.filter(s => s.stylist_id !== id);
  save(data);
}

module.exports = {
  getServices, getService, createService, updateService, deleteService,
  getStylists, getStylist, createStylist, updateStylist, updateSchedule, deleteStylist,
  load,
};
