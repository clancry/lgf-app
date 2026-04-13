import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { signInWithEmail, signUpWithEmail } from '../lib/supabase';
import { Colors } from '../theme/colors';

interface LoginScreenProps {
  onLoginSuccess: (userId: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [showEmail, setShowEmail] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      setError('Remplis tous les champs.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        const { data, error: err } = await signUpWithEmail(email.trim(), password);
        if (err) { setError(err.message); setLoading(false); return; }
        if (data?.user) onLoginSuccess(data.user.id);
      } else {
        const { data, error: err } = await signInWithEmail(email.trim(), password);
        if (err) { setError(err.message); setLoading(false); return; }
        if (data?.user) onLoginSuccess(data.user.id);
      }
    } catch (e: any) {
      setError(e.message || 'Erreur de connexion');
    }
    setLoading(false);
  };

  const showAlert = (provider: string) => {
    if (Platform.OS === 'web') {
      window.alert(`La connexion avec ${provider} sera disponible prochainement.`);
    } else {
      Alert.alert('Bientôt disponible', `La connexion avec ${provider} sera disponible prochainement.`);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header vert */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/logo-lgf.jpeg')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.welcome}>Bienvenue sur</Text>
        <Text style={styles.title}>La Gamelle Fit</Text>
        <Text style={styles.subtitle}>
          Ton coach nutritionnel personnel
        </Text>
      </View>

      {/* Zone blanche */}
      <View style={styles.formSection}>
        {!showEmail ? (
          <>
            <Text style={styles.sectionTitle}>Connexion</Text>
            <Text style={styles.sectionSubtitle}>Choisis ton mode de connexion</Text>

            {/* Apple */}
            <TouchableOpacity
              style={styles.appleBtn}
              onPress={() => showAlert('Apple')}
            >
              <Text style={styles.appleTxt}>🍎  Continuer avec Apple</Text>
            </TouchableOpacity>

            {/* Google */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={() => showAlert('Google')}
            >
              <Text style={styles.googleTxt}>G  Continuer avec Google</Text>
            </TouchableOpacity>

            {/* Séparateur */}
            <View style={styles.sep}>
              <View style={styles.sepLine} />
              <Text style={styles.sepText}>ou</Text>
              <View style={styles.sepLine} />
            </View>

            {/* Email */}
            <TouchableOpacity
              style={styles.emailBtn}
              onPress={() => setShowEmail(true)}
            >
              <Text style={styles.emailTxt}>✉️  Continuer avec Email</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {isRegister ? 'Créer un compte' : 'Se connecter'}
            </Text>

            <Text style={styles.inputLabel}>Adresse email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ton@email.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>Mot de passe</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder={isRegister ? 'Minimum 6 caractères' : '••••••••'}
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.emailBtn, loading && { opacity: 0.6 }]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.emailTxt}>
                  {isRegister ? 'Créer mon compte' : 'Se connecter'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setIsRegister(!isRegister); setError(''); }}
              style={styles.switchBtn}
            >
              <Text style={styles.switchTxt}>
                {isRegister
                  ? 'Déjà un compte ? '
                  : 'Pas encore de compte ? '}
                <Text style={styles.switchAccent}>
                  {isRegister ? 'Se connecter' : "S'inscrire"}
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setShowEmail(false); setError(''); }}
              style={styles.backBtn}
            >
              <Text style={styles.backTxt}>← Retour</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.legal}>
          En continuant, tu acceptes nos Conditions d'utilisation et notre Politique de confidentialité.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkGreen },
  content: { flexGrow: 1 },
  header: {
    paddingTop: 60, paddingBottom: 40,
    alignItems: 'center', backgroundColor: Colors.darkGreen,
  },
  logo: { width: 100, height: 100, borderRadius: 16, marginBottom: 16 },
  welcome: { color: '#ffffffaa', fontSize: 14 },
  title: { color: Colors.lime, fontSize: 28, fontWeight: '800', marginTop: 2 },
  subtitle: { color: '#ffffff80', fontSize: 13, marginTop: 6 },

  formSection: {
    flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40,
  },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#888', marginBottom: 24 },

  appleBtn: {
    backgroundColor: '#000', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12,
  },
  appleTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

  googleBtn: {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#e0e0e0', marginBottom: 12,
  },
  googleTxt: { color: '#333', fontWeight: '700', fontSize: 15 },

  sep: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  sepLine: { flex: 1, height: 1, backgroundColor: '#e8e8e8' },
  sepText: { marginHorizontal: 12, color: '#aaa', fontSize: 12 },

  emailBtn: {
    backgroundColor: Colors.darkGreen, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12,
  },
  emailTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

  inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 15, color: '#111', borderWidth: 1, borderColor: '#e8e8e8',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111',
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeIcon: {
    fontSize: 18,
  },
  error: { color: '#E8612D', fontSize: 13, textAlign: 'center', marginTop: 12 },

  switchBtn: { alignItems: 'center', marginTop: 16 },
  switchTxt: { color: '#888', fontSize: 13 },
  switchAccent: { color: Colors.darkGreen, fontWeight: '700' },

  backBtn: { alignItems: 'center', marginTop: 12 },
  backTxt: { color: '#aaa', fontSize: 13 },

  legal: { color: '#bbb', fontSize: 10, textAlign: 'center', marginTop: 24, lineHeight: 14 },
});
