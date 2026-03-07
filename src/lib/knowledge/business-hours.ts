/**
 * Business Hours - Structured Knowledge Category
 *
 * Converts structured schedule data into natural-language text for RAG embedding.
 * Bilingual output (EN/ES) for Peru + USA markets.
 */

import { z } from 'zod';

// --- Types ---

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export interface DaySchedule {
  open: boolean;
  openTime: string; // "HH:mm" 24h
  closeTime: string;
}

export interface HolidayEntry {
  name: string;
  date: string; // "MM-DD"
  closed: boolean;
  openTime?: string;
  closeTime?: string;
}

export interface BusinessHoursData {
  schedule: Record<DayOfWeek, DaySchedule>;
  holidays: HolidayEntry[];
  timezone?: string;
  notes?: string;
}

// --- Knowledge Categories ---

export type KnowledgeCategory =
  | 'free_text'
  | 'business_hours'
  | 'faqs'
  | 'pricing'
  | 'location_contact'
  | 'policies';

export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  'free_text',
  'business_hours',
  'faqs',
  'pricing',
  'location_contact',
  'policies',
];

// --- Defaults ---

export const DEFAULT_BUSINESS_HOURS: BusinessHoursData = {
  schedule: {
    monday: { open: true, openTime: '09:00', closeTime: '18:00' },
    tuesday: { open: true, openTime: '09:00', closeTime: '18:00' },
    wednesday: { open: true, openTime: '09:00', closeTime: '18:00' },
    thursday: { open: true, openTime: '09:00', closeTime: '18:00' },
    friday: { open: true, openTime: '09:00', closeTime: '18:00' },
    saturday: { open: false, openTime: '09:00', closeTime: '13:00' },
    sunday: { open: false, openTime: '09:00', closeTime: '13:00' },
  },
  holidays: [],
  timezone: 'America/Lima (PET)',
  notes: '',
};

// --- Holiday Presets (Peru + USA) ---

export interface HolidayPreset {
  name: string;
  nameEs: string;
  date: string;
  country: 'PE' | 'US' | 'both';
}

export const HOLIDAY_PRESETS: HolidayPreset[] = [
  // Peru
  { name: "New Year's Day", nameEs: 'Anio Nuevo', date: '01-01', country: 'both' },
  { name: 'Holy Thursday', nameEs: 'Jueves Santo', date: '04-17', country: 'PE' },
  { name: 'Good Friday', nameEs: 'Viernes Santo', date: '04-18', country: 'both' },
  { name: 'Labor Day (Peru)', nameEs: 'Dia del Trabajo', date: '05-01', country: 'PE' },
  { name: 'Inti Raymi / Farmers Day', nameEs: 'Dia del Campesino', date: '06-24', country: 'PE' },
  { name: 'Saints Peter and Paul', nameEs: 'San Pedro y San Pablo', date: '06-29', country: 'PE' },
  { name: 'Fiestas Patrias (Day 1)', nameEs: 'Fiestas Patrias (Dia 1)', date: '07-28', country: 'PE' },
  { name: 'Fiestas Patrias (Day 2)', nameEs: 'Fiestas Patrias (Dia 2)', date: '07-29', country: 'PE' },
  { name: 'Battle of Angamos', nameEs: 'Combate de Angamos', date: '10-08', country: 'PE' },
  { name: 'All Saints Day', nameEs: 'Dia de Todos los Santos', date: '11-01', country: 'PE' },
  { name: 'Immaculate Conception', nameEs: 'Inmaculada Concepcion', date: '12-08', country: 'PE' },
  { name: 'Christmas Day', nameEs: 'Navidad', date: '12-25', country: 'both' },
  // USA
  { name: 'Martin Luther King Jr. Day', nameEs: 'Dia de Martin Luther King Jr.', date: '01-20', country: 'US' },
  { name: "Presidents' Day", nameEs: 'Dia de los Presidentes', date: '02-17', country: 'US' },
  { name: 'Memorial Day', nameEs: 'Dia de los Caidos', date: '05-26', country: 'US' },
  { name: 'Independence Day (USA)', nameEs: 'Dia de la Independencia (USA)', date: '07-04', country: 'US' },
  { name: 'Labor Day (USA)', nameEs: 'Dia del Trabajo (USA)', date: '09-01', country: 'US' },
  { name: 'Thanksgiving', nameEs: 'Dia de Accion de Gracias', date: '11-27', country: 'US' },
];

// --- Zod Validation ---

const dayScheduleSchema = z.object({
  open: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const holidaySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{2}-\d{2}$/),
  closed: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const businessHoursSchema = z.object({
  schedule: z.object({
    monday: dayScheduleSchema,
    tuesday: dayScheduleSchema,
    wednesday: dayScheduleSchema,
    thursday: dayScheduleSchema,
    friday: dayScheduleSchema,
    saturday: dayScheduleSchema,
    sunday: dayScheduleSchema,
  }),
  holidays: z.array(holidaySchema).max(20).default([]),
  timezone: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
});

// --- Composer ---

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday / Lunes',
  tuesday: 'Tuesday / Martes',
  wednesday: 'Wednesday / Miercoles',
  thursday: 'Thursday / Jueves',
  friday: 'Friday / Viernes',
  saturday: 'Saturday / Sabado',
  sunday: 'Sunday / Domingo',
};

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function composeBusinessHoursText(data: BusinessHoursData): string {
  const sections: string[] = [];

  sections.push('BUSINESS HOURS / HORARIO DE ATENCION:');

  for (const day of DAYS_OF_WEEK) {
    const sched = data.schedule[day];
    const label = DAY_LABELS[day];
    if (sched.open) {
      sections.push(
        `- ${label}: ${formatTime12h(sched.openTime)} - ${formatTime12h(sched.closeTime)}`
      );
    } else {
      sections.push(`- ${label}: Closed / Cerrado`);
    }
  }

  if (data.timezone) {
    sections.push(`\nTimezone / Zona horaria: ${data.timezone}`);
  }

  if (data.holidays.length > 0) {
    sections.push('\nHOLIDAYS / DIAS FESTIVOS:');
    for (const h of data.holidays) {
      if (h.closed) {
        sections.push(`- ${h.name}: Closed / Cerrado`);
      } else if (h.openTime && h.closeTime) {
        sections.push(
          `- ${h.name}: ${formatTime12h(h.openTime)} - ${formatTime12h(h.closeTime)}`
        );
      }
    }
  }

  if (data.notes?.trim()) {
    sections.push(`\nAdditional notes / Notas adicionales: ${data.notes.trim()}`);
  }

  return sections.join('\n');
}
