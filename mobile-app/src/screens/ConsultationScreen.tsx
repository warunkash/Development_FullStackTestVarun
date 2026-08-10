import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { usePatients } from '../context/PatientsContext';
import { useConsultations } from '../context/ConsultationContext';
import { SectionCard } from '../components/SectionCard';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { ICDSuggestionList } from '../components/ICDSuggestionList';
import { colors, radius, spacing } from '../theme/colors';
import { draftAmbientNote, draftSOAP, extractSymptoms, suggestICD10Codes, transcribeAudio } from '../services/mockAI';

type Props = NativeStackScreenProps<RootStackParamList, 'Consultation'>;

export function ConsultationScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const { getPatient } = usePatients();
  const { getOrCreateActive, updateConsultation } = useConsultations();
  const patient = getPatient(patientId);

  const [consultationId, setConsultationId] = useState<string | null>(null);
  const { consultations } = useConsultations();
  const consultation = consultationId ? consultations[consultationId] : undefined;

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const active = getOrCreateActive(patientId);
    setConsultationId(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    if (consultation?.status === 'recording') {
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [consultation?.status]);

  if (!patient || !consultation) {
    return (
      <View style={styles.center}>
        <Text>Loading consultation...</Text>
      </View>
    );
  }

  const handleStartRecording = () => {
    updateConsultation(consultation.id, { status: 'recording' });
  };

  const handleStopAndTranscribe = async () => {
    updateConsultation(consultation.id, { status: 'processing' });
    const transcript = await transcribeAudio(patient);
    const ambientNote = await draftAmbientNote(transcript, patient);
    const soap = draftSOAP(ambientNote);
    const symptoms = extractSymptoms(transcript);
    const icdCodes = suggestICD10Codes(symptoms);
    updateConsultation(consultation.id, { status: 'reviewing', transcript, ambientNote, soap, icdCodes });
  };

  const toggleIcdCode = (code: string) => {
    updateConsultation(consultation.id, {
      icdCodes: consultation.icdCodes.map((c) => (c.code === code ? { ...c, selected: !c.selected } : c)),
    });
  };

  const canContinue = consultation.status === 'reviewing' || consultation.status === 'saved';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard title={patient.name} subtitle={`${patient.age} yrs - ${patient.gender}`}>
        <View style={styles.vitalsRow}>
          <VitalPill label="BP" value={patient.vitals.bp} />
          <VitalPill label="Pulse" value={patient.vitals.pulse} />
          <VitalPill label="Temp" value={patient.vitals.temp} />
          <VitalPill label="SpO2" value={patient.vitals.spo2} />
        </View>
      </SectionCard>

      <SectionCard title="Ambient Scribe" subtitle="Record with patient consent">
        {consultation.status === 'not_started' && (
          <PrimaryButton title="Start Recording" onPress={handleStartRecording} />
        )}
        {consultation.status === 'recording' && (
          <View>
            <View style={styles.recordingRow}>
              <View style={styles.recDot} />
              <Text style={styles.recordingText}>Recording... {elapsed}s</Text>
            </View>
            <PrimaryButton title="Stop & Transcribe" variant="secondary" onPress={handleStopAndTranscribe} />
          </View>
        )}
        {consultation.status === 'processing' && (
          <PrimaryButton title="Transcribing & drafting notes..." onPress={() => {}} loading disabled />
        )}
        {(consultation.status === 'reviewing' || consultation.status === 'saved') && (
          <Text style={styles.doneText}>Recording processed. Review the AI-generated notes below.</Text>
        )}
      </SectionCard>

      {consultation.transcript ? (
        <SectionCard title="Live Transcript">
          <Text style={styles.transcript}>{consultation.transcript}</Text>
        </SectionCard>
      ) : null}

      {consultation.status === 'reviewing' || consultation.status === 'saved' ? (
        <>
          <SectionCard title="AI Notes" subtitle="Editable before saving">
            <LabeledInput
              label="Chief Complaint"
              value={consultation.ambientNote.chiefComplaint}
              onChangeText={(text) =>
                updateConsultation(consultation.id, { ambientNote: { ...consultation.ambientNote, chiefComplaint: text } })
              }
            />
            <LabeledInput
              label="History of Present Illness"
              value={consultation.ambientNote.historyOfPresentIllness}
              onChangeText={(text) =>
                updateConsultation(consultation.id, { ambientNote: { ...consultation.ambientNote, historyOfPresentIllness: text } })
              }
              multiline
            />
            <LabeledInput
              label="Past History"
              value={consultation.ambientNote.pastHistory}
              onChangeText={(text) =>
                updateConsultation(consultation.id, { ambientNote: { ...consultation.ambientNote, pastHistory: text } })
              }
            />
            <LabeledInput
              label="Medications"
              value={consultation.ambientNote.medications}
              onChangeText={(text) =>
                updateConsultation(consultation.id, { ambientNote: { ...consultation.ambientNote, medications: text } })
              }
            />
            <LabeledInput
              label="Allergies"
              value={consultation.ambientNote.allergies}
              onChangeText={(text) =>
                updateConsultation(consultation.id, { ambientNote: { ...consultation.ambientNote, allergies: text } })
              }
            />
            <LabeledInput
              label="Examination"
              value={consultation.ambientNote.examination}
              onChangeText={(text) =>
                updateConsultation(consultation.id, { ambientNote: { ...consultation.ambientNote, examination: text } })
              }
            />
          </SectionCard>

          <SectionCard title="SOAP Note" subtitle="S - O - A - P">
            <LabeledInput
              label="Subjective"
              value={consultation.soap.subjective}
              onChangeText={(text) => updateConsultation(consultation.id, { soap: { ...consultation.soap, subjective: text } })}
              multiline
            />
            <LabeledInput
              label="Objective"
              value={consultation.soap.objective}
              onChangeText={(text) => updateConsultation(consultation.id, { soap: { ...consultation.soap, objective: text } })}
              multiline
            />
            <LabeledInput
              label="Assessment"
              value={consultation.soap.assessment}
              onChangeText={(text) => updateConsultation(consultation.id, { soap: { ...consultation.soap, assessment: text } })}
              multiline
            />
            <LabeledInput
              label="Plan"
              value={consultation.soap.plan}
              onChangeText={(text) => updateConsultation(consultation.id, { soap: { ...consultation.soap, plan: text } })}
              multiline
            />
          </SectionCard>

          <SectionCard title="ICD-10 Suggestions" subtitle="Tap to select diagnoses">
            <ICDSuggestionList suggestions={consultation.icdCodes} onToggle={toggleIcdCode} />
          </SectionCard>

          <PrimaryButton
            title="Continue to Prescription"
            disabled={!canContinue}
            onPress={() => navigation.navigate('Prescription', { patientId, consultationId: consultation.id })}
            style={styles.continueButton}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function VitalPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vitalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    minWidth: 64,
    marginRight: spacing.sm,
    marginTop: spacing.xs,
  },
  pillValue: { fontWeight: '700', color: colors.primaryDark, fontSize: 13 },
  pillLabel: { fontSize: 10, color: colors.primaryDark },
  recordingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, marginRight: spacing.sm },
  recordingText: { color: colors.danger, fontWeight: '600' },
  doneText: { color: colors.textSecondary, fontSize: 13 },
  transcript: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  continueButton: { marginTop: spacing.sm },
});
