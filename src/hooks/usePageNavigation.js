import { ACCOUNT_SECTIONS } from '../account/navigation';
import { useCallback, useEffect, useState } from 'react';
const PAGES = new Set([
  'home',
  'signin',
  'signup',
  'tracker',
  'chat',
  'bills',
  'plan',
  ...ACCOUNT_SECTIONS.map((section) => section.id),
]);
function currentPage() {
  const page = window.location.hash.replace('#/', '');
  return PAGES.has(page) ? page : 'home';
}
export function usePageNavigation() {
  const [page, setPage] = useState(currentPage);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    let transition;
    function changePage() {
      const nextPage = currentPage();
      clearTimeout(transition);
      if (nextPage === page) {
        setLeaving(false);
        return;
      }
      setLeaving(true);
      transition = setTimeout(() => {
        setPage(nextPage);
        setLeaving(false);
      }, 160);
    }
    window.addEventListener('hashchange', changePage);
    return () => {
      window.removeEventListener('hashchange', changePage);
      clearTimeout(transition);
    };
  }, [page]);
  const navigate = useCallback((nextPage) => {
    if (PAGES.has(nextPage)) window.location.hash = `/${nextPage}`;
  }, []);
  return { page, leaving, navigate };
}
