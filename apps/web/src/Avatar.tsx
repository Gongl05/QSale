import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './session';

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
  size = 38,
}: {
  userId: number;
  version?: number | null;
  name: string;
  size?: number;
}) {
  // Pictures need the session token, so they are fetched as blobs instead of a plain <img src>.
  const picture = useQuery({
    queryKey: ['avatar', userId, version],
    queryFn: ({ signal }) => api.avatar(userId, version!, signal),
    enabled: Boolean(version),
    staleTime: Infinity,
    retry: false,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!picture.data) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(picture.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [picture.data]);
  const box = { width: size, height: size, minWidth: size, fontSize: size * 0.36 };
  return url ? (
    <img className="avatar" src={url} alt="" style={{ ...box, objectFit: 'cover' }} />
  ) : (
    <span className="avatar" aria-hidden style={box}>
      {initials(name)}
    </span>
  );
}

/** Crops the chosen image to a square and shrinks it to 512 px JPEG, ready to upload. */
export async function prepareAvatar(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    throw new Error('Elige una imagen JPG, PNG o WebP.');
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(512, side);
  canvas
    .getContext('2d')!
    .drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  bitmap.close();
  const data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  return { contentType: 'image/jpeg', data };
}
