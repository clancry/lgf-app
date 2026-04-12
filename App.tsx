import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Session } from '@supabase/supabase-js';

import { supabase, getProfile } from './src/lib/supabase';
import { Colors } from './src/theme/colors';
import { TabNavigator } from './src/navigation/TabNavigator';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import RecipeDetailScreen from './src/screens/RecipeDetailScreen';
import DailyQuizScreen from './src/screens/DailyQuizScreen';
import CheatMealScreen from './src/screens/CheatMealScreen';
import CoachModeScreen from './src/screens/CoachModeScreen';
import { CoachMode } from './src/lib/coach-modes';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  RecipeDetail: { recipeId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

type AppState = 'loading' | 'splash' | 'login' | 'onboarding' | 'dailyquiz' | 'main';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [showCheatMeal, setShowCheatMeal] = useState(false);
  const [showCoachMode, setShowCoachMode] = useState(false);
  const [coachMode, setCoachMode] = useState<CoachMode>('soft');

  useEffect(() => {
    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          await checkOnboardingStatus(newSession.user.id);
        } else {
          setAppState('login');
        }
      }
    );

    // Initial session check via splash
    setAppState('splash');

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function checkOnboardingStatus(userId: string) {
    const { profile } = await getProfile(userId);
    if (profile?.onboarding_done) {
      setAppState('dailyquiz');
    } else {
      setAppState('onboarding');
    }
  }

  function handleSplashFinish(hasSession: boolean, userId?: string) {
    if (!hasSession) {
      setAppState('login');
    } else if (userId) {
      checkOnboardingStatus(userId);
    }
  }

  function handleLoginSuccess(userId: string) {
    checkOnboardingStatus(userId);
  }

  function handleOnboardingComplete() {
    setAppState('dailyquiz');
  }

  function handleDailyQuizComplete(_points: number) {
    setAppState('main');
  }

  if (appState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.lime} />
      </View>
    );
  }

  // DailyQuiz is rendered outside NavigationContainer (full-screen, no nav)
  if (appState === 'dailyquiz') {
    return (
      <SafeAreaProvider>
        <DailyQuizScreen session={session} onComplete={handleDailyQuizComplete} />
      </SafeAreaProvider>
    );
  }

  // Modals plein écran
  if (showCheatMeal) {
    return (
      <SafeAreaProvider>
        <CheatMealScreen
          session={session}
          coachMode={coachMode}
          regime="seche"
          dailyCalories={1800}
          onClose={() => setShowCheatMeal(false)}
        />
      </SafeAreaProvider>
    );
  }

  if (showCoachMode) {
    return (
      <SafeAreaProvider>
        <CoachModeScreen
          session={session}
          currentMode={coachMode}
          onModeChange={(mode) => setCoachMode(mode)}
          onClose={() => setShowCoachMode(false)}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {appState === 'splash' && (
            <Stack.Screen name="Splash">
              {(props) => (
                <SplashScreen {...props} onFinish={handleSplashFinish} />
              )}
            </Stack.Screen>
          )}
          {appState === 'login' && (
            <Stack.Screen name="Login">
              {(props) => (
                <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />
              )}
            </Stack.Screen>
          )}
          {appState === 'onboarding' && (
            <Stack.Screen name="Onboarding">
              {(props) => (
                <OnboardingScreen
                  {...props}
                  session={session}
                  onComplete={handleOnboardingComplete}
                />
              )}
            </Stack.Screen>
          )}
          {appState === 'main' && (
            <>
              <Stack.Screen name="MainTabs">
                {() => <TabNavigator
                  session={session}
                  onCheatMeal={() => setShowCheatMeal(true)}
                  onCoachMode={() => setShowCoachMode(true)}
                />}
              </Stack.Screen>
              <Stack.Screen
                name="RecipeDetail"
                component={RecipeDetailScreen}
                options={{
                  headerShown: true,
                  headerTitle: '',
                  headerBackTitle: 'Retour',
                  headerStyle: { backgroundColor: Colors.darkGreen },
                  headerTintColor: Colors.white,
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
