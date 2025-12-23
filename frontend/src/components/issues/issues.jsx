// src/components/Issues.jsx
import React from "react";
import "./issues.css";

const issues = [
  { id: 1, title: "Agent Not Responding", device: "Laptop-Dev-02", severity: "High", icon: "🚨", time: "2025-09-26T08:00:00Z" },
  { id: 2, title: "No Agent Installed", device: "Printer-HR-01", severity: "Medium", icon: "⚠️", time: "2025-09-26T09:15:00Z" },
  { id: 3, title: "Unauthorized Access Attempt", device: "Server-DB-01", severity: "Critical", icon: "🔥", time: "2025-09-26T10:30:00Z" },
  { id: 4, title: "Failed Backup", device: "Server-Web-01", severity: "Low", icon: "💾", time: "2025-09-26T11:00:00Z" },
  { id: 5, title: "Disk Space Low", device: "Workstation-01", severity: "Warning", icon: "📉", time: "2025-09-26T12:45:00Z" }
];

const Issues = () => {
  return (
    <div className="issues-content-wrapper">
      <h1 className="issues-title">System Issues</h1>

      <div className="issues-grid">
        {issues.map((issue) => (
          <div className={`issue-card severity-${issue.severity}`} key={issue.id}>
            <div className="issue-icon">{issue.icon}</div>
            <h3 className="issue-title">{issue.title}</h3>
            <span className="issue-device">Device: {issue.device}</span>
            <span className="issue-time">
              {new Date(issue.time).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Issues;
