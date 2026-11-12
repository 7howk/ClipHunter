import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { ClosingCta } from './ClosingCta';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { Principles } from './Principles';
import { ResultPreview } from './ResultPreview';

export function LandingPage() {
  const { hash } = useLocation();

  // React Router не прокручивает к якорю сам — делаем это при смене hash
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <main>
      <Hero />
      <HowItWorks />
      <ResultPreview />
      <Principles />
      <ClosingCta />
    </main>
  );
}
