import { db } from "hatchable";
export const access="user";
export const methods=["GET","PATCH"];
export default async function(req,res){
 const uid=req.user.id;
 if(req.method==="GET"){const {rows}=await db.query("SELECT a.id,a.patient_name,a.appointment_date,a.appointment_time,a.reason,a.status,d.name AS doctor_name,d.specialty FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.patient_user_id=$1 OR lower(a.patient_email)=lower($2) ORDER BY a.appointment_date DESC,a.id DESC",[uid,req.user.email]);return res.json({appointments:rows});}
 const {id}=req.body||{};const {rows}=await db.query("UPDATE appointments SET status='Cancelled',updated_at=now() WHERE id=$1 AND (patient_user_id=$2 OR lower(patient_email)=lower($3)) AND status IN ('Pending','Approved') RETURNING id,status",[Number(id),uid,req.user.email]);if(!rows.length)return res.status(404).json({error:"Appointment not found or cannot be cancelled."});return res.json({appointment:rows[0]});
}