import { calculateDistance } from '../utils/haversine';

export const calculateScore = (donor: any, patient: any): number => {
  let score = 0;

  let distance = 0;
  const pCoords = patient.location?.coordinates;
  const dCoords = donor.location?.coordinates;

  if (pCoords && dCoords && pCoords.length >= 2 && dCoords.length >= 2) {
    // coordinates are [lng, lat]
    distance = calculateDistance(pCoords[1], pCoords[0], dCoords[1], dCoords[0]);
  } else {
    // Provide a default high distance if unknown
    distance = 100;
  }

  // distance score (lower = better)
  score += (1 / (distance + 1)) * 40;

  // donation count
  score += (donor.donationsCount || 0) * 2;

  // response rate. User.score might be up to 100, normalize string/number logic
  const responseRate = Math.max(0, Math.min((donor.score || 0) / 100, 1));
  score += responseRate * 25;

  // availability
  if (donor.avail === "Available") score += 10;

  return score;
};
