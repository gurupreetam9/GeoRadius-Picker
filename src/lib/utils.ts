import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function haversineDistance(
  coords1: { lat: number; lng: number },
  coords2: { lat: number; lng: number }
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;

  const R = 6371e3; // Earth's mean radius in meters
  const dLat = toRad(coords2.lat - coords1.lat);
  const dLon = toRad(coords2.lng - coords1.lng);
  const lat1 = toRad(coords1.lat);
  const lat2 = toRad(coords2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export function getPointOnCircle(
    center: {lat: number; lng: number},
    radius: number,
    bearing: number
): {lat: number, lng: number} {
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

    return {
        lat: toDeg(lat2),
        lng: toDeg(lon2)
    };
}
