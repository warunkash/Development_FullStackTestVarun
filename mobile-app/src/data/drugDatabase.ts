/**
 * Small local sample formulary, keyed by ICD-10 code.
 * Stands in for a real RxNorm / country-specific drug database (see services/mockAI.ts).
 */
export interface DrugSuggestion {
  drug: string;
  brand: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export const drugDatabase: Record<string, DrugSuggestion[]> = {
  'R50.9': [
    { drug: 'Paracetamol', brand: 'Crocin / Dolo 650', dose: '500 mg', frequency: '3 times daily', duration: '5 days', instructions: 'Take after food' },
  ],
  'J02.9': [
    { drug: 'Amoxicillin', brand: 'Mox / Novamox', dose: '500 mg', frequency: '2 times daily', duration: '5 days', instructions: 'Complete full course' },
    { drug: 'Paracetamol', brand: 'Crocin / Dolo 650', dose: '500 mg', frequency: '3 times daily', duration: '3 days', instructions: 'Take if fever/pain' },
  ],
  'R05': [
    { drug: 'Dextromethorphan', brand: 'Benadryl DR', dose: '10 mg/5 mL', frequency: '3 times daily', duration: '5 days', instructions: 'Take after food' },
  ],
  'J06.9': [
    { drug: 'Cetirizine', brand: 'Cetzine / Alerid', dose: '10 mg', frequency: 'Once daily, at night', duration: '5 days', instructions: 'May cause drowsiness' },
  ],
  'R51': [
    { drug: 'Ibuprofen', brand: 'Brufen', dose: '400 mg', frequency: '2 times daily', duration: '3 days', instructions: 'Take after food' },
  ],
  'K59.1': [
    { drug: 'Oral Rehydration Salts', brand: 'Electral', dose: '1 sachet in 1L water', frequency: 'As needed', duration: '3 days', instructions: 'Sip throughout the day' },
    { drug: 'Racecadotril', brand: 'Redotil', dose: '100 mg', frequency: '3 times daily', duration: '3 days', instructions: 'Take before food' },
  ],
  'R10.4': [
    { drug: 'Pantoprazole', brand: 'Pantocid', dose: '40 mg', frequency: 'Once daily, before breakfast', duration: '5 days', instructions: 'Take on empty stomach' },
  ],
  'I10': [
    { drug: 'Amlodipine', brand: 'Amlong', dose: '5 mg', frequency: 'Once daily', duration: '30 days', instructions: 'Monitor blood pressure weekly' },
  ],
  'E11.9': [
    { drug: 'Metformin', brand: 'Glycomet', dose: '500 mg', frequency: '2 times daily', duration: '30 days', instructions: 'Take with meals' },
  ],
  'J45.909': [
    { drug: 'Salbutamol Inhaler', brand: 'Asthalin', dose: '100 mcg', frequency: 'As needed', duration: '30 days', instructions: '2 puffs during breathlessness' },
  ],
  'M54.5': [
    { drug: 'Ibuprofen', brand: 'Brufen', dose: '400 mg', frequency: '2 times daily', duration: '5 days', instructions: 'Take after food' },
  ],
  'L23.9': [
    { drug: 'Cetirizine', brand: 'Cetzine / Alerid', dose: '10 mg', frequency: 'Once daily, at night', duration: '5 days', instructions: 'May cause drowsiness' },
  ],
  'H66.90': [
    { drug: 'Amoxicillin-Clavulanate', brand: 'Augmentin', dose: '625 mg', frequency: '2 times daily', duration: '5 days', instructions: 'Complete full course' },
  ],
  'N39.0': [
    { drug: 'Nitrofurantoin', brand: 'Furadantin', dose: '100 mg', frequency: '2 times daily', duration: '5 days', instructions: 'Take with food, drink plenty of water' },
  ],
};
