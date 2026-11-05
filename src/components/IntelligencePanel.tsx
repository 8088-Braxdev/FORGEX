"use client";

import { Activity, ArrowUpRight, FileCode2, ShieldAlert, ScanSearch } from "lucide-react";
import type { IntelligenceV2 } from "@/lib/intelligence";
import styles from "./IntelligencePanel.module.css";

type Props = {
  report: IntelligenceV2;
  onOpenSource: (path: string, line?: number) => void;
};

function scoreLabel(score: number | null): string {
  return score === null ? "Not scored" : `${score}/100`;
}

export default function IntelligencePanel({ report, onOpenSource }: Props) {
  const { coverage, summary } = report;

  return (
    <section className={styles.root} aria-labelledby="forgex-intelligence-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>FORGEX INTELLIGENCE</p>
          <h2 id="forgex-intelligence-title">Understand the findings.</h2>
          <p>Advisory code analysis — not a security certification or test execution.</p>
        </div>
        <span className={styles.status} data-status={report.status}>
          {report.status === "complete" ? "Loaded files scanned" :
           report.status === "partial" ? "Partial scan" : "Scan required"}
        </span>
      </div>

      <div className={styles.metrics}>
        <article className={styles.metric}>
          <Activity size={18} aria-hidden="true" />
          <span>Combined code signals</span>
          <strong>{scoreLabel(report.score)}</strong>
          <small>Severity-weighted, normalized by project size</small>
        </article>
        <article className={styles.metric}>
          <ShieldAlert size={18} aria-hidden="true" />
          <span>Security signals</span>
          <strong>{scoreLabel(report.securityScore)}</strong>
          <small>Pattern-based findings; higher score is fewer signals</small>
        </article>
        <article className={styles.metric}>
          <ScanSearch size={18} aria-hidden="true" />
          <span>Targeted rule coverage</span>
          <strong>{coverage.targetedPercent}%</strong>
          <small>{coverage.targetedFiles} of {coverage.processedFiles} processed files</small>
        </article>
      </div>

      <div className={styles.details}>
        <div className={styles.block}>
          <h3>Scan context</h3>
          <div className={styles.fact}><span>Processed files</span><b>{coverage.processedFiles} / {coverage.importedFiles}</b></div>
          <div className={styles.fact}><span>Generic-only rules</span><b>{coverage.genericOnlyFiles}</b></div>
          <div className={styles.fact}><span>No active rules</span><b>{coverage.withoutActiveRules}</b></div>
          <div className={styles.fact}><span>Skipped by analyzer</span><b>{coverage.skippedDuringAnalysis}</b></div>
          <div className={styles.fact}><span>Findings / unique signals</span><b>{summary.findings} / {summary.uniqueIssues}</b></div>
          <p className={styles.note}>{coverage.note}</p>
          {report.status === "partial" && <p className={styles.warning}>Some loaded or remote files were not analyzed. Do not interpret the scores as covering the complete repository.</p>}
        </div>

        <div className={styles.block}>
          <h3>Priority fixes</h3>
          {!report.priorities.length ? <p className={styles.note}>No active heuristic findings in the files analyzed.</p> :
            <div className={styles.items}>
              {report.priorities.map((item) => (
                <button className={styles.item} type="button" key={item.id}
                  onClick={() => onOpenSource(item.path, item.line)}
                  aria-label={`Open ${item.path} line ${item.line}`}>
                  <span className={styles.severity} data-severity={item.severity}>{item.severity}</span>
                  <span className={styles.itemContent}>
                    <strong>{item.title}</strong>
                    <small>{item.path}:{item.line} · {item.ruleId} · {item.confidence} confidence</small>
                    <small className={styles.suggestion}>Suggested next step: {item.suggestion}</small>
                  </span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>}
        </div>
      </div>

      {!!report.hotspots.length && (
        <div className={styles.block}>
          <h3>Files to review first</h3>
          <div className={styles.hotspots}>
            {report.hotspots.map((file) => (
              <button className={styles.hotspot} key={file.path} type="button"
                onClick={() => onOpenSource(file.path)}>
                <FileCode2 size={16} aria-hidden="true" />
                <span>{file.path}</span>
                <small>{file.findings} signals</small>
                <strong>{file.score}/100</strong>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className={styles.method}>{report.methodology}</p>
    </section>
  );
}