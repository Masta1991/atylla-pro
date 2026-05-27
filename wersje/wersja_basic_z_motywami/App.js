import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
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

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: COLORS.background },
  animation: 'slide_from_right',
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
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="MenuModal" component={HamburgerMenu} options={{ animation: 'slide_from_left' }} />
          <Stack.Screen name="Clients" component={ClientsScreen} />
          <Stack.Screen name="ClientForm" component={ClientFormScreen} />
          <Stack.Screen name="Training" component={TrainingScreen} />
          <Stack.Screen name="Measurements" component={MeasurementsScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="Plans" component={PlansScreen} />
          <Stack.Screen name="Manager" component={ManagerScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <AppNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </AuthProvider>
  );
}
