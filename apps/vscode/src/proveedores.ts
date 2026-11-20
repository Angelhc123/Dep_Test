// Integración con el editor: hover con el detalle, Quick Fix "actualizar a la
// versión segura" y el árbol de hallazgos de la barra lateral.
import * as vscode from "vscode";
import type { Finding } from "@depscan/core";
import { corregible } from "./manifiestos.js";
import { osvUrl, type Controlador, type HallazgoUbicado } from "./controlador.js";

const SELECTOR: vscode.DocumentSelector = [
  { scheme: "file", pattern: "**/package.json" },
  { scheme: "file", pattern: "**/package-lock.json" },
  { scheme: "file", pattern: "**/npm-shrinkwrap.json" },
  { scheme: "file", pattern: "**/requirements*.txt" },
];

const ICONO_SEV: Record<string, string> = {
  critical: "🟥",
  high: "🟧",
  medium: "🟨",
  low: "🟦",
  unknown: "⬜",
};

export function markdownHallazgo(f: Finding): vscode.MarkdownString {
  const d = f.dependency;
  const md = new vscode.MarkdownString(undefined, true);
  md.isTrusted = { enabledCommands: ["depscan.showReport"] };
  md.appendMarkdown(`### $(shield) DepScan: \`${d.name}@${d.resolved ?? "?"}\`\n\n`);
  md.appendMarkdown(
    `${d.ecosystem} · ${d.direct ? "dependencia directa" : `transitiva: ${d.path.join(" › ")}`}${d.dev ? " · dev" : ""}\n\n`,
  );
  for (const v of f.vulnerabilities.slice(0, 6)) {
    const cvss = v.cvss !== undefined ? ` · CVSS ${v.cvss}` : "";
    md.appendMarkdown(
      `${ICONO_SEV[v.severity]} **${v.severity.toUpperCase()}**${cvss} · [${v.id}](${osvUrl(v.id).toString()}): ${v.summary}` +
        (v.fixedIn.length ? ` _(corregida en ${v.fixedIn.join(", ")})_` : "") +
        "\n\n",
    );
  }
  if (f.vulnerabilities.length > 6) md.appendMarkdown(`… y ${f.vulnerabilities.length - 6} más.\n\n`);
  const r = f.remediation;
  if (r?.status === "upgrade" && r.recommended) {
    md.appendMarkdown(
      `**Solución:** actualizar a \`${r.recommended}\`${r.verified ? " ✅ verificada: ninguna falla conocida la afecta" : ""}` +
        `${f.majorBump ? " ⚠️ cambia la versión mayor" : ""}.\n\n`,
    );
    for (const c of r.commands.slice(0, 2)) md.appendMarkdown(`\`${c.command}\` _(${c.label})_\n\n`);
  } else if (r?.status === "no-fix") {
    md.appendMarkdown(
      `**Sin versión segura publicada.** Mitigación: ${r.mitigations[0]?.text ?? "ver reporte"}\n\n`,
    );
  }
  md.appendMarkdown(`[Ver reporte completo](command:depscan.showReport)`);
  return md;
}

