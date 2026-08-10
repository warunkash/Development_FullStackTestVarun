import { PastVisitTimelineEntry } from '../types';

export const mockTimelines: Record<string, PastVisitTimelineEntry[]> = {
  'p-1': [
    { id: 't-1', date: '2026-06-02', diagnosis: 'Acute Pharyngitis (J02.9)', doctor: 'Dr. Ananya Rao' },
    { id: 't-2', date: '2026-02-14', diagnosis: 'Seasonal Allergy (L23.9)', doctor: 'Dr. Ananya Rao' },
  ],
  'p-2': [
    { id: 't-3', date: '2026-05-18', diagnosis: 'Urinary Tract Infection (N39.0)', doctor: 'Dr. Ananya Rao' },
  ],
  'p-3': [
    { id: 't-4', date: '2026-07-10', diagnosis: 'Essential Hypertension (I10)', doctor: 'Dr. Ananya Rao' },
    { id: 't-5', date: '2026-04-02', diagnosis: 'Type 2 Diabetes Mellitus (E11.9)', doctor: 'Dr. Ananya Rao' },
    { id: 't-6', date: '2026-01-20', diagnosis: 'Low Back Pain (M54.5)', doctor: 'Dr. Ananya Rao' },
  ],
  'p-4': [],
};

export const mockLabReports: Record<string, string[]> = {
  'p-1': ['CBC - Normal (2026-06-02)'],
  'p-2': ['Urine Culture - E. coli sensitive to Nitrofurantoin (2026-05-18)'],
  'p-3': ['HbA1c - 7.1% (2026-04-02)', 'Lipid Profile - Borderline LDL (2026-04-02)'],
  'p-4': [],
};

export const mockInvoices: Record<string, string[]> = {
  'p-1': ['INV-1042 - ₹800 - Paid'],
  'p-2': ['INV-1039 - ₹650 - Paid'],
  'p-3': ['INV-1051 - ₹1,200 - Paid', 'INV-0988 - ₹1,200 - Paid'],
  'p-4': [],
};
