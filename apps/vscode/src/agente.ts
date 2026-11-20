// Skills y agente de DepScan para la IA del editor.
//
// - Skills (Language Model Tools): depscan_scan, depscan_vulnerability y
//   depscan_fix. Cualquier agente del editor (Copilot en modo agente, o el
//   propio @depscan) puede llamarlas solo cuando la conversación lo necesite.
// - Agente (@depscan en el chat): orquesta esas skills con un bucle de
//   "tool calling": el modelo decide qué skill usar, el agente la ejecuta y le
//   devuelve el resultado hasta tener la respuesta final.
import * as vscode from "vscode";
import type { OsvVulnerability, Severity } from "@depscan/core";
import { corregible, superaSeveridad } from "./manifiestos.js";
import type { Controlador, HallazgoUbicado } from "./controlador.js";

const ORDEN_SEV: Severity[] = ["critical", "high", "medium", "low", "unknown"];

/** Resumen compacto del escaneo para el modelo (JSON). */
export function resumenParaModelo(ctl: Controlador, minima: Severity = "low") {
  return {
    proyectos: ctl.resultados.map((r) => ({
      carpeta: r.carpeta.name,
      dependencias: r.reporte.summary.dependencies,
      vulnerables: r.reporte.summary.vulnerableDependencies,
      semaforo: r.reporte.summary.risk,
      porSeveridad: r.reporte.summary.bySeverity,
    })),
    hallazgos: ctl.hallazgos
      .filter((h) => superaSeveridad(h.finding, minima))
      .sort((a, b) => ORDEN_SEV.indexOf(a.finding.maxSeverity) - ORDEN_SEV.indexOf(b.finding.maxSeverity))
      .map(({ finding: f, uri }) => ({
        paquete: f.dependency.name,
        version: f.dependency.resolved,
        ecosistema: f.dependency.ecosystem,
        directa: f.dependency.direct,
        cadena: f.dependency.direct ? undefined : f.dependency.path.join(" > "),
        dev: f.dependency.dev,
        archivo: vscode.workspace.asRelativePath(uri),
        severidad: f.maxSeverity,
        vulnerabilidades: f.vulnerabilities.map((v) => ({
          id: v.id,
          severidad: v.severity,
          cvss: v.cvss,
          resumen: v.summary,
        })),
        versionSegura: f.remediation?.recommended ?? null,
        verificada: f.remediation?.verified ?? false,
        cambiaMayor: f.majorBump,
        corregibleAutomaticamente: corregible(f),
        estado: f.remediation?.status ?? "unknown",
      })),
  };
}

const texto = (valor: unknown) =>
  new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart(typeof valor === "string" ? valor : JSON.stringify(valor, null, 2)),
  ]);

async function detalleVulnerabilidad(ctl: Controlador, id: string): Promise<unknown> {
  const buscado = id.trim().toUpperCase();
  for (const h of ctl.hallazgos) {
    const v = h.finding.vulnerabilities.find(
      (x) => x.id.toUpperCase() === buscado || x.aliases.some((a) => a.toUpperCase() === buscado),
    );
    if (v) {
      return {
        id: v.id,
        alias: v.aliases,
        severidad: v.severity,
        cvss: v.cvss,
        vector: v.cvssVector,
        cwe: v.cwes,
        resumen: v.summary,
        detalle: v.details?.slice(0, 3000),
        corregidaEn: v.fixedIn,
        referencias: v.references.slice(0, 8),
        afectaA: `${h.finding.dependency.name}@${h.finding.dependency.resolved}`,
        mitigaciones: h.finding.remediation?.mitigations.filter((m) => m.vulnId === v.id).map((m) => m.text),
      };
    }
  }
  const osv: OsvVulnerability | null = await ctl.motor.osv.getVulnerability(id.trim());
  return osv ?? `No se encontró ${id} en el proyecto ni en OSV.`;
}

