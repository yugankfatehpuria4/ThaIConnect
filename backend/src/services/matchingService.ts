import { isCompatible } from '../utils/bloodCompatibility';
import { calculateDistance } from '../utils/haversine';
import { calculateScore } from '../utils/scoring';
import { DonorProfile, MatchResult, PatientInput } from '../types/matching';

function buildExplanation(distanceKm: number, donor: DonorProfile): string[] {
  const reasons: string[] = [];

  reasons.push(`Compatible blood group: ${donor.bloodGroup}`);
  reasons.push(`Distance: ${distanceKm.toFixed(2)} km from patient`);

  if (donor.available) {
    reasons.push('Currently available for donation');
  } else {
    reasons.push('Currently marked unavailable');
  }

  const responseRate = donor.responseRate ?? 0.5;
  reasons.push(`Historical response rate: ${(responseRate * 100).toFixed(0)}%`);

  return reasons;
}

export function matchDonors(patient: PatientInput, donors: DonorProfile[]): MatchResult[] {
  const results: MatchResult[] = [];

  for (const donor of donors) {
    if (!isCompatible(donor.bloodGroup, patient.bloodGroup)) continue;

    const distance = calculateDistance(
      patient.location.lat,
      patient.location.lng,
      donor.location.lat,
      donor.location.lng
    );

    if (distance > 50) continue;

    const { score, breakdown } = calculateScore(donor, distance);

    results.push({
      donor,
      distance: Number(distance.toFixed(2)),
      score,
      breakdown,
      explanation: buildExplanation(distance, donor),
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
