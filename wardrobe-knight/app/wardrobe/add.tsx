import { useState, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ITEM_COLORS, THEME } from '@/constants/palette';
import { detectColorFromFile } from '@/services/color';
import { useAppState } from '@/state/AppState';
import type { ClothingType, FormalityLevel, PaletteColor } from '@/types/wardrobe';

const TYPE_OPTIONS: { value: ClothingType; label: string }[] = [
  { value: 'shirt', label: 'Camisa' },
  { value: 'tshirt', label: 'Camiseta' },
  { value: 'pants', label: 'Pantalon' },
  { value: 'jeans', label: 'Jeans' },
  { value: 'sneakers', label: 'Tenis' },
  { value: 'loafers', label: 'Zapatos' },
  { value: 'jacket', label: 'Chaqueta' },
  { value: 'coat', label: 'Abrigo' },
  { value: 'blazer', label: 'Blazer' },
];

const FORMALITY_OPTIONS: { value: FormalityLevel; label: string }[] = [
  { value: 'casual', label: 'Casual' },
  { value: 'smart', label: 'Smart' },
  { value: 'formal', label: 'Formal' },
];

const COLOR_OPTIONS: PaletteColor[] = ['white', 'navy', 'gray', 'beige', 'brown', 'black', 'blue', 'olive', 'red', 'green'];

export default function AddClothingScreen() {
  const router = useRouter();
  const { addWardrobeItem } = useAppState();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<'capture' | 'confirm'>('capture');
  const [detectedColor, setDetectedColor] = useState<PaletteColor>('navy');
  const [selectedType, setSelectedType] = useState<ClothingType>('shirt');
  const [selectedFormality, setSelectedFormality] = useState<FormalityLevel>('smart');
  const [selectedColor, setSelectedColor] = useState<PaletteColor>('navy');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = async (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Detect color
    const color = await detectColorFromFile(file);
    setDetectedColor(color);
    setSelectedColor(color);
    setStep('confirm');
  };

  const openCamera = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSave = () => {
    addWardrobeItem({
      name: '',
      type: selectedType,
      category: 'top',
      templateId: '',
      color: selectedColor,
      formality: selectedFormality,
      contexts: [],
      weatherSuitability: { minTemp: 5, maxTemp: 30, rainOk: true, windOk: true },
      availability: 'available',
      layer: 'top',
    });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Hidden file input for web camera */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef as any}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'< Volver'}</Text>
        </Pressable>

        <Text style={styles.title}>
          {step === 'capture' ? 'Escanear prenda' : 'Confirmar prenda'}
        </Text>

        {step === 'capture' ? (
          <View style={styles.section}>
            <Text style={styles.desc}>
              Toma una foto de tu prenda para detectar el color automaticamente.
            </Text>
            <View style={styles.cameraBox}>
              <Pressable style={styles.cameraButton} onPress={openCamera}>
                <Text style={styles.cameraIcon}>{'📷'}</Text>
                <Text style={styles.cameraLabel}>Abrir camara</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            {/* Photo preview */}
            {previewUrl && (
              <View style={styles.previewWrap}>
                <img
                  src={previewUrl}
                  alt="Prenda"
                  style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 16 }}
                />
              </View>
            )}

            {/* Detected color */}
            <View style={styles.detectRow}>
              <Text style={styles.label}>Color detectado:</Text>
              <View style={[styles.colorDot, { backgroundColor: ITEM_COLORS[detectedColor].hex }]} />
              <Text style={styles.detectValue}>{detectedColor}</Text>
            </View>

            {/* Type selection */}
            <Text style={styles.label}>Tipo de prenda</Text>
            <View style={styles.chipRow}>
              {TYPE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.chip, selectedType === opt.value && styles.chipActive]}
                  onPress={() => setSelectedType(opt.value)}
                >
                  <Text style={[styles.chipText, selectedType === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Formality */}
            <Text style={styles.label}>Formalidad</Text>
            <View style={styles.chipRow}>
              {FORMALITY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.chip, selectedFormality === opt.value && styles.chipActive]}
                  onPress={() => setSelectedFormality(opt.value)}
                >
                  <Text style={[styles.chipText, selectedFormality === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Color override */}
            <Text style={styles.label}>Color (puedes cambiar)</Text>
            <View style={styles.chipRow}>
              {COLOR_OPTIONS.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.colorChip, selectedColor === c && styles.colorChipActive]}
                  onPress={() => setSelectedColor(c)}
                >
                  <View style={[styles.colorDotSmall, { backgroundColor: ITEM_COLORS[c].hex }]} />
                </Pressable>
              ))}
            </View>

            <View style={styles.buttonWrap}>
              <PrimaryButton label="Guardar prenda" onPress={handleSave} />
            </View>

            <Pressable onPress={() => { setStep('capture'); setPreviewUrl(null); }} style={styles.retake}>
              <Text style={styles.retakeText}>Tomar otra foto</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },
  content: { paddingBottom: 40 },
  backBtn: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backText: { fontSize: 16, color: THEME.accent, fontWeight: '500' },
  title: { fontSize: 26, fontWeight: '700', color: THEME.text, paddingHorizontal: 24, paddingTop: 8 },
  desc: { fontSize: 15, color: THEME.textSecondary, lineHeight: 22, marginBottom: 24 },
  section: { paddingHorizontal: 24, paddingTop: 20 },
  cameraBox: { alignItems: 'center', paddingVertical: 40 },
  cameraButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: THEME.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.surfaceMute,
  },
  cameraIcon: { fontSize: 40, marginBottom: 8 },
  cameraLabel: { fontSize: 15, fontWeight: '600', color: THEME.accent },
  previewWrap: { marginBottom: 20, borderRadius: 16, overflow: 'hidden' },
  detectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: THEME.text, marginBottom: 10, marginTop: 16 },
  detectValue: { fontSize: 16, fontWeight: '600', color: THEME.text, textTransform: 'capitalize' },
  colorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: THEME.border },
  colorDotSmall: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: THEME.border },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: THEME.surfaceMute, borderWidth: 1, borderColor: THEME.border,
  },
  chipActive: { backgroundColor: THEME.accent, borderColor: THEME.accent },
  chipText: { fontSize: 14, fontWeight: '500', color: THEME.text },
  chipTextActive: { color: THEME.white },
  colorChip: {
    padding: 4, borderRadius: 18, borderWidth: 2, borderColor: 'transparent',
  },
  colorChipActive: { borderColor: THEME.accent },
  buttonWrap: { paddingTop: 28 },
  retake: { alignItems: 'center', paddingTop: 16 },
  retakeText: { fontSize: 14, color: THEME.accent, fontWeight: '500' },
});
