import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, spacing } from '../theme/colors';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('ananya.rao@sunriseclinic.example');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    setSubmitting(true);
    setError(undefined);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.success) setError(result.error);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brand}>
        <Text style={styles.title}>AI Medical Scribe</Text>
        <Text style={styles.subtitle}>Ambient documentation for your consultations</Text>
      </View>

      <View style={styles.form}>
        <LabeledInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@clinic.com"
        />
        <LabeledInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Enter your password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton title="Login" onPress={handleLogin} loading={submitting} style={styles.loginButton} />
        <Text style={styles.hint}>Demo mode: any email and a password of 4+ characters signs you in.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.lg },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  title: { fontSize: 26, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  form: { marginTop: spacing.lg },
  loginButton: { marginTop: spacing.sm },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, textAlign: 'center' },
});
