import { BackupScreen } from "@/backup/BackupScreen";
import { StatusBarInset } from "@/layout/StatusBarInset";

export default function BackupRoute() {
  return (
    <StatusBarInset>
      <BackupScreen />
    </StatusBarInset>
  );
}
