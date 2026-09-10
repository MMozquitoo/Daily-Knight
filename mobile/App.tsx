import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { TodayScreen } from './src/screens/TodayScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { supabase } from './src/supabase';
import { createSupabaseTodayRepository, type SupabaseTodayRepository } from './src/repository';
import { fetchProfile } from './src/data/wardrobeApi';
import { createConsoleEvents } from './src/events';
import type { TodayOutfit, TodayStatus } from './src/types';

const events = createConsoleEvents();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [repository, setRepository] = useState<SupabaseTodayRepository | null>(null);
  const [userName, setUserName] = useState('');
  const [outfit, setOutfit] = useState<TodayOutfit | null>(null);
  const [status, setStatus] = useState<TodayStatus>('loading');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setRepository(null);
      return;
    }
    setRepository(createSupabaseTodayRepository(supabase, session.user.id));
    fetchProfile(supabase, session.user.id)
      .then((profile) => setUserName(profile.display_name || session.user.email?.split('@')[0] || ''))
      .catch(() => setUserName(session.user.email?.split('@')[0] || ''));
  }, [session]);

  const load = async (repo: SupabaseTodayRepository) => {
    setStatus('loading');
    try {
      const result = await repo.getToday();
      setOutfit(result);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    if (repository) load(repository);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository]);

  const handleRegenerate = async () => {
    if (!repository) return;
    setStatus('loading');
    try {
      const result = await repository.regenerateToday();
      setOutfit(result);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  const handleAccept = () => {
    if (!repository || !outfit) return;
    repository.acceptToday(outfit.date).catch((err) => console.error('[acceptToday]', err));
  };

  // Bref flash au démarrage pendant que Supabase relit la session stockée —
  // pas la peine d'un spinner pour ça.
  if (!sessionLoaded) return null;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#edf0e8' }}>
        <StatusBar barStyle="dark-content" />
        {session ? (
          <TodayScreen
            outfit={outfit}
            status={status}
            events={events}
            userName={userName}
            onRegenerate={handleRegenerate}
            onAccept={handleAccept}
          />
        ) : (
          <SignInScreen />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
