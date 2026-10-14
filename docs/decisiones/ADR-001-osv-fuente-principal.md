# ADR-001: OSV como fuente principal, NVD solo para enriquecer por CVE

- Estado: aceptada
- Fecha: 2026-10-13

## Contexto

Hace falta una base de vulnerabilidades consultable por paquete y versión para npm y PyPI.
NVD busca por CPE, que tiene mala cobertura para paquetes de npm y Go, y sin API key permite 5 solicitudes cada 30 s.

## Decisión

- OSV (`/v1/querybatch` con hasta 1000 consultas por lote, y `/v1/vulns/{id}` para el detalle) es la fuente de verdad.
- NVD se usa solo por ID de CVE para obtener el CVSS oficial, es opcional y respeta su límite de uso (5 o 50 cada 30 s).
- Severidad, en este orden: CVSS de NVD → CVSS 3.x calculado desde el vector de OSV → etiqueta de GHSA → "sin dato".

## Alternativas descartadas

- NVD por nombre de paquete: cobertura CPE pobre y límites bajos.
- GitHub Advisory Database directa: requiere token y OSV ya la agrega.

## Consecuencias

- Un proyecto de 1000 dependencias se resuelve en una sola llamada de lote más una llamada por vulnerabilidad única (con caché).
- La calculadora de CVSS 3.x es código propio (`packages/core/src/analysis/cvss.ts`) y está probada con vectores conocidos.
- CVSS 4.0 no se calcula localmente: si OSV solo trae el vector 4.0, se usa la etiqueta de GHSA o NVD.
