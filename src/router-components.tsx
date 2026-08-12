import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { RouterContext, useRouter } from './router-context';

function getQuery(): URLSearchParams {
  return new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
}

function isExternalDestination(to: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(to);
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [query, setQuery] = useState<URLSearchParams>(getQuery);

  useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname);
      setQuery(getQuery());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (isExternalDestination(to)) {
      if (opts?.replace) window.location.replace(to);
      else window.location.assign(to);
      return;
    }
    if (opts?.replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }
    setPath(window.location.pathname);
    setQuery(getQuery());
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  return (
    <RouterContext.Provider value={{ path, query, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function Link({
  to,
  className,
  children,
  onClick,
  ...rest
}: {
  to: string;
  className?: string;
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>) {
  const { navigate } = useRouter();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onClick) onClick(e);
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (isExternalDestination(to)) return;
      e.preventDefault();
      navigate(to);
    },
    [navigate, to, onClick]
  );

  return (
    <a href={to} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
