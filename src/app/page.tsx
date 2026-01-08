'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const GeoRadiusPicker = dynamic(() => import('@/components/geo-radius-picker').then(mod => mod.GeoRadiusPicker), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center"><p>Loading Map...</p></div>
});

export default function Home() {
  return (
    <main className="relative h-[100svh] w-screen overflow-hidden bg-background">
      <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><p>Loading Map...</p></div>}>
        <GeoRadiusPicker />
      </Suspense>
    </main>
  );
}
