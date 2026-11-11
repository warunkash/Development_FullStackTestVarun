import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ICDSuggestion } from '../types';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  suggestions: ICDSuggestion[];
  onToggle: (code: string) => void;
}

export function ICDSuggestionList({ suggestions, onToggle }: Props) {
  if (suggestions.length === 0) {
    return <Text style={styles.empty}>Start recording to get ICD-10 suggestions from the conversation.</Text>;
  }

  return (
    <View>
      {suggestions.map((item) => (
        <TouchableOpacity key={item.code} style={styles.row} onPress={() => onToggle(item.code)}>
          <View style={[styles.checkbox, item.selected && styles.checkboxChecked]}>
            {item.selected ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: { backgroundColor: colors.primary },
  checkmark: { color: colors.white, fontSize: 13, fontWeight: '700' },
  textWrap: { flex: 1 },
  code: { fontWeight: '700', color: colors.textPrimary, fontSize: 13 },
  label: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
});
