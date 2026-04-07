/**
 * User profile type
 *
 * Stored locally. No authentication — single-user app.
 */

import { FormalityLevel } from './wardrobe';

export interface UserProfile {
  id: string;
  location: string;
  units: 'metric' | 'imperial';
  stylePreference: FormalityLevel | 'mixed';
  permissions: {
    location: boolean;
    calendar: boolean;
    camera: boolean;
  };
  onboardingComplete: boolean;
}
