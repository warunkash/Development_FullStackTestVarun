import React, { useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { usePatients } from '../context/PatientsContext';
import { useConsultations } from '../context/ConsultationContext';
import { useAuth } from '../context/AuthContext';
import { SectionCard } from '../components/SectionCard';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, spacing } from '../theme/colors';
import { suggestPrescription } from '../services/mockAI';
import { generatePrescriptionPdf } from '../services/pdf';
import { PrescriptionItem } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Prescription'>;

export function PrescriptionScreen({ route, navigation }: Props) {
  const { patientId, consultationId } = route.params;
  const { getPatient } = usePatients();
  const { consultations, updateConsultation } = useConsultations();
  const { doctor } = useAuth();
  const patient = getPatient(patientId);
  const consultation = consultations[consultationId];

  const selectedCodes = consultation?.icdCodes.filter((c) => c.selected) ?? [];
  const diagnosis = selectedCodes.map((c) => `${c.label} (${c.code})`).join(', ');

  useEffect(() => {
    if (consultation && consultation.prescription.length === 0 && selectedCodes.length > 0) {
      updateConsultation(consultationId, { prescription: suggestPrescription(selectedCodes) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  if (!patient || !consultation || !doctor) {
    return (
      <View style={styles.center}>
        <Text>Loading prescription...</Text>
      </View>
    );
  }

  const updateItem = (id: string, patch: Partial<PrescriptionItem>) => {
    updateConsultation(consultationId, {
      prescription: consultation.prescription.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const removeItem = (id: string) => {
    updateConsultation(consultationId, { prescription: consultation.prescription.filter((item) => item.id !== id) });
  };

  const addItem = () => {
    const newItem: PrescriptionItem = {
      id: `custom-${Date.now()}`,
      drug: '',
      dose: '',
      frequency: '',
      duration: '',
      instructions: '',
    };
    updateConsultation(consultationId, { prescription: [...consultation.prescription, newItem] });
  };

  const handleGeneratePdf = async () => {
    try {
      await generatePrescriptionPdf(patient, doctor, diagnosis, consultation.prescription);
    } catch (err) {
      Alert.alert('Could not generate PDF', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard title="Diagnosis">
        <Text style={styles.diagnosisText}>{diagnosis || 'No diagnosis selected yet - go back and pick ICD-10 codes.'}</Text>
      </SectionCard>

      <SectionCard title="Prescription" subtitle="AI-suggested, edit as needed">
        {consultation.prescription.map((item) => (
          <View key={item.id} style={styles.medicineCard}>
            <View style={styles.medicineHeader}>
              <Text style={styles.medicineTitle}>{item.drug || 'New medicine'}</Text>
              <TouchableOpacity onPress={() => removeItem(item.id)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
            <LabeledInput label="Medicine" value={item.drug} onChangeText={(text) => updateItem(item.id, { drug: text })} />
            <LabeledInput label="Dosage" value={item.dose} onChangeText={(text) => updateItem(item.id, { dose: text })} />
            <LabeledInput
              label="Frequency"
              value={item.frequency}
              onChangeText={(text) => updateItem(item.id, { frequency: text })}
            />
            <LabeledInput
              label="Duration"
              value={item.duration}
              onChangeText={(text) => updateItem(item.id, { duration: text })}
            />
            <LabeledInput
              label="Instructions"
              value={item.instructions}
              onChangeText={(text) => updateItem(item.id, { instructions: text })}
            />
          </View>
        ))}
        <PrimaryButton title="+ Add Medicine" variant="outline" onPress={addItem} />
      </SectionCard>

      <PrimaryButton title="Generate PDF" variant="secondary" onPress={handleGeneratePdf} style={styles.pdfButton} />
      <PrimaryButton
        title="Continue to Visit Summary"
        onPress={() => navigation.navigate('VisitSummary', { patientId, consultationId })}
        style={styles.continueButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  diagnosisText: { color: colors.textPrimary, fontSize: 14 },
  medicineCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  medicineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  medicineTitle: { fontWeight: '700', color: colors.textPrimary },
  remove: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  pdfButton: { marginTop: spacing.sm },
  continueButton: { marginTop: spacing.sm },
});
