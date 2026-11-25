import { db, auth } from "hatchable";
export const access = "public";
export const methods = ["GET", "POST", "PATCH"];
export default async function (req, res) {
  const user = await auth.getUser(req);
  if (req.method === "GET") {
    const q = String(req.query?.q || "").trim().toLowerCase();
    const status = String(req.query?.status || "").trim();
    const params = [];
    const clauses = [];
    if (q) { params.push("%"+q+"%"); clauses.push("(lower(a.patient_name) LIKE $"+params.length+" OR lower(d.name) LIKE $"+params.length+" OR lower(d.specialty) LIKE $"+params.length+")"); }
    if (status) { params.push(status); clauses.push("a.status = $"+params.length); }
    const where = clauses.length ? " WHERE "+clauses.join(" AND ") : "";
    const { rows } = await db.query("SELECT a.id,a.patient_name,a.patient_email,a.appointment_date,a.appointment_time,a.reason,a.status,d.name AS doctor_name,d.specialty FROM appointments a JOIN doctors d ON d.id=a.doctor_id"+where+" ORDER BY a.appointment_date DESC,a.id DESC LIMIT 100", params);
    return res.json({ appointments: rows });
  }
  if (req.method === "POST") {
    if (!user) return res.status(401).json({ error:"Please sign in before booking an appointment." });
    const { patient_name, patient_email, doctor_id, appointment_date, appointment_time, reason } = req.body || {};
    if (!patient_name || !patient_email || !doctor_id || !appointment_date || !appointment_time || !reason) return res.status(400).json({ error:"All appointment fields are required." });
    const doctor = await db.query("SELECT id FROM doctors WHERE id = $1", [Number(doctor_id)]);
    if (!doctor.rows.length) return res.status(404).json({ error:"Doctor not found." });
    const result = await db.query("INSERT INTO appointments (patient_name,patient_email,doctor_id,appointment_date,appointment_time,reason,status) VALUES ($1,$2,$3,$4,$5,$6,'Pending') RETURNING id,status,appointment_date,appointment_time", [String(patient_name).trim(),String(patient_email).trim(),Number(doctor_id),appointment_date,appointment_time,String(reason).trim()]);
    return res.status(201).json({ appointment: result.rows[0] });
  }
  if (!user) return res.status(401).json({ error:"Sign in required." });
  const id = Number(req.body?.id);
  const nextStatus = String(req.body?.status || "");
  if (!id || !["Cancelled","Approved","Rejected","Completed","Pending"].includes(nextStatus)) return res.status(400).json({ error:"Valid appointment id and status are required." });
  const updated = await db.query("UPDATE appointments SET status=$1,updated_at=now() WHERE id=$2 RETURNING id,status", [nextStatus,id]);
  if (!updated.rows.length) return res.status(404).json({ error:"Appointment not found." });
  return res.json({ appointment: updated.rows[0] });
}