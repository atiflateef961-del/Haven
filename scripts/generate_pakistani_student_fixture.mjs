import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "scripts/fixtures/pakistani-students.json");
let state = 20261115;
function random(max) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % max; }
function pick(list) { return list[random(list.length)]; }
const cities = [
  ["Karachi", "Sindh", 4, "74000"], ["Hyderabad", "Sindh", 4, "71000"], ["Sukkur", "Sindh", 4, "65200"], ["Larkana", "Sindh", 4, "77150"],
  ["Lahore", "Punjab", 3, "54000"], ["Rawalpindi", "Punjab", 3, "46000"], ["Faisalabad", "Punjab", 3, "38000"], ["Multan", "Punjab", 3, "60000"], ["Sialkot", "Punjab", 3, "51310"], ["Gujranwala", "Punjab", 3, "52250"], ["Bahawalpur", "Punjab", 3, "63100"], ["Sargodha", "Punjab", 3, "40100"], ["Rahim Yar Khan", "Punjab", 3, "64200"], ["Sahiwal", "Punjab", 3, "57000"], ["Okara", "Punjab", 3, "56300"], ["Wah Cantonment", "Punjab", 3, "47040"],
  ["Peshawar", "Khyber Pakhtunkhwa", 1, "25000"], ["Mardan", "Khyber Pakhtunkhwa", 1, "23200"], ["Quetta", "Balochistan", 5, "87300"], ["Islamabad", "Islamabad Capital Territory", 6, "44000"],
];
const male = ["Muhammad", "Ahmed", "Ali", "Hassan", "Hussain", "Abdullah", "Bilal", "Usman", "Umar", "Hamza", "Ibrahim", "Yusuf", "Ismail", "Imran", "Fahad", "Faisal", "Saad", "Salman", "Ahsan", "Junaid", "Zeeshan", "Talha", "Shayan", "Waleed", "Faizan", "Anas", "Rehman", "Karim", "Raheel"];
const female = ["Ayesha", "Fatima", "Maryam", "Khadija", "Zainab", "Hafsa", "Aisha", "Amna", "Asma", "Hira", "Mahnoor", "Nimra", "Saba", "Sadia", "Sana", "Sara", "Sidra", "Javeria", "Laiba", "Noor", "Rabia", "Zoya", "Areeba", "Bushra", "Mahira", "Anaya", "Esha"];
const surnames = ["Khan", "Ahmed", "Ali", "Hussain", "Malik", "Sheikh", "Siddiqui", "Qureshi", "Ansari", "Hashmi", "Raza", "Abbasi", "Butt", "Chaudhry", "Awan", "Mughal", "Syed", "Bukhari", "Jafri", "Naqvi", "Rahman", "Iqbal", "Mahmood", "Akhtar", "Baig", "Dar", "Farooqi", "Gillani", "Saeed", "Shah", "Yousaf", "Zaman", "Bhatti", "Khokhar", "Afridi", "Khattak", "Mehsud", "Qadri"];
const prefixes = ["Muhammad", "Syed", "Abdul", "Hafiz", "Qari", "Mian", "Khawaja", "Ghulam"];
const majors = ["BS Computer Science", "BBA (Business Administration)", "MBBS", "BS Urdu", "BS Electrical Engineering", "BS Mathematics", "BS Psychology", "BS Economics", "BS Civil Engineering", "BS Biotechnology", "BS English", "BS Physics"];
const grades = ["1st Year", "2nd Year", "3rd Year", "4th Year", "MS"];
const hobbies = ["reading", "cricket", "calligraphy", "gardening", "photography", "poetry", "chess", "hiking"];
const statuses = ["Active", "Active", "Active", "Probation", "Leave of Absence", "Suspended", "Graduated"];
const phonePrefixes = [...Array.from({ length: 8 }, (_, i) => 300 + i), ...Array.from({ length: 6 }, (_, i) => 312 + i), ...Array.from({ length: 5 }, (_, i) => 331 + i), ...Array.from({ length: 5 }, (_, i) => 345 + i)];
const usedEmails = new Set(), usedPhones = new Set(), usedCnic = new Set();
const rows = [];

