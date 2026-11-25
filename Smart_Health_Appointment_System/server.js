const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const { sqlite, query, hashPassword } = require('./db.js');
const auth = require('./auth.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins, including Live Server, file origin, and localhost
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Auth extraction middleware
app.use(async (req, res, next) => {
  try {
    req.user = await auth.getUser(req);
  } catch (err) {
    req.user = null;
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Please sign in to continue." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

// Provide compatibility client polyfill script
app.get('/hatchable-client.js', (req, res) => {
  res.type('application/javascript').send(`
    window.__HATCHABLE__ = { api: '/api' };
    window.hatchable = {
      auth: {
        async getSession() {
          const res = await fetch('/api/auth/session');
          return await res.json();
        },
        async signOut() {
          await fetch('/api/auth/logout', { method: 'POST' });
          location.href = '/';
        },
        supportsPasskeys() { return false; },
        async startLogin({ email }) {
          return { has_passkey: false };
        },
        async verifyCode({ email, code }) {
          const res = await fetch('/api/auth/demo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: email.includes('admin') ? 'admin' : (email.includes('doctor') ? 'doctor' : 'patient') })
          });
          return await res.json();
        }
      }
    };
  `);
});

// Protect role-specific HTML pages before serving static assets.
app.use('/my-appointments.html', requireAuth);
app.use(['/doctor.html', '/doctor'], requireRole('doctor', 'admin'));
app.use(['/admin.html', '/admin'], requireRole('admin'));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// Authentication API Endpoints
// ----------------------------------------------------

app.get('/api/auth/session', (req, res) => {
  res.json({ user: req.user || null });
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const { user, token } = auth.login(email, password);

    res.cookie('cf_session', token, {
      httpOnly: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Login failed.' });
  }
});

app.post('/api/auth/demo', (req, res) => {
  try {
    const { role } = req.body || {};
    const { user, token } = auth.demoLogin(role || 'patient');

    res.cookie('cf_session', token, {
      httpOnly: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Demo login failed.' });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, phone } = req.body || {};
    const { user, token } = auth.register({ name, email, password, phone });

    res.cookie('cf_session', token, {
      httpOnly: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.status(201).json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.cf_session;
  if (token) {
    auth.destroySession(token);
  }
  res.clearCookie('cf_session', { path: '/' });
  res.json({ success: true });
});

// ----------------------------------------------------
// Doctors API Endpoints
// ----------------------------------------------------

app.get('/api/doctors', (req, res) => {
  const { rows } = query("SELECT id, name, specialty, experience_years, availability FROM doctors ORDER BY name");
  res.json({ doctors: rows });
});

app.get('/api/admin-doctors', requireRole('admin'), (req, res) => {
  const { rows } = query(`
    SELECT d.id, d.name, d.specialty, d.experience_years, d.availability,
           da.user_id AS account_user_id, da.email AS account_email
    FROM doctors d
    LEFT JOIN doctor_accounts da ON da.doctor_id = d.id
    ORDER BY d.name
  `);
  res.json({ doctors: rows });
});

app.post('/api/admin-doctors', requireRole('admin'), (req, res) => {
  const { name, specialty, experience_years, availability, email } = req.body || {};
  if (!name || !specialty) {
    return res.status(400).json({ error: "Doctor name and specialty are required." });
  }

  const { rows, lastInsertRowid } = query(
    "INSERT INTO doctors (name, specialty, experience_years, availability) VALUES (?, ?, ?, ?) RETURNING *",
    [String(name).trim(), String(specialty).trim(), Number(experience_years || 0), availability || "Mon-Fri, 10:00 AM - 5:00 PM"]
  );

  const doc = rows[0] || { id: Number(lastInsertRowid), name, specialty };

  if (email) {
    const cleanEmail = String(email).trim().toLowerCase();
    let user = sqlite.prepare("SELECT id FROM users WHERE lower(email) = ?").get(cleanEmail);
    if (!user) {
      const uId = 'u_doc_' + Date.now();
      sqlite.prepare("INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, 'doctor')").run(
        uId, doc.name, cleanEmail, hashPassword('doctor123')
      );
      user = { id: uId };
    }
    sqlite.prepare("INSERT INTO doctor_accounts (user_id, doctor_id, email) VALUES (?, ?, ?)").run(
      user.id, doc.id, cleanEmail
    );
  }

  res.status(201).json({ doctor: doc });
});

app.patch('/api/admin-doctors', requireRole('admin'), (req, res) => {
  const { doctor_id, user_id, email } = req.body || {};
  if (!doctor_id || !email) {
    return res.status(400).json({ error: "Doctor ID and email are required." });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  let uid = user_id;

  let user = sqlite.prepare("SELECT id FROM users WHERE lower(email) = ?").get(cleanEmail);
  if (!user) {
    uid = 'u_doc_' + Date.now();
    const doc = sqlite.prepare("SELECT name FROM doctors WHERE id = ?").get(Number(doctor_id));
    sqlite.prepare("INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, 'doctor')").run(
      uid, doc ? doc.name : 'Doctor', cleanEmail, hashPassword('doctor123')
    );
  } else {
    uid = user.id;
    sqlite.prepare("UPDATE users SET role = 'doctor' WHERE id = ?").run(uid);
  }

  sqlite.prepare("DELETE FROM doctor_accounts WHERE doctor_id = ?").run(Number(doctor_id));
  const { rows } = query("INSERT INTO doctor_accounts (user_id, doctor_id, email) VALUES (?, ?, ?) RETURNING *", [
    uid, Number(doctor_id), cleanEmail
  ]);

  res.json({ account: rows[0] });
});

app.delete('/api/admin-doctors/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  sqlite.prepare("DELETE FROM doctor_accounts WHERE doctor_id = ?").run(id);
  sqlite.prepare("DELETE FROM appointments WHERE doctor_id = ?").run(id);
  sqlite.prepare("DELETE FROM doctors WHERE id = ?").run(id);
  res.json({ success: true, message: "Doctor deleted." });
});

// ----------------------------------------------------
// Appointments API Endpoints
// ----------------------------------------------------

app.get('/api/appointments', (req, res) => {
  const q = String(req.query?.q || "").trim().toLowerCase();
  const status = String(req.query?.status || "").trim();
  const doctor_id = Number(req.query?.doctor_id || 0);

  const params = [];
  const clauses = [];

  if (q) {
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    clauses.push(`(lower(a.patient_name) LIKE ? OR lower(d.name) LIKE ? OR lower(d.specialty) LIKE ?)`);
  }
  if (status) {
    params.push(status);
    clauses.push(`a.status = ?`);
  }
  if (doctor_id) {
    params.push(doctor_id);
    clauses.push(`a.doctor_id = ?`);
  }

  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const canViewPatientContact = req.user && ["doctor", "admin"].includes(req.user.role);
  const sql = `
    SELECT a.id, a.patient_name,
           ${canViewPatientContact ? "a.patient_email" : "NULL"} AS patient_email,
           ${canViewPatientContact ? "a.patient_phone" : "NULL"} AS patient_phone,
           ${canViewPatientContact ? "a.patient_user_id" : "NULL"} AS patient_user_id,
           a.appointment_date, a.appointment_time, a.reason, a.status, a.doctor_notes,
           d.id AS doctor_id, d.name AS doctor_name, d.specialty
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    ${where}
    ORDER BY a.appointment_date DESC, a.id DESC
    LIMIT 150
  `;

  const { rows } = query(sql, params);
  res.json({ appointments: rows });
});

app.post('/api/appointments', requireAuth, (req, res) => {
  const { patient_name, patient_email, patient_phone, doctor_id, appointment_date, appointment_time, reason } = req.body || {};

  if (!patient_name || !patient_email || !doctor_id || !appointment_date || !appointment_time || !reason) {
    return res.status(400).json({ error: "All appointment fields are required." });
  }

  const doctor = sqlite.prepare("SELECT id, name FROM doctors WHERE id = ?").get(Number(doctor_id));
  if (!doctor) {
    return res.status(404).json({ error: "Selected doctor not found." });
  }

  const userId = req.user ? req.user.id : null;
  const cleanPhone = patient_phone || (req.user ? req.user.phone : null);

  const { rows } = query(`
    INSERT INTO appointments (patient_name, patient_email, patient_phone, patient_user_id, doctor_id, appointment_date, appointment_time, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
    RETURNING id, patient_name, status, appointment_date, appointment_time
  `, [
    String(patient_name).trim(),
    String(patient_email).trim().toLowerCase(),
    cleanPhone,
    userId,
    Number(doctor_id),
    appointment_date,
    appointment_time,
    String(reason).trim()
  ]);

  res.status(201).json({ appointment: rows[0] });
});

app.patch('/api/appointments', requireAuth, (req, res) => {
  const id = Number(req.body?.id);
  const nextStatus = String(req.body?.status || "").trim();
  const notes = req.body?.doctor_notes !== undefined ? String(req.body.doctor_notes).trim() : null;

  if (!id || !["Cancelled", "Approved", "Rejected", "Completed", "Pending"].includes(nextStatus)) {
    return res.status(400).json({ error: "Valid appointment ID and status ('Pending','Approved','Rejected','Completed','Cancelled') are required." });
  }

  if (req.user.role === 'patient') {
    if (nextStatus !== 'Cancelled') {
      return res.status(403).json({ error: "Patients may only cancel their own appointments." });
    }
    const owned = query(`
      UPDATE appointments
      SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND (patient_user_id = ? OR lower(patient_email) = lower(?))
        AND status IN ('Pending', 'Approved')
      RETURNING *
    `, [id, req.user.id, req.user.email]).rows;
    if (!owned.length) {
      return res.status(404).json({ error: "Appointment not found or cannot be cancelled." });
    }
    return res.json({ appointment: owned[0] });
  }

  if (!["doctor", "admin"].includes(req.user.role)) {
    return res.status(403).json({ error: "You do not have permission to update appointment status." });
  }

  if (req.user.role === 'doctor') {
    const appointment = sqlite.prepare("SELECT doctor_id FROM appointments WHERE id = ?").get(id);
    if (!appointment || appointment.doctor_id !== req.user.doctor_id) {
      return res.status(403).json({ error: "You can only manage appointments assigned to you." });
    }
  }

  let rows;
  if (notes !== null) {
    rows = query("UPDATE appointments SET status = ?, doctor_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *", [
      nextStatus, notes, id
    ]).rows;
  } else {
    rows = query("UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *", [
      nextStatus, id
    ]).rows;
  }

  if (!rows || !rows.length) {
    return res.status(404).json({ error: "Appointment not found." });
  }

  res.json({ appointment: rows[0] });
});

app.delete('/api/appointments/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  sqlite.prepare("DELETE FROM appointments WHERE id = ?").run(id);
  res.json({ success: true, message: "Appointment deleted." });
});

// ----------------------------------------------------
// Patient Dashboard APIs
// ----------------------------------------------------

app.get('/api/my-appointments', requireAuth, (req, res) => {
  const { rows } = query(`
    SELECT a.id, a.patient_name, a.patient_email, a.patient_phone,
           a.appointment_date, a.appointment_time, a.reason, a.status, a.doctor_notes,
           d.name AS doctor_name, d.specialty, d.availability
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    WHERE a.patient_user_id = ? OR lower(a.patient_email) = lower(?)
    ORDER BY a.appointment_date DESC, a.id DESC
  `, [req.user.id, req.user.email]);

  res.json({ appointments: rows });
});

app.patch('/api/my-appointments', requireAuth, (req, res) => {
  const id = Number(req.body?.id);
  if (!id) {
    return res.status(400).json({ error: "Appointment ID is required." });
  }

  const { rows } = query(`
    UPDATE appointments
    SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (patient_user_id = ? OR lower(patient_email) = lower(?))
      AND status IN ('Pending', 'Approved')
    RETURNING id, status
  `, [id, req.user.id, req.user.email]);

  if (!rows || !rows.length) {
    return res.status(404).json({ error: "Appointment not found or cannot be cancelled." });
  }

  res.json({ appointment: rows[0] });
});

// ----------------------------------------------------
// Doctor Workspace APIs
// ----------------------------------------------------

app.get('/api/doctor-appointments', requireRole('doctor', 'admin'), (req, res) => {
  let doctorId = req.user.doctor_id;
  if (req.user.role === 'admin' && req.query.doctor_id) {
    doctorId = Number(req.query.doctor_id);
  }

  let sql = `
    SELECT a.id, a.patient_name, a.patient_email, a.patient_phone,
           a.appointment_date, a.appointment_time, a.reason, a.status, a.doctor_notes,
           d.id AS doctor_id, d.name AS doctor_name, d.specialty
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
  `;
  const params = [];

  if (doctorId) {
    sql += ` WHERE a.doctor_id = ? `;
    params.push(doctorId);
  }

  sql += ` ORDER BY a.appointment_date DESC, a.id DESC LIMIT 100 `;

  const { rows } = query(sql, params);
  res.json({ appointments: rows, doctor_id: doctorId });
});

// ----------------------------------------------------
// Clinic Dashboard Stats API
// ----------------------------------------------------

app.get('/api/dashboard', (req, res) => {
  const doctors = sqlite.prepare("SELECT count(*) as c FROM doctors").get().c;
  const total = sqlite.prepare("SELECT count(*) as c FROM appointments").get().c;
  const pending = sqlite.prepare("SELECT count(*) as c FROM appointments WHERE status = 'Pending'").get().c;
  const approved = sqlite.prepare("SELECT count(*) as c FROM appointments WHERE status = 'Approved'").get().c;
  const completed = sqlite.prepare("SELECT count(*) as c FROM appointments WHERE status = 'Completed'").get().c;
  const cancelled = sqlite.prepare("SELECT count(*) as c FROM appointments WHERE status = 'Cancelled'").get().c;

  res.json({
    doctors,
    appointments: total,
    pending,
    approved,
    completed,
    cancelled
  });
});

app.get('/api/account', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  const profile = sqlite.prepare("SELECT user_id, phone FROM patient_profiles WHERE user_id = ?").get(req.user.id);
  res.json({ user: req.user, profile: profile || null });
});

// ----------------------------------------------------
// Page Routes
// ----------------------------------------------------

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/my-appointments', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'my-appointments.html'));
});

app.get('/doctor', requireRole('doctor', 'admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'doctor.html'));
});

app.get('/admin', requireRole('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Bind to 0.0.0.0 so both localhost and 127.0.0.1 work
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`CareFlow - Smart Health Appointment System is LIVE!`);
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`Admin Portal:      http://localhost:${PORT}/admin`);
  console.log(`Doctor Portal:     http://localhost:${PORT}/doctor`);
  console.log(`Patient Portal:    http://localhost:${PORT}/my-appointments`);
  console.log(`====================================================`);
});
