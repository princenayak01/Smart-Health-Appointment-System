# CareFlow — Smart Health Appointment System

A modern, fully functional, multi-role hospital and clinic appointment management web application.

---

## 🚀 How to Run (1-Click)

### Option 1: Double-click `start.bat`
Simply double-click `start.bat` in this folder. It will start the server and automatically open the application in your browser at `http://localhost:3000`.

### Option 2: Using Terminal / Command Prompt
```bash
npm start
```
Then open your browser to [http://localhost:3000](http://localhost:3000).

---

## 👥 Demo Accounts (1-Click Login Available)

On the Login Page (`http://localhost:3000/login`), you can click the **1-Click Demo Buttons** or use these credentials:

| Role | Email | Password | Access / Features |
| :--- | :--- | :--- | :--- |
| **🛡️ Admin** | `admin@careflow.com` | `admin123` | Full clinic management, add doctors, assign doctor emails, oversee all appointments |
| **🩺 Doctor** | `dr.sharma@careflow.com` | `doctor123` | Doctor queue, approve visits, mark completed, record prescription / consultation notes |
| **🩺 Doctor 2** | `dr.verma@careflow.com` | `doctor123` | Cardiologist queue and appointments |
| **👤 Patient** | `rahul.patient@gmail.com` | `patient123` | Book consultations, view history, cancel upcoming visits, print slips |

> Patients can also register directly with their name, email, phone, and password from the login screen!

---

## 🌟 Key Features

1. **Patient Portal**:
   - Live doctor directory with specialties and working hours
   - Interactive appointment booking with instant confirmation
   - Personal appointment history with status badges (Pending, Approved, Completed, Cancelled)
   - 1-Click appointment cancellation
   - Printable appointment slips

2. **Doctor Workspace (`/doctor`)**:
   - Queue of appointments assigned to the logged-in doctor
   - Approve, complete, or reject patient requests
   - Write clinical notes & prescriptions directly into patient records

3. **Admin Dashboard (`/admin`)**:
   - Real-time clinic statistics (Active Doctors, Total Bookings, Pending, Confirmed)
   - Doctor management: Add new specialists, edit availability, link login accounts, delete records
   - Clinic-wide master appointment oversight and status overrides

4. **Self-Contained Backend**:
   - Node.js + Express
   - SQLite Database (`careflow.db`) with automatic schema initialization and sample seed data
   - Session authentication with secure cookies and bearer tokens
