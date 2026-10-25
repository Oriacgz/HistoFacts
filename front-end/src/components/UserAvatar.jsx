import { useState } from 'react';
import { Blobatar } from '@blobatar/react';
import { getAvatarSrc } from '../utils/mediaSrc';

const sizeClasses = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
  '2xl': 'h-24 w-24',
};

// Pixel sizes matching the Tailwind h-*/w-* classes above, for the inline-SVG Blobatar
const pixelSizes = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  '2xl': 96,
};

export default function UserAvatar({
  user,
  avatarUrl,
  username,
  userId,
  avatarSeed,
  size = 'md',
  className = '',
}) {
  const [imageError, setImageError] = useState(false);

  const finalAvatarUrl = avatarUrl ?? user?.avatar_url;
  const finalUsername = username ?? user?.username ?? 'User';
  const finalId = userId ?? user?.id ?? finalUsername;
  // Precedence: uploaded photo > Blobatar from chosen seed > Blobatar from the user id,
  // so every account has a consistent avatar from signup
  const finalSeed = String(avatarSeed ?? user?.avatar_seed ?? finalId);

  const src = getAvatarSrc(finalAvatarUrl);
  const sizeClass = sizeClasses[size] || size;

  if (src && !imageError) {
    return (
      <div
        className={`relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden border border-white/15 select-none ${sizeClass} ${className}`}
      >
        <img
          src={src}
          alt={finalUsername}
          onError={() => setImageError(true)}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden shadow-sm select-none border border-white/20 ${sizeClass} ${className}`}
      title={finalUsername}
    >
      <Blobatar name={finalSeed} size={pixelSizes[size] ?? 40} animate="always" />
    </div>
  );
}
