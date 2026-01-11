# KAIRO - Changelog

## [0.3.4] - 2026-01-11

### Cambiado
- **Vista tabla: Labels de potencial simplificados**
  - Español: "Alto", "Medio", "Bajo" (antes "Caliente", "Tibio", "Frío")
  - Inglés: "High", "Medium", "Low"
  - Nuevas traducciones `potentialShort` en archivos i18n
  - Vista grid mantiene labels descriptivos completos

### Corregido
- **Bug: Hover no funcionaba en dark mode (vista tabla)**
  - Síntoma: Filas de leads fríos/tibios no mostraban hover en dark mode
  - Causa: CSS specificity con Tailwind v4 combinaba reglas
  - Solución: Usar `var(--bg-hover)` que resuelve diferente por tema
  - Archivo: `globals.css` - sección "Lead Table Row Styles"

### Técnico
- Refactor de CSS para lead rows siguiendo estándar de variables semánticas
- Eliminada clase Tailwind `hover:bg-[var(--bg-tertiary)]` conflictiva en `leads/page.tsx`

---

## [0.3.3] - 2026-01-06

### Cambiado
- **Terminología: "Temperatura" → "Potencial Comercial"**
  - Renombrado el campo de clasificación de leads para mayor claridad
  - Nuevas etiquetas con contexto educativo para usuarios nuevos:
    - 🔥 Potencial Alto (lead caliente)
    - ⚡ Potencial Medio (lead tibio)
    - ❄️ Potencial Bajo (lead frío)
  - Los valores internos del enum (`HOT`, `WARM`, `COLD`) permanecen sin cambios
  - Traducciones actualizadas en español e inglés

- **Archivos de traducción**
  - `es.json`: `temperature` → `potential`, nuevas etiquetas descriptivas
  - `en.json`: `temperature` → `potential`, nuevas etiquetas en inglés

- **Componentes actualizados**
  - `LeadCard.tsx`: Claves de traducción actualizadas
  - `LeadFilters.tsx`: Título de sección y badges actualizados
  - `LeadDetailPanel.tsx`: Badge de potencial actualizado
  - `LeadTable.tsx`: Header de columna actualizado
  - `leads/page.tsx`: Header de tabla actualizado

---

## [0.3.2] - 2026-01-06

### Corregido
- **Bug crítico de navegación en Sidebar**
  - Síntoma: Clic en "Dashboard" llevaba a página en blanco con compilación infinita
  - Causa raíz: Uso incorrecto de `Link` de `next/link` en lugar de `@/i18n/routing`
  - El Link estándar de Next.js no añade el prefijo de locale (`/es/`, `/en/`)
  - El middleware de next-intl detectaba ruta sin locale y entraba en loop de redirección
  - Solución: Cambiar imports a `Link` y `usePathname` de `@/i18n/routing`

### Cambiado
- **Sidebar.tsx**
  - Import `Link` ahora viene de `@/i18n/routing` (no de `next/link`)
  - Import `usePathname` ahora viene de `@/i18n/routing` (no de `next/navigation`)
  - Nuevo tipo `AppPathname` para type-safety en rutas de navegación
  - Interface `NavItem.href` cambiado de `string` a `AppPathname`

- **Filtro de fecha por defecto**
  - Cambiado de "últimos 30 días" a "últimos 7 días" en página de Leads

- **Data mock de leads**
  - Fechas de `lastContactAt` ahora son relativas a la fecha actual
  - Helper function `getRelativeDate()` para cálculo dinámico
  - Distribución de leads en todas las opciones de filtro de fecha:
    - Hoy: 6 leads
    - Ayer: 4 leads
    - Últimos 7 días: 7 leads
    - Últimos 30 días: 9 leads
    - Más de 30 días: 4 leads

---

## [0.3.1] - 2026-01-06

### Agregado
- **Filtros colapsables en la página de Leads**
  - Diseño compacto: estado colapsado muestra solo barra de búsqueda
  - Estado expandido muestra todos los filtros por categoría (chips)
  - Badge flotante ("más filtros" / "menos filtros") centrado en el borde inferior del Card
  - Contador de filtros activos en el badge (color cyan)

- **Badges de filtros activos**
  - Chips removibles que muestran filtros aplicados cuando está colapsado
  - Colores semánticos por tipo de filtro:
    - Status: cyan
    - Temperature: gradiente según temperatura (blue/yellow/red)
    - Channel: purple
    - Type: orange
    - DateRange: green
  - Botón X para eliminar filtros individuales

- **Nuevos componentes en LeadFilters.tsx**
  - `ActiveFilterBadge`: Badge con color y botón de cierre
  - `FloatingFilterToggle`: Badge flotante para expandir/colapsar

- **Traducciones agregadas**
  - `leads.filters.moreFilters`: "Más filtros" / "More filters"
  - `leads.filters.lessFilters`: "Menos filtros" / "Less filters"

### Cambiado
- **LeadFilters.tsx**
  - Nuevas props: `isExpanded`, `onToggleExpanded`
  - Lógica condicional para mostrar/ocultar secciones de filtros
  - Transiciones CSS suaves para expand/collapse

- **leads/page.tsx**
  - Nuevo estado `isFiltersExpanded`
  - Cálculo de `activeFiltersCount` con useMemo
  - Card wrapper con `relative` para posicionar badge flotante

### Corregido
- Error TypeScript en comparación de dateRange (tipos sin overlap)
- Error TypeScript en Badge variant "outline" -> "default" en LeadDetailPanel

---

## [0.3.0] - 2025-01-05

