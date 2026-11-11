/**
 * Small local sample of an ICD-10 lookup table, keyed by symptom/finding keywords.
 * Stands in for a real ICD-10/SNOMED terminology service (see services/mockAI.ts).
 */
export interface ICDEntry {
  code: string;
  label: string;
  keywords: string[];
}

export const icd10Table: ICDEntry[] = [
  { code: 'J02.9', label: 'Acute Pharyngitis, unspecified', keywords: ['sore throat', 'throat pain', 'pharyngitis'] },
  { code: 'R50.9', label: 'Fever, unspecified', keywords: ['fever', 'high temperature', 'febrile'] },
  { code: 'R05', label: 'Cough', keywords: ['cough', 'coughing'] },
  { code: 'J06.9', label: 'Acute upper respiratory infection, unspecified', keywords: ['cold', 'runny nose', 'congestion', 'upper respiratory'] },
  { code: 'R51', label: 'Headache', keywords: ['headache', 'migraine'] },
  { code: 'K59.1', label: 'Diarrhea, unspecified', keywords: ['diarrhea', 'loose motion', 'loose stools'] },
  { code: 'R11.0', label: 'Nausea', keywords: ['nausea', 'nauseous'] },
  { code: 'R10.4', label: 'Abdominal pain, unspecified', keywords: ['abdominal pain', 'stomach ache', 'stomach pain'] },
  { code: 'I10', label: 'Essential (primary) hypertension', keywords: ['hypertension', 'high blood pressure', 'bp high'] },
  { code: 'E11.9', label: 'Type 2 diabetes mellitus without complications', keywords: ['diabetes', 'type 2 diabetes', 'high sugar'] },
  { code: 'J45.909', label: 'Unspecified asthma, uncomplicated', keywords: ['asthma', 'wheezing', 'breathless'] },
  { code: 'M54.5', label: 'Low back pain', keywords: ['back pain', 'lower back pain'] },
  { code: 'R42', label: 'Dizziness and giddiness', keywords: ['dizziness', 'giddiness', 'vertigo'] },
  { code: 'L23.9', label: 'Allergic contact dermatitis, unspecified cause', keywords: ['rash', 'skin allergy', 'dermatitis', 'itching'] },
  { code: 'H66.90', label: 'Otitis media, unspecified', keywords: ['ear pain', 'earache', 'ear infection'] },
  { code: 'N39.0', label: 'Urinary tract infection, site not specified', keywords: ['uti', 'burning urination', 'urinary infection'] },
];

export function lookupICD10(symptom: string): ICDEntry | undefined {
  const normalized = symptom.toLowerCase();
  return icd10Table.find((entry) => entry.keywords.some((kw) => normalized.includes(kw)));
}
