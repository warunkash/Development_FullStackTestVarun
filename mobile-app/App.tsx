import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { PatientsProvider } from './src/context/PatientsContext';
import { ConsultationProvider } from './src/context/ConsultationContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PatientsProvider>
          <ConsultationProvider>
            <AppNavigator />
            <StatusBar style="dark" />
          </ConsultationProvider>
        </PatientsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
