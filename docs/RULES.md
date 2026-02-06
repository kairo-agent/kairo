# KAIRO - Reglas Obligatorias del Proyecto

## Reglas de Desarrollo

### 1. Validacion Visual con Playwright MCP
Todo avance debe validarse usando **Playwright MCP** (herramienta global ya configurada) antes de considerarse completo.

**IMPORTANTE:** NO instalar playwright como dependencia del proyecto. Usar exclusivamente el MCP configurado a nivel global que permite abrir un navegador propio para validar avances y cambios de UI/UX.

#### Protocolo Context-Safe (OBLIGATORIO)

Los snapshots de Playwright generan 30-100KB de texto con emojis/surrogate pairs que causan error `"no low surrogate in string"` en la API de Claude. **SIEMPRE** usar outputs a archivo para mantener el contexto limpio:

**Screenshots (verificacion visual):**
```
browser_take_screenshot(filename: "qa-desktop.png", type: "png")
// Luego leer con Read tool si se necesita ver
```

**Snapshots (para interactuar con elementos):**
```
browser_snapshot(filename: "qa-snapshot.md")
// Luego leer SOLO las lineas necesarias:
Read("qa-snapshot.md", offset: 50, limit: 30)  // solo la seccion relevante
```

**Datos especificos (verificacion rapida):**
```
browser_evaluate(function: "() => ({ title: document.title, url: window.location.href, leadCount: document.querySelectorAll('[data-lead]').length })")
```

**Console/Network (debugging):**
```
browser_console_messages(level: "error", filename: "qa-errors.txt")
browser_network_requests(includeStatic: false, filename: "qa-network.txt")
```

| Herramienta | Usar `filename` | Cuando |
|---|---|---|
| `browser_snapshot` | **SIEMPRE** | Necesitas refs para click/interact |
| `browser_take_screenshot` | **SIEMPRE** | Verificacion visual |
| `browser_console_messages` | **SIEMPRE** | Debugging errores JS |
| `browser_network_requests` | **SIEMPRE** | Verificar APIs/performance |
| `browser_evaluate` | N/A (inline ok) | Extraer datos puntuales (resultado pequeno) |
| `browser_click/type/navigate` | N/A | Interacciones directas |

**NUNCA** usar `browser_snapshot` sin `filename` - es la causa #1 del error de API.

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

## Regla 15. Gobernanza de Documentacion

**CLAUDE.md debe mantenerse bajo 10 KB.** Toda informacion detallada va en `docs/`.

### Cuando se agrega una nueva feature:
1. Documentar detalles en el `docs/*.md` correspondiente (o crear uno nuevo)
2. Agregar entrada en `docs/INDEX.md` si es un doc nuevo
3. En CLAUDE.md: maximo 1 linea en "Estado Actual"
4. **NUNCA** agregar bloques de codigo, diagramas ASCII, o tablas extensas a CLAUDE.md

### Cuando se necesita un nuevo doc:
1. Crear `docs/NOMBRE-FEATURE.md` con el detalle completo
2. Agregar al indice `docs/INDEX.md` con descripcion breve
3. Referenciar desde CLAUDE.md con link: `Ver [NOMBRE-FEATURE.md](docs/NOMBRE-FEATURE.md)`

### Por que:
- CLAUDE.md se carga en CADA request a la API de Claude (costo de tokens)
- Contextos grandes causan errores de serializacion JSON en la API
- Los docs/ se leen bajo demanda solo cuando se necesitan
- Menos contexto base = conversaciones mas largas y estables

---

## Regla 16. Sin Emojis en Documentacion Tecnica

**NUNCA usar emojis above-BMP en archivos de documentacion** (CLAUDE.md, docs/*.md, CHANGELOG.md).

### Caracteres prohibidos:
Emojis como U+1F916 (robot), U+1F4BC (maletin), U+1F525 (fuego), etc. Estos caracteres requieren **surrogate pairs** en UTF-16 y corrompen la serializacion JSON de la API de Claude cuando se acumulan en el contexto.

### Alternativas permitidas:
- Texto descriptivo: `[bot]`, `[fire]`, `[check]`
- Emojis BMP (< U+FFFF): checkmark, flechas basicas, simbolos matematicos
- ASCII puro para indicadores: `[x]`, `[!]`, `[-]`, `[+]`

### Como detectar emojis problematicos:
```bash
# Detecta caracteres above-BMP en un archivo
node -e "const c=require('fs').readFileSync('FILE.md','utf-8');let n=0;for(let i=0;i<c.length;i++){if(c.charCodeAt(i)>=0xD800&&c.charCodeAt(i)<=0xDBFF)n++;}console.log('Above-BMP:',n)"
```

### Por que importa:
- La API de Anthropic serializa el contexto como JSON
- Emojis above-BMP usan surrogate pairs (2 code units en UTF-16)
- Cuando hay muchos en el contexto, pueden causar error `"no low surrogate in string"`
- Los emojis no aportan valor semantico para el modelo de IA

---

## Checklist Pre-Deploy

- [ ] Validacion visual con Playwright MCP (no instalar como dependencia)
- [ ] Mobile responsive verificado
- [ ] Sin console.logs en produccion
- [ ] Variables de entorno configuradas
- [ ] Linting sin errores
- [ ] Sin secrets en codigo
- [ ] Sin emojis above-BMP en docs (Regla 16)
