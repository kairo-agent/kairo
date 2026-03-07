/**
 * Location & Contact - Structured Knowledge Category
 */

import { z } from 'zod';

export interface SocialMediaEntry {
  platform: string;
  url: string;
}

export interface AdditionalLocation {
  name: string;
  address: string;
  phone?: string;
}

export interface LocationContactData {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  socialMedia: SocialMediaEntry[];
  additionalLocations: AdditionalLocation[];
}

export const DEFAULT_LOCATION_CONTACT: LocationContactData = {
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  phone: '',
  email: '',
  website: '',
  socialMedia: [],
  additionalLocations: [],
};

export const SOCIAL_PLATFORMS = [
  'Facebook',
  'Instagram',
  'X (Twitter)',
  'LinkedIn',
  'YouTube',
  'TikTok',
  'WhatsApp',
  'Google Business',
];

const socialMediaSchema = z.object({
  platform: z.string().min(1).max(50),
  url: z.string().min(1).max(500),
});

const additionalLocationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(300),
  phone: z.string().max(30).optional(),
});

export const locationContactSchema = z.object({
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(200).optional(),
  website: z.string().max(300).optional(),
  socialMedia: z.array(socialMediaSchema).max(10),
  additionalLocations: z.array(additionalLocationSchema).max(5),
});

export function composeLocationContactText(data: LocationContactData): string {
  const sections: string[] = [];

  sections.push('LOCATION & CONTACT / UBICACION Y CONTACTO:');

  const addressParts = [data.address, data.city, data.state, data.zipCode, data.country].filter(Boolean);
  if (addressParts.length > 0) {
    sections.push(`Address / Direccion: ${addressParts.join(', ')}`);
  }

  if (data.phone) sections.push(`Phone / Telefono: ${data.phone}`);
  if (data.email) sections.push(`Email: ${data.email}`);
  if (data.website) sections.push(`Website / Sitio web: ${data.website}`);

  if (data.socialMedia.length > 0) {
    sections.push('\nSocial Media / Redes Sociales:');
    for (const sm of data.socialMedia) {
      sections.push(`- ${sm.platform}: ${sm.url}`);
    }
  }

  if (data.additionalLocations.length > 0) {
    sections.push('\nAdditional Locations / Ubicaciones Adicionales:');
    for (const loc of data.additionalLocations) {
      const phone = loc.phone ? ` - Phone: ${loc.phone}` : '';
      sections.push(`- ${loc.name}: ${loc.address}${phone}`);
    }
  }

  return sections.join('\n');
}
