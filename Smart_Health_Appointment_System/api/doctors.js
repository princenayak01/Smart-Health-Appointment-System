import { db } from "hatchable";
export const access = "public";
export const methods = ["GET"];
export default async function (req, res) {
  const { rows } = await db.query("SELECT id, name, specialty, experience_years, availability FROM doctors ORDER BY name");
  return res.json({ doctors: rows });
}