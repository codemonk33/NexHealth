import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Home, BookOpen, FlaskConical, User, Upload } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Shadows, Typography } from '../theme';
import { useCartStore } from '../store/cartStore';

// ─── Screens ───────────────────────────────────────────────────────────────────
import { HomeScreen } from '../screens/home/HomeScreen';
import { RecordsScreen } from '../screens/records/RecordsScreen';
import { LabTestsScreen } from '../screens/labs/LabTestsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import DocumentsScreen from '../screens/DocumentsScreen';

export type MainTabParamList = {
  Home: undefined;
  Records: undefined;
  Upload: undefined;
  LabTests: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// ─── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const cartItems = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom || Spacing.sm }]}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const isFocused = state.index === index;
        const isCenter = route.name === 'Upload';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (isCenter) {
          return (
            <View key={route.key} style={styles.centerTabWrapper}>
              <TouchableOpacity
                id={`tab-upload-fab`}
                onPress={onPress}
                activeOpacity={0.85}
                style={styles.fabButton}
              >
                <Upload color={Colors.white} size={26} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          );
        }

        const IconComponent = {
          Home: Home,
          Records: BookOpen,
          LabTests: FlaskConical,
          Profile: User,
        }[route.name as string] ?? Home;

        return (
          <TouchableOpacity
            key={route.key}
            id={`tab-${route.name.toLowerCase()}`}
            onPress={onPress}
            activeOpacity={0.7}
            style={styles.tabItem}
          >
            <View style={styles.tabIconWrapper}>
              <IconComponent
                size={22}
                color={isFocused ? Colors.royalBlue : Colors.tabInactive}
                strokeWidth={isFocused ? 2.5 : 1.8}
              />
              {route.name === 'Records' && cartItems > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartItems > 9 ? '9+' : cartItems}</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.tabLabel,
                { color: isFocused ? Colors.royalBlue : Colors.tabInactive },
              ]}
            >
              {label}
            </Text>
            {isFocused && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main Tab Navigator ────────────────────────────────────────────────────────
export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Records"
        component={RecordsScreen}
        options={{ tabBarLabel: 'Med Order' }}
      />
      <Tab.Screen
        name="Upload"
        component={DocumentsScreen}
        options={{ tabBarLabel: '' }}
      />
      <Tab.Screen
        name="LabTests"
        component={LabTestsScreen}
        options={{ tabBarLabel: 'Lab Test' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    ...Shadows.md,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabIconWrapper: {
    position: 'relative',
    marginBottom: 3,
  },
  tabLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    marginTop: 2,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.royalBlue,
    marginTop: 2,
  },
  centerTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -24,
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.orange,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.orange,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
  },
});
