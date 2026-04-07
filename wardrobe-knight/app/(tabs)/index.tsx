import { View, StyleSheet, Dimensions, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { OutfitTitle } from '@/components/home/OutfitTitle';
import { OutfitMessage } from '@/components/home/OutfitMessage';
import { ContextBar } from '@/components/home/ContextBar';
import { THEME } from '@/constants/palette';
import type { WardrobeItem } from '@/types/wardrobe';
import { useAppState } from '@/state/AppState';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(SCREEN_HEIGHT * 0.40, 320);

function indexWardrobe(items: WardrobeItem[]) {
  return new Map(items.map((item) => [item.id, item]));
}

export default function HomeScreen() {
  const router = useRouter();
  const { wardrobe, currentOutfit, nextOutfit, weather, weatherLoading } = useAppState();
  const wardrobeById = indexWardrobe(wardrobe);

  // Resolve outfit items to their wardrobe data
  const topItem = wardrobeById.get(currentOutfit.wear.top);
  const bottomItem = wardrobeById.get(currentOutfit.wear.bottom);
  const shoesItem = wardrobeById.get(currentOutfit.wear.shoes);
  const outerwearItem = currentOutfit.wear.outerwear
    ? wardrobeById.get(currentOutfit.wear.outerwear)
    : undefined;

  const displayTemp = weather?.temperature ?? '--';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.screen}>
        {/* Header: menu + profile */}
        <HeaderBar
          onMenuPress={() => router.push('/settings')}
          onProfilePress={() => router.push('/settings')}
        />

        {/* Hero: Character with real PNGs */}
        <Pressable style={styles.heroSection} onPress={nextOutfit}>
          <CharacterAvatar
            size={AVATAR_SIZE}
            top={topItem ? { type: topItem.type, color: topItem.color } : undefined}
            bottom={bottomItem ? { type: bottomItem.type, color: bottomItem.color } : undefined}
            shoes={shoesItem ? { type: shoesItem.type, color: shoesItem.color } : undefined}
            outerwear={outerwearItem ? { type: outerwearItem.type, color: outerwearItem.color } : undefined}
          />
        </Pressable>

        {/* Outfit name */}
        <OutfitTitle name={currentOutfit.name} />

        {/* Why message */}
        <OutfitMessage message={currentOutfit.why} />

        {/* Tap to change hint */}
        <Pressable onPress={nextOutfit} style={styles.changeHint}>
          <Text style={styles.changeText}>Toca el personaje para cambiar outfit</Text>
        </Pressable>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Bottom: temp, calendar, scan */}
        <ContextBar
          temperature={typeof displayTemp === 'number' ? displayTemp : 0}
          unit={weatherLoading ? '' : '°'}
          onTempPress={() => router.push('/(tabs)/weather')}
          onCalendarPress={() => router.push('/agenda')}
          onScanPress={() => router.push('/wardrobe/add')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  screen: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 4,
  },
  changeHint: {
    alignItems: 'center',
    paddingTop: 12,
  },
  changeText: {
    fontSize: 12,
    color: THEME.textTertiary,
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
});
