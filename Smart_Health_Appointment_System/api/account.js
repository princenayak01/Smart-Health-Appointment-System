import { db, auth } from "hatchable";
export const access = "user";
export const methods = ["GET"];
export default async function (req, res) {
  const profile = await db.query("SELECT user_id, phone FROM patient_profiles WHERE user_id = $1", [req.user.id]);
  return res.json({ user: req.user, profile: profile.rows[0] || null });
}