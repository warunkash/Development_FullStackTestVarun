import React, { useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { usePatients } from '../context/PatientsContext';
import { useConsultations } from '../context/ConsultationContext';
import { useAuth } from '../context/AuthContext';
import { PatientCard } from '../components/PatientCard';
import { SectionCard } from '../components/SectionCard';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, spacing } from '../theme/colors';
import { Patient } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { patients, searchPatients, addPatient } = usePatients();
  const { consultations } = useConsultations();
  const { doctor, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const visiblePatients = searchPatients(query);
  const savedConsultations = Object.values(consultations)
    .filter((c) => c.status === 'saved')
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.doctorName}>{doctor?.name}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      <SectionCard title="Analytics" subtitle="This week at a glance">
        <View style={styles.statsRow}>
          <Stat label="Patients" value={String(patients.length)} />
          <Stat label="Consultations saved" value={String(savedConsultations.length)} />
          <Stat label="Avg. time saved" value="~8 min/visit" />
        </View>
      </SectionCard>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Today's Patients</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Text style={styles.addButton}>+ New Patient</Text>
        </TouchableOpacity>
      </View>

      <LabeledInput
        label="Search Patient"
        placeholder="Search by name or phone"
        value={query}
        onChangeText={setQuery}
      />

      <FlatList
        data={visiblePatients}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <PatientCard
            patient={item}
            onPress={() => navigation.navigate('Consultation', { patientId: item.id })}
            onLongPress={() => navigation.navigate('PatientTimeline', { patientId: item.id })}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No patients match your search.</Text>}
      />

      <Text style={styles.sectionHeader}>Recent Consultations</Text>
      {savedConsultations.length === 0 ? (
        <Text style={styles.empty}>No consultations saved yet.</Text>
      ) : (
        savedConsultations.map((c) => {
          const patient = patients.find((p) => p.id === c.patientId);
          return (
            <TouchableOpacity
              key={c.id}
              style={styles.consultationRow}
              onPress={() => navigation.navigate('VisitSummary', { patientId: c.patientId, consultationId: c.id })}
            >
              <Text style={styles.consultationPatient}>{patient?.name ?? 'Unknown patient'}</Text>
              <Text style={styles.consultationMeta}>
                {new Date(c.date).toLocaleDateString()} - {c.summary.diagnosis}
              </Text>
            </TouchableOpacity>
          );
        })
      )}

      <AddPatientModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreate={(patient) => {
          addPatient(patient);
          setModalVisible(false);
        }}
      />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AddPatientModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (patient: Omit<Patient, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [insurance, setInsurance] = useState('');

  const reset = () => {
    setName('');
    setAge('');
    setPhone('');
    setInsurance('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>New Patient</Text>
          <LabeledInput label="Name" value={name} onChangeText={setName} placeholder="Full name" />
          <LabeledInput label="Age" value={age} onChangeText={setAge} placeholder="Age" keyboardType="number-pad" />
          <LabeledInput label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
          <LabeledInput label="Insurance" value={insurance} onChangeText={setInsurance} placeholder="Insurance provider" />
          <View style={styles.modalActions}>
            <PrimaryButton
              title="Cancel"
              variant="outline"
              onPress={() => {
                reset();
                onClose();
              }}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <PrimaryButton
              title="Add Patient"
              disabled={!name.trim()}
              onPress={() => {
                onCreate({
                  name: name.trim(),
                  age: Number(age) || 0,
                  gender: 'Other',
                  phone: phone.trim(),
                  insurance: insurance.trim() || 'Self-pay',
                  vitals: { bp: '-', pulse: '-', temp: '-', spo2: '-', weight: '-' },
                });
                reset();
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  greeting: { color: colors.textSecondary, fontSize: 13 },
  doctorName: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  logout: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  addButton: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  empty: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  consultationRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  consultationPatient: { fontWeight: '600', color: colors.textPrimary, fontSize: 14 },
  consultationMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', marginTop: spacing.sm },
});
