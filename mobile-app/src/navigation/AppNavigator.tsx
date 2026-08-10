import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ConsultationScreen } from '../screens/ConsultationScreen';
import { PrescriptionScreen } from '../screens/PrescriptionScreen';
import { VisitSummaryScreen } from '../screens/VisitSummaryScreen';
import { PatientTimelineScreen } from '../screens/PatientTimelineScreen';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Consultation: { patientId: string };
  Prescription: { patientId: string; consultationId: string };
  VisitSummary: { patientId: string; consultationId: string };
  PatientTimeline: { patientId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
};

export function AppNavigator() {
  const { doctor, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!doctor ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Today' }} />
            <Stack.Screen name="Consultation" component={ConsultationScreen} options={{ title: 'Consultation' }} />
            <Stack.Screen name="Prescription" component={PrescriptionScreen} options={{ title: 'Prescription' }} />
            <Stack.Screen name="VisitSummary" component={VisitSummaryScreen} options={{ title: 'Visit Summary' }} />
            <Stack.Screen name="PatientTimeline" component={PatientTimelineScreen} options={{ title: 'Patient Timeline' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
