/**
 * Guía de mitigación por tipo de falla (CWE) para quien decide seguir usando una versión vulnerable
 * mientras actualiza. Son medidas compensatorias genéricas: no reemplazan la actualización.
 */

export interface CweGuidance {
  name: string;
  advice: string;
}

const GUIDE: Record<string, CweGuidance> = {
  "CWE-1321": {
    name: "Contaminación de prototipo (prototype pollution)",
    advice:
      "No pases objetos construidos con entrada del usuario a funciones de merge/set/clone de la librería. Filtra las claves __proto__, constructor y prototype; usa Object.create(null) o Map para datos externos; valida el JSON de entrada con un esquema estricto. Como defensa adicional: node --disable-proto=delete.",
  },
  "CWE-1333": {
    name: "Expresión regular con complejidad excesiva (ReDoS)",
    advice:
      "Limita el tamaño de la entrada antes de pasarla a la función afectada (por ejemplo, máximo de caracteres por campo y bodyLimit en el servidor), aplica timeouts a la petición y limita la tasa de solicitudes por cliente.",
  },
  "CWE-400": {
    name: "Consumo de recursos sin control (DoS)",
    advice:
      "Pon límites de tamaño a cuerpos, archivos y profundidad de objetos; aplica rate limiting y timeouts; ejecuta el procesamiento costoso fuera del hilo principal o con cuotas.",
  },
  "CWE-770": {
    name: "Asignación de recursos sin límites",
    advice:
      "Define límites explícitos (tamaño, cantidad de elementos, conexiones) y rate limiting por cliente.",
  },
  "CWE-79": {
    name: "Cross-site scripting (XSS)",
    advice:
      "Escapa toda salida que provenga de la librería antes de insertarla en HTML, evita innerHTML/dangerouslySetInnerHTML con ese contenido, sanitiza con una librería mantenida (por ejemplo DOMPurify) y activa una Content-Security-Policy restrictiva.",
  },
  "CWE-22": {
    name: "Path traversal",
    advice:
      "Normaliza y valida rutas antes de pasarlas a la librería: rechaza '..', rutas absolutas y separadores codificados; resuelve contra un directorio base y verifica que el resultado siga dentro de él.",
  },
  "CWE-89": {
    name: "Inyección SQL",
    advice:
      "Usa solo consultas parametrizadas; nunca concatenes entrada del usuario en SQL generado por la librería.",
  },
  "CWE-78": {
    name: "Inyección de comandos del sistema",
    advice:
      "No pases entrada del usuario a funciones que ejecutan comandos; usa listas blancas de argumentos y execFile/spawn sin shell.",
  },
  "CWE-77": {
    name: "Inyección de comandos",
    advice:
      "Valida con lista blanca cualquier dato que llegue a la función afectada y evita ejecutarla con entrada externa.",
  },
  "CWE-94": {
    name: "Inyección de código",
    advice:
      "No pases plantillas, expresiones u opciones controladas por el usuario a la librería; trata sus opciones de configuración como código confiable únicamente.",
  },
  "CWE-95": {
    name: "Evaluación dinámica de código (eval)",
    advice:
      "Evita que entrada externa llegue a la función afectada; desactiva opciones que evalúen expresiones.",
  },
  "CWE-502": {
    name: "Deserialización de datos no confiables",
    advice:
      "No deserialices datos de origen externo con la librería; usa JSON plano validado con un esquema.",
  },
  "CWE-918": {
    name: "Server-side request forgery (SSRF)",
    advice:
      "Permite solo una lista blanca de hosts/esquemas antes de llamar a la librería, bloquea IPs privadas y de metadatos (169.254.169.254) y no sigas redirecciones automáticamente.",
  },
  "CWE-601": {
    name: "Redirección abierta",
    advice: "Valida las URLs de redirección contra una lista blanca de destinos o usa solo rutas relativas.",
  },
  "CWE-352": {
    name: "Cross-site request forgery (CSRF)",
    advice: "Usa tokens anti-CSRF y cookies con SameSite=Lax o Strict en las rutas que usan la librería.",
  },
  "CWE-611": {
    name: "Entidades externas XML (XXE)",
    advice: "Desactiva DTD y entidades externas en el parser; no proceses XML de origen no confiable.",
  },
  "CWE-200": {
    name: "Exposición de información sensible",
    advice:
      "Revisa qué datos pasan por la librería y evita registrar o devolver secretos; minimiza los mensajes de error.",
  },
  "CWE-287": {
    name: "Autenticación incorrecta",
    advice: "Agrega una verificación de autenticación independiente delante de la funcionalidad afectada.",
  },
  "CWE-285": {
    name: "Autorización incorrecta",
    advice:
      "Verifica permisos en tu propio código antes de delegar en la librería; no confíes solo en su control.",
  },
  "CWE-863": {
    name: "Autorización incorrecta",
    advice:
      "Verifica permisos en tu propio código antes de delegar en la librería; no confíes solo en su control.",
  },
  "CWE-444": {
    name: "HTTP request smuggling",
    advice:
      "Pon delante un proxy que normalice las peticiones y rechace cabeceras Content-Length/Transfer-Encoding ambiguas.",
  },
  "CWE-20": {
    name: "Validación de entrada insuficiente",
    advice:
      "Valida con un esquema estricto (tipos, longitudes, formatos) todo dato externo antes de pasarlo a la librería.",
  },
  "CWE-327": {
    name: "Algoritmo criptográfico débil",
    advice:
      "Configura explícitamente algoritmos robustos (por ejemplo SHA-256, AES-GCM) o usa node:crypto directamente.",
  },
  "CWE-330": {
    name: "Aleatoriedad insuficiente",
    advice: "Genera tokens y secretos con crypto.randomBytes / crypto.randomUUID en lugar de la librería.",
  },
  "CWE-347": {
    name: "Verificación de firma incorrecta",
    advice:
      "Fija los algoritmos permitidos al verificar (por ejemplo algorithms: ['RS256']) y rechaza 'none'.",
  },
  "CWE-74": {
    name: "Inyección (neutralización incorrecta)",
    advice: "Escapa o valida con lista blanca la entrada antes de pasarla a la función afectada.",
  },
  "CWE-1236": {
    name: "Inyección de fórmulas CSV",
    advice: "Antepón un apóstrofo a celdas que comiencen con =, +, -, @ al exportar con la librería.",
  },
};

export function cweGuidance(cwe: string): CweGuidance | undefined {
  return GUIDE[cwe.toUpperCase()];
}

/** Extrae del texto del aviso las secciones "Workarounds" / "Mitigation" (formato markdown de GHSA). */
export function extractWorkaround(details: string | undefined): string | null {
  if (!details) return null;
  const lines = details.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let inside = false;
  for (const line of lines) {
    const heading = /^\s*(#{1,6})\s+(.*)$/.exec(line) ?? /^\s*\*\*(.+?)\*\*\s*:?\s*$/.exec(line);
    if (heading) {
      const title = (heading[2] ?? heading[1] ?? "").toLowerCase();
      inside = /workaround|mitigat|mitigación|solución temporal/.test(title);
      continue;
    }
    // Se omite la pregunta de plantilla de GitHub ("_Is there a way for users to fix…?_").
    if (inside && !/^\s*_.*\?_\s*$/.test(line)) out.push(line);
  }
  const text = out.join("\n").trim();
  if (text) return text.slice(0, 1500);
  // Avisos sin sección: buscar un párrafo que mencione workaround.
  const para = details.split(/\n\s*\n/).find((p) => /\bworkaround/i.test(p));
  return para ? para.trim().slice(0, 800) : null;
}
