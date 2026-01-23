# KAIRO - Reglas Obligatorias del Proyecto

## Reglas de Desarrollo

### 1. Validación Visual con Playwright MCP
Todo avance debe validarse usando **Playwright MCP** (herramienta global ya configurada) antes de considerarse completo.

**IMPORTANTE:** NO instalar playwright como dependencia del proyecto. Usar exclusivamente el MCP configurado a nivel global que permite abrir un navegador propio para validar avances y cambios de UI/UX.

### 2. Ciberseguridad
- Validaciones server-side obligatorias
- Sanitización de inputs
- Prepared statements para queries
- Protección CSRF, XSS
- Headers de seguridad configurados
- No exponer data sensible en cliente

### 3. Mobile-First Responsive
- Diseñar desde 320px hacia arriba
- Usar breakpoints con `min-width`
- Testear en móvil primero

### 4. UX para "Usuarios Idiotas"
- Navegación obvia e intuitiva
- Feedback visual claro en cada acción
- Estados visibles (loading, error, success)
- Cero fricción en flujos principales
- Tooltips y ayudas contextuales

### 5. Full-Width Design
- Sin `max-width` restrictivo
- Aprovechar todo el ancho del viewport
- Layouts fluidos con grids responsivos

### 6. Código Auditable
- Clean code
- Sin hacks ni workarounds
- Consistente en estilo
- Debe pasar linting sin warnings

### 7. Variables Semánticas
```typescript
// ❌ MAL
const d = getData();
const x = d.filter(i => i.s === 1);
const btn = true;

// ✅ BIEN
const allCompanyLeads = await fetchLeadsByCompany(companyId);
const activeLeads = allCompanyLeads.filter(lead => lead.status === 'active');
const isSubmitButtonEnabled = true;
```

### 8. Arquitectura Escalable
- Modular desde el inicio
- Separación de concerns clara
- Preparado para nuevos features sin refactor mayor
- Componentes reutilizables

### 9. Fields Inteligentes
No usar inputs básicos. Preferir:
- Autocompletado con sugerencias
- Selects con búsqueda
- Date pickers con rangos
- Máscaras de input (teléfono, RUC, etc.)
- Validación en tiempo real

#### 9.1 Teléfonos Internacionales - PhoneInput Obligatorio
**SIEMPRE usar el componente `PhoneInput`** para campos de teléfono:

```typescript
// ❌ MAL - Input básico de texto
<Input
  type="tel"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
/>

// ✅ BIEN - Componente PhoneInput con i18n
import { PhoneInput, type E164Number } from '@/components/ui/PhoneInput';

<PhoneInput
  label="Teléfono"
  value={phone}
  onChange={(value) => setPhone(value)}
  defaultCountry="PE"
  error={phoneError}
/>
```

**Características del componente:**
- Selector de país con banderas SVG y búsqueda
- Nombres de países en el idioma actual (es/en) automáticamente
- Formato E.164 estándar (`+51912345678`)
- Usuario NO puede escribir código de país manualmente
- Validación integrada con `libphonenumber-js`

**Validación en servidor:**
```typescript
import { validatePhone, normalizePhone } from '@/lib/utils';

// Validar antes de guardar
if (phone && !validatePhone(phone)) {
  return { success: false, error: 'Número de teléfono inválido' };
}

// Normalizar a E.164
const normalizedPhone = normalizePhone(phone) || phone;
```

**Archivos de referencia:**
- `src/components/ui/PhoneInput.tsx` - Componente con i18n
- `src/lib/utils.ts` - Funciones `validatePhone`, `normalizePhone`, `formatPhone`
- `src/components/features/LeadEditModal.tsx` - Ejemplo de uso

### 10. Modales, No Alerts
```typescript
// ❌ MAL
alert('Lead guardado exitosamente');
confirm('¿Eliminar este lead?');

// ✅ BIEN
showModal({
  type: 'success',
  title: 'Lead guardado',
  message: 'El lead fue registrado correctamente'
});

showConfirmModal({
  title: '¿Eliminar lead?',
  message: 'Esta acción no se puede deshacer',
  onConfirm: handleDelete
});
```

### 11. Theme System
- Light theme por defecto
- Dark theme disponible via toggle
- Colores definidos en CSS variables
- Transiciones suaves al cambiar

### 12. Internacionalización (next-intl) - CRÍTICO
**SIEMPRE usar los exports de `@/i18n/routing` para navegación:**

