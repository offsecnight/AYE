import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me";

/** Haversine distance in metres */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface GpsCheckResult {
  valid: boolean;
  distance_meters: number;
  gps_token?: string; // short-lived proof token valid for 10 min
}

/**
 * Validate that the given coordinates are within the college geofence.
 * Returns a signed GPS proof token on success, used during registration.
 */
export function verifyGpsProximity(
  userLat: number,
  userLng: number,
  collegeLat: number,
  collegeLng: number,
  radiusMeters: number,
  college_id: string
): GpsCheckResult {
  const dist = haversine(userLat, userLng, collegeLat, collegeLng);
  const valid = dist <= radiusMeters;

  if (!valid) return { valid: false, distance_meters: Math.round(dist) };

  const gps_token = jwt.sign(
    { type: "GPS_PROOF", college_id },
    JWT_SECRET,
    { expiresIn: "10m" }
  );

  return { valid: true, distance_meters: Math.round(dist), gps_token };
}

/** Verify a GPS proof token (used during registration step) */
export function verifyGpsToken(token: string): { college_id: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { type: string; college_id: string };
    if (payload.type !== "GPS_PROOF") return null;
    return { college_id: payload.college_id };
  } catch {
    return null;
  }
}
