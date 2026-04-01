import { DonorProfile } from '../types/matching';

const mockDonors: DonorProfile[] = [
  {
    id: 1,
    name: 'Rahul',
    bloodGroup: 'O+',
    location: { lat: 28.6139, lng: 77.209 },
    available: true,
    lastDonation: '2024-12-01',
    responseRate: 0.9,
  },
  {
    id: 2,
    name: 'Anjali',
    bloodGroup: 'A+',
    location: { lat: 28.7041, lng: 77.1025 },
    available: true,
    lastDonation: '2025-01-10',
    responseRate: 0.7,
  },
  {
    id: 3,
    name: 'Karan',
    bloodGroup: 'B+',
    location: { lat: 28.5355, lng: 77.391 },
    available: false,
    lastDonation: '2025-02-25',
    responseRate: 0.8,
  },
];

export default mockDonors;
