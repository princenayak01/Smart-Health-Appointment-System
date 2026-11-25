import { db } from "hatchable";
export const access = "public";
export const methods = ["GET"];
export default async function (req, res) {
  const [d,a,p,c] = await Promise.all([
    db.query("SELECT count(*)::int AS count FROM doctors"),
    db.query("SELECT count(*)::int AS count FROM appointments"),
    db.query("SELECT count(*)::int AS count FROM appointments WHERE status='Pending'"),
    db.query("SELECT count(*)::int AS count FROM appointments WHERE status='Approved'")
  ]);
  return res.json({doctors:d.rows[0].count,appointments:a.rows[0].count,pending:p.rows[0].count,approved:c.rows[0].count});
}