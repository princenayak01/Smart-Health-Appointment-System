const crypto = require('node:crypto');
const { sqlite, hashPassword } = require('./db.js');

const auth = {
  // Extract user from request
  async getUser(req) {
    let token = null;

    if (req.cookies && req.cookies.cf_session) {
      token = req.cookies.cf_session;
    } else if (req.headers && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      }
    }

    if (!token) return null;

    const row = sqlite.prepare(`
      SELECT s.token, u.id, u.name, u.email, u.role, u.phone, da.doctor_id
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN doctor_accounts da ON da.user_id = u.id
      WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
    `).get(token);

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      phone: row.phone,
      doctor_id: row.doctor_id || null
    };
  },

  // Create session token
  createSession(userId) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    sqlite.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
    return token;
  },

  // Destroy session
  destroySession(token) {
    if (token) {
      sqlite.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    }
  },

  // Login with credentials
  login(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const hashed = hashPassword(password);

    const user = sqlite.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.phone, da.doctor_id
      FROM users u
      LEFT JOIN doctor_accounts da ON da.user_id = u.id
      WHERE lower(u.email) = ? AND u.password = ?
    `).get(cleanEmail, hashed);

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const token = this.createSession(user.id);
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        doctor_id: user.doctor_id || null
      },
      token
    };
  },

  // Fast demo login for immediate 1-click test
  demoLogin(roleOrEmail) {
    let user;
    if (roleOrEmail === 'admin') {
      user = sqlite.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
    } else if (roleOrEmail === 'doctor') {
      user = sqlite.prepare("SELECT * FROM users WHERE role = 'doctor' LIMIT 1").get();
    } else if (roleOrEmail === 'patient') {
      user = sqlite.prepare("SELECT * FROM users WHERE role = 'patient' LIMIT 1").get();
    } else {
      user = sqlite.prepare("SELECT * FROM users WHERE lower(email) = ?").get(String(roleOrEmail).toLowerCase());
    }

    if (!user) {
      throw new Error('User not found.');
    }

    const docAccount = sqlite.prepare("SELECT doctor_id FROM doctor_accounts WHERE user_id = ?").get(user.id);
    const token = this.createSession(user.id);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        doctor_id: docAccount ? docAccount.doctor_id : null
      },
      token
    };
  },

  // Register new patient
  register({ name, email, password, phone }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    if (!cleanEmail || !password || !cleanName) {
      throw new Error('Name, email, and password are required.');
    }

    const existing = sqlite.prepare("SELECT id FROM users WHERE lower(email) = ?").get(cleanEmail);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const userId = 'u_' + crypto.randomBytes(6).toString('hex');
    const hashed = hashPassword(password);

    sqlite.prepare("INSERT INTO users (id, name, email, password, role, phone) VALUES (?, ?, ?, ?, 'patient', ?)").run(
      userId,
      cleanName,
      cleanEmail,
      hashed,
      phone || null
    );

    sqlite.prepare("INSERT INTO patient_profiles (user_id, phone) VALUES (?, ?)").run(userId, phone || null);

    const token = this.createSession(userId);
    return {
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        role: 'patient',
        phone: phone || null,
        doctor_id: null
      },
      token
    };
  }
};

module.exports = auth;
