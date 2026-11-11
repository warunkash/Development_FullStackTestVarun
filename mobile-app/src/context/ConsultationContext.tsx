import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Consultation } from '../types';

const STORAGE_KEY = 'ai-medical-scribe/consultations';

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function emptyConsultation(patientId: string): Consultation {
  return {
    id: generateId('visit'),
    patientId,
    date: new Date().toISOString(),
    status: 'not_started',
    transcript: '',
    ambientNote: {
      chiefComplaint: '',
      historyOfPresentIllness: '',
      pastHistory: '',
      medications: '',
      allergies: '',
      examination: '',
      assessment: '',
      plan: '',
    },
    soap: { subjective: '', objective: '', assessment: '', plan: '' },
    icdCodes: [],
    prescription: [],
    summary: { diagnosis: '', medicines: '', investigations: '', followUp: '', lifestyleAdvice: '' },
    insurance: { diagnosis: '', procedures: '', clinicalJustification: '', supportingNotes: '' },
  };
}

interface ConsultationContextValue {
  consultations: Record<string, Consultation>;
  isLoading: boolean;
  getOrCreateActive: (patientId: string) => Consultation;
  updateConsultation: (id: string, patch: Partial<Consultation>) => void;
  saveConsultation: (id: string) => Promise<void>;
  getConsultationsForPatient: (patientId: string) => Consultation[];
}

const ConsultationContext = createContext<ConsultationContextValue | undefined>(undefined);

export function ConsultationProvider({ children }: { children: React.ReactNode }) {
  const [consultations, setConsultations] = useState<Record<string, Consultation>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setConsultations(JSON.parse(raw));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const getOrCreateActive = (patientId: string): Consultation => {
    const existingDraft = Object.values(consultations).find(
      (c) => c.patientId === patientId && c.status !== 'saved'
    );
    if (existingDraft) return existingDraft;
    const fresh = emptyConsultation(patientId);
    setConsultations((prev) => ({ ...prev, [fresh.id]: fresh }));
    return fresh;
  };

  const updateConsultation = (id: string, patch: Partial<Consultation>) => {
    setConsultations((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, ...patch } };
    });
  };

  const saveConsultation = async (id: string) => {
    setConsultations((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const updated = { ...prev, [id]: { ...current, status: 'saved' as const } };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => undefined);
      return updated;
    });
  };

  const getConsultationsForPatient = (patientId: string) =>
    Object.values(consultations)
      .filter((c) => c.patientId === patientId && c.status === 'saved')
      .sort((a, b) => (a.date < b.date ? 1 : -1));

  const value = useMemo(
    () => ({ consultations, isLoading, getOrCreateActive, updateConsultation, saveConsultation, getConsultationsForPatient }),
    [consultations, isLoading]
  );

  return <ConsultationContext.Provider value={value}>{children}</ConsultationContext.Provider>;
}

export function useConsultations() {
  const ctx = useContext(ConsultationContext);
  if (!ctx) throw new Error('useConsultations must be used within ConsultationProvider');
  return ctx;
}