export function registrarSkills(ctl: Controlador): vscode.Disposable[] {
  return [
    vscode.lm.registerTool<{ minimumSeverity?: Severity }>("depscan_scan", {
      prepareInvocation: () => ({
        invocationMessage: "DepScan está escaneando las dependencias del proyecto…",
      }),
      async invoke(opts) {
        await ctl.escanear();
        return texto(resumenParaModelo(ctl, opts.input.minimumSeverity ?? "low"));
      },
    }),
    vscode.lm.registerTool<{ id: string }>("depscan_vulnerability", {
      prepareInvocation: (opts) => ({ invocationMessage: `DepScan: consultando ${opts.input.id}…` }),
      async invoke(opts) {
        return texto(await detalleVulnerabilidad(ctl, opts.input.id));
      },
    }),
    vscode.lm.registerTool<{ package: string }>("depscan_fix", {
      prepareInvocation(opts) {
        const h = ctl.buscarPaquete(opts.input.package);
        const destino = h?.finding.remediation?.recommended ?? "su versión segura";
        return {
          invocationMessage: `DepScan: actualizando ${opts.input.package}…`,
          confirmationMessages: {
            title: `¿Actualizar ${opts.input.package}?`,
            message: new vscode.MarkdownString(
              `DepScan cambiará **${opts.input.package}** a \`${destino}\` en \`${h ? vscode.workspace.asRelativePath(h.uri) : "el manifiesto"}\`.`,
            ),
          },
        };
      },
      async invoke(opts) {
        if (!ctl.hallazgos.length) await ctl.escanear();
        const h = ctl.buscarPaquete(opts.input.package);
        if (!h) return texto(`${opts.input.package} no tiene vulnerabilidades conocidas en este proyecto.`);
        if (!corregible(h.finding)) {
          return texto(
            h.finding.dependency.direct
              ? `${h.finding.dependency.name} no tiene una versión segura publicada; aplica las mitigaciones del reporte.`
              : `${h.finding.dependency.name} es transitiva (${h.finding.dependency.path.join(" > ")}): se corrige actualizando el paquete padre o con "overrides" en package.json.`,
          );
        }
        const ok = await ctl.corregir(h);
        return texto(
          ok
            ? `Actualizado ${h.finding.dependency.name} a ${h.finding.remediation!.recommended} en ${vscode.workspace.asRelativePath(h.uri)}. Falta ejecutar ${h.finding.dependency.ecosystem === "npm" ? "npm install" : "pip install -r requirements.txt"}.`
            : `No se pudo editar ${vscode.workspace.asRelativePath(h.uri)}.`,
        );
      },
    }),
  ];
}

const SISTEMA = `Eres DepScan, un asistente de seguridad de dependencias dentro de VS Code.
Respondes SIEMPRE en español, claro y breve, para estudiantes y desarrolladores.
Usa las herramientas de DepScan para obtener datos reales: nunca inventes CVE, versiones ni severidades.
Prioriza por severidad (crítica > alta > media > baja) y distingue dependencias directas (se corrigen editando el manifiesto) de transitivas (se corrigen actualizando el paquete padre u "overrides").
La "versión segura" de DepScan está verificada contra TODOS los avisos del paquete. Solo aplica cambios con depscan_fix si el usuario lo pide.`;

const TOOLS = ["depscan_scan", "depscan_vulnerability", "depscan_fix"];

