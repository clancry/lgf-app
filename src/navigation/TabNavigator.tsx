import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Session } from '@supabase/supabase-js';

import { Colors } from '../theme/colors';
import DashboardScreen from '../screens/DashboardScreen';
import RecipesScreen from '../screens/RecipesScreen';
import DayPlanScreen from '../screens/DayPlanScreen';
import ArenaScreen from '../screens/ArenaScreen';
import WalletScreen from '../screens/WalletScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type TabParamList = {
  Accueil: undefined;
  Plan: undefined;
  Recettes: undefined;
  Arena: undefined;
  Wallet: undefined;
  Profil: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

interface TabNavigatorProps {
  session: Session | null;
  onCheatMeal?: () => void;
  onCoachMode?: () => void;
}

// Simple icon component using text emoji
function TabIcon({
  emoji,
  focused,
}: {
  emoji: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <Text style={styles.iconEmoji}>{emoji}</Text>
    </View>
  );
}

export function TabNavigator({ session, onCheatMeal, onCoachMode }: TabNavigatorProps) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.darkGreen,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Accueil"
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" focused={focused} />
          ),
        }}
      >
        {() => <DashboardScreen session={session} onCheatMeal={onCheatMeal} onCoachMode={onCoachMode} />}
      </Tab.Screen>

      <Tab.Screen
        name="Recettes"
        options={{
          tabBarLabel: 'Recettes',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🥗" focused={focused} />
          ),
        }}
      >
        {() => <RecipesScreen session={session} />}
      </Tab.Screen>

      <Tab.Screen
        name="Arena"
        options={{
          tabBarLabel: 'Arena',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏟️" focused={focused} />
          ),
        }}
      >
        {() => <ArenaScreen session={session} />}
      </Tab.Screen>

      <Tab.Screen
        name="Plan"
        options={{
          tabBarLabel: 'Plan',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📋" focused={focused} />
          ),
        }}
      >
        {() => <DayPlanScreen session={session} />}
      </Tab.Screen>

      <Tab.Screen
        name="Profil"
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="😊" focused={focused} />
          ),
        }}
      >
        {() => <ProfileScreen session={session} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBarBackground,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 16,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: Colors.lime + '30',
  },
  iconEmoji: {
    fontSize: 20,
  },
});
