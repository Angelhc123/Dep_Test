Escáner de dependencias vulnerables: planteamiento y funcionamiento
Proyecto de calidad y seguridad de software · Octubre 2026
Aclaración inicial
Sí, en parte es un cruce contra una base que mantiene otro. Ustedes no descubren vulnerabilidades: OSV y NVD las publican. Pero no es "mirar una página": es un programa que lee los archivos de un proyecto, saca qué librerías y versiones exactas usa, consulta la API y decide qué reportar y en qué orden.
Hay un problema que no conviene ocultar: esto ya existe. OSV-Scanner, de Google, busca lockfiles, SBOMs y repos git, lista dependencias directas y transitivas, y las compara con la base OSV. Si solo hacen "leer y consultar", rehacen una herramienta gratis. Se justifica si ustedes programan el motor, le agregan lógica propia y miden resultados reales contra esas herramientas.
El problema real
El caso clásico es Equifax (2017). Falló un componente sin parchear, Apache Struts (CVE-2017-5638), y el parche había salido el 6 de marzo, dos meses antes del ataque. El informe del GAO indica que los atacantes empezaron a escanear a Equifax solo dos días después de que se publicó la vulnerabilidad. Además, la lista de administradores que debían ser avisados estaba desactualizada.
Moraleja: la vulnerabilidad estaba publicada, pero nadie cruzó "lo que tengo instalado" con "lo que ya se sabe que está roto". Eso es lo que automatiza el escáner.
Las dos fuentes y sus límites
OSV (api.osv.dev): la mejor para este proyecto
• /v1/querybatch consulta varios paquetes a la vez, devuelve solo IDs de vulnerabilidades y respeta el orden de lo que se envió.
• Acepta hasta 1000 consultas por lote y cubre npm, PyPI, Go, crates.io, Maven, RubyGems y Packagist.
• Como el batch solo trae IDs, el detalle completo (resumen, referencias, rangos afectados) se pide aparte con /v1/vulns/{id}.
NVD (services.nvd.nist.gov): más incómoda
• Sin API key permite 5 requests por 30 segundos; con key gratuita, 50.
• Su diccionario CPE tiene buena cobertura para productos establecidos, pero mala para paquetes de npm y Go; muchos no tienen CPE registrado.
• Por eso herramientas como NodeSecure no usan matching por CPE para npm y buscan por palabra clave.
Recomendación: OSV como fuente principal y NVD solo para enriquecer por ID de CVE (puntaje CVSS, descripción), no para buscar por nombre de paquete.
Cómo funcionaría

1. Leer archivos. requirements.txt y package.json, idealmente con package-lock.json.
2. Sacar la versión exacta. Es lo más importante: package.json trae rangos como ^4.17.0, no versiones. Otras herramientas recomiendan usar la versión instalada resuelta desde el lockfile, no el mínimo declarado. Sin lockfile, hay que reportarlo como "versión no determinable" o resolverla contra el registro de npm/PyPI (y declarar que es una estimación).
3. Consultar OSV en lote con {package:{name, ecosystem:"npm" | "PyPI"}, version}.
4. Pedir el detalle de cada ID y extraer severidad, alias (CVE/GHSA) y versión que lo corrige.
5. Enriquecer con NVD por CVE (opcional).
6. Procesar con lógica propia (ver tabla).
7. Generar el reporte en HTML o JSON, con código de salida distinto de 0 si hay críticas (útil para CI).
   Se puede hacer en Node.js, que ya trae fetch incluido, sin dependencias externas.
   Qué hace cada parte
   Parte
   Quién
   Descubrir y publicar vulnerabilidades
   OSV / NVD
   Parsers de requirements.txt y package.json (rangos, -r, comentarios, extras)
   Ustedes
   Resolver versión exacta y comparar rangos semver
   Ustedes
   Deduplicar la misma falla listada como CVE y GHSA
   Ustedes
   Separar directa vs transitiva y priorizar por severidad
   Ustedes
   Sugerir versión mínima segura y avisar si implica salto mayor
   Ustedes
   Reporte y semáforo de riesgo
   Ustedes
   Cómo evitar pruebas falsas
   • Escoger 5 a 10 repos open source reales con lockfile y anotar el commit exacto de cada uno.
   • Correr el escáner propio y también npm audit y osv-scanner sobre los mismos commits.
   • Comparar cuántas vulnerabilidades encuentra cada uno, cuáles solo encuentra el propio y cuáles faltan.
   • Revisar a mano una muestra de las diferencias, leyendo el aviso original, para clasificar aciertos y falsos positivos.
   • Anotar la fecha de cada escaneo, porque las bases cambian a diario.
   Así los números son reales y verificables, y cualquier profesor puede repetir el experimento.
   Límites que deben declarar
   • Un escáner dice "esta versión tiene una falla conocida", no si el código usa la función afectada. Habrá alertas que no son explotables.
   • Solo detecta lo que ya está publicado, no fallas desconocidas.
   • Sin lockfile, la precisión baja.
   • Requiere internet y depende de que OSV/NVD estén disponibles.
   Un proyecto serio declara estas limitaciones en el informe.
   Fuentes consultadas
   • OSV, documentación de POST /v1/querybatch: https://google.github.io/osv.dev/post-v1-querybatch
   • Cliente OSV (límite de 1000 consultas y /v1/vulns/{id}): https://pkg.go.dev/github.com/cwayne18/vexscan@v0.8.2/internal/osv
   • NVD, cambios en API y límites de uso: https://nvd.nist.gov/General/News/changes-to-feeds-and-apis
   • NodeSecure, estrategia NVD para npm: https://app.unpkg.com/@nodesecure/vulnera@3.1.0/files/dist/database/nvd.d.ts
   • Cobertura CPE incompleta para npm/Go: https://github.com/hashb00k/vulnerability-tracker-RSS
   • Equifax y Apache Struts (patch del 6 de marzo): https://computing.co.uk/news/3017334/equifax-confirms-unpatched-apache-struts-flaw-was-exploited-in-massive-data-breach
   • Informe del GAO sobre Equifax: https://www.techtarget.com/cybersecurity/podcast/Risk-Repeat-Inside-the-GAOs-Equifax-breach-report?amp=1
   • OSV-Scanner (funcionamiento): https://tuxcare.com/google-launches-free-vulnerability-scanner-for-open-source-developers/
   • Versión instalada vs declarada (lockfile): https://pypi.org/project/closeread-verify/