```typescript
// ❌ MAL - Causa loop infinito de redirección
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ✅ BIEN - Maneja automáticamente el prefijo de locale
import { Link, usePathname, useRouter, redirect } from '@/i18n/routing';
```

**¿Por qué?**
- El `Link` de `next/link` navega a `/dashboard`
- El middleware de next-intl detecta que falta el locale
- Intenta redirigir a `/es/dashboard`
- El `Link` vuelve a navegar a `/dashboard`
- **Loop infinito → Página en blanco**

**Regla:** En cualquier componente que use navegación interna:
1. Importar `Link` de `@/i18n/routing`
2. Importar `usePathname` de `@/i18n/routing`
3. Importar `useRouter` de `@/i18n/routing` (si se necesita)
4. Tipar las rutas con un type union que coincida con `pathnames` en `routing.ts`

**Archivos de referencia:**
- `src/i18n/routing.ts` - Define las rutas válidas
- `src/components/layout/Sidebar.tsx` - Ejemplo de implementación correcta

---

## Reglas de Seguridad (Detalle)

### Nunca hacer:
- Exponer API keys en cliente
- Guardar passwords en plain text
- Confiar en input del usuario sin validar
- Usar `eval()` o `dangerouslySetInnerHTML` sin sanitizar
- Logs con data sensible

### Siempre hacer:
- Validar en servidor aunque valides en cliente
- Usar HTTPS
- Implementar rate limiting
- Sanitizar outputs (prevenir XSS)
- Escapar queries (prevenir SQL injection)

---

## Reglas de Git (Cuando se suba a repo)

### .gitignore obligatorio:
```
.env*
*.local
.env.production
node_modules/
.next/
credentials/
*.key
*.pem
```

### Commits:
- Mensajes descriptivos
- Un commit por feature/fix
- No commits con secrets

---

---

## Regla 13. Orquestación de Desarrollo con Sub-agentes

**Adan (Claude) actúa como Project Leader** del proyecto KAIRO y debe:

### ⚠️ ANÁLISIS PREVIO OBLIGATORIO
**ANTES de comenzar cualquier tarea**, Adan debe:
1. **Analizar qué sub-agentes utilizar** para la tarea específica
2. **Identificar tareas paralelizables** y ejecutarlas en paralelo cuando sea posible
3. **Planificar la secuencia** de tareas que dependen entre sí
4. **Solo asumir tareas personalmente** cuando NO exista un sub-agente adecuado

> **Principio:** No hacer todo uno mismo. Delegar eficientemente a los sub-agentes especializados disponibles.

### Uso de Sub-agentes (Plugins)
- Utilizar los sub-agentes instalados de forma **eficaz y eficiente**
- Paralelizar tareas cuando sea posible sin generar conflictos
- Si no se puede paralelizar, orquestar secuencialmente de la forma más eficiente
- **Trasladar TODOS los principios y reglas del proyecto** a los sub-agentes para mantener coherencia

### Comunicación y Coordinación
- Mantener comunicación constante sobre qué se está desarrollando
- Evitar conflictos entre cambios paralelos
- Proteger el código ya funcional - no dañar lo que ya está avanzado
- Respetar el enfoque general y arquitectura del proyecto

### Validación Obligatoria
- Usar **Playwright MCP** para validar:
  - Avances incrementales
  - Updates a features existentes
  - Nuevas features y módulos
- **Solo confirmar como "completado" cuando haya certeza 100%** de que funciona correctamente
- No asumir que funciona - demostrarlo con validación real

### Estándares de Calidad
- Mantener buen **UX/UI** en todo momento
- **Mobile-first** obligatorio con mejores prácticas de UX/UI
- Responsive design en todos los componentes
- Código limpio y mantenible

### Principios a Trasladar a Sub-agentes
1. Validación con Playwright MCP
2. Ciberseguridad prioritaria
3. Mobile-first responsive
4. UX para "usuarios idiotas"
5. Código auditable
6. Variables semánticas
7. Modales elegantes (no alerts)
8. i18n con `@/i18n/routing`
9. Theme system (light default)

---

## Checklist Pre-Deploy

- [ ] Validación visual con Playwright MCP (no instalar como dependencia)
- [ ] Mobile responsive verificado
- [ ] Sin console.logs en producción
- [ ] Variables de entorno configuradas
- [ ] Linting sin errores
- [ ] Sin secrets en código
