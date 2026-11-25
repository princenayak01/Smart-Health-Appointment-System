const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const dbPath = path.join(__dirname, 'careflow.db');
const sqlite = new DatabaseSync(dbPath);

// Enable WAL mode for high performance
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

// Initialize database schema
function initSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'patient', -- 'patient', 'doctor', 'admin'
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patient_profiles (
      user_id TEXT PRIMARY KEY,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      experience_years INTEGER NOT NULL DEFAULT 0,
      availability TEXT NOT NULL DEFAULT 'Mon-Fri, 10:00 AM - 5:00 PM',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctor_accounts (
      user_id TEXT PRIMARY KEY,
      doctor_id INTEGER NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_name TEXT NOT NULL,
      patient_email TEXT NOT NULL,
      patient_phone TEXT,
      patient_user_id TEXT,
      doctor_id INTEGER NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      doctor_notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  seedData();
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'careflow_salt').digest('hex');
}

function seedData() {
  // Check if doctors exist
  const docCount = sqlite.prepare("SELECT count(*) as c FROM doctors").get().c;
  if (docCount === 0) {
    const initialDoctors = [
      { name: 'Dr. Ananya Sharma', specialty: 'General Physician', exp: 8, avail: 'Mon-Fri, 10:00 AM - 5:00 PM' },
      { name: 'Dr. Rajesh Verma', specialty: 'Cardiologist', exp: 15, avail: 'Mon-Sat, 09:00 AM - 2:00 PM' },
      { name: 'Dr. Priya Patel', specialty: 'Dermatologist', exp: 10, avail: 'Tue-Sun, 11:00 AM - 6:00 PM' },
      { name: 'Dr. Vikram Malhotra', specialty: 'Orthopedic Surgeon', exp: 12, avail: 'Mon-Fri, 10:00 AM - 4:00 PM' },
      { name: 'Dr. Sneha Kulkarni', specialty: 'Pediatrician', exp: 9, avail: 'Mon-Sat, 09:30 AM - 3:30 PM' },
      { name: 'Dr. Tariq Ahmed', specialty: 'Neurologist', exp: 14, avail: 'Mon-Thu, 01:00 PM - 7:00 PM' }
    ];

    const insDoc = sqlite.prepare("INSERT INTO doctors (name, specialty, experience_years, availability) VALUES (?, ?, ?, ?)");
    for (const d of initialDoctors) {
      insDoc.run(d.name, d.specialty, d.exp, d.avail);
    }
  }

  // Seed default demo users if not present
  const userCount = sqlite.prepare("SELECT count(*) as c FROM users").get().c;
  if (userCount === 0) {
    const insUser = sqlite.prepare("INSERT INTO users (id, name, email, password, role, phone) VALUES (?, ?, ?, ?, ?, ?)");

    // 1. Admin
    insUser.run('u_admin_1', 'Clinic Administrator', 'admin@careflow.com', hashPassword('admin123'), 'admin', '+91 90000 00001');

    // 2. Doctor user 1 (Dr. Ananya Sharma)
    insUser.run('u_doc_1', 'Dr. Ananya Sharma', 'dr.sharma@careflow.com', hashPassword('doctor123'), 'doctor', '+91 90000 00002');
    const doc1 = sqlite.prepare("SELECT id FROM doctors WHERE name LIKE '%Ananya%'").get();
    if (doc1) {
      sqlite.prepare("INSERT INTO doctor_accounts (user_id, doctor_id, email) VALUES (?, ?, ?)").run('u_doc_1', doc1.id, 'dr.sharma@careflow.com');
    }

    // 3. Doctor user 2 (Dr. Rajesh Verma)
    insUser.run('u_doc_2', 'Dr. Rajesh Verma', 'dr.verma@careflow.com', hashPassword('doctor123'), 'doctor', '+91 90000 00003');
    const doc2 = sqlite.prepare("SELECT id FROM doctors WHERE name LIKE '%Rajesh%'").get();
    if (doc2) {
      sqlite.prepare("INSERT INTO doctor_accounts (user_id, doctor_id, email) VALUES (?, ?, ?)").run('u_doc_2', doc2.id, 'dr.verma@careflow.com');
    }

    // 4. Patients
    insUser.run('u_pat_1', 'Rahul Mehta', 'rahul.patient@gmail.com', hashPassword('patient123'), 'patient', '+91 98765 43210');
    insUser.run('u_pat_2', 'Sarah Khan', 'sarah.khan@gmail.com', hashPassword('patient123'), 'patient', '+91 98111 22334');

    sqlite.prepare("INSERT INTO patient_profiles (user_id, phone) VALUES (?, ?)").run('u_pat_1', '+91 98765 43210');
    sqlite.prepare("INSERT INTO patient_profiles (user_id, phone) VALUES (?, ?)").run('u_pat_2', '+91 98111 22334');
  }

  // Seed sample appointments if none
  const apptCount = sqlite.prepare("SELECT count(*) as c FROM appointments").get().c;
  if (apptCount === 0) {
    const doc1 = sqlite.prepare("SELECT id FROM doctors LIMIT 1").get();
    const doc2 = sqlite.prepare("SELECT id FROM doctors LIMIT 1 OFFSET 1").get();
    const doc3 = sqlite.prepare("SELECT id FROM doctors LIMIT 1 OFFSET 2").get();

    const insAppt = sqlite.prepare(`
      INSERT INTO appointments (patient_name, patient_email, patient_phone, patient_user_id, doctor_id, appointment_date, appointment_time, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dayAfter = new Date(Date.now() + 172800000).toISOString().split('T')[0];
    const prevDay = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (doc1) {
      insAppt.run('Rahul Mehta', 'rahul.patient@gmail.com', '+91 98765 43210', 'u_pat_1', doc1.id, tomorrow, '10:00 AM', 'Annual health checkup and fever consultation', 'Approved');
    }
    if (doc2) {
      insAppt.run('Sarah Khan', 'sarah.khan@gmail.com', '+91 98111 22334', 'u_pat_2', doc2.id, dayAfter, '11:30 AM', 'Chest pain diagnosis and ECG review', 'Pending');
    }
    if (doc3) {
      insAppt.run('Amit Sharma', 'amit.s@example.com', '+91 98222 33445', null, doc3.id, prevDay, '03:00 PM', 'Skin allergy and rash consultation', 'Completed');
    }
  }
}

// Universal query adapter that accepts Postgres-style ($1, $2, now(), ::int)
// and SQLite syntax transparently
function query(sql, params = []) {
  // Convert Postgres syntax to SQLite
  let sqliteSql = sql
    .replace(/\$\d+/g, '?')
    .replace(/::int/gi, '')
    .replace(/now\(\)/gi, 'CURRENT_TIMESTAMP');

  const trimmed = sqliteSql.trim().toUpperCase();

  try {
    const stmt = sqlite.prepare(sqliteSql);

    if (trimmed.startsWith('SELECT') || trimmed.includes(' RETURNING ')) {
      const rows = stmt.all(...params);
      return { rows };
    } else {
      const info = stmt.run(...params);
      return { rows: [], changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  } catch (err) {
    console.error('DB Query Error:', err.message, 'SQL:', sqliteSql, 'Params:', params);
    throw err;
  }
}

initSchema();

module.exports = {
  sqlite,
  query,
  hashPassword
};
