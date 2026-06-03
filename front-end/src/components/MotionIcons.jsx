import { motion } from 'framer-motion';

const iconMotion = {
  initial: false,
  whileHover: { scale: 1.08, rotate: 4 },
  whileTap: { scale: 0.95 },
  transition: { type: 'spring', stiffness: 380, damping: 18 },
};

function BaseIcon({ children, className = 'h-6 w-6', label, viewBox = '0 0 24 24' }) {
  return (
    <motion.svg
      {...iconMotion}
      viewBox={viewBox}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </motion.svg>
  );
}

export function UserIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.5c1.7-3.2 4.4-4.8 6.5-4.8s4.8 1.6 6.5 4.8" />
    </BaseIcon>
  );
}

export function BulbIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a5.5 5.5 0 0 0-3.2 9.9c.6.5 1.2 1.3 1.4 2.1h3.6c.2-.8.8-1.6 1.4-2.1A5.5 5.5 0 0 0 12 3Z" />
    </BaseIcon>
  );
}

export function HeartIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M12 20s-6.5-3.9-8.4-8.2C2.1 8.5 4.1 5.5 7.2 5.5c1.7 0 3 1 3.8 2.2.8-1.2 2.1-2.2 3.8-2.2 3.1 0 5.1 3 3.6 6.3C18.5 16.1 12 20 12 20Z" />
    </BaseIcon>
  );
}

export function BookmarkIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M8 4.8h8a1 1 0 0 1 1 1V20l-5-3-5 3V5.8a1 1 0 0 1 1-1Z" />
    </BaseIcon>
  );
}

export function CogIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M16.4 7.6l1.4-1.4M6.2 17.8l1.4-1.4" />
    </BaseIcon>
  );
}

export function BellIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M6.5 17h11l-.8-1.2a6.2 6.2 0 0 1-.9-3.3V11a3.8 3.8 0 1 0-7.6 0v1.5c0 1.2-.3 2.3-.9 3.3L6.5 17Z" />
      <path d="M10.2 18.8a1.8 1.8 0 0 0 3.6 0" />
    </BaseIcon>
  );
}

export function BookOpenIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M12 6.2v13" />
      <path d="M12 6.2c-1.4-1-3.2-1.5-5-1.5H5.5v12.7H7c1.8 0 3.6.5 5 1.5" />
      <path d="M12 6.2c1.4-1 3.2-1.5 5-1.5h1.5v12.7H17c-1.8 0-3.6.5-5 1.5" />
    </BaseIcon>
  );
}

export function CalendarIcon(props) {
  return (
    <BaseIcon {...props}>
      <rect x="4.5" y="5" width="15" height="14.5" rx="2" />
      <path d="M4.5 9.2h15M8 3.8v3.4M16 3.8v3.4M8 12h.01M12 12h.01M16 12h.01M8 15.4h.01M12 15.4h.01" />
    </BaseIcon>
  );
}

export function FilterIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M5 6h14l-5.5 6v5l-3 1v-6L5 6Z" />
    </BaseIcon>
  );
}

export function SearchIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="11" cy="11" r="5.2" />
      <path d="M15 15l4 4" />
    </BaseIcon>
  );
}

export function TimeIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 8v4l3 2" />
    </BaseIcon>
  );
}

export function CrownIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 8l3 3 4.5-5 4.5 5 3-3-1.2 9H5.7L4.5 8Z" />
      <path d="M6.2 17h11.6" />
    </BaseIcon>
  );
}

export function ChevronLeftIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M14.5 5.5 8.5 12l6 6.5" />
    </BaseIcon>
  );
}

export function RightArrowIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M6 12h10" />
      <path d="M12 7l5 5-5 5" />
    </BaseIcon>
  );
}

export function CheckCircleIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="m8.7 12.1 2.3 2.3 4.4-4.8" />
    </BaseIcon>
  );
}

export function XCircleIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </BaseIcon>
  );
}

export function FacebookIcon(props) {
  return (
    <BaseIcon {...props} viewBox="0 0 24 24">
      <path d="M14 8.3h2V5.5h-2.3c-2.4 0-4 1.6-4 4V12H8v3h1.7v5h3v-5h2.4l.4-3h-2.8v-1.9c0-.6.5-1 1.3-1Z" />
    </BaseIcon>
  );
}

export function GoogleIcon(props) {
  return (
    <BaseIcon {...props} viewBox="0 0 24 24">
      <path d="M20.5 12.2c0-.6 0-1.1-.1-1.5H12v3h4.8c-.2 1.1-.9 2-1.8 2.6v2.2h2.9c1.7-1.6 2.6-3.8 2.6-6.3Z" />
      <path d="M12 21c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.8-3.1.8-2.4 0-4.5-1.6-5.2-3.8H3.7v2.4A9 9 0 0 0 12 21Z" />
      <path d="M6.8 13.6A5.4 5.4 0 0 1 6.5 12c0-.6.1-1.1.3-1.6V8H3.7A9 9 0 0 0 3 12c0 1.4.3 2.7.8 3.8l3-2.2Z" />
      <path d="M12 6.5c1.3 0 2.5.5 3.4 1.3l2.5-2.5A9 9 0 0 0 12 3c-3.5 0-6.6 2-8.2 5l3.1 2.4C7.4 8 9.4 6.5 12 6.5Z" />
    </BaseIcon>
  );
}
