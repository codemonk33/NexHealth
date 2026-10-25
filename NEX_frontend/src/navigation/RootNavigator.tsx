import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';

// ─── Navigators ────────────────────────────────────────────────────────────────
import { AuthStack } from './AuthStack';
import { MainTabNavigator } from './MainTabNavigator';

// ─── Screens ───────────────────────────────────────────────────────────────────
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { LabTestDetailScreen } from '../screens/labs/LabTestDetailScreen';
import { CartScreen } from '../screens/pharmacy/CartScreen';
import { WearableScreen } from '../screens/home/WearableScreen';
import { SmartRemindersScreen } from '../screens/home/SmartRemindersScreen';
import { LabSearchScreen } from '../screens/labs/LabSearchScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Main: undefined;
  LabTestDetail: { testId: string };
  Cart: undefined;
  Wearable: undefined;
  SmartReminders: undefined;
  LabSearch: { testId?: string; testName?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Auth" component={AuthStack} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="LabTestDetail"
              component={LabTestDetailScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="Cart"
              component={CartScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="Wearable"
              component={WearableScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="SmartReminders"
              component={SmartRemindersScreen}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen
              name="LabSearch"
              component={LabSearchScreen}
              options={{ presentation: 'card' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
