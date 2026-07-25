export interface Vitals {
  bp: string;
  pulse: string;
  temp: string;
  spo2: string;
  weight: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  insurance: string;
  vitals: Vitals;
  lastVisit?: string;
}

export interface Doctor {
  id: string;
  name: string;
  clinic: string;
  department: string;
  specialty: string;
  email: string;
}

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface AmbientNote {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastHistory: string;
  medications: string;
  allergies: string;
  examination: string;
  assessment: string;
  plan: string;
}

export interface ICDSuggestion {
  code: string;
  label: string;
  selected: boolean;
}

export interface PrescriptionItem {
  id: string;
  drug: string;
  brand?: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface VisitSummary {
  diagnosis: string;
  medicines: string;
  investigations: string;
  followUp: string;
  lifestyleAdvice: string;
}

export interface InsuranceDocumentation {
  diagnosis: string;
  procedures: string;
  clinicalJustification: string;
  supportingNotes: string;
}

export type ConsultationStatus = 'not_started' | 'recording' | 'processing' | 'reviewing' | 'saved';

export interface Consultation {
  id: string;
  patientId: string;
  date: string;
  status: ConsultationStatus;
  transcript: string;
  ambientNote: AmbientNote;
  soap: SOAPNote;
  icdCodes: ICDSuggestion[];
  prescription: PrescriptionItem[];
  summary: VisitSummary;
  insurance: InsuranceDocumentation;
}

export interface PastVisitTimelineEntry {
  id: string;
  date: string;
  diagnosis: string;
  doctor: string;
}
