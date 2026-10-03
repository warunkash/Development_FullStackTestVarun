import { Link } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const FEATURES = [
  { title: 'Fast refresh', body: 'Edit a file and see changes instantly.' },
  { title: 'File-based routing', body: 'Add a file in src/app to add a screen.' },
  { title: 'Web, iOS & Android', body: 'One codebase, every platform.' },
];

export default function HomeScreen() {
  const [taps, setTaps] = useState(0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="small" themeColor="textSecondary">
              {getGreeting()}
            </ThemedText>
            <ThemedText type="title">Home</ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle">Tap counter</ThemedText>
            <ThemedText type="title">{taps}</ThemedText>
            <ThemedView type="backgroundElement" style={styles.row}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setTaps((n) => n + 1)}
                style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={styles.primaryText}>
                  Tap me
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setTaps(0)}
                style={({ pressed }) => [
                  styles.button,
                  styles.secondary,
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">Reset</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>

          <ThemedText type="subtitle">Highlights</ThemedText>
          {FEATURES.map((f) => (
            <ThemedView key={f.title} type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{f.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {f.body}
              </ThemedText>
            </ThemedView>
          ))}

          <Link href="/explore" style={styles.link}>
            <ThemedText type="link">Go to Explore →</ThemedText>
          </Link>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    padding: Spacing.four,
    // The web tab bar floats over the top of the page.
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.four : Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  primary: {
    backgroundColor: '#208AEF',
  },
  primaryText: {
    color: '#ffffff',
  },
  secondary: {
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  pressed: {
    opacity: 0.7,
  },
  link: {
    alignSelf: 'center',
    paddingVertical: Spacing.three,
  },
});
