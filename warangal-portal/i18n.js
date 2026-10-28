// UI strings and label translations. Telugu text is machine-drafted; have a native speaker review it.
window.I18N = {
  en: {
    title: "Warangal Citizen Portal",
    sub: "Local, Telangana and Government of India websites for residents of Warangal & Hanumakonda — grouped by sector, department, area and link status.",
    search: "Search by title, purpose, department… e.g. property tax, ration card",
    groupBy: "Group by", area: "Area", status: "Status", all: "All",
    sector: "Sector", dept: "Department", areaK: "Area", statusK: "Status",
    none: "No matching sites.", help: "Emergency & helplines (tap to call)",
    sum: (t, a, b, c) => `${t} sites · ${a} working · ${b} reachable but block bots · ${c} not reachable (from test)`,
    foot: d => `Unofficial directory; not run by any government body. Status reflects a single automated check on ${d} from outside India: "Not reachable" means no response from the test environment (often geo-blocking), not that the site is permanently down. Verify before entering personal data.`,
    st: { ok: "Working", blocked: "Reachable (blocks bots)", down: "Not reachable" },
    stTip: { ok: "Responded normally", blocked: "Server answered but rejects automated checks; likely works in a browser", down: "No response from the test environment; may be geo-blocked or moved" },
    map: {}
  },
  te: {
    title: "వరంగల్ పౌర పోర్టల్",
    sub: "వరంగల్ & హనుమకొండ ప్రజల కోసం స్థానిక, తెలంగాణ రాష్ట్ర మరియు భారత ప్రభుత్వ వెబ్‌సైట్లు — రంగం, శాఖ, ప్రాంతం, లింక్ స్థితి వారీగా.",
    search: "శీర్షిక, ఉద్దేశ్యం, శాఖ ద్వారా వెతకండి… ఉదా: ఆస్తి పన్ను, రేషన్ కార్డు",
    groupBy: "వర్గీకరణ", area: "ప్రాంతం", status: "స్థితి", all: "అన్నీ",
    sector: "రంగం", dept: "శాఖ", areaK: "ప్రాంతం", statusK: "స్థితి",
    none: "సరిపోలే సైట్లు లేవు.", help: "అత్యవసర & హెల్ప్‌లైన్లు (నొక్కి కాల్ చేయండి)",
    sum: (t, a, b, c) => `${t} సైట్లు · ${a} పనిచేస్తున్నాయి · ${b} అందుబాటులో (బాట్లను అడ్డుకుంటాయి) · ${c} అందుబాటులో లేవు (పరీక్షలో)`,
    foot: d => `ఇది అనధికారిక డైరెక్టరీ; ఏ ప్రభుత్వ సంస్థ నిర్వహించదు. స్థితి ${d} న భారతదేశం వెలుపల నుండి జరిగిన ఒక ఆటోమేటెడ్ తనిఖీని సూచిస్తుంది: "అందుబాటులో లేదు" అంటే పరీక్ష వాతావరణం నుండి స్పందన రాలేదని (తరచూ భౌగోళిక నిరోధం), సైట్ శాశ్వతంగా పనిచేయదని కాదు. వ్యక్తిగత వివరాలు ఇచ్చే ముందు నిర్ధారించుకోండి.`,
    st: { ok: "పనిచేస్తోంది", blocked: "అందుబాటులో (బాట్లను అడ్డుకుంటుంది)", down: "అందుబాటులో లేదు" },
    stTip: { ok: "సాధారణంగా స్పందించింది", blocked: "సర్వర్ స్పందించింది కానీ ఆటోమేటెడ్ తనిఖీలను తిరస్కరిస్తోంది; బ్రౌజర్‌లో పనిచేసే అవకాశం ఉంది", down: "పరీక్ష వాతావరణం నుండి స్పందన లేదు; భౌగోళిక నిరోధం లేదా చిరునామా మారి ఉండవచ్చు" },
    map: {
      "Warangal / Hanumakonda": "వరంగల్ / హనుమకొండ", "Telangana State": "తెలంగాణ రాష్ట్రం", "India (Central)": "భారతదేశం (కేంద్రం)",
      "Governance": "పరిపాలన", "Education": "విద్య", "Employment": "ఉపాధి", "Health": "ఆరోగ్యం", "Utilities": "ప్రజోపయోగ సేవలు",
      "Transport": "రవాణా", "Land & Revenue": "భూమి & రెవెన్యూ", "Citizen Services": "పౌర సేవలు", "Welfare & Agriculture": "సంక్షేమం & వ్యవసాయం",
      "Identity & Taxes": "గుర్తింపు & పన్నులు", "Grievance & Rights": "ఫిర్యాదులు & హక్కులు", "Tourism & Culture": "పర్యాటకం & సంస్కృతి",
      "District Administration (Collectorate)": "జిల్లా పరిపాలన (కలెక్టరేట్)", "Municipal Administration (GWMC)": "పురపాలక పరిపాలన (GWMC)",
      "Home / Police": "హోం / పోలీస్", "Judiciary (eCourts)": "న్యాయవ్యవస్థ (ఈ-కోర్టులు)", "Higher Education": "ఉన్నత విద్య", "Urban Development (KUDA)": "పట్టణాభివృద్ధి (KUDA)", "Medical Education (KMC)": "వైద్య విద్య (KMC)", "Health Sciences University": "ఆరోగ్య శాస్త్రాల విశ్వవిద్యాలయం",
      "Higher Education (MoE)": "ఉన్నత విద్య (విద్యా మంత్రిత్వ శాఖ)", "Intermediate Education": "ఇంటర్మీడియట్ విద్య", "School Education": "పాఠశాల విద్య",
      "Social Welfare / Minorities / BC Welfare": "సాంఘిక / మైనారిటీ / బీసీ సంక్షేమం", "Public Service Commission": "పబ్లిక్ సర్వీస్ కమిషన్",
      "Aarogyasri Health Care Trust": "ఆరోగ్యశ్రీ హెల్త్ కేర్ ట్రస్ట్", "Health, Medical & Family Welfare": "ఆరోగ్య, వైద్య & కుటుంబ సంక్షేమం",
      "National Health Authority": "జాతీయ ఆరోగ్య ప్రాధికార సంస్థ", "Energy (TGNPDCL)": "ఇంధనం (TGNPDCL)", "Transport (TGSRTC)": "రవాణా (TGSRTC)",
      "Transport, Roads & Buildings": "రవాణా, రహదారులు & భవనాలు", "Road Transport & Highways (MoRTH)": "రోడ్డు రవాణా & రహదారులు (MoRTH)",
      "Railways (South Central Railway)": "రైల్వే (దక్షిణ మధ్య రైల్వే)", "Railways (IRCTC)": "రైల్వే (IRCTC)", "Revenue (CCLA)": "రెవెన్యూ (CCLA)",
      "Registration & Stamps": "రిజిస్ట్రేషన్లు & స్టాంపులు", "IT, Electronics & Communications": "ఐటీ, ఎలక్ట్రానిక్స్ & కమ్యూనికేషన్లు",
      "Civil Supplies": "పౌర సరఫరాలు", "Agriculture & Cooperation": "వ్యవసాయ & సహకారం", "Government of Telangana": "తెలంగాణ ప్రభుత్వం",
      "Agriculture & Farmers Welfare (MoA)": "వ్యవసాయ & రైతు సంక్షేమం (MoA)", "UIDAI (MeitY)": "UIDAI (MeitY)", "MeitY / NeGD": "MeitY / NeGD",
      "External Affairs (MEA)": "విదేశాంగ శాఖ (MEA)", "Election Commission of India": "భారత ఎన్నికల సంఘం", "Income Tax Department (CBDT)": "ఆదాయపు పన్ను శాఖ (CBDT)",
      "GST Council / CBIC": "GST కౌన్సిల్ / CBIC", "Personnel & Public Grievances (DARPG)": "సిబ్బంది & ప్రజా ఫిర్యాదులు (DARPG)",
      "Personnel & Training (DoPT)": "సిబ్బంది & శిక్షణ (DoPT)", "MeitY / NIC": "MeitY / NIC", "MeitY": "MeitY", "Tourism & Culture": "పర్యాటకం & సంస్కృతి",
      "Archaeological Survey of India (MoC)": "భారత పురావస్తు సర్వేక్షణ (సాంస్కృతిక శాఖ)", "UNESCO World Heritage Centre": "యునెస్కో ప్రపంచ వారసత్వ కేంద్రం"
    }
  }
};
