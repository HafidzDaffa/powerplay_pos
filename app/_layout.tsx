import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { initDatabase } from '@/db/database';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  useEffect(() => {
    initDatabase().catch(console.error);
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modals/product-form" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modals/barcode-view" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modals/checkout" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modals/cashflow-form" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="modals/trash" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <Toast />
    </>
  );
}
