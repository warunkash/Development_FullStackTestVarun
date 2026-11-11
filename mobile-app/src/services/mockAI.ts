/**
 * Local, offline simulation of the AI pipeline described in the product spec:
 *   audio -> speech-to-text -> clinical NLP -> LLM drafting -> terminology lookups.
 *
 * This lets the app be demoed end-to-end without API keys or a backend. Each
 * function below documents the real service it stands in for, so swapping in
 * a production integration means replacing the function body, not the callers:
 *   - transcribeAudio      -> Whisper / Azure Speech / AWS Transcribe Medical
 *   - extractSymptoms      -> clinical NLP entity extraction service
 *   - draftAmbientNote/SOAP -> GPT-5.5 (or similar) with RAG over clinical guidelines
 *   - suggestICD10Codes    -> ICD-10 / SNOMED CT terminology API
 *   - suggestPrescription  -> RxNorm / country-specific drug database + LLM reasoning
 */
import { icd10Table, lookupICD10 } from '../data/icd10';
import { drugDatabase } from '../data/drugDatabase';
import { AmbientNote, ICDSuggestion, Patient, PrescriptionItem, SOAPNote, VisitSummary, InsuranceDocumentation } from '../types';

const SAMPLE_TRANSCRIPTS: string[] = [
  "Doctor: What brings you in today? Patient: I've had a fever and sore throat since yesterday, and I've been coughing too. Doctor: Any body aches? Patient: A little, and I feel tired. No known drug allergies, not on any regular medication.",
  "Doctor: What's going on? Patient: I've had a headache for two days, and I feel a bit dizzy when I stand up. Doctor: Any nausea? Patient: Slight nausea this morning. No allergies, not on any medication currently.",
  "Doctor: Tell me what's bothering you. Patient: Loose motions since last night, maybe four or five times, some stomach pain and mild nausea. No fever. No known allergies, no regular medications.",
  "Doctor: How can I help today? Patient: My blood pressure has been running high on my home monitor, around 140 over 90. No chest pain, no breathlessness. I'm on Amlodipine already but it doesn't seem to be controlling it well.",
  "Doctor: What symptoms are you having? Patient: Burning sensation while passing urine for two days, and I'm going more often than usual. No fever, no back pain. No known allergies.",
];

function pseudoRandomIndex(seed: string, length: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  }
  return hash % length;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function transcribeAudio(patient: Patient): Promise<string> {
  await delay(1200);
  const index = pseudoRandomIndex(patient.id + patient.name, SAMPLE_TRANSCRIPTS.length);
  return SAMPLE_TRANSCRIPTS[index];
}

export function extractSymptoms(transcript: string): string[] {
  const normalized = transcript.toLowerCase();
  const matches = new Set<string>();
  icd10Table.forEach((entry) => {
    entry.keywords.forEach((kw) => {
      if (normalized.includes(kw)) matches.add(kw);
    });
  });
  return Array.from(matches);
}

function hasAllergyMention(transcript: string) {
  return /no known (drug )?allergies|no allergies/i.test(transcript) ? 'No known drug allergies' : 'Not mentioned during consultation';
}

function hasMedicationMention(transcript: string) {
  const match = transcript.match(/on ([A-Z][a-zA-Z]+)(?: already)?/);
  if (match) return `Currently on ${match[1]}`;
  return /not on any (regular )?medication/i.test(transcript) ? 'No regular medications' : 'Not mentioned during consultation';
}

export async function draftAmbientNote(transcript: string, patient: Patient): Promise<AmbientNote> {
  await delay(900);
  const symptoms = extractSymptoms(transcript);
  const chiefComplaint = symptoms.length ? symptoms.join(', ') : 'See transcript for details';
  return {
    chiefComplaint: capitalize(chiefComplaint),
    historyOfPresentIllness: transcript,
    pastHistory: 'No significant past medical history reported.',
    medications: hasMedicationMention(transcript),
    allergies: hasAllergyMention(transcript),
    examination: `BP ${patient.vitals.bp}, Pulse ${patient.vitals.pulse}, Temp ${patient.vitals.temp}, SpO2 ${patient.vitals.spo2}, Weight ${patient.vitals.weight}.`,
    assessment: symptoms.length
      ? `Likely diagnosis consistent with reported symptoms: ${symptoms.join(', ')}.`
      : 'Assessment pending clinician review.',
    plan: 'Symptomatic management; review ICD-10 suggestions and draft prescription below.',
  };
}

export function draftSOAP(note: AmbientNote): SOAPNote {
  return {
    subjective: `${note.chiefComplaint}. ${note.historyOfPresentIllness}`,
    objective: note.examination,
    assessment: note.assessment,
    plan: note.plan,
  };
}

export function suggestICD10Codes(symptoms: string[]): ICDSuggestion[] {
  const seen = new Map<string, ICDSuggestion>();
  symptoms.forEach((symptom) => {
    const entry = lookupICD10(symptom);
    if (entry && !seen.has(entry.code)) {
      seen.set(entry.code, { code: entry.code, label: entry.label, selected: true });
    }
  });
  return Array.from(seen.values());
}

export function suggestPrescription(selectedCodes: ICDSuggestion[]): PrescriptionItem[] {
  const items: PrescriptionItem[] = [];
  selectedCodes.forEach((code) => {
    const suggestions = drugDatabase[code.code] ?? [];
    suggestions.forEach((s, i) => {
      items.push({
        id: `${code.code}-${i}-${Date.now()}`,
        drug: s.drug,
        brand: s.brand,
        dose: s.dose,
        frequency: s.frequency,
        duration: s.duration,
        instructions: s.instructions,
      });
    });
  });
  return items;
}

export function draftVisitSummary(
  diagnosisLabels: string[],
  prescription: PrescriptionItem[],
): VisitSummary {
  return {
    diagnosis: diagnosisLabels.join(', ') || 'Pending diagnosis',
    medicines: prescription.map((p) => `${p.drug} ${p.dose} - ${p.frequency} for ${p.duration}`).join('\n') || 'No medicines prescribed',
    investigations: 'None ordered at this visit.',
    followUp: 'Follow up in 5-7 days if symptoms persist or worsen.',
    lifestyleAdvice: 'Stay hydrated, get adequate rest, and complete the full course of any prescribed medication.',
  };
}

export function draftInsuranceDocumentation(
  diagnosisLabels: string[],
  soap: SOAPNote,
): InsuranceDocumentation {
  return {
    diagnosis: diagnosisLabels.join(', ') || 'Pending diagnosis',
    procedures: 'Outpatient consultation and clinical examination',
    clinicalJustification: soap.assessment,
    supportingNotes: `Subjective: ${soap.subjective}\nObjective: ${soap.objective}\nPlan: ${soap.plan}`,
  };
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
