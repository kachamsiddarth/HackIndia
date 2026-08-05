"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import styles from "./FixActions.module.css";

export interface FixActionsProps {
  fixId: string;
  initialStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

/**
 * Interactive approval action bar for reviewing, approving, rejecting, and rolling back fixes.
 */
export default function FixActions({
  fixId,
  initialStatus,
  onStatusChange,
}: FixActionsProps): ReactNode {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: "approve" | "reject" | "rollback") => {
    try {
      setLoading(true);
      const res = await fetch(`/api/fixes/${fixId}/${action}`, { method: "POST" });
      const json = await res.json();
      if (json.data?.fix) {
        const newStatus = json.data.fix.status;
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      }
    } catch (err) {
      console.error(`Failed to ${action} fix:`, err);
    } finally {
      setLoading(false);
    }
  };

  if (status === "approved") {
    return (
      <div className={styles.actionsRow}>
        <Badge variant="success" size="sm" showDot>
          Fix Approved
        </Badge>
        <Button
          variant="secondary"
          size="sm"
          isLoading={loading}
          onClick={() => handleAction("rollback")}
        >
          Rollback Fix
        </Button>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className={styles.actionsRow}>
        <Badge variant="error" size="sm" showDot>
          Fix Rejected
        </Badge>
        <Button
          variant="secondary"
          size="sm"
          isLoading={loading}
          onClick={() => handleAction("approve")}
        >
          Re-approve
        </Button>
      </div>
    );
  }

  if (status === "rolled_back") {
    return (
      <div className={styles.actionsRow}>
        <Badge variant="neutral" size="sm" showDot>
          Fix Rolled Back
        </Badge>
      </div>
    );
  }

  return (
    <div className={styles.actionsRow}>
      <Button
        variant="primary"
        size="sm"
        isLoading={loading}
        onClick={() => handleAction("approve")}
      >
        Approve Fix
      </Button>
      <Button
        variant="danger"
        size="sm"
        isLoading={loading}
        onClick={() => handleAction("reject")}
      >
        Reject Fix
      </Button>
    </div>
  );
}
