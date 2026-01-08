"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import L from "leaflet";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MapPin, Search, Copy, CheckCircle, Loader2 } from "lucide-react";

import { geocodeAddress } from "@/ai/flows/geocode-address-to-coordinates";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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

const INITIAL_CENTER: L.LatLngExpression = [51.5072, -0.1276]; // London
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

// Custom icon for the markers
const markerIcon = new L.Icon({
    iconUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="%237B2CBF" stroke="white" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/><circle cx="12" cy="9.5" r="2.5" fill="white" /></svg>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

const radiusHandleIcon = new L.Icon({
    iconUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="white" stroke="%237B2CBF" stroke-width="2"/></svg>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

function getPointOnCircle(center: L.LatLng, radius: number, bearing: number): L.LatLng {
    const R = 6371e3; // Earth's radius in meters
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const toDeg = (rad: number) => rad * (180 / Math.PI);

    const lat1 = toRad(center.lat);
    const lon1 = toRad(center.lng);
    const brng = toRad(bearing);

    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(radius / R) +
        Math.cos(lat1) * Math.sin(radius / R) * Math.cos(brng)
    );

    const lon2 =
        lon1 +
        Math.atan2(
            Math.sin(brng) * Math.sin(radius / R) * Math.cos(lat1),
            Math.cos(radius / R) - Math.sin(lat1) * Math.sin(lat2)
        );

    return L.latLng(toDeg(lat2), toDeg(lon2));
}

export function GeoRadiusPicker() {
  const [center, setCenter] = useState(L.latLng(INITIAL_CENTER[0], INITIAL_CENTER[1]));
  const [radius, setRadius] = useState(INITIAL_RADIUS);
  const [fallbackInfo, setFallbackInfo] = useState<FallbackInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const radiusMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const isDraggingRadiusRef = useRef(false);

  const { toast } = useToast();

  const form = useForm<z.infer<typeof AddressFormSchema>>({
    resolver: zodResolver(AddressFormSchema),
    defaultValues: { address: "" },
  });
  const {
    formState: { isSubmitting },
  } = form;

  useEffect(() => {
    setIsMounted(true);
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    }
  }, []);
  
  // Initialize map
  useEffect(() => {
    if (isMounted && mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: center,
        zoom: INITIAL_ZOOM,
        scrollWheelZoom: true,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      mapRef.current = map;

      // Get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
            setCenter(userLatLng);
            map.setView(userLatLng, 13);
          },
          () => {
            // User denied permission or error occurred
            map.setView(INITIAL_CENTER, INITIAL_ZOOM);
          }
        );
      } else {
        // Geolocation not supported
        map.setView(INITIAL_CENTER, INITIAL_ZOOM);
      }
      
      map.on('click', (e) => {
        if (!isDraggingRadiusRef.current) {
          setCenter(e.latlng);
        }
      });
    }
  }, [isMounted, center]);

  // Update markers and circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMounted) return;
  
    // Center Marker
    if (!centerMarkerRef.current) {
      centerMarkerRef.current = L.marker(center, { draggable: true, icon: markerIcon }).addTo(map);
      centerMarkerRef.current.on('dragend', () => {
        if (centerMarkerRef.current) {
          setCenter(centerMarkerRef.current.getLatLng());
        }
      });
    } else {
      centerMarkerRef.current.setLatLng(center);
    }
  
    // Radius Circle
    if (!circleRef.current) {
      circleRef.current = L.circle(center, {
        radius: radius,
        color: 'hsl(var(--primary))',
        fillColor: 'hsl(var(--primary))',
        fillOpacity: 0.2,
        weight: 2
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(center);
      circleRef.current.setRadius(radius);
    }
  
    // Radius Handle Marker
    if (!radiusMarkerRef.current) {
      const handlePosition = getPointOnCircle(center, radius, 90);
      radiusMarkerRef.current = L.marker(handlePosition, { draggable: true, icon: radiusHandleIcon }).addTo(map);
      
      radiusMarkerRef.current.on('dragstart', () => {
        isDraggingRadiusRef.current = true;
      });
      
      radiusMarkerRef.current.on('drag', () => {
        if (radiusMarkerRef.current && centerMarkerRef.current && circleRef.current) {
          const centerPoint = centerMarkerRef.current.getLatLng();
          const handlePoint = radiusMarkerRef.current.getLatLng();
          const newRadius = centerPoint.distanceTo(handlePoint);
          setRadius(newRadius);
          circleRef.current.setRadius(newRadius); // Update circle radius in real-time
        }
      });

      radiusMarkerRef.current.on('dragend', () => {
        isDraggingRadiusRef.current = false;
      });

    } else {
       if (!isDraggingRadiusRef.current) {
         const handlePosition = getPointOnCircle(center, radius, 90);
         radiusMarkerRef.current.setLatLng(handlePosition);
       }
    }
  
  }, [center, radius, isMounted]);


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
        const newCenter = L.latLng(result.latitude, result.longitude);
        setCenter(newCenter);
        mapRef.current?.setView(newCenter, 14);
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
    if (mapRef.current) {
        mapRef.current.panTo(center);
    }
  }, [center]);

  if (!isMounted) {
     return <div className="h-full w-full flex items-center justify-center"><p>Loading Map...</p></div>;
  }

  return (
    <>
      <div ref={mapContainerRef} className="h-full w-full" />
      
      <Card className="absolute bottom-4 left-4 right-4 z-[1000] w-auto max-w-lg mx-auto shadow-2xl">
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
