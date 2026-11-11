import React, { useEffect } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { usePatients } from '../context/PatientsContext';
import { useConsultations } from '../context/ConsultationContext';
import { useAuth } from '../context/AuthContext';
import { SectionCard } from '../components/SectionCard';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing } from '../theme/colors';
import { draftInsuranceDocumentation, draftVisitSummary } from '../services/mockAI';
import { generateInsuranceDocumentationPdf, generateVisitSummaryPdf } from '../services/pdf';

type Props = NativeStackScreenProps<RootStackParamList, 'VisitSummary'>;

export function VisitSummaryScreen({ route, navigation }: Props) {
  const { patientId, consultationId } = route.params;
  const { getPatient } = usePatients();
  const { consultations, updateConsultation, saveConsultation } = useConsultations();
  const { doctor } = useAuth();
  const patient = getPatient(patientId);
  const consultation = consultations[consultationId];

  useEffect(() => {
    if (!consultation) return;
    if (!consultation.summary.diagnosis) {
      const selected = consultation.icdCodes.filter((c) => c.selected);
      const diagnosisLabels = selected.map((c) => `${c.label} (${c.code})`);
      const summary = draftVisitSummary(diagnosisLabels, consultation.prescription);
      const insurance = draftInsuranceDocumentation(diagnosisLabels, consultation.soap);
      updateConsultation(consultationId, { summary, insurance });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  if (!patient || !consultation || !doctor) {
    return (
      <View style={styles.center}>
        <Text>Loading visit summary...</Text>
      </View>
    );
  }

  const updateSummary = (patch: Partial<typeof consultation.summary>) => {
    updateConsultation(consultationId, { summary: { ...consultation.summary, ...patch } });
  };

  const handleSaveToEmr = async () => {
    await saveConsultation(consultationId);
    Alert.alert('Saved', 'Consultation saved to EMR.', [
      {
        text: 'OK',
        onPress: () =>
          navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'Dashboard' }] })
          ),
      },
    ]);
  };

  const handleSendEmail = () => {
    const body = encodeURIComponent(
      `Diagnosis: ${consultation.summary.diagnosis}\n\nMedicines:\n${consultation.summary.medicines}\n\nFollow-up: ${consultation.summary.followUp}\n\nAdvice: ${consultation.summary.lifestyleAdvice}`
    );
    Linking.openURL(`mailto:?subject=${encodeURIComponent(`Visit Summary - ${patient.name}`)}&body=${body}`).catch(() =>
      Alert.alert('Could not open email app')
    );
  };

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(
      `Visit Summary for ${patient.name}\nDiagnosis: ${consultation.summary.diagnosis}\nMedicines: ${consultation.summary.medicines}\nFollow-up: ${consultation.summary.followUp}`
    );
    Linking.openURL(`https://wa.me/?text=${text}`).catch(() => Alert.alert('Could not open WhatsApp'));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard title="Visit Summary" subtitle="Shared with the patient">
        <LabeledInput label="Diagnosis" value={consultation.summary.diagnosis} onChangeText={(t) => updateSummary({ diagnosis: t })} />
        <LabeledInput
          label="Medicines"
          value={consultation.summary.medicines}
          onChangeText={(t) => updateSummary({ medicines: t })}
          multiline
        />
        <LabeledInput
          label="Investigations"
          value={consultation.summary.investigations}
          onChangeText={(t) => updateSummary({ investigations: t })}
        />
        <LabeledInput label="Follow-up" value={consultation.summary.followUp} onChangeText={(t) => updateSummary({ followUp: t })} />
        <LabeledInput
          label="Lifestyle Advice"
          value={consultation.summary.lifestyleAdvice}
          onChangeText={(t) => updateSummary({ lifestyleAdvice: t })}
          multiline
        />
      </SectionCard>

      <View style={styles.row}>
        <PrimaryButton title="Email Patient Copy" variant="outline" onPress={handleSendEmail} style={styles.rowButton} />
        <PrimaryButton title="Send WhatsApp" variant="outline" onPress={handleSendWhatsApp} style={styles.rowButton} />
      </View>
      <PrimaryButton
        title="Download Visit Summary PDF"
        variant="secondary"
        onPress={() => generateVisitSummaryPdf(patient, doctor, consultation.summary)}
        style={styles.pdfButton}
      />

      <SectionCard title="Insurance Documentation" subtitle="Auto-prepared for claims">
        <Text style={styles.insuranceLabel}>Diagnosis</Text>
        <Text style={styles.insuranceValue}>{consultation.insurance.diagnosis}</Text>
        <Text style={styles.insuranceLabel}>Procedures</Text>
        <Text style={styles.insuranceValue}>{consultation.insurance.procedures}</Text>
        <Text style={styles.insuranceLabel}>Clinical Justification</Text>
        <Text style={styles.insuranceValue}>{consultation.insurance.clinicalJustification}</Text>
        <PrimaryButton
          title="Export for Claims"
          variant="outline"
          onPress={() => generateInsuranceDocumentationPdf(patient, doctor, consultation.insurance)}
          style={styles.pdfButton}
        />
      </SectionCard>

      <PrimaryButton title="Save to EMR" onPress={handleSaveToEmr} style={styles.saveButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowButton: { flex: 1 },
  pdfButton: { marginTop: spacing.sm },
  saveButton: { marginTop: spacing.md, marginBottom: spacing.lg },
  insuranceLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.sm },
  insuranceValue: { fontSize: 13, color: colors.textPrimary, marginTop: 2 },
});
