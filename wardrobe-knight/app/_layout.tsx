import { Stack } from 'expo-router';
import { AppStateProvider } from '@/state/AppState';

export default function RootLayout() {
  return (
    <AppStateProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="agenda" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
    </AppStateProvider>
  );
}
