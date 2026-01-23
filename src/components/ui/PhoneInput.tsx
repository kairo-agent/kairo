'use client';

import { useState, useRef, useEffect, useId, useMemo } from 'react';
import { useLocale } from 'next-intl';
import PhoneInputBase, {
  getCountries,
  getCountryCallingCode,
} from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import labelsEs from 'react-phone-number-input/locale/es.json';
import labelsEn from 'react-phone-number-input/locale/en.json';
import 'react-phone-number-input/style.css';
import { cn } from '@/lib/utils';

// Type for locale labels
type Labels = Record<string, string>;

// E.164 format type (e.g., "+51912345678")
export type E164Number = string;

export interface PhoneInputProps {
  label?: string;
  value: E164Number | undefined;
  onChange: (value: E164Number | undefined) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  defaultCountry?: Country;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
}

// ============================================
// Custom Country Select Component
// ============================================

interface CountrySelectProps {
  value: Country | undefined;
  onChange: (country: Country) => void;
  options: { value: Country | undefined; label: string }[];
  disabled?: boolean;
  labels?: Labels;
  searchPlaceholder?: string;
  noResultsText?: string;
}

function CountrySelect({
  value,
  onChange,
  options,
  disabled,
  searchPlaceholder = 'Search country...',
  noResultsText = 'No countries found',
}: CountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get all countries for display
  const countries = useMemo(() => {
    return options
      .filter((option): option is { value: Country; label: string } =>
        option.value !== undefined
      )
      .map(option => ({
        code: option.value,
        name: option.label,
        callingCode: getCountryCallingCode(option.value),
      }));
  }, [options]);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!search.trim()) return countries;
    const searchLower = search.toLowerCase();
    return countries.filter(
      country =>
        country.name.toLowerCase().includes(searchLower) ||
        country.code.toLowerCase().includes(searchLower) ||
        `+${country.callingCode}`.includes(searchLower)
    );
  }, [countries, search]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll to selected country when dropdown opens
  useEffect(() => {
    if (isOpen && value && listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-country="${value}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'center' });
      }
    }
  }, [isOpen, value]);

  const handleSelect = (country: Country) => {
    onChange(country);
    setIsOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
    }
  };

  // Get the Flag component for a country
  const FlagComponent = value ? flags[value] : null;

  return (
    <div ref={containerRef} className="relative">
      {/* Selected Country Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 rounded-l-lg',
          'bg-[var(--bg-tertiary)] border-r border-[var(--border-primary)]',
          'hover:bg-[var(--bg-hover)] transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-primary)]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Flag */}
        <span className="w-6 h-4 rounded-sm overflow-hidden shadow-sm flex-shrink-0">
          {FlagComponent && value ? (
            <FlagComponent title={value} />
          ) : (
            <span className="w-full h-full bg-[var(--bg-secondary)] flex items-center justify-center text-xs">
              🌐
            </span>
          )}
        </span>

        {/* Calling Code */}
        <span className="text-sm font-medium text-[var(--text-primary)] min-w-[3rem]">
          {value ? `+${getCountryCallingCode(value)}` : '---'}
        </span>

        {/* Dropdown Arrow */}
        <svg
          className={cn(
            'w-4 h-4 text-[var(--text-tertiary)] transition-transform',
            isOpen && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 top-full mt-1 z-50',
            'w-72 max-h-80 overflow-hidden',
            'bg-[var(--bg-card)] border border-[var(--border-primary)]',
            'rounded-xl shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-[var(--border-primary)]">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  'w-full pl-9 pr-3 py-2 text-sm',
                  'bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg',
                  'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent'
                )}
              />
            </div>
          </div>

          {/* Country List */}
          <div ref={listRef} className="overflow-y-auto max-h-60 py-1">
            {filteredCountries.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[var(--text-tertiary)] text-center">
                {noResultsText}
              </div>
            ) : (
              filteredCountries.map((country) => {
                const CountryFlag = flags[country.code];
                const isSelected = country.code === value;

                return (
                  <button
                    key={country.code}
                    type="button"
                    data-country={country.code}
                    onClick={() => handleSelect(country.code)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5',
                      'hover:bg-[var(--bg-tertiary)] transition-colors',
                      'focus:outline-none focus:bg-[var(--bg-tertiary)]',
                      isSelected && 'bg-[var(--accent-primary)]/10'
                    )}
                  >
                    {/* Flag */}
                    <span className="w-7 h-5 rounded-sm overflow-hidden shadow-sm flex-shrink-0 border border-[var(--border-secondary)]">
                      {CountryFlag && <CountryFlag title={country.name} />}
                    </span>

                    {/* Country Name */}
                    <span className={cn(
                      'flex-1 text-sm text-left truncate',
                      isSelected ? 'text-[var(--accent-primary)] font-medium' : 'text-[var(--text-primary)]'
                    )}>
                      {country.name}
                    </span>

                    {/* Calling Code */}
                    <span className={cn(
                      'text-sm font-mono',
                      isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                    )}>
                      +{country.callingCode}
                    </span>

                    {/* Check Mark for Selected */}
                    {isSelected && (
                      <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// PhoneInput Component
// ============================================

// i18n configuration for the custom CountrySelect
const i18nConfig = {
  es: {
    labels: labelsEs as Labels,
    searchPlaceholder: 'Buscar país...',
    noResultsText: 'No se encontraron países',
  },
  en: {
    labels: labelsEn as Labels,
    searchPlaceholder: 'Search country...',
    noResultsText: 'No countries found',
  },
};

/**
 * PhoneInput - International phone number input with country selector
 *
 * Uses react-phone-number-input (which uses libphonenumber-js internally)
 * - Custom dropdown with country search and SVG flags
 * - Auto-formats based on selected country
 * - Returns E.164 format (e.g., "+51912345678")
 * - User cannot manually type country code
 * - i18n support: Country names shown in current locale (es/en)
 */
export function PhoneInput({
  label,
  value,
  onChange,
  error,
  helperText,
  placeholder = '999 999 999',
  defaultCountry = 'PE',
  disabled = false,
  required = false,
  className,
  id,
}: PhoneInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const locale = useLocale() as 'es' | 'en';
  const config = i18nConfig[locale] || i18nConfig.es;

  // Create a custom CountrySelect with i18n props
  const LocalizedCountrySelect = useMemo(() => {
    return function LocalizedSelect(props: CountrySelectProps) {
      return (
        <CountrySelect
          {...props}
          searchPlaceholder={config.searchPlaceholder}
          noResultsText={config.noResultsText}
        />
      );
    };
  }, [config.searchPlaceholder, config.noResultsText]);

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
        >
          {label}
          {required && <span className="text-[var(--status-lost)] ml-1">*</span>}
        </label>
      )}
      <div className="phone-input-wrapper">
        <PhoneInputBase
          id={inputId}
          international
          countryCallingCodeEditable={false}
          defaultCountry={defaultCountry}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          labels={config.labels}
          countrySelectComponent={LocalizedCountrySelect}
          flags={flags}
          className={cn(
            'kairo-phone-input',
            error && 'kairo-phone-input--error',
            disabled && 'kairo-phone-input--disabled'
          )}
        />
      </div>
      {(error || helperText) && (
        <p
          className={cn(
            'mt-1.5 text-xs',
            error ? 'text-[var(--status-lost)]' : 'text-[var(--text-tertiary)]'
          )}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
}

export default PhoneInput;
