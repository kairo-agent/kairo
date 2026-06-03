# KAIRO — Modelo de Negocio y Estrategia de Monetización

> **Apartado vivo.** Esta es la fuente de verdad del modelo comercial de KAIRO. Se actualiza, agrega y versiona a medida que crecemos. Cada cambio relevante va al **Historial** al final.
>
> **Estado:** v1 (borrador operativo, listo para vender) · **Última actualización:** 2026-06-03 · **Decidido por:** Leo

---

## 0. Cómo usar este documento

- Aquí vive **todo lo de pricing, packaging, go-to-market y estrategia comercial**. NO va código ni detalle técnico (eso en los otros `docs/`).
- Antes de cambiar un precio, un plan o una regla comercial: **edita este archivo** y registra el cambio en el Historial.
- Mantener bajo 25 KB (regla del proyecto). Si crece, fragmentar por tema (`docs/business/`).

---

## 1. Modelo de acceso (etapa actual)

KAIRO **NO se abre a auto-registro todavía.** Las organizaciones y sus usuarios los crea **Leo como `super_admin`** dentro de la app. Se mantiene así por ahora.

**Por qué:** en pruebas reales (ej. E&Z), los dueños de PYME **no logran configurar bien** el agente, la base de conocimiento (KB) ni las reglas, y meten conflictos. El valor de KAIRO en esta etapa es **"hecho para ti"**: nosotros lo dejamos funcionando y lo mantenemos.

---

## 2. Plan único — "Caballo de batalla"

> **KAIRO — Plan Gestionado** · servicio gestionado (done-for-you)

| Concepto | Valor |
|---|---|
| **Mensual** | **S/1.200/mes** (~$348 a 3.45 PEN/USD) |
| **Setup** | **Sin costo** |
| **Conversaciones** | **Ilimitadas, todos los canales** (WhatsApp + WebChat) |
| **Uso justo** | hasta **5.000 conv/mes por proyecto** (sobre eso, se evalúa caso por caso) |
| **Proyectos** | **1 incluido** por organización |
| **Proyecto extra** | **+S/300/mes** cada uno |
| **Plazo** | mínimo sugerido **3 meses** (protege el onboarding no cobrado) |

**Incluye (mensual):** agente de IA activo · WhatsApp + WebChat · re-engagement automático · dashboard de leads · notificaciones · **mantenimiento y actualizaciones de la KB** · soporte · KAIRO cubre el costo de OpenAI.

**Paga el cliente aparte:** su número y WhatsApp Business API de Meta (~S/200–400/mes vía BSP). Las respuestas a leads entrantes en WhatsApp son **gratis** en Meta (mensajes "service" dentro de 24h).

**Moneda:** cobrar y comunicar **en SOLES** (el sol está apreciado ~3.45 PEN/USD; precios en USD se ven más caros para el bolsillo peruano).

---

## 3. Programa de Clientes Fundadores (Design Partners)

Los **primeros 5 clientes** son privilegiados. Objetivo: **conseguir data real** y tracción, no ganancia.

| Etapa | Qué pasa |
|---|---|
| **Meses 1–3** | **GRATIS.** Iteramos fuerte, aprendemos con su uso real. |
| **Revisión (fin mes 3)** | Evaluamos resultados y data. |
| **Posible meses 4–6** | Posible **+3 meses gratis** si necesitamos más data. |
| **Después** | **Tarifa preferencial de fundador** + **módulos nuevos cobrados aparte.** |

**Beneficio permanente:** gozan de **todo lo nuevo que construyamos a futuro** (por un tiempo acotado, no para siempre).

> **OJO — Acción crítica:** dejar el **"por un tiempo" POR ESCRITO** con cada fundador. Si no, en el mes 7 creerán que es gratis para siempre.

---

## 4. Socio comercial y reparto

- **Amigo (socio comercial):** consigue clientes + da **soporte de primera línea** al cliente.
- **Leo:** da la **inducción** al socio + **ejecuta los cambios técnicos** (configuración de agente/KB/reglas). Sigue siendo el cuello de botella de "build".
- **Reparto del ingreso:** **40% socio / 60% Leo** (el 60% cubre costos).

**Nota sobre el periodo gratis:** durante los meses gratis **no hay ingreso que repartir** — el aporte del socio es *sweat equity* (apuesta a futuro). El split 40/60 **arranca cuando empiece la facturación.** Dejarlo claro entre ambos desde el inicio.

