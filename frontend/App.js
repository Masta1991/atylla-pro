import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from './src/assets/theme';

import LoginScreen from './src/screens/LoginScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import HamburgerMenu from './src/screens/HamburgerMenu';
import TrainingScreen from './src/screens/TrainingScreen';
import ClientsScreen from './src/screens/ClientsScreen';
import ClientFormScreen from './src/screens/ClientFormScreen';
import MeasurementsScreen from './src/screens/MeasurementsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import PlansScreen from './src/screens/PlansScreen';
import ManagerScreen from './src/screens/ManagerScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import PaymentsScreen from './src/screens/PaymentsScreen';
import HistoryFilterScreen from './src/screens/HistoryFilterScreen';
import MuscleExercisesScreen from './src/screens/MuscleExercisesScreen';
import TypeExercisesScreen from './src/screens/TypeExercisesScreen';
import PlanManagerScreen from './src/screens/PlanManagerScreen';
import AbsencesScreen from './src/screens/AbsencesScreen';
import DayCloseScreen from './src/screens/DayCloseScreen';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerShown: false,
  contentStyle: { flex: 1, backgroundColor: COLORS.background },
  animation: 'fade',
};

function AppNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!token ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Atylla Pro' }} />
          <Stack.Screen name="MenuModal" component={HamburgerMenu} options={{ animation: 'slide_from_left' }} />
          <Stack.Screen name="Clients" component={ClientsScreen} />
          <Stack.Screen name="ClientForm" component={ClientFormScreen} />
          <Stack.Screen name="Training" component={TrainingScreen} />
          <Stack.Screen name="Measurements" component={MeasurementsScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="Results" component={ResultsScreen} />
          <Stack.Screen name="Payments" component={PaymentsScreen} />
          <Stack.Screen name="Plans" component={PlansScreen} />
          <Stack.Screen name="Manager" component={ManagerScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="MuscleExercises" component={MuscleExercisesScreen} />
          <Stack.Screen name="TypeExercises" component={TypeExercisesScreen} />
          <Stack.Screen name="PlanManager" component={PlanManagerScreen} />
          <Stack.Screen name="Absences" component={AbsencesScreen} />
          <Stack.Screen name="DayClose" component={DayCloseScreen} />
          <Stack.Screen name="HistoryFilter" component={HistoryFilterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SafeAreaProvider style={{ flex: 1 }}>
          <NavigationContainer>
            <StatusBar style="light" />
            <AppNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
