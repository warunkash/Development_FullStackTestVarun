// Each site: n title, d purpose, u url, area, dept (department), sector, status.
// status: ok = responded 200; blocked = server responded but rejects automated requests (403/406);
//         down = no response from the test environment (may be geo-blocked, not proven dead).
// Last checked 2026-10-28 from a cloud sandbox. Re-run `node check-links.js` to refresh.
window.CHECKED="2026-10-28";
window.SITES = [
 {
  "n": "Warangal District",
  "d": "Official district administration portal: collectorate, departments, grievances, notices.",
  "u": "https://warangal.telangana.gov.in",
  "area": "Warangal / Hanumakonda",
  "dept": "District Administration (Collectorate)",
  "sector": "Governance",
  "status": "ok"
 },
 {
  "n": "Hanumakonda District",
  "d": "Official portal of Hanumakonda district (part of the Warangal twin-city region).",
  "u": "https://hanumakonda.telangana.gov.in",
  "area": "Warangal / Hanumakonda",
  "dept": "District Administration (Collectorate)",
  "sector": "Governance",
  "status": "ok"
 },
 {
  "n": "Greater Warangal Municipal Corporation (GWMC)",
  "d": "Property tax, trade licences, birth/death certificates, building permissions, sanitation.",
  "u": "https://www.gwmc.gov.in",
  "area": "Warangal / Hanumakonda",
  "dept": "Municipal Administration (GWMC)",
  "sector": "Governance",
  "status": "down"
 },
 {
  "n": "Warangal Police Commissionerate",
  "d": "Commissionerate covering Warangal, Hanumakonda and Jangaon: police services and notices.",
  "u": "https://warangalpolice.telangana.gov.in",
  "area": "Warangal / Hanumakonda",
  "dept": "Home / Police",
  "sector": "Governance",
  "status": "down"
 },
 {
  "n": "Warangal District Court (eCourts)",
  "d": "Case status, cause lists and orders.",
  "u": "https://districts.ecourts.gov.in/warangal",
  "area": "Warangal / Hanumakonda",
  "dept": "Judiciary (eCourts)",
  "sector": "Governance",
  "status": "down"
 },
 {
  "n": "Kakatiya University",
  "d": "State university in Warangal: admissions, results, exams.",
  "u": "https://kakatiya.ac.in",
  "area": "Warangal / Hanumakonda",
  "dept": "Higher Education",
  "sector": "Education",
  "status": "down"
 },
 {
  "n": "NIT Warangal",
  "d": "National Institute of Technology: admissions, academics, placements.",
  "u": "https://www.nitw.ac.in",
  "area": "Warangal / Hanumakonda",
  "dept": "Higher Education (MoE)",
  "sector": "Education",
  "status": "down"
 },
 {
  "n": "Telangana Board of Intermediate Education",
  "d": "Intermediate results, hall tickets, admissions.",
  "u": "https://tgbie.cgg.gov.in",
  "area": "Telangana State",
  "dept": "Intermediate Education",
  "sector": "Education",
  "status": "blocked"
 },
 {
  "n": "School Education Dept. (SSC Board)",
  "d": "SSC results and school education information.",
  "u": "https://bse.telangana.gov.in",
  "area": "Telangana State",
  "dept": "School Education",
  "sector": "Education",
  "status": "down"
 },
 {
  "n": "TG ePASS Scholarships",
  "d": "Post-matric scholarships and fee reimbursement.",
  "u": "https://telanganaepass.cgg.gov.in",
  "area": "Telangana State",
  "dept": "Social Welfare / Minorities / BC Welfare",
  "sector": "Education",
  "status": "ok"
 },
 {
  "n": "Telangana State Public Service Commission",
  "d": "Recruitment notifications and exam results.",
  "u": "https://websitenew.tgpsc.gov.in",
  "area": "Telangana State",
  "dept": "Public Service Commission",
  "sector": "Employment",
  "status": "ok"
 },
 {
  "n": "Aarogyasri Health Care Trust",
  "d": "Cashless treatment for eligible families, network hospitals.",
  "u": "https://www.aarogyasri.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Aarogyasri Health Care Trust",
  "sector": "Health",
  "status": "down"
 },
 {
  "n": "Health, Medical & Family Welfare Dept.",
  "d": "State health programmes, schemes and notices.",
  "u": "https://health.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Health, Medical & Family Welfare",
  "sector": "Health",
  "status": "down"
 },
 {
  "n": "Ayushman Bharat PM-JAY",
  "d": "National health protection scheme; check eligibility.",
  "u": "https://pmjay.gov.in",
  "area": "India (Central)",
  "dept": "National Health Authority",
  "sector": "Health",
  "status": "down"
 },
 {
  "n": "ABHA / Ayushman Bharat Digital Mission",
  "d": "Create your health ID and records.",
  "u": "https://abdm.gov.in",
  "area": "India (Central)",
  "dept": "National Health Authority",
  "sector": "Health",
  "status": "blocked"
 },
 {
  "n": "TGNPDCL (Northern Power)",
  "d": "Electricity bills and connections for the Warangal region.",
  "u": "https://tgnpdcl.com",
  "area": "Telangana State",
  "dept": "Energy (TGNPDCL)",
  "sector": "Utilities",
  "status": "ok"
 },
 {
  "n": "TGSRTC",
  "d": "Bus timings, ticket booking and passes.",
  "u": "https://www.tgsrtc.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Transport (TGSRTC)",
  "sector": "Transport",
  "status": "ok"
 },
 {
  "n": "Transport Department",
  "d": "Driving licence, vehicle registration, permits.",
  "u": "https://transport.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Transport, Roads & Buildings",
  "sector": "Transport",
  "status": "ok"
 },
 {
  "n": "Parivahan Sewa",
  "d": "National driving licence and vehicle services.",
  "u": "https://parivahan.gov.in",
  "area": "India (Central)",
  "dept": "Road Transport & Highways (MoRTH)",
  "sector": "Transport",
  "status": "ok"
 },
 {
  "n": "South Central Railway (Kazipet Jn.)",
  "d": "Zone information for Kazipet/Warangal stations.",
  "u": "https://scr.indianrailways.gov.in",
  "area": "India (Central)",
  "dept": "Railways (South Central Railway)",
  "sector": "Transport",
  "status": "ok"
 },
 {
  "n": "IRCTC",
  "d": "Train tickets and PNR status.",
  "u": "https://www.irctc.co.in",
  "area": "India (Central)",
  "dept": "Railways (IRCTC)",
  "sector": "Transport",
  "status": "blocked"
 },
 {
  "n": "Bhu Bharati (replaced Dharani)",
  "d": "Land records (RoR), mutations, appeals and registration slots.",
  "u": "https://bhubharati.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Revenue (CCLA)",
  "sector": "Land & Revenue",
  "status": "down"
 },
 {
  "n": "Registration & Stamps",
  "d": "Encumbrance certificates, document search, stamp duty.",
  "u": "https://registration.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Registration & Stamps",
  "sector": "Land & Revenue",
  "status": "down"
 },
 {
  "n": "MeeSeva",
  "d": "150+ citizen services: certificates, bills, applications.",
  "u": "https://ts.meeseva.telangana.gov.in",
  "area": "Telangana State",
  "dept": "IT, Electronics & Communications",
  "sector": "Citizen Services",
  "status": "down"
 },
 {
  "n": "Civil Supplies (Ration Cards)",
  "d": "Ration card status and PDS information.",
  "u": "https://civilsupplies.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Civil Supplies",
  "sector": "Welfare & Agriculture",
  "status": "down"
 },
 {
  "n": "Agriculture Department",
  "d": "Farmer schemes, advisories and subsidies.",
  "u": "https://agriculture.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Agriculture & Cooperation",
  "sector": "Welfare & Agriculture",
  "status": "down"
 },
 {
  "n": "Praja Palana / Telangana Portal",
  "d": "State schemes and public services directory.",
  "u": "https://www.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Government of Telangana",
  "sector": "Citizen Services",
  "status": "ok"
 },
 {
  "n": "PM-KISAN",
  "d": "Income support for farmers; beneficiary status.",
  "u": "https://pmkisan.gov.in",
  "area": "India (Central)",
  "dept": "Agriculture & Farmers Welfare (MoA)",
  "sector": "Welfare & Agriculture",
  "status": "down"
 },
 {
  "n": "UIDAI (Aadhaar)",
  "d": "Aadhaar update, download and enrolment centres.",
  "u": "https://uidai.gov.in",
  "area": "India (Central)",
  "dept": "UIDAI (MeitY)",
  "sector": "Identity & Taxes",
  "status": "ok"
 },
 {
  "n": "DigiLocker",
  "d": "Digital documents: Aadhaar, licence, marksheets.",
  "u": "https://www.digilocker.gov.in",
  "area": "India (Central)",
  "dept": "MeitY / NeGD",
  "sector": "Identity & Taxes",
  "status": "ok"
 },
 {
  "n": "UMANG",
  "d": "Single app for many central and state services.",
  "u": "https://web.umang.gov.in",
  "area": "India (Central)",
  "dept": "MeitY / NeGD",
  "sector": "Citizen Services",
  "status": "ok"
 },
 {
  "n": "Passport Seva",
  "d": "Passport application and appointments.",
  "u": "https://www.passportindia.gov.in",
  "area": "India (Central)",
  "dept": "External Affairs (MEA)",
  "sector": "Identity & Taxes",
  "status": "ok"
 },
 {
  "n": "Voters' Service Portal",
  "d": "Voter registration, EPIC download and corrections.",
  "u": "https://voters.eci.gov.in",
  "area": "India (Central)",
  "dept": "Election Commission of India",
  "sector": "Identity & Taxes",
  "status": "blocked"
 },
 {
  "n": "Income Tax e-Filing",
  "d": "File returns, PAN services.",
  "u": "https://www.incometax.gov.in",
  "area": "India (Central)",
  "dept": "Income Tax Department (CBDT)",
  "sector": "Identity & Taxes",
  "status": "ok"
 },
 {
  "n": "GST Portal",
  "d": "GST registration and returns.",
  "u": "https://www.gst.gov.in",
  "area": "India (Central)",
  "dept": "GST Council / CBIC",
  "sector": "Identity & Taxes",
  "status": "ok"
 },
 {
  "n": "CPGRAMS",
  "d": "File public grievances with central/state departments.",
  "u": "https://pgportal.gov.in",
  "area": "India (Central)",
  "dept": "Personnel & Public Grievances (DARPG)",
  "sector": "Grievance & Rights",
  "status": "ok"
 },
 {
  "n": "RTI Online",
  "d": "File RTI requests to central public authorities.",
  "u": "https://rtionline.gov.in",
  "area": "India (Central)",
  "dept": "Personnel & Training (DoPT)",
  "sector": "Grievance & Rights",
  "status": "ok"
 },
 {
  "n": "National Portal of India",
  "d": "Gateway to all government websites.",
  "u": "https://www.india.gov.in",
  "area": "India (Central)",
  "dept": "MeitY / NIC",
  "sector": "Citizen Services",
  "status": "down"
 },
 {
  "n": "MyGov",
  "d": "Citizen engagement platform.",
  "u": "https://www.mygov.in",
  "area": "India (Central)",
  "dept": "MeitY",
  "sector": "Citizen Services",
  "status": "ok"
 },
 {
  "n": "Telangana Tourism",
  "d": "Warangal Fort, Thousand Pillar Temple, Ramappa (UNESCO) and bookings.",
  "u": "https://tourism.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Tourism & Culture",
  "sector": "Tourism & Culture",
  "status": "down"
 },
 {
  "n": "Archaeological Survey of India",
  "d": "Protected monuments and visiting information.",
  "u": "https://asi.nic.in",
  "area": "India (Central)",
  "dept": "Archaeological Survey of India (MoC)",
  "sector": "Tourism & Culture",
  "status": "ok"
 },
 {
  "n": "UNESCO – Ramappa Temple",
  "d": "World Heritage listing of the Kakatiya Rudreswara Temple.",
  "u": "https://whc.unesco.org/en/list/1570",
  "area": "India (Central)",
  "dept": "UNESCO World Heritage Centre",
  "sector": "Tourism & Culture",
  "status": "blocked"
 }
];
