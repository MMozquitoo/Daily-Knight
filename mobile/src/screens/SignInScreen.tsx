import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../supabase';

type Mode = 'sign-in' | 'sign-up';

export function SignInScreen() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canSubmit = !loading && !!email.trim() && password.length >= 6;

  const toggleMode = () => {
    setMode((current) => (current === 'sign-in' ? 'sign-up' : 'sign-in'));
    setError(null);
    setInfo(null);
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);

    if (mode === 'sign-in') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (signInError) setError(signInError.message);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    // Sans confirmation par e-mail activée côté Supabase, signUp() renvoie déjà
    // une session valide — sinon il faut confirmer avant de pouvoir se connecter.
    if (!data.session) {
      setInfo('Compte créé — vérifie ta boîte e-mail pour confirmer, puis connecte-toi.');
      setMode('sign-in');
    }
  };

  return (
    <View style={styles.screen} testID="sign-in-screen">
      <Text style={styles.title}>Mage Stylist</Text>

      <Text style={styles.label}>Adresse e-mail</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="toi@exemple.com"
        autoCapitalize="none"
        keyboardType="email-address"
        testID="sign-in-email-input"
      />

      <Text style={styles.label}>Mot de passe</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        testID="sign-in-password-input"
      />

      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        accessibilityRole="button"
        testID="sign-in-submit"
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonLabel}>{mode === 'sign-in' ? 'Se connecter' : 'Créer un compte'}</Text>
        )}
      </Pressable>

      <Pressable onPress={toggleMode} accessibilityRole="button" testID="sign-in-toggle-mode">
        <Text style={styles.toggle}>
          {mode === 'sign-in' ? "Pas encore de compte ? Créer un compte" : 'Déjà un compte ? Se connecter'}
        </Text>
      </Pressable>

      {error ? (
        <Text style={styles.error} testID="sign-in-error">
          {error}
        </Text>
      ) : null}
      {info ? (
        <Text style={styles.info} testID="sign-in-info">
          {info}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 13, color: '#687164' },
  input: {
    borderWidth: 1,
    borderColor: '#c9d2c4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#314a35',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { color: '#ffffff', fontWeight: '500' },
  toggle: { marginTop: 4, fontSize: 13, color: '#3F6B4C', textAlign: 'center' },
  error: { color: '#a33', fontSize: 13, textAlign: 'center', marginTop: 8 },
  info: { color: '#3F6B4C', fontSize: 13, textAlign: 'center', marginTop: 8 },
});
