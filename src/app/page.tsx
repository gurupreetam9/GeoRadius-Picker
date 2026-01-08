import { GeoRadiusPicker } from '@/components/geo-radius-picker';
import { Suspense } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Home() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
           <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Configuration Error</AlertTitle>
              <AlertDescription>
                <p className="mb-2">The Google Maps API key is missing. Please add it to your environment variables to use the map.</p>
                <p>Create a <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">.env.local</code> file in the root of your project and add:</p>
                <code className="block font-mono bg-muted px-2 py-1 rounded-sm mt-2 text-sm">
                  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_API_KEY"
                </code>
              </AlertDescription>
            </Alert>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-[100svh] w-screen overflow-hidden bg-background">
      <Suspense fallback={<div className="h-full w-full flex items-center justify-center"><p>Loading Map...</p></div>}>
        <GeoRadiusPicker apiKey={apiKey} />
      </Suspense>
    </main>
  );
}
