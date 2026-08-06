import { Link } from '@/router';

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-2.5">
      <img
        src="/logo.png"
        alt="Cameron Learning"
        className="h-12 w-auto object-contain"
      />
    </Link>
  );
}
