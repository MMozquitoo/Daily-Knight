import { createSupabaseTodayRepository } from '../repository';
import * as wardrobeApi from '../data/wardrobeApi';
import { fetchWeather } from '../services/weather';
import type { ClothingItem } from '../engine/types/wardrobe';
import type { PlannedOutfitRow } from '../data/wardrobeApi';

jest.mock('../data/wardrobeApi');
jest.mock('../services/weather');

const mockedApi = wardrobeApi as jest.Mocked<typeof wardrobeApi>;
const mockedFetchWeather = fetchWeather as jest.MockedFunction<typeof fetchWeather>;

const OWNER_ID = 'owner-1';
const FAKE_CLIENT = {} as any;

const CLOTHING_ITEMS: ClothingItem[] = [
  {
    id: 'CM-01', categorie: 'tshirt', sousCategorie: 'Basique', marque: '', modele: '',
    couleur: 'Bleu', palette: 'neutre', matiere: '', coupe: '', niveau: 'casual', saison: 'toutes',
    formalite: 2, impact: 3, polyvalence: 3, etat: 'bon', imageUrl: 'https://example.com/cm01.jpg',
  },
  {
    id: 'PA-01', categorie: 'pants', sousCategorie: 'Chino', marque: '', modele: '',
    couleur: 'Beige', palette: 'neutre', matiere: '', coupe: '', niveau: 'casual', saison: 'toutes',
    formalite: 2, impact: 3, polyvalence: 3, etat: 'bon', imageUrl: 'https://example.com/pa01.jpg',
  },
  {
    id: 'SN-01', categorie: 'sneakers', sousCategorie: 'Basses', marque: '', modele: '',
    couleur: 'Blanc', palette: 'neutre', matiere: '', coupe: '', niveau: 'casual', saison: 'toutes',
    formalite: 2, impact: 3, polyvalence: 3, etat: 'bon', imageUrl: 'https://example.com/sn01.jpg',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.fetchWardrobeItems.mockResolvedValue(CLOTHING_ITEMS);
  mockedApi.fetchStyleRules.mockResolvedValue([]);
  mockedApi.fetchCooldownMap.mockResolvedValue(new Map());
  mockedApi.fetchFeedbackScores.mockResolvedValue(new Map());
  mockedApi.fetchProfile.mockResolvedValue({ display_name: 'Cristian', latitude: 48.8566, longitude: 2.3522 });
  mockedApi.fetchPlannedOutfit.mockResolvedValue(null);
  mockedApi.upsertPlannedOutfit.mockResolvedValue(undefined);
  mockedApi.updatePlannedOutfitStatus.mockResolvedValue(undefined);
  mockedApi.recordWornToday.mockResolvedValue(undefined);
  mockedFetchWeather.mockResolvedValue({
    temperature: 20, feelsLike: 19, rainProbability: 5, condition: 'clear', wind: 10, tempMax: 23, tempMin: 17,
  });
});

