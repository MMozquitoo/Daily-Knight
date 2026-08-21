import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { TodayScreen } from './src/screens/TodayScreen';
import { today20260818 } from './src/fixtures/today-2026-08-18';
import { createFixtureRepository } from './src/repository';
import { createConsoleEvents } from './src/events';
import type { TodayOutfit, TodayStatus } from './src/types';

const events = createConsoleEvents();
const repository = createFixtureRepository(today20260818);
const USER_NAME = 'Adrien';

export default function App() {
  const [outfit, setOutfit] = useState<TodayOutfit | null>(null);
  const [status, setStatus] = useState<TodayStatus>('loading');

  const load = async () => {
    setStatus('loading');
    try {
      const result = await repository.getToday();
      setOutfit(result);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#edf0e8' }}>
        <StatusBar barStyle="dark-content" />
        <TodayScreen outfit={outfit} status={status} events={events} userName={USER_NAME} onRegenerate={load} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