### Agregado
- **Internacionalización completa (i18n) con next-intl**
  - Soporte para español (es) e inglés (en)
  - Routing basado en locale: `/es/leads`, `/en/leads`
  - Middleware de detección automática de idioma
  - Archivos de traducción: `src/messages/es.json`, `src/messages/en.json`

- **Documentación de i18n**
  - Nuevo archivo `docs/I18N.md` con guía completa
  - Patrones de código para traducciones
  - Checklist para nuevos componentes
  - Consideraciones de moneda y fechas

- **Namespaces de traducciones**
  - `common`: Botones, labels, mensajes genéricos
  - `navigation`: Items del sidebar
  - `login`: Página de autenticación
  - `leads`: Módulo completo de leads (status, temperature, channel, actions)
  - `dashboard`: Página principal

### Cambiado
- **Estructura de rutas**
  - De `/leads` a `/[locale]/leads`
  - De `/login` a `/[locale]/login`
  - Redirect automático de `/` al locale detectado

- **Componentes actualizados para i18n**
  - `Sidebar.tsx`: NavItems usan `labelKey` en lugar de `label`
  - `LeadCard.tsx`: Badges, labels y acciones traducidos
  - `LeadFilters.tsx`: Filtros y placeholders traducidos
  - `LeadTable.tsx`: Headers de columna traducidos

- **NavItem interface**
  - Cambio de `label: string` a `labelKey: string`
  - Cambio de `badge?: string` a `hasBadge?: boolean`

### Notas técnicas
- `formatCurrency()` sigue usando PEN/es-PE (pendiente para backend)
- `formatDate()` sigue usando es-PE (pendiente para locale-aware)
- Validado con Playwright MCP en ambos idiomas y mobile

---

## [0.2.0] - 2025-01-02

### Agregado
- **Login Page con animaciones de pulsos**
  - Efecto visual de "leads esperando" con pulsos animados
  - Pulsos con posiciones aleatorias que se regeneran al terminar la animación
  - Animaciones suaves sin flash inicial (opacity y scale desde 0)
  - Keyframes personalizados: `leadPulse` y `leadPulseGlow`

- **Sistema de temas mejorado**
  - Modo Light: fondo cyan sutil (20%), gradiente blanco central (85%), pulsos Kairo Midnight
  - Modo Dark: fondo midnight, gradiente cyan (10%), pulsos cyan
  - Toggle de tema funcional en login y dashboard

- **Logo real de KAIRO en Sidebar**
  - Reemplazo del logo texto "K KAIRO" por imágenes oficiales
  - `logo-main.png` para modo dark (logo blanco)
  - `logo-oscuro.png` para modo light (logo oscuro)
  - Cambio dinámico según el tema activo

### Cambiado
- **Login page background**
  - Light mode: de blanco puro a cyan tenue con centro blanco
  - Dark mode: gradiente cyan central más visible (de 5% a 10%)

- **Componente Image de Next.js**
  - Uso de prop `fill` con contenedor en lugar de width/height
  - Agregado `sizes` para evitar warnings de Next.js

### Corregido
- Flash visual antes de animación de pulsos (inicio desde scale(0) y opacity(0))
- Warning de Next.js "width or height modified by styles"
- Warning de Next.js "missing sizes prop"
- Import duplicado de useTheme en Sidebar.tsx

---

## [0.1.1] - 2025-01-01

### Agregado
- **Componentes UI base**
  - Button.tsx con variantes (primary, secondary, ghost, danger)
  - Input.tsx con soporte para iconos y estados
  - Modal.tsx + AlertModal para sistema de modales
  - Card.tsx para contenedores
  - Badge.tsx para etiquetas de estado

- **Layout del Dashboard**
  - Sidebar.tsx responsive con navegación
  - Header.tsx con toggle de tema y notificaciones
  - Sistema de rutas con route groups (auth) y (dashboard)

- **Vista de Leads**
  - LeadCard.tsx para vista de cuadrícula
  - LeadTable.tsx para vista de tabla
  - LeadFilters.tsx con filtros por estado, temperatura, canal, agente
  - Toggle vista grid/tabla persistido

- **Data Mock**
  - 25 leads peruanos realistas
  - 4 agentes IA (Luna, Atlas, Nova, Orion)
  - 3 usuarios de prueba
  - 1 empresa (TechCorp SAC)

- **Contextos React**
  - ThemeContext.tsx para manejo de temas light/dark
  - ModalContext.tsx para sistema de modales global

### Estructura
- Configuración de Tailwind CSS 4 con variables CSS
- Sistema de colores Kairo (midnight, cyan, etc.)
- Tipografía Inter desde Google Fonts

---

## [0.1.0] - 2024-12-31

### Agregado
- Inicialización del proyecto Next.js 15 con TypeScript
- Configuración de Tailwind CSS
- Sistema de documentación con índices MD
  - CLAUDE.md (índice raíz)
  - INDEX.md (índice de documentación)
  - ARCHITECTURE.md (decisiones técnicas)
  - COMPONENTS.md (catálogo UI)
  - DATA-MODELS.md (modelos de datos)
  - RULES.md (reglas del proyecto)
  - CHANGELOG.md (este archivo)

### Estructura base
- Definición de estructura de carpetas
- Modelos de datos para MVP (Lead, User, Company, AIAgent, etc.)
- Reglas de desarrollo establecidas

---

## Formato de Changelog

Cada entrada sigue el formato:

```markdown
## [VERSION] - YYYY-MM-DD

### Agregado
- Nuevas features

### Cambiado
- Cambios en features existentes

### Corregido
- Bug fixes

### Eliminado
- Features removidas

### Seguridad
- Fixes de seguridad
```
