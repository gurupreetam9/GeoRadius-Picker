"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MapPin, Search, Copy, CheckCircle, Loader2 } from "lucide-react";

import { geocodeAddress } from "@/ai/flows/geocode-address-to-coordinates";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { haversineDistance, getPointOnCircle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "./ui/label";

const DEBOUNCE_DELAY = 500;
const INITIAL_CENTER = { lat: 51.5072, lng: -0.1276 }; // London
const INITIAL_RADIUS = 5000; // 5km in meters
const INITIAL_ZOOM = 10;
const DEEP_LINK_BASE = "myapp://location-picker";

const AddressFormSchema = z.object({
  address: z.string().min(3, "Address must be at least 3 characters long."),
});

type FallbackInfo = {
  lat: number;
  lng: number;
  radius: number;
  url: string;
};

// Re-implement Circle component since it was removed from the library
const Circle = (props: google.maps.CircleOptions) => {
  const map = useMap();
  const [circle, setCircle] = useState<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map) return;
    if (!circle) {
      setCircle(new google.maps.Circle(props));
    } else {
      circle.setOptions(props);
    }
  }, [map, circle, props]);

  useEffect(() => {
    if (circle) {
      circle.setMap(map);
    }
    return () => {
      if (circle) {
        circle.setMap(null);
      }
    };
  }, [map, circle]);

  return null;
};

export function GeoRadiusPicker({ apiKey }: { apiKey: string }) {
  return (
    <APIProvider apiKey={apiKey} libraries={["marker", "geometry"]}>
      <MapContainer />
    </APIProvider>
  );
}

function MapContainer() {
  const [center, setCenter] = useState(INITIAL_CENTER);
  const [radius, setRadius] = useState(INITIAL_RADIUS);
  const [fallbackInfo, setFallbackInfo] = useState<FallbackInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const map = useMap();
  const { toast } = useToast();
  const debouncedRadius = useDebounce(radius, DEBOUNCE_DELAY);

  const form = useForm<z.infer<typeof AddressFormSchema>>({
    resolver: zodResolver(AddressFormSchema),
    defaultValues: { address: "" },
  });
  const {
    formState: { isSubmitting },
  } = form;

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  }, []);

  const handleCenterDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      }
    },
    []
  );

  const radiusHandlePosition = useMemo(
    () => getPointOnCircle(center, radius, 90),
    [center, radius]
  );

  const handleRadiusDrag = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newRadius = haversineDistance(center, {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      });
      setRadius(newRadius);
    }
  }, [center]);

  const handleConfirm = () => {
    const lat = parseFloat(center.lat.toFixed(6));
    const lng = parseFloat(center.lng.toFixed(6));
    const rad = Math.round(radius);
    const deepLinkUrl = `${DEEP_LINK_BASE}?lat=${lat}&lng=${lng}&radius=${rad}`;

    setFallbackInfo({ lat, lng, radius: rad, url: deepLinkUrl });
    window.location.href = deepLinkUrl;
  };

  const handleCopy = async () => {
    if (!fallbackInfo) return;
    try {
      await navigator.clipboard.writeText(fallbackInfo.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Could not copy to clipboard.",
      });
    }
  };

  async function onAddressSubmit(data: z.infer<typeof AddressFormSchema>) {
    try {
      const result = await geocodeAddress({ address: data.address });
      if (result?.latitude && result?.longitude) {
        const newCenter = { lat: result.latitude, lng: result.longitude };
        setCenter(newCenter);
        map?.panTo(newCenter);
        map?.setZoom(14);
        toast({
          title: "Location Found",
          description: `Map centered on ${data.address}.`,
        });
      } else {
        throw new Error("Could not find coordinates for the address.");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Geocoding Error",
        description: "Failed to find the specified address. Please try again.",
      });
    }
  }

  useEffect(() => {
    if (map) {
        map.panTo(center);
    }
  }, [center, map]);

  return (
    <>
      <Map
        defaultCenter={INITIAL_CENTER}
        defaultZoom={INITIAL_ZOOM}
        mapId="a3a71f43477c7c8c"
        onClick={handleMapClick}
        gestureHandling="greedy"
        disableDefaultUI
        className="h-full w-full"
      >
        <AdvancedMarker
          position={center}
          gmpDraggable
          onDragEnd={handleCenterDragEnd}
        >
          <MapPin className="h-8 w-8 text-primary-foreground fill-primary" />
        </AdvancedMarker>

        <AdvancedMarker
            position={radiusHandlePosition}
            gmpDraggable
            onDrag={handleRadiusDrag}
            onDragEnd={handleRadiusDrag}
        >
            <div className="h-4 w-4 rounded-full bg-primary-foreground border-2 border-primary shadow-lg cursor-grab active:cursor-grabbing"></div>
        </AdvancedMarker>

        <Circle
          center={center}
          radius={debouncedRadius}
          strokeColor="hsl(var(--primary))"
          strokeOpacity={0.8}
          strokeWeight={2}
          fillColor="hsl(var(--primary))"
          fillOpacity={0.2}
        />
      </Map>

      <Card className="absolute bottom-4 left-4 right-4 z-10 w-auto max-w-lg mx-auto shadow-2xl">
        <Tabs defaultValue="location">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="location">Location & Radius</TabsTrigger>
            <TabsTrigger value="search">Search Address</TabsTrigger>
          </TabsList>
          <TabsContent value="location">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Latitude</Label>
                  <p className="font-mono">{center.lat.toFixed(6)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Longitude</Label>
                  <p className="font-mono">{center.lng.toFixed(6)}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-baseline">
                  <Label htmlFor="radius-slider" className="text-xs text-muted-foreground">Radius</Label>
                  <p className="font-mono text-sm">
                    {(radius / 1000).toFixed(2)} km
                  </p>
                </div>
                <Slider
                  id="radius-slider"
                  value={[radius]}
                  onValueChange={(value) => setRadius(value[0])}
                  min={100}
                  max={50000}
                  step={100}
                  className="mt-2"
                />
              </div>

              <Button onClick={handleConfirm} className="w-full">
                Confirm Location
              </Button>
            </CardContent>
          </TabsContent>
          <TabsContent value="search">
            <CardContent className="pt-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onAddressSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input placeholder="e.g., 1600 Amphitheatre Parkway" {...field} />
                          </FormControl>
                           <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Search />}
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
      
      <AlertDialog open={!!fallbackInfo} onOpenChange={(open) => !open && setFallbackInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm in App</AlertDialogTitle>
            <AlertDialogDescription>
              If your app did not open, the deep link may not be configured or the app is not installed. You can manually copy the link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 space-y-2">
            <h3 className="font-semibold">Selected Location:</h3>
            <p className="text-sm"><span className="text-muted-foreground">Lat:</span> {fallbackInfo?.lat}</p>
            <p className="text-sm"><span className="text-muted-foreground">Lng:</span> {fallbackInfo?.lng}</p>
            <p className="text-sm"><span className="text-muted-foreground">Radius:</span> {fallbackInfo?.radius}m</p>
            <div className="mt-4">
                <Label htmlFor="deeplink" className="font-semibold">Deep Link URL:</Label>
                <div className="flex items-center gap-2 mt-1">
                    <Input id="deeplink" readOnly value={fallbackInfo?.url} className="text-xs" />
                    <Button variant="outline" size="icon" onClick={handleCopy}>
                        {copied ? <CheckCircle className="text-green-500" /> : <Copy />}
                    </Button>
                </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setFallbackInfo(null)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
