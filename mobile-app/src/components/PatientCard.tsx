import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Patient } from '../types';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  patient: Patient;
  onPress: () => void;
  onLongPress?: () => void;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function PatientCard({ patient, onPress, onLongPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(patient.name)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{patient.name}</Text>
        <Text style={styles.meta}>
          {patient.age} yrs - {patient.gender} - {patient.phone}
        </Text>
        {patient.lastVisit ? <Text style={styles.lastVisit}>Last visit: {patient.lastVisit}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { color: colors.primaryDark, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  lastVisit: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
