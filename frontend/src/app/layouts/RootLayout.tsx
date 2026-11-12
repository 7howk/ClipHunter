import { Outlet, ScrollRestoration } from 'react-router';

import { SiteFooter } from '@/widgets/site-footer';

export function RootLayout() {
  return (
    <>
      <Outlet />
      <SiteFooter />
      <ScrollRestoration />
    </>
  );
}