describe('createSupabaseTodayRepository', () => {
  test('getToday runs the engine over the fetched wardrobe and persists the pick', async () => {
    const repo = createSupabaseTodayRepository(FAKE_CLIENT, OWNER_ID);
    const outfit = await repo.getToday();

    expect(outfit.top.id).toBe('CM-01');
    expect(outfit.bottom.id).toBe('PA-01');
    expect(outfit.shoes.id).toBe('SN-01');
    expect(outfit.weather.range).toBe('17–23°C');
    expect(mockedApi.upsertPlannedOutfit).toHaveBeenCalledWith(
      FAKE_CLIENT,
      OWNER_ID,
      expect.objectContaining({ top_item_id: 'CM-01', bottom_item_id: 'PA-01', shoes_item_id: 'SN-01', status: 'proposed' }),
    );
  });

  test('getToday returns the cached planned_outfits row without re-running the engine', async () => {
    const cached: PlannedOutfitRow = {
      date: '2026-08-21',
      top_item_id: 'CM-01',
      bottom_item_id: 'PA-01',
      shoes_item_id: 'SN-01',
      outerwear_item_id: null,
      carry: [],
      why: 'déjà calculé',
      weather: { range: '10–20°C', condition: 'clear', rainChancePct: 0, windKmh: 0 },
      agenda: { eventCount: 0, formality: 'casual' },
      status: 'proposed',
    };
    mockedApi.fetchPlannedOutfit.mockResolvedValue(cached);

    const repo = createSupabaseTodayRepository(FAKE_CLIENT, OWNER_ID);
    const outfit = await repo.getToday();

    expect(outfit.why).toBe('déjà calculé');
    expect(mockedApi.upsertPlannedOutfit).not.toHaveBeenCalled();
    expect(mockedFetchWeather).not.toHaveBeenCalled();
  });

  test('acceptToday marks the row accepted and records today\'s picks as worn', async () => {
    mockedApi.fetchPlannedOutfit.mockResolvedValue({
      date: '2026-08-21',
      top_item_id: 'CM-01',
      bottom_item_id: 'PA-01',
      shoes_item_id: 'SN-01',
      outerwear_item_id: null,
      carry: [],
      why: 'x',
      weather: {},
      agenda: {},
      status: 'accepted',
    } as unknown as PlannedOutfitRow);

    const repo = createSupabaseTodayRepository(FAKE_CLIENT, OWNER_ID);
    await repo.acceptToday('2026-08-21');

    expect(mockedApi.updatePlannedOutfitStatus).toHaveBeenCalledWith(FAKE_CLIENT, '2026-08-21', 'accepted');
    expect(mockedApi.recordWornToday).toHaveBeenCalledWith(FAKE_CLIENT, OWNER_ID, '2026-08-21', ['CM-01', 'PA-01', 'SN-01']);
  });

  test('regenerateToday excludes the current picks and finds an alternative', async () => {
    const itemsWithAlternates: ClothingItem[] = [
      ...CLOTHING_ITEMS,
      {
        id: 'CM-02', categorie: 'tshirt', sousCategorie: 'Basique', marque: '', modele: '',
        couleur: 'Vert', palette: 'neutre', matiere: '', coupe: '', niveau: 'casual', saison: 'toutes',
        formalite: 2, impact: 3, polyvalence: 3, etat: 'bon', imageUrl: 'https://example.com/cm02.jpg',
      },
      {
        id: 'PA-02', categorie: 'pants', sousCategorie: 'Chino', marque: '', modele: '',
        couleur: 'Noir', palette: 'neutre', matiere: '', coupe: '', niveau: 'casual', saison: 'toutes',
        formalite: 2, impact: 3, polyvalence: 3, etat: 'bon', imageUrl: 'https://example.com/pa02.jpg',
      },
      {
        id: 'SN-02', categorie: 'sneakers', sousCategorie: 'Basses', marque: '', modele: '',
        couleur: 'Noir', palette: 'neutre', matiere: '', coupe: '', niveau: 'casual', saison: 'toutes',
        formalite: 2, impact: 3, polyvalence: 3, etat: 'bon', imageUrl: 'https://example.com/sn02.jpg',
      },
    ];
    mockedApi.fetchWardrobeItems.mockResolvedValue(itemsWithAlternates);
    mockedApi.fetchPlannedOutfit.mockResolvedValue({
      date: '2026-08-21',
      top_item_id: 'CM-01',
      bottom_item_id: 'PA-01',
      shoes_item_id: 'SN-01',
      outerwear_item_id: null,
      carry: [],
      why: 'x',
      weather: {},
      agenda: {},
      status: 'proposed',
    } as unknown as PlannedOutfitRow);

    const repo = createSupabaseTodayRepository(FAKE_CLIENT, OWNER_ID);
    const outfit = await repo.regenerateToday();

    expect(outfit.top.id).toBe('CM-02');
    expect(outfit.bottom.id).toBe('PA-02');
    expect(outfit.shoes.id).toBe('SN-02');
  });
});
