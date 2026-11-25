import { db } from "hatchable";
export const access="admin";
export const methods=["GET","POST","PATCH"];
export default async function(req,res){
 if(req.method==="GET"){const {rows}=await db.query("SELECT d.id,d.name,d.specialty,d.experience_years,d.availability,da.user_id AS account_user_id,da.email AS account_email FROM doctors d LEFT JOIN doctor_accounts da ON da.doctor_id=d.id ORDER BY d.name");return res.json({doctors:rows});}
 if(req.method==="POST"){const {name,specialty,experience_years,availability}=req.body||{};if(!name||!specialty)return res.status(400).json({error:"Name and specialty are required."});const {rows}=await db.query("INSERT INTO doctors(name,specialty,experience_years,availability) VALUES($1,$2,$3,$4) RETURNING *",[name,specialty,Number(experience_years||0),availability||"Mon-Fri, 10:00 AM - 5:00 PM"]);return res.status(201).json({doctor:rows[0]});}
 const {doctor_id,user_id,email}=req.body||{};if(!doctor_id||!user_id||!email)return res.status(400).json({error:"Doctor ID, user ID and email are required."});await db.query("DELETE FROM doctor_accounts WHERE doctor_id=$1",[Number(doctor_id)]);const {rows}=await db.query("INSERT INTO doctor_accounts(user_id,doctor_id,email) VALUES($1,$2,$3) RETURNING *",[String(user_id),Number(doctor_id),String(email).trim().toLowerCase()]);return res.json({account:rows[0]});
}