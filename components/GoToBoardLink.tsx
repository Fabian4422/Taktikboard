"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";

function BoardLinkLabel() {
  const { pending } = useLinkStatus();

  return pending ? "Taktikboard wird geladen…" : "Zum Taktikboard";
}

export function GoToBoardLink() {
  return (
    <Link
      href="/admin/tactics-board"
      className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-500"
    >
      <BoardLinkLabel />
    </Link>
  );
}