for (let serial = 1; serial <= 100; serial++) {
  const year = 2019 + random(7);
  const month = pick([8, 9]);
  const day = 1 + random(28);
  const enrollment = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const gender = pick(["Male", "Female"]);
  const first = pick(gender === "Male" ? male : female);
  const surname = pick(surnames);
  const [city, province, provinceCode, postal] = pick(cities);
  const grade = pick(grades);
  const major = pick(majors);
  const age = 17 + random(8);
  const dobYear = year - age;
  const dob = `${dobYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const base = `${first}.${surname}`.toLowerCase().replace(/[^a-z0-9.]+/g, ".");
  let email = `${base}@uni.edu.pk`, suffix = 2;
  while (usedEmails.has(email)) email = `${base}${suffix++}@uni.edu.pk`;
  usedEmails.add(email);
  const phonePrefix = pick(phonePrefixes);
  let phoneTail = random(10_000_000), phone = `+92 ${phonePrefix} ${String(phoneTail).padStart(7, "0")}`;
  while (usedPhones.has(phone)) { phoneTail = (phoneTail + 1) % 10_000_000; phone = `+92 ${phonePrefix} ${String(phoneTail).padStart(7, "0")}`; }
  usedPhones.add(phone);
  const genderDigits = gender === "Male" ? [1, 3, 5, 7, 9] : [0, 2, 4, 6, 8];
  let cnic = "";
  do { cnic = `${provinceCode}${String(random(10_000)).padStart(4, "0")}-${String(random(10_000_000)).padStart(7, "0")}-${pick(genderDigits)}`; } while (usedCnic.has(cnic));
  usedCnic.add(cnic);
  const fatherPrefix = random(100) < 38 ? `${pick(prefixes)} ` : "";
  const fatherName = `${fatherPrefix}${pick(male)} ${surname}`;
  const address = `House ${1 + random(499)}, Street ${1 + random(45)}, Block ${pick("ABCDEFGH")}, ${pick(["University Road", "Model Town", "Satellite Town", "Gulshan", "Cantt Area", "Iqbal Town"])}, ${city}, ${province} ${postal}`;
  rows.push({
    student_id: `PK${year}-${String(serial).padStart(5, "0")}`,
    full_name: `${first} ${surname}`,
    father_name: fatherName,
    date_of_birth: dob,
    gender,
    grade_year: grade,
    major,
    email,
    phone,
    cnic,
    home_address: address,
    profile_photo_url: `https://i.pravatar.cc/150?u=${email}`,
    bio: `${grade} ${major} student from ${city} who enjoys ${pick(hobbies)}.`,
    enrollment_date: enrollment,
    status: pick(statuses),
  });
}

const unique = (key) => new Set(rows.map((row) => row[key])).size === rows.length;
if (rows.length !== 100 || rows.some((row) => Object.keys(row).length !== 15 || Object.values(row).some((value) => !value))) throw new Error("Row count, schema, or nonblank validation failed");
for (const key of ["student_id", "email", "phone", "cnic", "profile_photo_url"]) if (!unique(key)) throw new Error(`${key} uniqueness validation failed`);
for (const row of rows) {
  const city = cities.find(([name]) => row.home_address.includes(`, ${name},`));
  const enrollmentYear = Number(row.enrollment_date.slice(0, 4));
  const age = enrollmentYear - Number(row.date_of_birth.slice(0, 4));
  if (!city || row.cnic[0] !== String(city[2]) || Number(row.cnic.at(-1)) % 2 !== (row.gender === "Male" ? 1 : 0)) throw new Error(`CNIC validation failed for ${row.student_id}`);
  if (!phonePrefixes.includes(Number(row.phone.slice(4, 7))) || !row.home_address.endsWith(`${city[1]} ${city[3]}`)) throw new Error(`Phone/address validation failed for ${row.student_id}`);
  if (age < 17 || age > 24 || enrollmentYear < 2019 || enrollmentYear > 2025 || !row.student_id.startsWith(`PK${enrollmentYear}-`)) throw new Error(`Age/enrollment validation failed for ${row.student_id}`);
  if (!row.profile_photo_url.endsWith(row.email)) throw new Error(`Avatar/email validation failed for ${row.student_id}`);
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(`Wrote and verified ${rows.length} fictional records to ${relative(root, output)}`);
