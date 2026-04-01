'use client';

import { useState, useCallback } from 'react';
import type {
  LocationContactData,
  SocialMediaEntry,
  AdditionalLocation,
} from '@/lib/knowledge/location-contact';
import { SOCIAL_PLATFORMS } from '@/lib/knowledge/location-contact';

// =============================================================================
// Types
// =============================================================================

interface LocationContactFormProps {
  data: LocationContactData;
  onSave: (data: LocationContactData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

// =============================================================================
// Labels (hardcoded until i18n is added)
// =============================================================================

const labels = {
  save: 'Guardar',
  cancel: 'Cancelar',
  saving: 'Guardando...',
  remove: 'Quitar',
  // Address section
  addressSection: 'Direccion',
  address: 'Direccion',
  addressPlaceholder: 'Av. Principal 123',
  city: 'Ciudad',
  cityPlaceholder: 'Lima',
  state: 'Estado / Region',
  statePlaceholder: 'Lima',
  zipCode: 'Codigo postal',
  zipPlaceholder: '15001',
  country: 'Pais',
  countryPlaceholder: 'Peru',
  // Contact section
  contactSection: 'Contacto',
  phone: 'Telefono',
  phonePlaceholder: '+51 912 345 678',
  email: 'Correo electronico',
  emailPlaceholder: 'contacto@empresa.com',
  website: 'Sitio web',
  websitePlaceholder: 'https://www.empresa.com',
  // Social media section
  socialSection: 'Redes Sociales',
  addSocial: 'Agregar red social',
  socialPlatform: 'Plataforma',
  socialUrl: 'URL / Enlace',
  socialUrlPlaceholder: 'https://...',
  maxSocial: 'Maximo 10 redes sociales',
  // Additional locations section
  locationsSection: 'Ubicaciones Adicionales',
  addLocation: 'Agregar ubicacion',
  locationName: 'Nombre de la sede',
  locationNamePlaceholder: 'Sucursal Centro',
  locationAddress: 'Direccion',
  locationAddressPlaceholder: 'Av. Secundaria 456',
  locationPhone: 'Telefono (opcional)',
  locationPhonePlaceholder: '+51 912 345 678',
  maxLocations: 'Maximo 5 ubicaciones',
};

const MAX_SOCIAL = 10;
const MAX_LOCATIONS = 5;

// =============================================================================
// Shared Styles
// =============================================================================

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-sm';

const selectClass =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent text-sm appearance-none cursor-pointer';

// =============================================================================
// Component
// =============================================================================

export function LocationContactForm({
  data,
  onSave,
  onCancel,
  isSaving,
}: LocationContactFormProps) {
  const [formData, setFormData] = useState<LocationContactData>(() => ({
    ...data,
    socialMedia: [...data.socialMedia],
    additionalLocations: [...data.additionalLocations],
  }));

  // --- Simple field updater ---

  const updateField = useCallback(
    (field: keyof LocationContactData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // --- Social media handlers ---

  const addSocial = useCallback(() => {
    setFormData((prev) => {
      if (prev.socialMedia.length >= MAX_SOCIAL) return prev;
      return {
        ...prev,
        socialMedia: [...prev.socialMedia, { platform: SOCIAL_PLATFORMS[0], url: '' }],
      };
    });
  }, []);

  const removeSocial = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      socialMedia: prev.socialMedia.filter((_, i) => i !== index),
    }));
  }, []);

  const updateSocial = useCallback(
    (index: number, field: keyof SocialMediaEntry, value: string) => {
      setFormData((prev) => {
        const updated = [...prev.socialMedia];
        updated[index] = { ...updated[index], [field]: value };
        return { ...prev, socialMedia: updated };
      });
    },
    []
  );

  // --- Additional locations handlers ---

  const addLocation = useCallback(() => {
    setFormData((prev) => {
      if (prev.additionalLocations.length >= MAX_LOCATIONS) return prev;
      return {
        ...prev,
        additionalLocations: [
          ...prev.additionalLocations,
          { name: '', address: '', phone: '' },
        ],
      };
    });
  }, []);

  const removeLocation = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      additionalLocations: prev.additionalLocations.filter(
        (_, i) => i !== index
      ),
    }));
  }, []);

  const updateLocation = useCallback(
    (index: number, field: keyof AdditionalLocation, value: string) => {
      setFormData((prev) => {
        const updated = [...prev.additionalLocations];
        updated[index] = { ...updated[index], [field]: value };
        return { ...prev, additionalLocations: updated };
      });
    },
    []
  );

  // --- Save ---

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <div className="space-y-6">
      {/* ---- Address Section ---- */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          {labels.addressSection}
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              {labels.address}
            </label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder={labels.addressPlaceholder}
              maxLength={200}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                {labels.city}
              </label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder={labels.cityPlaceholder}
                maxLength={100}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                {labels.state}
              </label>
              <input
                type="text"
                value={formData.state || ''}
                onChange={(e) => updateField('state', e.target.value)}
                placeholder={labels.statePlaceholder}
                maxLength={100}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                {labels.zipCode}
              </label>
              <input
                type="text"
                value={formData.zipCode || ''}
                onChange={(e) => updateField('zipCode', e.target.value)}
                placeholder={labels.zipPlaceholder}
                maxLength={20}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                {labels.country}
              </label>
              <input
                type="text"
                value={formData.country || ''}
                onChange={(e) => updateField('country', e.target.value)}
                placeholder={labels.countryPlaceholder}
                maxLength={100}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---- Contact Section ---- */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          {labels.contactSection}
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              {labels.phone}
            </label>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder={labels.phonePlaceholder}
              maxLength={30}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                {labels.email}
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder={labels.emailPlaceholder}
                maxLength={200}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                {labels.website}
              </label>
              <input
                type="url"
                value={formData.website || ''}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder={labels.websitePlaceholder}
                maxLength={300}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---- Social Media Section ---- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
            {labels.socialSection}
          </h3>
          <span className="text-xs text-[var(--text-tertiary)]">
            {formData.socialMedia.length}/{MAX_SOCIAL}
          </span>
        </div>

        {formData.socialMedia.length > 0 && (
          <div className="space-y-2">
            {formData.socialMedia.map((sm, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg bg-[var(--bg-secondary)]"
              >
                <select
                  value={sm.platform}
                  onChange={(e) =>
                    updateSocial(index, 'platform', e.target.value)
                  }
                  className={`${selectClass} sm:w-40 shrink-0`}
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  type="url"
                  value={sm.url}
                  onChange={(e) => updateSocial(index, 'url', e.target.value)}
                  placeholder={labels.socialUrlPlaceholder}
                  maxLength={500}
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeSocial(index)}
                  className="text-xs px-2 py-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors shrink-0 self-center sm:self-auto"
                  aria-label={`${labels.remove} ${sm.platform}`}
                >
                  {labels.remove}
                </button>
              </div>
            ))}
          </div>
        )}

        {formData.socialMedia.length < MAX_SOCIAL ? (
          <button
            type="button"
            onClick={addSocial}
            className="w-full text-sm px-3 py-2 rounded-lg border border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors"
          >
            + {labels.addSocial}
          </button>
        ) : (
          <p className="text-xs text-[var(--text-tertiary)] text-center italic">
            {labels.maxSocial}
          </p>
        )}
      </div>

      {/* ---- Additional Locations Section ---- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
            {labels.locationsSection}
          </h3>
          <span className="text-xs text-[var(--text-tertiary)]">
            {formData.additionalLocations.length}/{MAX_LOCATIONS}
          </span>
        </div>

        {formData.additionalLocations.length > 0 && (
          <div className="space-y-3">
            {formData.additionalLocations.map((loc, index) => (
              <div
                key={index}
                className="p-4 rounded-lg bg-[var(--bg-secondary)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">
                    Sede {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLocation(index)}
                    className="text-xs px-2 py-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                    aria-label={`${labels.remove} Sede ${index + 1}`}
                  >
                    {labels.remove}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    {labels.locationName}
                  </label>
                  <input
                    type="text"
                    value={loc.name}
                    onChange={(e) =>
                      updateLocation(index, 'name', e.target.value)
                    }
                    placeholder={labels.locationNamePlaceholder}
                    maxLength={100}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[var(--text-secondary)]">
                      {labels.locationAddress}
                    </label>
                    <input
                      type="text"
                      value={loc.address}
                      onChange={(e) =>
                        updateLocation(index, 'address', e.target.value)
                      }
                      placeholder={labels.locationAddressPlaceholder}
                      maxLength={300}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[var(--text-secondary)]">
                      {labels.locationPhone}
                    </label>
                    <input
                      type="tel"
                      value={loc.phone || ''}
                      onChange={(e) =>
                        updateLocation(index, 'phone', e.target.value)
                      }
                      placeholder={labels.locationPhonePlaceholder}
                      maxLength={30}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {formData.additionalLocations.length < MAX_LOCATIONS ? (
          <button
            type="button"
            onClick={addLocation}
            className="w-full text-sm px-3 py-2 rounded-lg border border-dashed border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors"
          >
            + {labels.addLocation}
          </button>
        ) : (
          <p className="text-xs text-[var(--text-tertiary)] text-center italic">
            {labels.maxLocations}
          </p>
        )}
      </div>

      {/* ---- Actions ---- */}
      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-primary)]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
        >
          {labels.cancel}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--kairo-midnight)] hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {isSaving ? labels.saving : labels.save}
        </button>
      </div>
    </div>
  );
}
