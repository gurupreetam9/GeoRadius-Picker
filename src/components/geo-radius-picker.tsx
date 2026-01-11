"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Map, { Marker, Source, Layer, MapRef, ViewState } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Search, Copy, CheckCircle, Loader2, Locate } from "lucide-react";

import { geocodeAddress } from "@/ai/flows/geocode-address-to-coordinates";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "./ui/label";

// Turf.js helpers for geo calculations
function destination(center: [number, number], radius: number, bearing: number): [number, number] {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const toDeg = (rad: number) => rad * (180 / Math.PI);

  const [lon1, lat1] = center;
  const lat1Rad = toRad(lat1);
  const lon1Rad = toRad(lon1);
  const brng = toRad(bearing);
  const ad = radius / R;

  const lat2Rad = Math.asin(Math.sin(lat1Rad) * Math.cos(ad) + Math.cos(lat1Rad) * Math.sin(ad) * Math.cos(brng));
  const lon2Rad = lon1Rad + Math.atan2(Math.sin(brng) * Math.sin(ad) * Math.cos(lat1Rad), Math.cos(ad) - Math.sin(lat1Rad) * Math.sin(lat2Rad));
  
  return [toDeg(lon2Rad), toDeg(lat2Rad)];
}

function createGeoJSONCircle(center: [number, number], radius: number, points = 64) {
    const coords = {
        latitude: center[1],
        longitude: center[0]
    };

    const km = radius / 1000;
    const ret = [];
    const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
    const distanceY = km / 110.574;

    let theta, x, y;
    for (let i = 0; i < points; i++) {
        theta = (i / points) * (2 * Math.PI);
        x = distanceX * Math.cos(theta);
        y = distanceY * Math.sin(theta);

        ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]);

    return {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [ret]
                }
            }]
        }
    };
}


const INITIAL_VIEW_STATE = {
  longitude: -0.1276,
  latitude: 51.5072,
  zoom: 10,
  pitch: 0,
  bearing: 0,
};
const INITIAL_RADIUS = 5000; // 5km in meters
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

const circleLayer: Layer = {
    id: 'radius-circle',
    type: 'fill',
    source: 'radius-circle',
    paint: {
        'fill-color': 'hsl(var(--primary))',
        'fill-opacity': 0.2
    }
};

const circleOutlineLayer: Layer = {
    id: 'radius-circle-outline',
    type: 'line',
    source: 'radius-circle',
    paint: {
        'line-color': 'hsl(var(--primary))',
        'line-width': 2
    }
}

export function GeoRadiusPicker() {
  const [viewState, setViewState] = useState<Partial<ViewState>>(INITIAL_VIEW_STATE);
  const [center, setCenter] = useState([INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude]);
  const [radius, setRadius] = useState(INITIAL_RADIUS);
  const [fallbackInfo, setFallbackInfo] = useState<FallbackInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isRadiusDragging, setIsRadiusDragging] = useState(false);

  const mapRef = useRef<MapRef | null>(null);

  const { toast } = useToast();

  const form = useForm<z.infer<typeof AddressFormSchema>>({
    resolver: zodResolver(AddressFormSchema),
    defaultValues: { address: "" },
  });
  const { formState: { isSubmitting } } = form;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const locateUser = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLngLat: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserLocation(userLngLat);
          setCenter(userLngLat);
          mapRef.current?.flyTo({ center: userLngLat, zoom: 13 });
        },
        () => {
          toast({
            variant: "destructive",
            title: "Location Error",
            description: "Could not access your location. Please enable location services.",
          });
          mapRef.current?.flyTo({ center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude], zoom: INITIAL_VIEW_STATE.zoom });
        }
      );
    } else {
      mapRef.current?.flyTo({ center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude], zoom: INITIAL_VIEW_STATE.zoom });
    }
  }, [toast]);
  
  useEffect(() => {
    if(mapRef.current) {
        locateUser();
    }
  }, [locateUser, mapRef.current]);

  const circleSource = useMemo(() => createGeoJSONCircle(center as [number, number], radius), [center, radius]);
  const handlePosition = useMemo(() => destination(center as [number, number], radius, 90), [center, radius]);

  const onCenterDrag = (e: { lngLat: { lng: number; lat: number; }}) => {
    setCenter([e.lngLat.lng, e.lngLat.lat]);
  };

  const onRadiusDrag = (e: { lngLat: { lng: number, lat: number }}) => {
    const from = center;
    const to = [e.lngLat.lng, e.lngLat.lat];
    const newRadius = mapRef.current?.getMap().project(from).dist(mapRef.current?.getMap().project(to));
    if(newRadius) {
       setRadius(newRadius);
    }
  };

  const handleConfirm = () => {
    const lng = parseFloat(center[0].toFixed(6));
    const lat = parseFloat(center[1].toFixed(6));
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
        const newCenter: [number, number] = [result.longitude, result.latitude];
        setCenter(newCenter);
        mapRef.current?.flyTo({ center: newCenter, zoom: 14 });
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

  const handleRecenter = () => {
    if (userLocation) {
        setCenter(userLocation);
        mapRef.current?.flyTo({ center: userLocation, zoom: 13 });
        toast({
            title: "Re-centered",
            description: "Map centered on your current location.",
        });
    } else {
        locateUser(); 
    }
  };

  if (!isMounted) {
     return <div className="h-full w-full flex items-center justify-center"><p>Loading Map...</p></div>;
  }

  return (
    <>
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={INITIAL_VIEW_STATE}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={(e) => {
          if (!isRadiusDragging) {
             setCenter([e.lngLat.lng, e.lngLat.lat]);
          }
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL"
      >
        <Source id="radius-circle" {...circleSource}>
            <Layer {...circleLayer} />
            <Layer {...circleOutlineLayer} />
        </Source>

        <Marker
            longitude={center[0]}
            latitude={center[1]}
            draggable
            onDrag={onCenterDrag}
            onDragEnd={onCenterDrag}
            anchor="bottom"
        >
            <div className="cursor-pointer">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="#7B2CBF" stroke="white" strokeWidth="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/><circle cx="12" cy="9.5" r="2.5" fill="white" /></svg>
            </div>
        </Marker>

        <Marker
            longitude={handlePosition[0]}
            latitude={handlePosition[1]}
            draggable
            onDragStart={() => setIsRadiusDragging(true)}
            onDrag={onRadiusDrag}
            onDragEnd={(e) => {
              onRadiusDrag(e);
              setIsRadiusDragging(false);
            }}
        >
            <div className="cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="white" stroke="#7B2CBF" strokeWidth="2"/></svg>
            </div>
        </Marker>
      </Map>
      
      <Button
        variant="outline"
        size="icon"
        onClick={handleRecenter}
        className="absolute top-4 right-4 z-[1000] bg-background/80 backdrop-blur-sm"
        aria-label="Recenter map to your location"
      >
        <Locate />
      </Button>

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
                  <p className="font-mono">{center[1].toFixed(6)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Longitude</Label>
                  <p className="font-mono">{center[0].toFixed(6)}</p>
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
