# AI Medical Scribe (Mobile MVP)

A React Native (Expo) mobile app implementing the core MVP flow from the
product spec: ambient consultation scribe -> SOAP note -> ICD-10 suggestions
-> prescription -> visit summary -> insurance documentation.

## Why this scope

The full spec calls for a production clinical platform: real speech-to-text
(Whisper/Azure/AWS Transcribe Medical), an LLM-backed FastAPI service, ICD-10
/ SNOMED / RxNorm terminology integrations, FHIR export, HIPAA/GDPR-grade
security, and multi-tenant billing. None of that can run without API keys,
a provisioned backend, and a compliance review, so this mobile app is a
**runnable, demoable prototype of the product experience**: every screen and
flow from the spec works end-to-end, with the AI steps simulated locally
instead of calling paid third-party services. It's the fastest way to
validate the UX before investing in the Weeks 1-12 backend build-out.

## What's real vs. simulated

| Layer | This app | Production |
| --- | --- | --- |
| UI/navigation, screens, editable notes | Real | Same |
| Patient records, consultation drafts | Real, persisted locally (AsyncStorage) | Real, in PostgreSQL |
| Auth | Local mock (any email + password >= 4 chars) | JWT/session auth against FastAPI |
| Speech-to-text | Simulated: picks a canned transcript | Whisper / Azure Speech / AWS Transcribe Medical |
| Clinical NLP + SOAP/summary drafting | Simulated: keyword matching + templating | GPT-5.5 (or similar) with RAG over clinical guidelines |
| ICD-10 suggestions | Small local lookup table (16 codes) | ICD-10 / SNOMED CT terminology API |
| Drug suggestions | Small local formulary keyed by ICD-10 code | RxNorm / country-specific drug database |
| PDF generation (prescription, visit summary, insurance doc) | Real, via `expo-print` + `expo-sharing` | Same, or server-rendered |
| Email / WhatsApp send | Opens the native mailto: / wa.me share sheet | Backend-triggered SMS/Email/WhatsApp Business API |
| FHIR export, audit logs, RBAC, MFA, encryption at rest | Not implemented | Required before any real patient data is stored |

All simulation logic lives in `src/services/mockAI.ts`, with each function's
doc comment naming the real service it stands in for. `src/services/api.ts`
is a stub showing the intended FastAPI endpoints; swapping the mock for the
real backend means implementing that backend and updating `AuthContext` /
`ConsultationContext` to call it instead of `mockAI.ts`.

**Do not use this app with real patient data.** There is no encryption at
rest, no consent management, no audit trail, and no compliance review.

## Running it

```bash
cd mobile-app
npm install
npm start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code
with the Expo Go app. Log in with any email and a password of 4+ characters.

## Project structure

```
src/
  screens/        Login, Dashboard, Consultation, Prescription, VisitSummary, PatientTimeline
  components/      Reusable UI: buttons, inputs, cards, ICD-10 checklist
  context/         AuthContext, PatientsContext, ConsultationContext (local state + AsyncStorage)
  services/        mockAI.ts (simulated AI pipeline), pdf.ts (expo-print), api.ts (backend stub)
  data/            Sample patients, ICD-10 table, drug formulary, timeline history
  navigation/      React Navigation stack
  theme/           Shared colors/spacing
```

## User flow implemented

Login -> Dashboard (today's patients, search, + new patient, recent
consultations, analytics) -> open a patient -> Start Recording -> AI drafts
a transcript, ambient note (Chief Complaint / HPI / Past History /
Medications / Allergies / Examination / Assessment / Plan), and an editable
SOAP note -> doctor reviews and selects ICD-10 suggestions -> Prescription
screen (AI-suggested medicines by diagnosis, editable, PDF export) -> Visit
Summary (patient-facing summary, email/WhatsApp share, PDF) and Insurance
Documentation (diagnosis, procedures, clinical justification, export for
claims) -> Save to EMR -> back to Dashboard. Long-press a patient card to
open their timeline (previous visits, lab reports, medicines, notes,
imaging, insurance, invoices).

## Roadmap to production

Follows the 12-week plan in the product spec: replace `mockAI.ts` calls with
the FastAPI backend (`api.ts` stub), add real audio capture + streaming STT,
wire up ICD-10/SNOMED/RxNorm APIs, add FHIR export, and implement the
security controls (encryption at rest/in transit, RBAC, MFA, audit logs,
consent management, data residency) required before handling real PHI.
