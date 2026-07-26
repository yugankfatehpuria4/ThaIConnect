/**
 * scoring.ts (services)
 * Used by the SOS matching flow — delegates to the canonical utils/scoring.ts
 * so both flows use the same weighted algorithm.
 */
import { calculateDistance } from '../utils/haversine';
import { calculateScore as canonicalScore } from '../utils/scoring';
import { DonorProfile } from '../types/matching';

/**
 * Adapts a raw Mongoose User document (from the SOS flow) into the
 * DonorProfile shape expected by the canonical scoring function.
 */
export const calculateScore = (donor: any, patient: any): number => {
  const pCoords = patient.location?.coordinates;
  const dCoords = donor.location?.coordinates;

  let distanceKm = 100; // default high distance when unknown
  if (
    pCoords && dCoords &&
    pCoords.length >= 2 && dCoords.length >= 2
  ) {
    // MongoDB stores coordinates as [lng, lat]
    distanceKm = calculateDistance(
      pCoords[1], pCoords[0],
      dCoords[1], dCoords[0],
    );
  }

  const donorProfile: DonorProfile = {
    id: String(donor._id || ''),
    name: donor.name || '',
    bloodGroup: donor.bloodGroup,
    location: {
      lat: dCoords?.[1] ?? 0,
      lng: dCoords?.[0] ?? 0,
    },
    available: donor.avail === 'Available',
    lastDonation: donor.lastDonated ?? new Date('2024-01-01'),
    responseRate: typeof donor.score === 'number'
      ? Math.max(0, Math.min(donor.score / 100, 1))
      : 0.5,
  };

  const { score } = canonicalScore(donorProfile, distanceKm);
  // Return as 0-100 scale to match the existing SOS sorting expectation
  return Math.round(score * 100);
};
