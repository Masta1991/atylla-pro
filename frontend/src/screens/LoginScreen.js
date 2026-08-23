import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { login } from '../services/api';
import { SPACING } from '../assets/theme';
import { useTheme } from '../context/ThemeContext';
import { APP_VERSION } from '../version';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const { colors: C, themeColors } = useTheme();
  const styles = useMemo(() => makeStyles(C.accent, themeColors), [C.accent, themeColors]);

  async function handleLogin() {
    Keyboard.dismiss();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Wprowadź adres e-mail i hasło.');
      return;
    }
    setLoading(true);
    try {
      const data = await login(cleanEmail, cleanPassword);
      await signIn(data.access_token, cleanEmail, data.refresh_token);
    } catch (err) {
      let msg = err.message || 'Logowanie nieudane';
      if (msg.includes('401') || msg.toLowerCase().includes('invalid login credentials')) {
        msg = 'Nieprawidłowy e-mail lub hasło.';
      } else if (msg.includes('Failed to fetch') || msg.includes('Network')) {
        msg = 'Błąd połączenia z serwerem. Sprawdź internet.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <View style={{ alignItems: 'center', marginBottom: SPACING.xl }}>
          <Text style={[styles.title, { color: C.accent }]}>ATYLLA</Text>
          <Text style={styles.subtitle}>TRAINER PRO</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            placeholder="E-mail"
            placeholderTextColor={themeColors.textSecondary}
            style={styles.input}
            value={email}
            onChangeText={(val) => { setEmail(val); setError(''); }}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="email-address"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="Hasło"
              placeholderTextColor={themeColors.textSecondary}
              style={styles.passwordInput}
              value={password}
              onChangeText={(val) => { setPassword(val); setError(''); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={themeColors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={18} color="#FF5252" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: C.accent }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={themeColors.white} />
            ) : (
              <Text style={styles.buttonText}>ZALOGUJ</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>v{APP_VERSION}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(accent, TC) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: TC.background },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
    title: { fontSize: 32, fontWeight: '800', textAlign: 'center', letterSpacing: 3 },
    subtitle: { fontSize: 14, color: TC.textSecondary, textAlign: 'center', marginTop: SPACING.xs, marginBottom: SPACING.xl },
    form: { gap: SPACING.md },
    input: {
      backgroundColor: TC.surfaceLight, borderRadius: 12, padding: 16,
      fontSize: 16, color: TC.text, borderWidth: 1, borderColor: TC.border,
    },
    passwordContainer: {
      position: 'relative',
      justifyContent: 'center',
    },
    passwordInput: {
      backgroundColor: TC.surfaceLight, borderRadius: 12, padding: 16, paddingRight: 50,
      fontSize: 16, color: TC.text, borderWidth: 1, borderColor: TC.border,
    },
    eyeButton: {
      position: 'absolute',
      right: 14,
      top: 16,
      zIndex: 10,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 82, 82, 0.1)',
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255, 82, 82, 0.3)',
    },
    errorText: {
      color: '#FF5252',
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
    },
    button: {
      borderRadius: 12, padding: 16,
      alignItems: 'center', marginTop: SPACING.sm,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: TC.background, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
    versionText: {
      color: TC.textMuted,
      fontSize: 11,
      textAlign: 'center',
      marginTop: SPACING.xl,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
  });
}
