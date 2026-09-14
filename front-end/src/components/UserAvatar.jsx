import React, { useState } from 'react';

export function getHueFromString(str) {
  if (!str) return 210;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function getInitials(name) {
  if (!name) return 'U';
  const clean = name.trim();
  const parts = clean.split(/[\s_-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  // Check CamelCase (e.g. JohnDoe -> JD)
  const camelMatches = clean.match(/[A-Z]/g);
  if (camelMatches && camelMatches.length >= 2) {
    return (camelMatches[0] + camelMatches[1]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export function getAvatarSrc(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return `${baseUrl}${url}`;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
  '2xl': 'h-24 w-24 text-2xl font-bold',
};

export default function UserAvatar({
  user,
  avatarUrl,
  username,
  userId,
  size = 'md',
  className = '',
}) {
  const [imageError, setImageError] = useState(false);

  const finalAvatarUrl = avatarUrl ?? user?.avatar_url;
  const finalUsername = username ?? user?.username ?? 'User';
  const finalId = userId ?? user?.id ?? finalUsername;

  const src = getAvatarSrc(finalAvatarUrl);
  const hue = getHueFromString(String(finalId));
  const initials = getInitials(finalUsername);
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
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      style={{ backgroundColor: `hsl(${hue}, 65%, 45%)` }}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden text-white font-display font-bold shadow-sm select-none border border-white/20 ${sizeClass} ${className}`}
      title={finalUsername}
    >
      {initials}
    </div>
  );
}
