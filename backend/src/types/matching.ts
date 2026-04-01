export type BloodGroup =
  | 'O-'
  | 'O+'
  | 'A-'
  | 'A+'
  | 'B-'
  | 'B+'
  | 'AB-'
  | 'AB+';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PatientInput {
  bloodGroup: BloodGroup;
  location: LatLng;
}

export interface DonorProfile {
  id: string | number;
  name: string;
  bloodGroup: BloodGroup;
  location: LatLng;
  available: boolean;
  lastDonation: string | Date;
  responseRate?: number; // expected 0.0 - 1.0
}

export interface ScoreBreakdown {
  distanceScore: number;
  availabilityScore: number;
  recencyScore: number;
  responseScore: number;
}

export interface MatchResult {
  donor: DonorProfile;
  distance: number;
  score: number;
  breakdown: ScoreBreakdown;
  explanation: string[];
}
