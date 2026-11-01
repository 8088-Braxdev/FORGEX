
"use client";

import { useMemo } from "react";
import {
  ArrowUpRight,
  GitBranch,
  Info,
  Network,
  Link2Off
} from "lucide-react";

import type { SourceFile } from "../lib/analyzer";
import { buildImpactGraph } from "../lib/impact";

type Props = {
  files: SourceFile[];
  onOpenFile: (path: string) => void;
};

export default function ImpactPanel({
  files,
  onOpenFile
}: Props) {
  const graph = useMemo(
    () => buildImpactGraph(files),
    [files]
  );

  const connected = useMemo(() => {
    return graph.files
      .map(path => ({
        path,
        imports: graph.importsOf(path).length,
        importers: graph.importedBy(path).length,
        affected: graph.affectedBy(path).length
      }))
      .filter(item => item.imports + item.importers > 0)
      .sort(
        (a, b) =>
          b.affected - a.affected ||
          b.importers - a.importers ||
          a.path.localeCompare(b.path)
      )
      .slice(0, 8);
  }, [graph]);

  return (
    <section className="impact-panel fx-overview">
      <header className="fx-overview-header">
        <div>
          <span className="impact-eyebrow">
            <Network size={15} />
            PROJECT INTELLIGENCE
          </span>

          <h2>Dependency overview</h2>
          <p>
            Explore detected relationships
            between loaded source files.
          </p>
        </div>

        <span className="impact-tag">
          STATIC ANALYSIS
        </span>
      </header>

      <div className="impact-stats">
        <div>
          <small>FILES LOADED</small>
          <strong>{graph.files.length}</strong>
        </div>

        <div>
          <small>LOCAL LINKS</small>
          <strong>{graph.edges.length}</strong>
        </div>

        <div>
          <small>UNRESOLVED IMPORTS</small>
          <strong>{graph.unresolved.length}</strong>
        </div>
      </div>

      {graph.edges.length === 0 ? (
        <div className="fx-overview-empty">
          <Info size={19} />

          <div>
            <strong>
              No supported local import links detected
            </strong>

            <p>
              The current graph mainly recognizes local
              JavaScript and TypeScript imports. HTML
              script links, CSS assets and incomplete
              repository imports may not appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="fx-overview-results">
          <div className="fx-overview-section-title">
            <GitBranch size={16} />
            Connected source files
          </div>

          <div className="fx-overview-files">
            {connected.map(item => (
              <button
                type="button"
                key={item.path}
                className="fx-overview-file"
                onClick={() => onOpenFile(item.path)}
                title={`Open ${item.path} in Code Workbench`}
              >
                <span>
                  <strong>{item.path}</strong>
                  <small>
                    {item.imports} imports ·
                    {" "}{item.importers} direct importers ·
                    {" "}{item.affected} possibly affected
                  </small>
                </span>

                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
        </div>
      )}

      {graph.unresolved.length > 0 && (
        <details className="impact-unresolved">
          <summary>
            <Link2Off size={15} />
            Review {graph.unresolved.length} unresolved imports
          </summary>

          <div className="impact-missing">
            {graph.unresolved.slice(0, 20).map((entry, i) => (
              <div key={`${entry.from}-${entry.specifier}-${i}`}>
                {entry.from} → {entry.specifier}
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="impact-disclaimer">
        Import-based estimates only. No runtime behavior
        or actual breakage has been verified.
      </p>
    </section>
  );
}