---

## 5. Allowance de cambios — "uso razonable" (NO vender horas)

**No se venden horas al cliente.** Se vende **uso razonable + SLA de respuesta**. Lo que protege el tiempo no es un número de horas, sino la **línea entre lo incluido y lo cobrable**:

| Incluido (uso razonable) | Cobrable / Upsell |
|---|---|
| Actualizar precios, FAQs, horarios, políticas | **Proyecto nuevo** (+S/300/mes) |
| Ajustar reglas / comportamiento del agente | **Módulo / feature nuevo** |
| Agregar un producto/servicio a la KB | Rediseño grande del agente / flujo complejo |
| Tunear respuestas según conversaciones reales | Integración a medida (ej. CRM del cliente) |

**Frase para propuesta/contrato:**
> *"Incluye actualizaciones y ajustes de tu agente bajo uso razonable (precios, FAQs, reglas, comportamiento). Atendemos tus solicitudes en un máximo de 2 días hábiles. Nuevos módulos o proyectos adicionales se cotizan aparte."*

**Presupuesto INTERNO de capacidad (no se le dice al cliente):**
- Cliente estable: **~2–4 h/mes**.
- Primer mes tras setup: **~4–8 h** (tuneo inicial).
- Fundador en evaluación: **más generoso (~5–8 h)** — el objetivo es aprender.

---

## 6. Costos y márgenes

| Concepto | Valor |
|---|---|
| Ingreso mensual (1 proyecto) | S/1.200 (~$348) |
| Costo OpenAI (gpt-4o-mini, $0.15/$0.60 por 1M tok) | ~$30–75/mes/proyecto **incluso a 5.000 conv/mes** |
| **Margen bruto** | **~80–90%** |
| Proyecto extra (+S/300) | cubre su OpenAI con holgura |

**El recurso escaso real NO es el dinero — es el TIEMPO de Leo** (solo-founder que configura y mantiene). El margen aguanta de sobra; el límite es cuántos clientes puede sostener el equipo.

**Meta / WhatsApp:** sin tope por cantidad de conversaciones. Cobra por mensaje; entrantes (service, <24h) = gratis. Lo paga el cliente igual. Facturación en PEN disponible desde abril 2026.

---

## 7. Referencias de mercado (Perú, jun 2026)

| Clase | Rango | Nota |
|---|---|---|
| SaaS self-serve (Cliengo, WATI, chatbots) | S/150–900/mes | Exigen que el dueño configure → ahí está nuestra cuña |
| Agencia "agente IA" (Perú) | S/10k–40k setup + S/800–2.500/mes | Caro: desarrollan a medida. Nosotros ya tenemos el producto |
| **Ancla de venta** | Asesor de ventas a planilla ≈ **S/1.700/mes** | KAIRO < mitad, 24/7, nunca renuncia |

**Pitch corto:** *"El asesor de ventas con IA que nunca duerme, montado y mantenido por nosotros — tú no tocas nada. Cuesta menos de la mitad de un vendedor a planilla y empieza a trabajar esta semana."*

Fuentes (verificadas en vivo 2–3 jun 2026): Adratech Systems, Alaz.pe, Beex, Cliengo, Computrabajo/GeoVictoria (costo laboral), XE (tipo de cambio).

---

## 8. Decisiones abiertas / pendientes

- [ ] Formalizar el **plazo mínimo de 3 meses** en la propuesta.
- [ ] Redactar el **acuerdo escrito del "por un tiempo"** para los fundadores.
- [ ] Definir con el socio el **inicio del split 40/60** (al facturar) por escrito.
- [ ] Materiales de venta: **one-pager del Programa Fundador** + **guion de inducción** para el socio.
- [ ] Futuro: definir **precio por módulo nuevo** cuando exista el primero.
- [ ] Futuro: posibles **planes/tiers** adicionales (hoy: plan único a propósito).

---

## Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-06-03 | v1 | Documento inicial. Plan único S/1.200/mes sin setup, uso justo 5k/mes, +S/300 proyecto extra. Programa de 5 fundadores (3+3 meses gratis). Socio 40/60. Allowance "uso razonable" sin vender horas. Benchmark Perú + ancla de valor. |
