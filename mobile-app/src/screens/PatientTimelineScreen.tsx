import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { usePatients } from '../context/PatientsContext';
import { useConsultations } from '../context/ConsultationContext';
import { SectionCard } from '../components/SectionCard';
import { colors, spacing } from '../theme/colors';
import { mockInvoices, mockLabReports, mockTimelines } from '../data/mockConsultations';

type Props = NativeStackScreenProps<RootStackParamList, 'PatientTimeline'>;

export function PatientTimelineScreen({ route }: Props) {
  const { patientId } = route.params;
  const { getPatient } = usePatients();
  const { getConsultationsForPatient } = useConsultations();
  const patient = getPatient(patientId);

  if (!patient) {
    return (
      <View style={styles.center}>
        <Text>Patient not found.</Text>
      </View>
    );
  }

  const savedConsultations = getConsultationsForPatient(patientId);
  const historicalVisits = mockTimelines[patientId] ?? [];
  const labReports = mockLabReports[patientId] ?? [];
  const invoices = mockInvoices[patientId] ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard title={patient.name} subtitle={`${patient.age} yrs - ${patient.gender} - ${patient.phone}`}>
        <Text style={styles.detail}>Insurance: {patient.insurance}</Text>
      </SectionCard>

      <SectionCard title="Previous Visits">
        {historicalVisits.length === 0 && savedConsultations.length === 0 ? (
          <Text style={styles.empty}>No previous visits recorded.</Text>
        ) : (
          <>
            {savedConsultations.map((c) => (
              <ListRow key={c.id} primary={c.summary.diagnosis} secondary={new Date(c.date).toLocaleDateString()} />
            ))}
            {historicalVisits.map((v) => (
              <ListRow key={v.id} primary={v.diagnosis} secondary={`${v.date} - ${v.doctor}`} />
            ))}
          </>
        )}
      </SectionCard>

      <SectionCard title="Lab Reports">
        {labReports.length === 0 ? (
          <Text style={styles.empty}>No lab reports on file.</Text>
        ) : (
          labReports.map((r, i) => <ListRow key={i} primary={r} />)
        )}
      </SectionCard>

      <SectionCard title="Medicines">
        {savedConsultations.length === 0 ? (
          <Text style={styles.empty}>No prescriptions on file.</Text>
        ) : (
          savedConsultations.map((c) =>
            c.prescription.map((p) => (
              <ListRow key={p.id} primary={`${p.drug} ${p.dose}`} secondary={`${p.frequency} - ${p.duration}`} />
            ))
          )
        )}
      </SectionCard>

      <SectionCard title="Notes">
        {savedConsultations.length === 0 ? (
          <Text style={styles.empty}>No consultation notes on file.</Text>
        ) : (
          savedConsultations.map((c) => (
            <ListRow key={c.id} primary={c.soap.assessment} secondary={new Date(c.date).toLocaleDateString()} />
          ))
        )}
      </SectionCard>

      <SectionCard title="Imaging">
        <Text style={styles.empty}>No imaging records on file.</Text>
      </SectionCard>

      <SectionCard title="Insurance">
        <Text style={styles.detail}>{patient.insurance}</Text>
      </SectionCard>

      <SectionCard title="Invoices">
        {invoices.length === 0 ? (
          <Text style={styles.empty}>No invoices on file.</Text>
        ) : (
          invoices.map((inv, i) => <ListRow key={i} primary={inv} />)
        )}
      </SectionCard>
    </ScrollView>
  );
}

function ListRow({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <View style={styles.listRow}>
      <Text style={styles.listPrimary}>{primary}</Text>
      {secondary ? <Text style={styles.listSecondary}>{secondary}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  detail: { fontSize: 13, color: colors.textSecondary },
  empty: { fontSize: 13, color: colors.textMuted },
  listRow: { paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  listPrimary: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  listSecondary: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
});
