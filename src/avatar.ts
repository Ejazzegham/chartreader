import * as ImagePicker from 'expo-image-picker';

// Resize to `width` px and return a JPEG as base64, or null if the image tools are not available. Works with the new and the older expo-image-manipulator API.
async function resizeTo(uri: string, width: number, compress: number): Promise<string | null> {
  try {
    const M = require('expo-image-manipulator');
    if (M.ImageManipulator?.manipulate) {
      const ctx = M.ImageManipulator.manipulate(uri);
      ctx.resize({ width });
      const img = await ctx.renderAsync();
      const out = await img.saveAsync({ format: M.SaveFormat.JPEG, compress, base64: true });
      if (out?.base64) return out.base64;
    } else if (M.manipulateAsync) {
      const out = await M.manipulateAsync(uri, [{ resize: { width } }], { compress, format: M.SaveFormat.JPEG, base64: true });
      if (out?.base64) return out.base64;
    }
  } catch {}
  return null;
}

// Returns a small square JPEG as a data uri, or null if the user cancelled. Throws an Error with a readable message.
export async function pickAvatar(source: 'gallery' | 'camera'): Promise<string | null> {
  if (source === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new Error('Camera permission was not given. Allow it in the phone settings, or choose a photo from the gallery.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true };
  const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const small = await resizeTo(a.uri, 320, 0.75); // only a few KB
  if (small) return 'data:image/jpeg;base64,' + small;
  if (a.base64 && a.base64.length < 1_200_000) return 'data:image/jpeg;base64,' + a.base64; // fallback: the cropped picker image itself
  throw new Error('That photo is too large. Pick a smaller one.');
}
