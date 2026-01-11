// ============================================
// KAIRO - Mock Companies Data
// ============================================

import { Company, CompanyPlan } from '@/types';

export const companies: Company[] = [
  {
    id: 'company-001',
    name: 'TechCorp SAC',
    slug: 'techcorp-sac',
    logoUrl: '/logos/techcorp.png',
    plan: CompanyPlan.PROFESSIONAL,
    defaultCurrency: 'PEN',
    supportedCurrencies: ['PEN', 'USD'],
    exchangeRates: {
      'USD_PEN': 3.72,
      'PEN_USD': 0.27,
    },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-12-20'),
  },
];

// Helper to get company by ID
export const getCompanyById = (id: string): Company | undefined => {
  return companies.find((company) => company.id === id);
};

// Default company for the MVP
export const defaultCompany = companies[0];
