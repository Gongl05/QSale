import { useState } from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { apiURL, currentAccessToken } from './session';
import { Text } from './ui';

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

/** Profile picture when the person has one, otherwise their initials. */
export function Avatar({
  userId,
  version,
  name,
  size = 40,
}: {
  userId: number;
  version?: number | null;
  name: string;
  size?: number;
}) {
  const [failedVersion, setFailedVersion] = useState<number | null>(null);
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (version && failedVersion !== version)
    return (
      <Image
        accessibilityLabel={'Foto de ' + name}
        source={{
          uri: `${apiURL}/users/${userId}/avatar?v=${version}`,
          headers: { Authorization: 'Bearer ' + (currentAccessToken() ?? '') },
        }}
        onError={() => setFailedVersion(version)}
        style={[round, { backgroundColor: '#F9E4CF' }]}
      />
    );
  return (
    <View
      accessible
      accessibilityLabel={'Iniciales de ' + name}
      style={[round, { backgroundColor: '#F9E4CF', alignItems: 'center', justifyContent: 'center' }]}
    >
      <Text
        style={{
          color: '#8B4215',
          fontFamily: 'Manrope_800ExtraBold',
          fontSize: size * 0.36,
          lineHeight: size * 0.46,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

/**
 * Lets the person pick a photo, crops it square and shrinks it to 512 px so it uploads quickly.
 * Returns null when they cancel.
 */
export async function pickAvatar(source: 'library' | 'camera') {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Necesitamos permiso de cámara para tomar la foto.');
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const resized = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 512 } }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!resized.base64) throw new Error('No pudimos preparar la foto. Prueba con otra.');
  return { contentType: 'image/jpeg', data: resized.base64 };
}
