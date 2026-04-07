import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MOCK_WARDROBE } from '@/data/mockDecisionInput';
import { fetchWeather, getUserLocation } from '@/services/weather';
import type { WeatherData } from '@/types/weather';
import type {
  ClothingType,
  FormalityLevel,
  LayerCategory,
  LayerSlot,
  NewWardrobeItem,
  PaletteColor,
  UsageContext,
  WardrobeItem,
} from '@/types/wardrobe';
import type { CarryItem } from '@/types/outfit';

interface PredefinedOutfit {
  id: string;
  name: string;
  wear: {
    top: string;
    bottom: string;
    shoes: string;
    outerwear?: string;
    accessories: string[];
  };
  carry: CarryItem[];
  why: string;
}

interface ScanDraft {
  imageUri: string;
  detectedColor: PaletteColor;
}

interface AppStateValue {
  wardrobe: WardrobeItem[];
  currentOutfit: PredefinedOutfit;
  nextOutfit: () => void;
  addWardrobeItem: (item: NewWardrobeItem) => void;
  scanDraft: ScanDraft | null;
  setScanDraft: (draft: ScanDraft | null) => void;
  weather: WeatherData | null;
  weatherLoading: boolean;
}

const PREDEFINED_OUTFITS: PredefinedOutfit[] = [
  {
    id: 'outfit_1',
    name: 'Smart Office Look',
    wear: {
      top: 'top_oxford_white',
      bottom: 'bottom_pants_gray',
      shoes: 'shoes_loafers_black',
      outerwear: 'outer_blazer_navy',
      accessories: [],
    },
    carry: ['umbrella'],
    why: 'Hoy hay reuniones formales y probabilidad de lluvia. Te recomiendo un look estructurado y un paraguas.',
  },
  {
    id: 'outfit_2',
    name: 'Casual Friday',
    wear: {
      top: 'top_oxford_blue',
      bottom: 'bottom_jeans_navy',
      shoes: 'shoes_sneakers_white',
      accessories: [],
    },
    carry: [],
    why: 'Dia relajado sin reuniones. Un look comodo y limpio es suficiente.',
  },
  {
    id: 'outfit_3',
    name: 'Cold Day Layer',
    wear: {
      top: 'top_oxford_blue',
      bottom: 'bottom_pants_beige',
      shoes: 'shoes_loafers_brown',
      outerwear: 'outer_coat_gray',
      accessories: [],
    },
    carry: ['umbrella', 'light-layer'],
    why: 'Hace frio hoy. Lleva capas y algo para la lluvia por si acaso.',
  },
];

const DEFAULT_CONTEXTS: Record<LayerCategory, UsageContext[]> = {
  top: ['casual'],
  bottom: ['casual'],
  shoes: ['casual'],
  outerwear: ['casual'],
  accessories: ['casual'],
};

const APP_STATE_CONTEXT = createContext<AppStateValue | null>(null);

function inferCategory(type: ClothingType): LayerCategory {
  if (['tshirt', 'shirt', 'sweater', 'hoodie'].includes(type)) return 'top';
  if (['pants', 'jeans', 'shorts', 'skirt'].includes(type)) return 'bottom';
  if (['sneakers', 'boots', 'loafers', 'sandals'].includes(type)) return 'shoes';
  if (['jacket', 'coat', 'blazer', 'vest'].includes(type)) return 'outerwear';
  return 'accessories';
}

function buildItemName(color: PaletteColor, type: ClothingType) {
  const colorLabel = color.charAt(0).toUpperCase() + color.slice(1);
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  return `${colorLabel} ${typeLabel}`;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(MOCK_WARDROBE);
  const [outfitIndex, setOutfitIndex] = useState(0);
  const [scanDraft, setScanDraft] = useState<ScanDraft | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Fetch real weather on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loc = await getUserLocation();
        const data = await fetchWeather(loc.lat, loc.lon);
        if (!cancelled) setWeather(data);
      } catch {
        // Fallback mock weather
        if (!cancelled) setWeather({
          temperature: 14,
          feelsLike: 11,
          rainProbability: 40,
          condition: 'cloudy',
          wind: 18,
        });
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const nextOutfit = useCallback(() => {
    setOutfitIndex((i) => (i + 1) % PREDEFINED_OUTFITS.length);
  }, []);

  const addWardrobeItem = useCallback((item: NewWardrobeItem) => {
    const category = inferCategory(item.type);
    setWardrobe((current) => [
      {
        id: `item_${Date.now()}`,
        createdAt: new Date().toISOString(),
        name: item.name || buildItemName(item.color, item.type),
        type: item.type,
        category,
        templateId: item.templateId || `${category}_${item.type}`,
        color: item.color,
        formality: item.formality,
        contexts: item.contexts.length > 0 ? item.contexts : DEFAULT_CONTEXTS[category],
        weatherSuitability: item.weatherSuitability,
        availability: item.availability,
        layer: category as LayerSlot,
      },
      ...current,
    ]);
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      wardrobe,
      currentOutfit: PREDEFINED_OUTFITS[outfitIndex],
      nextOutfit,
      addWardrobeItem,
      scanDraft,
      setScanDraft,
      weather,
      weatherLoading,
    }),
    [outfitIndex, scanDraft, wardrobe, weather, weatherLoading, nextOutfit, addWardrobeItem],
  );

  return <APP_STATE_CONTEXT.Provider value={value}>{children}</APP_STATE_CONTEXT.Provider>;
}

export function useAppState() {
  const context = useContext(APP_STATE_CONTEXT);
  if (!context) throw new Error('useAppState must be used inside AppStateProvider.');
  return context;
}
