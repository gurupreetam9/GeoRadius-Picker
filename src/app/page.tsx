import { GeoRadiusPicker } from '@/components/geo-radius-picker';
import { Suspense } from 'react';

export default function Home() {
  return (
    <main className="relative h-[100svh] w-screen overflow-hidden bg-background">
      <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><p>Loading Map...</p></div>}>
        <GeoRadiusPicker />
      </Suspense>
    </main>
  );
}
