# KAIRO - Catálogo de Componentes

## Componentes UI Base

### Button
**Ubicación:** `src/components/ui/Button.tsx`

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}
```

**Variantes:**
- `primary`: Fondo cyan, texto oscuro - CTAs principales
- `secondary`: Borde cyan, fondo transparente
- `ghost`: Sin borde, solo texto
- `danger`: Acciones destructivas

---

### Modal
**Ubicación:** `src/components/ui/Modal.tsx`

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}
```

**Tipos de modal:**
- Información
- Confirmación (con acciones)
- Formulario
- Alerta (success, error, warning)

---

### Input
**Ubicación:** `src/components/ui/Input.tsx`

```typescript
interface InputProps {
  label: string;
  type: 'text' | 'email' | 'password' | 'tel' | 'search';
  placeholder?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```

**Features:**
- Validación visual en tiempo real
- Máscaras de input (teléfono, RUC)
- Estados: default, focus, error, disabled

---

### Select
**Ubicación:** `src/components/ui/Select.tsx`

```typescript
interface SelectProps {
  label: string;
  options: Array<{ value: string; label: string }>;
  searchable?: boolean;
  multiple?: boolean;
  placeholder?: string;
}
```

**Features:**
- Búsqueda integrada
- Multi-select
- Grupos de opciones

---

### Card
**Ubicación:** `src/components/ui/Card.tsx`

```typescript
interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}
```

---

## Componentes de Layout

### Header
**Ubicación:** `src/components/layout/Header.tsx`

- Logo KAIRO
- Toggle de tema (light/dark)
- User menu
- Notificaciones

### Sidebar
**Ubicación:** `src/components/layout/Sidebar.tsx`

- Navegación principal
- Colapsable en mobile
- Indicador de sección activa

---

## Componentes de Features

### LeadCard
**Ubicación:** `src/components/features/LeadCard.tsx`

```typescript
interface LeadCardProps {
  lead: Lead;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
}
```

**Muestra:**
- Nombre y empresa
- Canal de origen
- Estado (badge con color)
- Temperatura (indicador visual)
- Última interacción
- Acciones rápidas

### LeadGrid
**Ubicación:** `src/components/features/LeadGrid.tsx`

Grid responsivo de LeadCards:
- 1 columna en mobile
- 2 columnas en tablet
- 3-4 columnas en desktop

### LeadTable
**Ubicación:** `src/components/features/LeadTable.tsx`

Vista tabular alternativa:
- Sorteable por columnas
- Selección múltiple
- Acciones en batch

### LeadFilters
**Ubicación:** `src/components/features/LeadFilters.tsx`

- Búsqueda por nombre/empresa
- Filtro por estado
- Filtro por canal
- Filtro por fecha
- Filtro por sub-agente

---

## Estilos Compartidos

### Colores (CSS Variables)
```css
--kairo-midnight: #0B1220;
--kairo-cyan: #00E5FF;
--kairo-white: #FFFFFF;
--kairo-gray: #1F2937;
```

### Estados de Lead (Colores)
```css
--status-new: #3B82F6;       /* Azul */
--status-contacted: #F59E0B; /* Amarillo */
--status-qualified: #10B981; /* Verde */
--status-proposal: #8B5CF6;  /* Morado */
--status-won: #059669;       /* Verde oscuro */
--status-lost: #EF4444;      /* Rojo */
```

### Breakpoints
```css
--bp-sm: 640px;
--bp-md: 768px;
--bp-lg: 1024px;
--bp-xl: 1280px;
--bp-2xl: 1536px;
```
