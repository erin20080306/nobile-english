"use client";

import { useEffect } from "react";
import { cloudAppStateService } from "@/services/cloudAppStateService";

export default function CloudStateSync() {
  useEffect(() => {
    cloudAppStateService.startAutoBackup();
    void cloudAppStateService.restoreCurrentUser().then(() => {
      void cloudAppStateService.backup(undefined, { force: true });
    });
  }, []);

  return null;
}
