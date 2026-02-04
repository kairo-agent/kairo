# RAG Debug Session - 3 Febrero 2026

## Problema Inicial

El sistema RAG no estaba funcionando correctamente. Cuando los usuarios preguntaban cosas como "¿a qué hora duermes?", el bot respondía con respuestas genéricas de IA ("No duermo como las personas...") en lugar de usar el conocimiento cargado ("Normalmente duermo a las 2 de la madrugada y siempre me despierto a las 7 am").

---

## Diagnóstico y Fixes Aplicados

### Fix 1: Threshold de Similitud (COMPLETADO ✅)

**Problema:** El threshold de 0.7 era muy alto para queries coloquiales.

**Solución:** Bajamos el threshold de 0.7 a 0.5 en el nodo "RAG Search" de n8n.

**Archivo afectado:** Workflow n8n "KAIRO - Basic Response" → Nodo "RAG Search"

---

### Fix 2: SECURITY DEFINER en función SQL (COMPLETADO ✅)

**Problema:** La función `search_agent_knowledge` usaba `SECURITY INVOKER` mientras que las otras funciones (`insert_agent_knowledge`, `list_agent_knowledge`) usaban `SECURITY DEFINER`.

Cuando n8n llama a la API `/api/rag/search`, no hay sesión de usuario (no hay cookies), por lo tanto `auth.uid()` es NULL. Con `SECURITY INVOKER`, las políticas RLS bloqueaban el acceso porque no podían verificar membresía del proyecto.

