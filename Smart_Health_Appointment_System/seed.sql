INSERT INTO doctors (name, specialty, experience_years, availability)
SELECT 'Dr. Ananya Sharma', 'General Physician', 8, 'Mon-Fri, 10:00 AM - 5:00 PM'
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name = 'Dr. Ananya Sharma')