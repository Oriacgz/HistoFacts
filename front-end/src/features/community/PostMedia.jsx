import { getAvatarSrc } from '../../components/UserAvatar';

// Post media grid: one image or video renders full-width; 2–4 images render in a
// 2-column grid (a 4-image post is a 2×2 grid).
export default function PostMedia({ post }) {
  if (!post.media_type || post.media_type === 'none') return null;

  if (post.media_type === 'video') {
    return (
      <video
        src={getAvatarSrc(post.media_urls?.[0])}
        controls
        className="mt-3 max-h-[500px] w-full rounded-2xl bg-black object-contain"
      />
    );
  }

  const urls = post.media_urls || [];
  if (urls.length === 0) return null;

  return (
    <div
      className={`mt-3 grid gap-0.5 overflow-hidden rounded-2xl ${
        urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
      }`}
    >
      {urls.map((url, i) => (
        <img
          key={url || i}
          src={getAvatarSrc(url)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          style={{ maxHeight: urls.length === 1 ? 500 : 250 }}
        />
      ))}
    </div>
  );
}
