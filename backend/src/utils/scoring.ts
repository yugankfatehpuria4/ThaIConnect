import { DonorProfile, ScoreBreakdown } from '../types/matching';

function normalizeDistance(distanceKm: number): number {
  return Math.max(0, 1 - distanceKm / 50); // 50 km max radius
}

function getAvailabilityScore(isAvailable: boolean): number {
  return isAvailable ? 1 : 0;
}

function getRecencyScore(lastDonationDate: string | Date): number {
  const donatedAt = new Date(lastDonationDate);
  if (Number.isNaN(donatedAt.getTime())) {
    return 0.5;
  }

  const daysSinceLastDonation =
    (Date.now() - donatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.min(daysSinceLastDonation / 90, 1);
}

function normalizeResponseRate(responseRate?: number): number {
  if (typeof responseRate !== 'number' || Number.isNaN(responseRate)) return 0.5;
  return Math.max(0, Math.min(responseRate, 1));
}

export function calculateScore(
  donor: DonorProfile,
  distanceKm: number
): { score: number; breakdown: ScoreBreakdown } {
  const distanceScore = normalizeDistance(distanceKm);
  const availabilityScore = getAvailabilityScore(donor.available);
  const recencyScore = getRecencyScore(donor.lastDonation);
  const responseScore = normalizeResponseRate(donor.responseRate);

  const finalScore =
    distanceScore * 0.4 +
    availabilityScore * 0.3 +
    recencyScore * 0.2 +
    responseScore * 0.1;

  return {
    score: Number(finalScore.toFixed(4)),
    breakdown: {
      distanceScore: Number(distanceScore.toFixed(4)),
      availabilityScore: Number(availabilityScore.toFixed(4)),
      recencyScore: Number(recencyScore.toFixed(4)),
      responseScore: Number(responseScore.toFixed(4)),
    },
  };
}
