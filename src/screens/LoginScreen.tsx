import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmail, signUpWithEmail, createProfile } from '../lib/supabase';
import { Colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface LoginScreenProps {
  onLoginSuccess: (userId: string) => void;
}

type AuthMode = 'buttons' | 'login' | 'register';

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>('buttons');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    const { data, error } = await signInWithEmail(email.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Connexion échouée', error.message);
    } else if (data.user) {
      onLoginSuccess(data.user.id);
    }
  }

  async function handleSignUp() {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Mot de passe trop court', 'Minimum 8 caractères requis.');
      return;
    }
    setLoading(true);
    const { data, error } = await signUpWithEmail(email.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Inscription échouée', error.message);
    } else if (data.user) {
      await createProfile(data.user.id, email.trim());
      onLoginSuccess(data.user.id);
    }
  }

  function handleAppleLogin() {
    Alert.alert('Bientôt disponible', 'La connexion avec Apple sera disponible prochainement.');
  }

  function handleGoogleLogin() {
    Alert.alert('Bientôt disponible', 'La connexion avec Google sera disponible prochainement.');
  }

  return (
    <View style={styles.container}>
      {/* Green header section */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <Image
            source={require('../../assets/logo-lgf.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.welcomeText}>Bienvenue sur</Text>
          <Text style={styles.appName}>La Gamelle Fit</Text>
        </SafeAreaView>
      </View>

      {/* White bottom card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.bottomCard}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {mode === 'buttons' && (
            <View style={styles.buttonsSection}>
              <Text style={styles.sectionTitle}>Connexion</Text>
              <Text style={styles.sectionSubtitle}>
                Choisis ton mode de connexion
              </Text>

              {/* Apple */}
              <TouchableOpacity
                style={styles.appleButton}
                onPress={handleAppleLogin}
                activeOpacity={0.85}
              >
                <Text style={styles.appleButtonText}>🍎  Continuer avec Apple</Text>
              </TouchableOpacity>

              {/* Google */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleLogin}
                activeOpacity={0.85}
              >
                <Text style={styles.googleButtonText}>G  Continuer avec Google</Text>
              </TouchableOpacity>

              {/* Separator */}
              <View style={styles.separator}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>ou</Text>
                <View style={styles.separatorLine} />
              </View>

              {/* Email */}
              <TouchableOpacity
                style={styles.emailButton}
                onPress={() => setMode('login')}
                activeOpacity={0.85}
              >
                <Text style={styles.emailButtonText}>✉️  Continuer avec Email</Text>
              </TouchableOpacity>

              <Text style={styles.legalText}>
                En continuant, tu acceptes nos{' '}
                <Text style={styles.legalLink}>Conditions d'utilisation</Text>
                {' '}et notre{' '}
                <Text style={styles.legalLink}>Politique de confidentialité</Text>.
              </Text>
            </View>
          )}

          {(mode === 'login' || mode === 'register') && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>
                {mode === 'login' ? 'Se connecter' : 'Créer un compte'}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Adresse email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ton@email.com"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mot de passe</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'register' ? 'Minimum 8 caractères' : '••••••••'}
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                onPress={mode === 'login' ? handleSignIn : handleSignUp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleText}>
                  {mode === 'login'
                    ? "Pas encore de compte ? "
                    : "Déjà un compte ? "}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setMode(mode === 'login' ? 'register' : 'login')
                  }
                >
                  <Text style={styles.toggleLink}>
                    {mode === 'login' ? "S'inscrire" : 'Se connecter'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setMode('buttons')}
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>← Retour</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.darkGreen,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 32,
    paddingBottom: 24,
    alignItems: 'center',
    minHeight: height * 0.35,
    justifyContent: 'center',
  },
  logo: {
    width: 100,
    height: 130,
    alignSelf: 'center',
    marginBottom: 12,
  },
  welcomeText: {
    color: Colors.white,
    fontSize: 15,
    opacity: 0.8,
    textAlign: 'center',
  },
  appName: {
    color: Colors.lime,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  bottomCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: height * 0.65,
    paddingTop: 32,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  buttonsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  appleButton: {
    backgroundColor: Colors.black,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  appleButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  googleButtonText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  separatorText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  emailButton: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  emailButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  legalText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  legalLink: {
    color: Colors.darkGreen,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  formSection: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  primaryButton: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  toggleLink: {
    fontSize: 14,
    color: Colors.darkGreen,
    fontWeight: '700',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 4,
  },
  backButtonText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
