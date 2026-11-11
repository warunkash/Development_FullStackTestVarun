import React, { createContext, useContext, useMemo, useState } from 'react';
import { Patient } from '../types';
import { mockPatients } from '../data/mockPatients';

interface PatientsContextValue {
  patients: Patient[];
  getPatient: (id: string) => Patient | undefined;
  addPatient: (patient: Omit<Patient, 'id'>) => Patient;
  searchPatients: (query: string) => Patient[];
}

const PatientsContext = createContext<PatientsContextValue | undefined>(undefined);

export function PatientsProvider({ children }: { children: React.ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(mockPatients);

  const getPatient = (id: string) => patients.find((p) => p.id === id);

  const addPatient = (patient: Omit<Patient, 'id'>) => {
    const newPatient: Patient = { ...patient, id: `p-${Date.now()}` };
    setPatients((prev) => [newPatient, ...prev]);
    return newPatient;
  };

  const searchPatients = (query: string) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return patients;
    return patients.filter(
      (p) => p.name.toLowerCase().includes(normalized) || p.phone.includes(normalized)
    );
  };

  const value = useMemo(() => ({ patients, getPatient, addPatient, searchPatients }), [patients]);

  return <PatientsContext.Provider value={value}>{children}</PatientsContext.Provider>;
}

export function usePatients() {
  const ctx = useContext(PatientsContext);
  if (!ctx) throw new Error('usePatients must be used within PatientsProvider');
  return ctx;
}
