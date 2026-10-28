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
  "status": "ok",
  "tn": "వరంగల్ జిల్లా",
  "td": "జిల్లా కలెక్టరేట్, శాఖలు, ఫిర్యాదులు, ప్రకటనల అధికారిక పోర్టల్."
 },
 {
  "n": "Hanumakonda District",
  "d": "Official portal of Hanumakonda district (part of the Warangal twin-city region).",
  "u": "https://hanumakonda.telangana.gov.in",
  "area": "Warangal / Hanumakonda",
  "dept": "District Administration (Collectorate)",
  "sector": "Governance",
  "status": "ok",
  "tn": "హనుమకొండ జిల్లా",
  "td": "హనుమకొండ జిల్లా పరిపాలన అధికారిక పోర్టల్ (వరంగల్ జంట నగర ప్రాంతం)."
 },
 {
  "n": "Greater Warangal Municipal Corporation (GWMC)",
  "d": "Property tax, trade licences, birth/death certificates, building permissions, sanitation.",
  "u": "https://www.gwmc.gov.in",
  "area": "Warangal / Hanumakonda",
  "dept": "Municipal Administration (GWMC)",
  "sector": "Governance",
  "status": "down",
  "tn": "గ్రేటర్ వరంగల్ మునిసిపల్ కార్పొరేషన్ (GWMC)",
  "td": "ఆస్తి పన్ను, ట్రేడ్ లైసెన్సులు, జనన/మరణ ధృవపత్రాలు, భవన అనుమతులు, పారిశుధ్యం."
 },
 {
  "n": "Warangal Police Commissionerate",
  "d": "Commissionerate covering Warangal, Hanumakonda and Jangaon: police services and notices.",
  "u": "https://warangalpolice.telangana.gov.in",
  "area": "Warangal / Hanumakonda",
  "dept": "Home / Police",
  "sector": "Governance",
  "status": "down",
  "tn": "వరంగల్ పోలీస్ కమిషనరేట్",
  "td": "వరంగల్, హనుమకొండ, జనగామ పరిధిలో పోలీసు సేవలు మరియు ప్రకటనలు."
 },
 {
  "n": "Warangal District Court (eCourts)",
  "d": "Case status, cause lists and orders.",
  "u": "https://districts.ecourts.gov.in/warangal",
  "area": "Warangal / Hanumakonda",
  "dept": "Judiciary (eCourts)",
  "sector": "Governance",
  "status": "down",
  "tn": "వరంగల్ జిల్లా కోర్టు (ఈ-కోర్టులు)",
  "td": "కేసు స్థితి, కాజ్ లిస్టులు, ఉత్తర్వులు."
 },
 {
  "n": "Kakatiya University",
  "d": "State university in Warangal: admissions, results, exams.",
  "u": "https://kakatiya.ac.in",
  "area": "Warangal / Hanumakonda",
  "dept": "Higher Education",
  "sector": "Education",
  "status": "down",
  "tn": "కాకతీయ విశ్వవిద్యాలయం",
  "td": "వరంగల్‌లోని రాష్ట్ర విశ్వవిద్యాలయం: ప్రవేశాలు, ఫలితాలు, పరీక్షలు."
 },
 {
  "n": "NIT Warangal",
  "d": "National Institute of Technology: admissions, academics, placements.",
  "u": "https://www.nitw.ac.in",
  "area": "Warangal / Hanumakonda",
  "dept": "Higher Education (MoE)",
  "sector": "Education",
  "status": "down",
  "tn": "NIT వరంగల్",
  "td": "జాతీయ సాంకేతిక సంస్థ: ప్రవేశాలు, విద్యా విభాగాలు, ప్లేస్‌మెంట్లు."
 },
 {
  "n": "Telangana Board of Intermediate Education",
  "d": "Intermediate results, hall tickets, admissions.",
  "u": "https://tgbie.cgg.gov.in",
  "area": "Telangana State",
  "dept": "Intermediate Education",
  "sector": "Education",
  "status": "blocked",
  "tn": "తెలంగాణ ఇంటర్మీడియట్ విద్యా మండలి",
  "td": "ఇంటర్ ఫలితాలు, హాల్ టికెట్లు, ప్రవేశాలు."
 },
 {
  "n": "School Education Dept. (SSC Board)",
  "d": "SSC results and school education information.",
  "u": "https://bse.telangana.gov.in",
  "area": "Telangana State",
  "dept": "School Education",
  "sector": "Education",
  "status": "down",
  "tn": "పాఠశాల విద్యా శాఖ (SSC బోర్డు)",
  "td": "పదవ తరగతి ఫలితాలు మరియు పాఠశాల విద్య సమాచారం."
 },
 {
  "n": "TG ePASS Scholarships",
  "d": "Post-matric scholarships and fee reimbursement.",
  "u": "https://telanganaepass.cgg.gov.in",
  "area": "Telangana State",
  "dept": "Social Welfare / Minorities / BC Welfare",
  "sector": "Education",
  "status": "ok",
  "tn": "TG ఈపాస్ స్కాలర్‌షిప్‌లు",
  "td": "పోస్ట్-మెట్రిక్ స్కాలర్‌షిప్‌లు మరియు ఫీజు రీయింబర్స్‌మెంట్."
 },
 {
  "n": "Telangana State Public Service Commission",
  "d": "Recruitment notifications and exam results.",
  "u": "https://websitenew.tgpsc.gov.in",
  "area": "Telangana State",
  "dept": "Public Service Commission",
  "sector": "Employment",
  "status": "ok",
  "tn": "తెలంగాణ రాష్ట్ర పబ్లిక్ సర్వీస్ కమిషన్",
  "td": "నియామక ప్రకటనలు మరియు పరీక్ష ఫలితాలు."
 },
 {
  "n": "Aarogyasri Health Care Trust",
  "d": "Cashless treatment for eligible families, network hospitals.",
  "u": "https://www.aarogyasri.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Aarogyasri Health Care Trust",
  "sector": "Health",
  "status": "down",
  "tn": "ఆరోగ్యశ్రీ హెల్త్ కేర్ ట్రస్ట్",
  "td": "అర్హులైన కుటుంబాలకు నగదు రహిత వైద్యం, నెట్‌వర్క్ ఆసుపత్రుల వివరాలు."
 },
 {
  "n": "Health, Medical & Family Welfare Dept.",
  "d": "State health programmes, schemes and notices.",
  "u": "https://health.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Health, Medical & Family Welfare",
  "sector": "Health",
  "status": "down",
  "tn": "ఆరోగ్య, వైద్య & కుటుంబ సంక్షేమ శాఖ",
  "td": "రాష్ట్ర ఆరోగ్య కార్యక్రమాలు, పథకాలు, ప్రకటనలు."
 },
 {
  "n": "Ayushman Bharat PM-JAY",
  "d": "National health protection scheme; check eligibility.",
  "u": "https://pmjay.gov.in",
  "area": "India (Central)",
  "dept": "National Health Authority",
  "sector": "Health",
  "status": "down",
  "tn": "ఆయుష్మాన్ భారత్ PM-JAY",
  "td": "జాతీయ ఆరోగ్య రక్షణ పథకం; అర్హతను తనిఖీ చేయండి."
 },
 {
  "n": "ABHA / Ayushman Bharat Digital Mission",
  "d": "Create your health ID and records.",
  "u": "https://abdm.gov.in",
  "area": "India (Central)",
  "dept": "National Health Authority",
  "sector": "Health",
  "status": "blocked",
  "tn": "ABHA / ఆయుష్మాన్ భారత్ డిజిటల్ మిషన్",
  "td": "మీ హెల్త్ ఐడీ మరియు ఆరోగ్య రికార్డులను సృష్టించండి."
 },
 {
  "n": "TGNPDCL (Northern Power)",
  "d": "Electricity bills and connections for the Warangal region.",
  "u": "https://tgnpdcl.com",
  "area": "Telangana State",
  "dept": "Energy (TGNPDCL)",
  "sector": "Utilities",
  "status": "ok",
  "tn": "TGNPDCL (ఉత్తర తెలంగాణ విద్యుత్ సంస్థ)",
  "td": "వరంగల్ ప్రాంతంలో విద్యుత్ బిల్లులు మరియు కనెక్షన్లు."
 },
 {
  "n": "TGSRTC",
  "d": "Bus timings, ticket booking and passes.",
  "u": "https://www.tgsrtc.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Transport (TGSRTC)",
  "sector": "Transport",
  "status": "ok",
  "tn": "TGSRTC",
  "td": "బస్సు సమయాలు, టికెట్ బుకింగ్, పాస్‌లు."
 },
 {
  "n": "Transport Department",
  "d": "Driving licence, vehicle registration, permits.",
  "u": "https://transport.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Transport, Roads & Buildings",
  "sector": "Transport",
  "status": "ok",
  "tn": "రవాణా శాఖ",
  "td": "డ్రైవింగ్ లైసెన్స్, వాహన రిజిస్ట్రేషన్, పర్మిట్లు."
 },
 {
  "n": "Parivahan Sewa",
  "d": "National driving licence and vehicle services.",
  "u": "https://parivahan.gov.in",
  "area": "India (Central)",
  "dept": "Road Transport & Highways (MoRTH)",
  "sector": "Transport",
  "status": "ok",
  "tn": "పరివాహన్ సేవ",
  "td": "జాతీయ డ్రైవింగ్ లైసెన్స్ మరియు వాహన సేవలు."
 },
 {
  "n": "South Central Railway (Kazipet Jn.)",
  "d": "Zone information for Kazipet/Warangal stations.",
  "u": "https://scr.indianrailways.gov.in",
  "area": "India (Central)",
  "dept": "Railways (South Central Railway)",
  "sector": "Transport",
  "status": "ok",
  "tn": "దక్షిణ మధ్య రైల్వే (కాజీపేట జంక్షన్)",
  "td": "కాజీపేట/వరంగల్ స్టేషన్ల జోన్ సమాచారం."
 },
 {
  "n": "IRCTC",
  "d": "Train tickets and PNR status.",
  "u": "https://www.irctc.co.in",
  "area": "India (Central)",
  "dept": "Railways (IRCTC)",
  "sector": "Transport",
  "status": "blocked",
  "tn": "IRCTC",
  "td": "రైలు టికెట్లు మరియు PNR స్థితి."
 },
 {
  "n": "Bhu Bharati (replaced Dharani)",
  "d": "Land records (RoR), mutations, appeals and registration slots.",
  "u": "https://bhubharati.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Revenue (CCLA)",
  "sector": "Land & Revenue",
  "status": "down",
  "tn": "భూ భారతి (ధరణి స్థానంలో)",
  "td": "భూ రికార్డులు (RoR), మ్యుటేషన్లు, అప్పీళ్లు, రిజిస్ట్రేషన్ స్లాట్లు."
 },
 {
  "n": "Registration & Stamps",
  "d": "Encumbrance certificates, document search, stamp duty.",
  "u": "https://registration.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Registration & Stamps",
  "sector": "Land & Revenue",
  "status": "down",
  "tn": "రిజిస్ట్రేషన్లు & స్టాంపులు",
  "td": "ఎన్‌కంబరెన్స్ సర్టిఫికెట్లు, డాక్యుమెంట్ శోధన, స్టాంపు డ్యూటీ."
 },
 {
  "n": "MeeSeva",
  "d": "150+ citizen services: certificates, bills, applications.",
  "u": "https://ts.meeseva.telangana.gov.in",
  "area": "Telangana State",
  "dept": "IT, Electronics & Communications",
  "sector": "Citizen Services",
  "status": "down",
  "tn": "మీసేవ",
  "td": "ధృవపత్రాలు, బిల్లులు, దరఖాస్తులతో సహా 150+ పౌర సేవలు."
 },
 {
  "n": "Civil Supplies (Ration Cards)",
  "d": "Ration card status and PDS information.",
  "u": "https://civilsupplies.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Civil Supplies",
  "sector": "Welfare & Agriculture",
  "status": "down",
  "tn": "పౌర సరఫరాలు (రేషన్ కార్డులు)",
  "td": "రేషన్ కార్డు స్థితి మరియు ప్రజా పంపిణీ వ్యవస్థ సమాచారం."
 },
 {
  "n": "Agriculture Department",
  "d": "Farmer schemes, advisories and subsidies.",
  "u": "https://agriculture.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Agriculture & Cooperation",
  "sector": "Welfare & Agriculture",
  "status": "down",
  "tn": "వ్యవసాయ శాఖ",
  "td": "రైతు పథకాలు, సలహాలు, సబ్సిడీలు."
 },
 {
  "n": "Praja Palana / Telangana Portal",
  "d": "State schemes and public services directory.",
  "u": "https://www.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Government of Telangana",
  "sector": "Citizen Services",
  "status": "ok",
  "tn": "తెలంగాణ ప్రభుత్వ పోర్టల్",
  "td": "రాష్ట్ర పథకాలు మరియు ప్రజా సేవల డైరెక్టరీ."
 },
 {
  "n": "PM-KISAN",
  "d": "Income support for farmers; beneficiary status.",
  "u": "https://pmkisan.gov.in",
  "area": "India (Central)",
  "dept": "Agriculture & Farmers Welfare (MoA)",
  "sector": "Welfare & Agriculture",
  "status": "down",
  "tn": "PM-కిసాన్",
  "td": "రైతులకు ఆదాయ మద్దతు; లబ్ధిదారుల స్థితి."
 },
 {
  "n": "UIDAI (Aadhaar)",
  "d": "Aadhaar update, download and enrolment centres.",
  "u": "https://uidai.gov.in",
  "area": "India (Central)",
  "dept": "UIDAI (MeitY)",
  "sector": "Identity & Taxes",
  "status": "ok",
  "tn": "UIDAI (ఆధార్)",
  "td": "ఆధార్ నవీకరణ, డౌన్‌లోడ్, నమోదు కేంద్రాలు."
 },
 {
  "n": "DigiLocker",
  "d": "Digital documents: Aadhaar, licence, marksheets.",
  "u": "https://www.digilocker.gov.in",
  "area": "India (Central)",
  "dept": "MeitY / NeGD",
  "sector": "Identity & Taxes",
  "status": "ok",
  "tn": "డిజిలాకర్",
  "td": "డిజిటల్ పత్రాలు: ఆధార్, లైసెన్స్, మార్క్‌షీట్లు."
 },
 {
  "n": "UMANG",
  "d": "Single app for many central and state services.",
  "u": "https://web.umang.gov.in",
  "area": "India (Central)",
  "dept": "MeitY / NeGD",
  "sector": "Citizen Services",
  "status": "ok",
  "tn": "ఉమంగ్",
  "td": "అనేక కేంద్ర, రాష్ట్ర సేవలకు ఒకే యాప్."
 },
 {
  "n": "Passport Seva",
  "d": "Passport application and appointments.",
  "u": "https://www.passportindia.gov.in",
  "area": "India (Central)",
  "dept": "External Affairs (MEA)",
  "sector": "Identity & Taxes",
  "status": "ok",
  "tn": "పాస్‌పోర్ట్ సేవ",
  "td": "పాస్‌పోర్ట్ దరఖాస్తు మరియు అపాయింట్‌మెంట్లు."
 },
 {
  "n": "Voters' Service Portal",
  "d": "Voter registration, EPIC download and corrections.",
  "u": "https://voters.eci.gov.in",
  "area": "India (Central)",
  "dept": "Election Commission of India",
  "sector": "Identity & Taxes",
  "status": "blocked",
  "tn": "ఓటర్ల సేవా పోర్టల్",
  "td": "ఓటరు నమోదు, EPIC డౌన్‌లోడ్, సవరణలు."
 },
 {
  "n": "Income Tax e-Filing",
  "d": "File returns, PAN services.",
  "u": "https://www.incometax.gov.in",
  "area": "India (Central)",
  "dept": "Income Tax Department (CBDT)",
  "sector": "Identity & Taxes",
  "status": "ok",
  "tn": "ఆదాయపు పన్ను ఈ-ఫైలింగ్",
  "td": "రిటర్నులు దాఖలు, PAN సేవలు."
 },
 {
  "n": "GST Portal",
  "d": "GST registration and returns.",
  "u": "https://www.gst.gov.in",
  "area": "India (Central)",
  "dept": "GST Council / CBIC",
  "sector": "Identity & Taxes",
  "status": "ok",
  "tn": "GST పోర్టల్",
  "td": "GST నమోదు మరియు రిటర్నులు."
 },
 {
  "n": "CPGRAMS",
  "d": "File public grievances with central/state departments.",
  "u": "https://pgportal.gov.in",
  "area": "India (Central)",
  "dept": "Personnel & Public Grievances (DARPG)",
  "sector": "Grievance & Rights",
  "status": "ok",
  "tn": "CPGRAMS",
  "td": "కేంద్ర/రాష్ట్ర శాఖలకు ప్రజా ఫిర్యాదులు నమోదు చేయండి."
 },
 {
  "n": "RTI Online",
  "d": "File RTI requests to central public authorities.",
  "u": "https://rtionline.gov.in",
  "area": "India (Central)",
  "dept": "Personnel & Training (DoPT)",
  "sector": "Grievance & Rights",
  "status": "ok",
  "tn": "RTI ఆన్‌లైన్",
  "td": "కేంద్ర ప్రభుత్వ సంస్థలకు సమాచార హక్కు దరఖాస్తులు."
 },
 {
  "n": "National Portal of India",
  "d": "Gateway to all government websites.",
  "u": "https://www.india.gov.in",
  "area": "India (Central)",
  "dept": "MeitY / NIC",
  "sector": "Citizen Services",
  "status": "down",
  "tn": "జాతీయ పోర్టల్ ఆఫ్ ఇండియా",
  "td": "అన్ని ప్రభుత్వ వెబ్‌సైట్లకు ముఖద్వారం."
 },
 {
  "n": "MyGov",
  "d": "Citizen engagement platform.",
  "u": "https://www.mygov.in",
  "area": "India (Central)",
  "dept": "MeitY",
  "sector": "Citizen Services",
  "status": "ok",
  "tn": "మైగవ్",
  "td": "పౌరుల భాగస్వామ్య వేదిక."
 },
 {
  "n": "Telangana Tourism",
  "d": "Warangal Fort, Thousand Pillar Temple, Ramappa (UNESCO) and bookings.",
  "u": "https://tourism.telangana.gov.in",
  "area": "Telangana State",
  "dept": "Tourism & Culture",
  "sector": "Tourism & Culture",
  "status": "down",
  "tn": "తెలంగాణ టూరిజం",
  "td": "వరంగల్ కోట, వేయి స్తంభాల గుడి, రామప్ప (యునెస్కో) మరియు బుకింగ్‌లు."
 },
 {
  "n": "Archaeological Survey of India",
  "d": "Protected monuments and visiting information.",
  "u": "https://asi.nic.in",
  "area": "India (Central)",
  "dept": "Archaeological Survey of India (MoC)",
  "sector": "Tourism & Culture",
  "status": "ok",
  "tn": "భారత పురావస్తు సర్వేక్షణ సంస్థ",
  "td": "రక్షిత స్మారక చిహ్నాలు మరియు సందర్శన సమాచారం."
 },
 {
  "n": "UNESCO – Ramappa Temple",
  "d": "World Heritage listing of the Kakatiya Rudreswara Temple.",
  "u": "https://whc.unesco.org/en/list/1570",
  "area": "India (Central)",
  "dept": "UNESCO World Heritage Centre",
  "sector": "Tourism & Culture",
  "status": "blocked",
  "tn": "యునెస్కో – రామప్ప దేవాలయం",
  "td": "కాకతీయ రుద్రేశ్వర (రామప్ప) ఆలయ ప్రపంచ వారసత్వ గుర్తింపు."
 },
 {
  "n": "Kakatiya Urban Development Authority (KUDA)",
  "d": "City master plan, layout and building approvals, and development projects for Warangal, Hanumakonda and Jangaon.",
  "u": "http://www.kuda.in",
  "area": "Warangal / Hanumakonda",
  "dept": "Urban Development (KUDA)",
  "sector": "Governance",
  "status": "ok",
  "tn": "కాకతీయ పట్టణాభివృద్ధి సంస్థ (KUDA)",
  "td": "వరంగల్, హనుమకొండ, జనగామ ప్రాంతాలకు మాస్టర్ ప్లాన్, లేఅవుట్/భవన అనుమతులు, అభివృద్ధి ప్రాజెక్టులు."
 },
 {
  "n": "Kakatiya Medical College & MGM Hospital",
  "d": "Government medical college in Hanumakonda; its site lists courses, admissions and the affiliated MGM tertiary hospital (1,450 beds).",
  "u": "https://kmcwgl.com",
  "area": "Warangal / Hanumakonda",
  "dept": "Medical Education (KMC)",
  "sector": "Health",
  "status": "ok",
  "tn": "కాకతీయ మెడికల్ కాలేజీ & MGM ఆసుపత్రి",
  "td": "హనుమకొండలోని ప్రభుత్వ వైద్య కళాశాల; కోర్సులు, ప్రవేశాలు మరియు అనుబంధ MGM ఆసుపత్రి (1,450 పడకలు) వివరాలు."
 },
 {
  "n": "Kaloji Narayana Rao University of Health Sciences (KNRUHS)",
  "d": "Warangal-based health university: medical, dental and nursing admissions, exams and results.",
  "u": "https://knruhs.telangana.gov.in",
  "area": "Warangal / Hanumakonda",
  "dept": "Health Sciences University",
  "sector": "Education",
  "status": "ok",
  "tn": "కాళోజీ నారాయణరావు ఆరోగ్య శాస్త్రాల విశ్వవిద్యాలయం (KNRUHS)",
  "td": "వరంగల్‌లోని ఆరోగ్య విశ్వవిద్యాలయం: వైద్య, దంత, నర్సింగ్ ప్రవేశాలు, పరీక్షలు, ఫలితాలు."
 }
];
// Emergency numbers (Telangana moved to unified 112 in 2025; older numbers still referenced). Confirm locally.
window.HELPLINES = [
 {
  "num": "112",
  "n": "Emergency (Police, Fire, Ambulance)",
  "tn": "అత్యవసర సేవలు (పోలీస్, అగ్నిమాపక, అంబులెన్స్)"
 },
 {
  "num": "100",
  "n": "Police",
  "tn": "పోలీస్"
 },
 {
  "num": "108",
  "n": "Ambulance",
  "tn": "అంబులెన్స్"
 },
 {
  "num": "101",
  "n": "Fire",
  "tn": "అగ్నిమాపక"
 },
 {
  "num": "181",
  "n": "Women helpline",
  "tn": "మహిళా హెల్ప్‌లైన్"
 },
 {
  "num": "1098",
  "n": "Child helpline",
  "tn": "చిల్డ్రన్ హెల్ప్‌లైన్"
 },
 {
  "num": "1930",
  "n": "Cyber crime (national)",
  "tn": "సైబర్ నేరాలు (జాతీయ)"
 },
 {
  "num": "1077",
  "n": "Disaster control room",
  "tn": "విపత్తు నియంత్రణ గది"
 }
];
