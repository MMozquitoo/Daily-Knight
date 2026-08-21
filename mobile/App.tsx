import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { TodayScreen } from './src/screens/TodayScreen';
import { today20260818 } from './src/fixtures/today-2026-08-18';
import { createConsoleEvents } from './src/events';

const events = createConsoleEvents();

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#edf0e8' }}>
      <StatusBar barStyle="dark-content" />
      <TodayScreen outfit={today20260818} status="ready" events={events} dateLabel="Mardi 18 août" />
    </SafeAreaView>
  );
}
