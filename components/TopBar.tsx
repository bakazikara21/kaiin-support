import Link from "next/link";

export default function TopBar({ backTo = "/", backLabel = "← ホームへ" }: { backTo?: string; backLabel?: string }) {
  return (
    <div className="topbar">
      <Link href={backTo} className="back-link">
        {backLabel}
      </Link>
    </div>
  );
}
