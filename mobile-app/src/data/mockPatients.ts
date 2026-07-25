import { Patient } from '../types';

export const mockDoctor = {
  id: 'doc-1',
  name: 'Dr. Ananya Rao',
  clinic: 'Sunrise Family Clinic',
  department: 'General Medicine',
  specialty: 'Internal Medicine',
  email: 'ananya.rao@sunriseclinic.example',
};

export const mockPatients: Patient[] = [
  {
    id: 'p-1',
    name: 'Rohan Mehta',
    age: 34,
    gender: 'Male',
    phone: '+91 98765 43210',
    insurance: 'Star Health - SH2291',
    vitals: { bp: '122/78', pulse: '84', temp: '100.9°F', spo2: '98%', weight: '76 kg' },
    lastVisit: '2026-06-02',
  },
  {
    id: 'p-2',
    name: 'Priya Nair',
    age: 27,
    gender: 'Female',
    phone: '+91 91234 56789',
    insurance: 'HDFC Ergo - HE7712',
    vitals: { bp: '110/70', pulse: '76', temp: '98.6°F', spo2: '99%', weight: '58 kg' },
    lastVisit: '2026-05-18',
  },
  {
    id: 'p-3',
    name: 'Arjun Kapoor',
    age: 52,
    gender: 'Male',
    phone: '+91 99887 66554',
    insurance: 'Self-pay',
    vitals: { bp: '138/90', pulse: '88', temp: '99.1°F', spo2: '97%', weight: '82 kg' },
    lastVisit: '2026-07-10',
  },
  {
    id: 'p-4',
    name: 'Sneha Iyer',
    age: 8,
    gender: 'Female',
    phone: '+91 90000 12345',
    insurance: 'ICICI Lombard - IL4410',
    vitals: { bp: '96/62', pulse: '98', temp: '101.4°F', spo2: '98%', weight: '26 kg' },
  },
];
