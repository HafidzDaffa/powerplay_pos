import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { initDatabase } from '@/db/database';
import { Colors } from '@/constants/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => setDbLoaded(true))
      .catch(console.error);
  }, []);

  if (!dbLoaded) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modals/product-form" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modals/barcode-view" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modals/checkout" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modals/cashflow-form" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modals/trash" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modals/history" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <Toast />
    </SafeAreaProvider>
  );
}