export function registrarAgente(ctl: Controlador, ctx: vscode.ExtensionContext): vscode.Disposable {
  const agente = vscode.chat.createChatParticipant(
    "depscan.agent",
    async (request, chatCtx, stream, token) => {
      const comando = request.command;

      // /scan sin modelo disponible: respuesta determinista con los datos del escaneo.
      if (comando === "scan" || comando === "fix") {
        stream.progress("Escaneando dependencias con DepScan…");
        await ctl.escanear();
        escribirResumen(ctl, stream);
        if (comando === "fix") {
          const corregibles = ctl.hallazgos.filter((h) => corregible(h.finding));
          if (!corregibles.length) {
            stream.markdown("\nNo hay dependencias directas que se puedan actualizar automáticamente.");
          } else {
            stream.markdown("\n**Actualizaciones seguras disponibles:**\n");
            for (const h of corregibles) {
              stream.button({
                command: "depscan.fixOne",
                arguments: [h.finding.dependency.name],
                title: `Actualizar ${h.finding.dependency.name} a ${h.finding.remediation!.recommended}`,
              });
            }
            stream.button({ command: "depscan.fixAllDirect", title: "Aplicar todas" });
          }
          return { metadata: { comando } };
        }
        if (!request.model) return { metadata: { comando } };
      }

      const modelo = request.model;
      const herramientas = vscode.lm.tools.filter((t) => TOOLS.includes(t.name));
      const mensajes: vscode.LanguageModelChatMessage[] = [vscode.LanguageModelChatMessage.User(SISTEMA)];
      for (const turno of chatCtx.history) {
        if (turno instanceof vscode.ChatRequestTurn)
          mensajes.push(vscode.LanguageModelChatMessage.User(turno.prompt));
        else if (turno instanceof vscode.ChatResponseTurn) {
          const t = turno.response
            .map((p) => (p instanceof vscode.ChatResponseMarkdownPart ? p.value.value : ""))
            .join("");
          if (t) mensajes.push(vscode.LanguageModelChatMessage.Assistant(t));
        }
      }
      const pedido =
        comando === "scan"
          ? "Ya escaneé el proyecto (usa depscan_scan para leer el resultado). Prioriza los riesgos y explica qué hacer primero."
          : comando === "explain"
            ? `Explica esta vulnerabilidad de forma sencilla (qué es, cómo se explota, a qué afecta en mi proyecto y cómo corregirla): ${request.prompt}`
            : request.prompt;
      mensajes.push(vscode.LanguageModelChatMessage.User(pedido));

      // Bucle de agente: el modelo pide skills, se ejecutan y se le devuelven los resultados.
      for (let paso = 0; paso < 6 && !token.isCancellationRequested; paso++) {
        const respuesta = await modelo.sendRequest(mensajes, { tools: herramientas }, token);
        const llamadas: vscode.LanguageModelToolCallPart[] = [];
        const partes: (vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart)[] = [];
        for await (const parte of respuesta.stream) {
          if (parte instanceof vscode.LanguageModelTextPart) {
            stream.markdown(parte.value);
            partes.push(parte);
          } else if (parte instanceof vscode.LanguageModelToolCallPart) {
            llamadas.push(parte);
            partes.push(parte);
          }
        }
        if (!llamadas.length) break;
        mensajes.push(vscode.LanguageModelChatMessage.Assistant(partes));
        for (const llamada of llamadas) {
          const resultado = await vscode.lm.invokeTool(
            llamada.name,
            { input: llamada.input, toolInvocationToken: request.toolInvocationToken },
            token,
          );
          mensajes.push(
            vscode.LanguageModelChatMessage.User([
              new vscode.LanguageModelToolResultPart(llamada.callId, resultado.content),
            ]),
          );
        }
      }
      for (const h of ctl.hallazgos.slice(0, 5)) stream.reference(h.uri);
      return { metadata: { comando } };
    },
  );
  agente.iconPath = vscode.Uri.joinPath(ctx.extensionUri, "media", "icono.png");
  agente.followupProvider = {
    provideFollowups: () => [
      { prompt: "¿Qué debo corregir primero?", label: "Priorizar riesgos" },
      {
        prompt: "Actualiza las dependencias directas a su versión segura",
        label: "Corregir",
        command: "fix",
      },
    ],
  };
  return agente;
}

function escribirResumen(ctl: Controlador, stream: vscode.ChatResponseStream): void {
  const r = resumenParaModelo(ctl);
  for (const p of r.proyectos) {
    const icono = p.semaforo === "red" ? "🔴" : p.semaforo === "yellow" ? "🟡" : "🟢";
    stream.markdown(
      `${icono} **${p.carpeta}**: ${p.vulnerables} de ${p.dependencias} dependencias vulnerables.\n\n`,
    );
  }
  if (!r.hallazgos.length) return;
  stream.markdown(
    "| Paquete | Versión | Severidad | Vulnerabilidades | Versión segura |\n|---|---|---|---|---|\n",
  );
  for (const h of r.hallazgos.slice(0, 15)) {
    stream.markdown(
      `| ${h.paquete}${h.directa ? "" : " _(transitiva)_"} | ${h.version} | ${h.severidad} | ${h.vulnerabilidades.map((v) => v.id).join(", ")} | ${h.versionSegura ?? "—"}${h.verificada ? " ✅" : ""} |\n`,
    );
  }
}

export type { HallazgoUbicado };