**Solución:** Leo ejecutó el siguiente SQL en Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION search_agent_knowledge(
  p_agent_id TEXT,
  p_project_id TEXT,
  p_query_embedding TEXT,
  p_match_count INT DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (id UUID, content TEXT, title VARCHAR(255), source VARCHAR(100), similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ak.id, ak.content, ak.title, ak.source,
         (1 - (ak.embedding <=> p_query_embedding::vector(1536)))::FLOAT AS similarity
  FROM agent_knowledge ak
  WHERE ak.agent_id = p_agent_id
    AND ak.project_id = p_project_id
    AND (1 - (ak.embedding <=> p_query_embedding::vector(1536))) > p_match_threshold
  ORDER BY ak.embedding <=> p_query_embedding::vector(1536)
  LIMIT p_match_count;
END;
$$;
```

**Resultado:** El nodo "RAG Search" en n8n ahora retorna resultados correctamente (antes retornaba `results: []`).

---

### Fix 3: Prioridad del Conocimiento RAG en el Prompt (COMPLETADO ✅)

**Problema:** Aunque el RAG ahora retornaba resultados, el modelo seguía el patrón del historial de conversación (que tenía 3-4 respuestas previas incorrectas) en lugar de usar el conocimiento nuevo.

**Solución:** Modificamos el prompt del nodo "Message a model" en n8n para dar prioridad máxima al conocimiento RAG.

**Cambio aplicado:**

| Antes | Después |
|-------|---------|
| `'TU CONOCIMIENTO:\n'` | `'⭐ TU CONOCIMIENTO (PRIORIDAD MÁXIMA - USA ESTO aunque contradiga respuestas anteriores):\n'` |

**Ubicación:** Workflow n8n → Nodo "Message a model" → Campo "Prompt" (System)

**Versión publicada:** Version 2f105ffb con descripción "RAG Priority Fix: Prompt now instructs model to prioritize RAG knowledge over conversation history to avoid incorrect pattern following"

---

## Prueba Pendiente

Eliminamos el lead de prueba para hacer un test limpio:

- **Lead eliminado:** Leo D. Leon 💪😎
- **Teléfono:** +51966427334
- **Datos eliminados:** 24 mensajes, 1 conversación, el lead completo

**Siguiente paso:** Enviar un mensaje de WhatsApp preguntando "¿a qué hora duermes?" y verificar que el bot responda con el conocimiento cargado.

---

## Archivos Clave Revisados

| Archivo | Propósito |
|---------|-----------|
| `src/app/api/rag/search/route.ts` | Endpoint RAG que n8n llama |
| `scripts/setup-rag-complete.sql` | Definición de funciones SQL para RAG |
| `src/lib/actions/knowledge.ts` | Server Actions para CRUD de conocimiento |
| `src/lib/supabase/server.ts` | Cliente Supabase + Prisma singleton |

---

## Flujo Completo del RAG (Actualizado)

```
┌─────────────────────────────────────────────────────────────┐
│  1. Usuario envía mensaje WhatsApp                          │
│     "¿a qué hora duermes?"                                  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Webhook KAIRO recibe mensaje                            │
│     POST /api/webhooks/whatsapp                             │
│     - Crea/actualiza lead                                   │
│     - Guarda mensaje en BD                                  │
│     - Si handoffMode === 'ai' → Trigger n8n                 │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  3. n8n Webhook recibe datos                                │
│     - agentId, projectId, message, leadName, etc.           │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  4. n8n → RAG Search                                        │
│     POST /api/rag/search                                    │
│     - Header: X-N8N-Secret                                  │
│     - Body: { agentId, projectId, query, threshold: 0.5 }   │
│     - Genera embedding del query                            │
│     - Busca en agent_knowledge via RPC (SECURITY DEFINER)   │
│     - Retorna top 5 resultados por similaridad              │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  5. n8n → Message a model (OpenAI)                          │
│     System prompt incluye:                                  │
│     - Identidad del agente (nombre, empresa)                │
│     - Fecha/hora actual                                     │
│     - systemInstructions del agente                         │
│     - ⭐ TU CONOCIMIENTO (PRIORIDAD MÁXIMA)                 │
│     - Contexto previo del lead (leadSummary)                │
│     - Historial de conversación (últimos 8 mensajes)        │
│     - Instrucciones de temperatura (HOT/WARM/COLD)          │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  6. n8n → Send to WhatsApp                                  │
│     POST /api/ai/respond                                    │
│     - Guarda mensaje en BD con sender: 'ai'                 │
│     - Envía a WhatsApp Cloud API                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Conocimiento de Prueba Cargado

En el agente "Leo (Test)" del proyecto TechCorp SAC:

```
Normalmente duermo a las 2 de la madrugada y siempre me despierto a las 7 am
```

**Verificación:** El conocimiento está correctamente almacenado en `agent_knowledge` con su embedding de 1536 dimensiones.

---

## ✅ VERIFICACIÓN COMPLETADA - 4 Febrero 2026

### Pruebas Realizadas por Leo (3-4 Feb 2026)

| Pregunta | Respuesta del Bot | ¿Usó RAG? |
|----------|-------------------|-----------|
| "¿cual es tu nombre y a que horas duermes?" | "¡Soy Leo D. León! 💪😎 Normalmente duermo a las 2 de la madrugada y me despierto a las 7 am." | ✅ Sí |
| "a que hora te despiertas?" | "Normalmente me despierto a las 7 am. 😊" | ✅ Sí |

### Verificación en n8n (Ejecución #89 - 4 Feb 08:19)

**Output del nodo RAG Search:**
```json
{
  "success": true,
  "results": [{
    "id": "c0e2c113-93f5-46be-b2e6-4fe9a46d5817",
    "content": "Normalmente duermo a las 2 de la madrugada y siempre me despierto a las 7 am.",
    "title": "Hora de dormir",
    "source": "manual",
    "similarity": 0.704
  }],
  "metadata": {
    "agentId": "cmkoyc9oa0001ez0om10ga29w",
    "agentName": "Leonidas",
    "projectId": "cmka785up0004c7yv8fhnliao",
    "projectName": "Disruptivo",
    "resultsCount": 1,
    "threshold": 0.5,
    "timing": {
      "embedding": 2034,
      "search": 1453,
      "total": 4313
    }
  }
}
```

### Métricas de Rendimiento

| Métrica | Valor |
|---------|-------|
| Tiempo embedding | 2.0s |
| Tiempo búsqueda | 1.5s |
| **Tiempo total RAG** | **4.3s** |
| Similarity score | 0.704 |
| Threshold configurado | 0.5 |

### Estado de las Últimas Ejecuciones

| # | Fecha | Duración | Estado |
|---|-------|----------|--------|
| 89 | Feb 4, 08:19 | 12.98s | ✅ Success |
| 88 | Feb 3, 09:48 | 10.90s | ✅ Success |
| 87 | Feb 3, 09:47 | 8.74s | ✅ Success |
| 86 | Feb 3, 09:47 | 9.12s | ✅ Success |

### Conclusión

**🎉 RAG 100% OPERATIVO**

Los 3 fixes aplicados el 3 de febrero funcionan correctamente:

1. ✅ **Threshold 0.5** → Queries coloquiales encuentran resultados
2. ✅ **SECURITY DEFINER** → Función SQL retorna datos sin bloqueo RLS
3. ✅ **Prioridad RAG en prompt** → Modelo usa conocimiento sobre historial

---

## Próximos Pasos (Opcionales)

1. **Agregar más conocimiento** al agente para probar diferentes tipos de queries
2. **Monitorear tasa de éxito** del RAG en las próximas semanas
3. **Optimizar tiempos** si 4.3s de RAG se vuelve un cuello de botella

---

## Comandos Útiles

```bash
# Ver logs de Vercel (KAIRO)
vercel logs --follow

# Ejecutar script de prueba para verificar RAG
cd /d/KAIRO/kairo-dashboard
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
// ... test queries
"
```

---

## URLs Importantes

| Recurso | URL |
|---------|-----|
| KAIRO Dashboard | https://app.kairoagent.com/ |
| n8n Workflows | https://n8n-production-5d42.up.railway.app/ |
| Supabase Dashboard | (ver Vercel env vars) |
| Workflow activo | https://n8n-production-5d42.up.railway.app/workflow/Os0zwHlgMVfOVDk178WCq |

---

## Notas Técnicas

- **SECURITY DEFINER vs INVOKER:** DEFINER ejecuta la función con los permisos del creador (bypassing RLS), INVOKER ejecuta con los permisos del llamador (respeta RLS).

- **Por qué n8n necesita SECURITY DEFINER:** Las llamadas server-to-server no tienen sesión de usuario, por lo tanto `auth.uid()` es NULL y las políticas RLS que verifican membresía fallan.

- **Historial contaminado:** Cuando el modelo recibe un historial donde él mismo dio respuestas incorrectas, tiende a seguir ese patrón. La instrucción de "PRIORIDAD MÁXIMA" intenta romper ese ciclo.

---

*Documentado por Adan - 3 Feb 2026*
