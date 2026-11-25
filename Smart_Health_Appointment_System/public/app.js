const API = (window.__HATCHABLE__ && window.__HATCHABLE__.api) ||
  ((window.location.protocol === 'file:' || (window.location.port !== '3000' && window.location.port !== ''))
    ? 'http://localhost:3000/api'
    : '/api');

document.addEventListener('alpine:init', () => {
  Alpine.data('healthApp', () => ({
    user: null,
    doctors: [],
    appointments: [],
    stats: { doctors: 0, appointments: 0, pending: 0, approved: 0, completed: 0 },
    loading: true,
    showForm: false,
    selectedDoctor: null,
    search: '',
    statusFilter: '',
    message: '',
    error: '',
    form: {
      patient_name: '',
      patient_email: '',
      patient_phone: '',
      doctor_id: '',
      appointment_date: '',
      appointment_time: '',
      reason: ''
    },

    async init() {
      const today = new Date().toISOString().split('T')[0];
      this.minDate = today;

      await this.checkSession();
      await Promise.all([
        this.loadDoctors(),
        this.loadAppointments(),
        this.loadStats()
      ]);
      this.loading = false;
    },

    async checkSession() {
      try {
        const res = await fetch(API + '/auth/session', { credentials: 'include' });
        const data = await res.json();
        this.user = data.user || null;
        if (this.user) {
          this.form.patient_name = this.user.name || '';
          this.form.patient_email = this.user.email || '';
          this.form.patient_phone = this.user.phone || '';
        }
      } catch (e) {
        this.user = null;
      }
    },

    async loadDoctors() {
      try {
        const res = await fetch(API + '/doctors');
        const data = await res.json();
        this.doctors = data.doctors || [];
      } catch (err) {
        console.error('Error loading doctors:', err);
      }
    },

    async loadAppointments() {
      try {
        const u = new URL(API + '/appointments', window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:3000');
        if (this.search) u.searchParams.set('q', this.search);
        if (this.statusFilter) u.searchParams.set('status', this.statusFilter);
        const res = await fetch(u);
        const data = await res.json();
        this.appointments = data.appointments || [];
      } catch (err) {
        console.error('Error loading appointments:', err);
      }
    },

    async loadStats() {
      try {
        const res = await fetch(API + '/dashboard');
        this.stats = await res.json();
      } catch (err) {
        console.error('Error loading stats:', err);
      }
    },

    async refresh() {
      await Promise.all([
        this.loadAppointments(),
        this.loadStats()
      ]);
    },

    openBooking(doctorId = null) {
      this.message = '';
      this.error = '';

      if (this.user) {
        this.form.patient_name = this.user.name || '';
        this.form.patient_email = this.user.email || '';
        this.form.patient_phone = this.user.phone || '';
      }

      if (doctorId) {
        this.form.doctor_id = doctorId;
      }

      if (!this.form.appointment_date) {
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        this.form.appointment_date = tomorrow;
      }

      this.showForm = true;
    },

    async book() {
      this.message = '';
      this.error = '';

      if (!this.form.patient_name || !this.form.patient_email || !this.form.doctor_id || !this.form.appointment_date || !this.form.appointment_time || !this.form.reason) {
        this.error = 'Please fill out all required fields.';
        return;
      }

      try {
        const res = await fetch(API + '/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(this.form)
        });

        const data = await res.json();
        if (!res.ok) {
          this.error = data.error || 'Failed to book appointment.';
          return;
        }

        this.message = `Appointment #${data.appointment.id} successfully requested! Status: Pending review.`;
        this.showForm = false;

        this.form.reason = '';
        this.form.appointment_time = '';

        await this.refresh();
        window.scrollTo({ top: 380, behavior: 'smooth' });
      } catch (err) {
        this.error = 'Network error while booking appointment.';
      }
    },

    async changeStatus(id, status) {
      this.message = '';
      this.error = '';

      try {
        const res = await fetch(API + '/appointments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id, status })
        });

        const data = await res.json();
        if (!res.ok) {
          this.error = data.error || 'Update failed.';
          return;
        }

        this.message = `Appointment #${id} updated to ${status}.`;
        await this.refresh();
      } catch (err) {
        this.error = 'Failed to update appointment status.';
      }
    },

    async signOut() {
      try {
        await fetch(API + '/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.reload();
      } catch (err) {
        window.location.href = '/';
      }
    },

    initials(name) {
      return (name || 'Care Flow').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase();
    }
  }));
});