export function registrarProveedores(ctl: Controlador): vscode.Disposable[] {
  const hover = vscode.languages.registerHoverProvider(SELECTOR, {
    provideHover(doc, pos) {
      const h = ctl.hallazgoEn(doc.uri, pos);
      return h && h.rango ? new vscode.Hover(markdownHallazgo(h.finding), h.rango) : undefined;
    },
  });

  const acciones = vscode.languages.registerCodeActionsProvider(
    SELECTOR,
    {
      async provideCodeActions(doc, rango, contexto) {
        const out: vscode.CodeAction[] = [];
        const diags = contexto.diagnostics.filter((d) => d.source === "DepScan");
        for (const diag of diags.length ? diags : []) {
          const h = ctl.hallazgoEn(doc.uri, diag.range) ?? ctl.hallazgoEn(doc.uri, rango);
          if (!h) continue;
          const f = h.finding;
          if (corregible(f)) {
            const edit = await ctl.edicionPara(h);
            if (edit) {
              const a = new vscode.CodeAction(
                `DepScan: actualizar ${f.dependency.name} a ${f.remediation!.recommended} (versión segura${f.remediation!.verified ? " verificada" : ""})`,
                vscode.CodeActionKind.QuickFix,
              );
              a.edit = edit;
              a.diagnostics = [diag];
              a.isPreferred = true;
              out.push(a);
            }
          }
          const ver = new vscode.CodeAction(
            `DepScan: ver ${f.vulnerabilities[0]!.id} en OSV`,
            vscode.CodeActionKind.Empty,
          );
          ver.command = {
            command: "vscode.open",
            title: "Abrir",
            arguments: [osvUrl(f.vulnerabilities[0]!.id)],
          };
          out.push(ver);
        }
        return out;
      },
    },
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
  );

  const arbol = new ArbolHallazgos(ctl);
  const vista = vscode.window.createTreeView("depscan.findings", {
    treeDataProvider: arbol,
    showCollapseAll: true,
  });
  const sub = ctl.onCambio(() => {
    arbol.refrescar();
    const n = ctl.hallazgos.length;
    vista.badge = n ? { value: n, tooltip: `${n} dependencias vulnerables` } : undefined;
    vista.message =
      ctl.resultados.length && !n ? "✅ Ninguna dependencia con vulnerabilidades conocidas." : undefined;
  });

  return [hover, acciones, vista, sub];
}

type Nodo =
  { tipo: "hallazgo"; h: HallazgoUbicado } | { tipo: "vuln"; id: string; texto: string; sev: string };

const ORDEN: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
const COLOR: Record<string, string> = {
  critical: "errorForeground",
  high: "list.errorForeground",
  medium: "list.warningForeground",
  low: "editorInfo.foreground",
  unknown: "descriptionForeground",
};

export class ArbolHallazgos implements vscode.TreeDataProvider<Nodo> {
  private readonly evento = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.evento.event;

  constructor(private readonly ctl: Controlador) {}

  refrescar(): void {
    this.evento.fire();
  }

  getChildren(n?: Nodo): Nodo[] {
    if (!n) {
      return [...this.ctl.hallazgos]
        .sort((a, b) => ORDEN[a.finding.maxSeverity]! - ORDEN[b.finding.maxSeverity]!)
        .map((h) => ({ tipo: "hallazgo", h }));
    }
    if (n.tipo === "hallazgo") {
      return n.h.finding.vulnerabilities.map((v) => ({
        tipo: "vuln",
        id: v.id,
        texto: v.summary,
        sev: v.severity,
      }));
    }
    return [];
  }

  getTreeItem(n: Nodo): vscode.TreeItem {
    if (n.tipo === "vuln") {
      const item = new vscode.TreeItem(n.id);
      item.description = n.texto;
      item.tooltip = `${n.sev.toUpperCase()} · ${n.texto}`;
      item.iconPath = new vscode.ThemeIcon("bug", new vscode.ThemeColor(COLOR[n.sev]!));
      item.command = { command: "vscode.open", title: "Abrir en OSV", arguments: [osvUrl(n.id)] };
      return item;
    }
    const f = n.h.finding;
    const d = f.dependency;
    const item = new vscode.TreeItem(
      `${d.name} ${d.resolved ?? ""}`,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    const sol = f.remediation?.recommended
      ? ` → ${f.remediation.recommended}`
      : f.remediation?.status === "no-fix"
        ? " · sin corrección"
        : "";
    item.description = `${f.maxSeverity}${sol}${d.direct ? "" : " · transitiva"}`;
    item.tooltip = markdownHallazgo(f);
    item.iconPath = new vscode.ThemeIcon(
      f.maxSeverity === "critical" || f.maxSeverity === "high" ? "error" : "warning",
      new vscode.ThemeColor(COLOR[f.maxSeverity]!),
    );
    item.contextValue = corregible(f) ? "corregible" : "hallazgo";
    item.command = { command: "depscan.openFinding", title: "Abrir", arguments: [n.h] };
    return item;
  }
}
