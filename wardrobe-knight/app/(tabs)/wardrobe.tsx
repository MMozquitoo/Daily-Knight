import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ItemCard } from '@/components/ui/ItemCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { THEME } from '@/constants/palette';
import { useAppState } from '@/state/AppState';

export default function WardrobeScreen() {
  const router = useRouter();
  const { wardrobe } = useAppState();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Wardrobe</Text>
          <Text style={styles.sub}>{wardrobe.length} items stored locally</Text>
        </View>

        <View style={styles.buttonWrap}>
          <PrimaryButton label="Add clothing" onPress={() => router.push('/wardrobe/add')} />
        </View>

        <View style={styles.list}>
          {wardrobe.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },
  content: { paddingBottom: 24 },
  header: { paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '700', color: THEME.text },
  sub: { fontSize: 14, color: THEME.textSecondary, marginTop: 4 },
  buttonWrap: { paddingHorizontal: 24, paddingTop: 20 },
  list: { paddingHorizontal: 24, paddingTop: 20, gap: 12 },
});
