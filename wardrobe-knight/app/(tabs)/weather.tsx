import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { THEME } from '@/constants/palette';
import { useAppState } from '@/state/AppState';

export default function WeatherScreen() {
  const router = useRouter();
  const { weather, weatherLoading } = useAppState();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>{'< Volver'}</Text>
      </Pressable>

      <View style={styles.center}>
        {weatherLoading ? (
          <Text style={styles.loading}>Cargando clima...</Text>
        ) : weather ? (
          <>
            <Text style={styles.temp}>{weather.temperature}°</Text>
            <Text style={styles.feels}>Sensacion {weather.feelsLike}°</Text>
            <View style={styles.row}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{weather.rainProbability}%</Text>
                <Text style={styles.statLabel}>Lluvia</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{weather.wind} km/h</Text>
                <Text style={styles.statLabel}>Viento</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{weather.condition}</Text>
                <Text style={styles.statLabel}>Condicion</Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.loading}>No se pudo obtener el clima</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },
  back: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backText: { fontSize: 16, color: THEME.accent, fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  loading: { fontSize: 16, color: THEME.textSecondary },
  temp: { fontSize: 72, fontWeight: '200', color: THEME.text },
  feels: { fontSize: 16, color: THEME.textSecondary, marginTop: 4 },
  row: { flexDirection: 'row', gap: 32, marginTop: 40 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '600', color: THEME.text },
  statLabel: { fontSize: 13, color: THEME.textTertiary, marginTop: 4, textTransform: 'capitalize' },
});
