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

## Checklist Pre-Deploy

- [ ] Validación visual con Playwright MCP (no instalar como dependencia)
- [ ] Mobile responsive verificado
- [ ] Sin console.logs en producción
- [ ] Variables de entorno configuradas
- [ ] Linting sin errores
- [ ] Sin secrets en código
