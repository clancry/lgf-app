import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: (hasSession: boolean, userId?: string) => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Animate logo in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Check session after animation
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session?.user) {
        onFinish(true, session.user.id);
      } else {
        onFinish(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Image
          source={require('../../assets/logo-lgf.jpeg')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.taglineContainer, { opacity: fadeAnim }]}>
        <Text style={styles.tagline}>
          Ton coach nutritionnel,
        </Text>
        <Text style={styles.taglineAccent}>
          fraîchement préparé chaque jour
        </Text>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    width: width * 0.55,
    aspectRatio: 0.75,
    marginBottom: 40,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  taglineContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  tagline: {
    fontSize: 16,
    color: Colors.white,
    textAlign: 'center',
    opacity: 0.85,
    letterSpacing: 0.3,
  },
  taglineAccent: {
    fontSize: 16,
    color: Colors.lime,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
    opacity: 0.3,
  },
  dotActive: {
    backgroundColor: Colors.lime,
    opacity: 1,
    width: 24,
    borderRadius: 4,
  },
});
