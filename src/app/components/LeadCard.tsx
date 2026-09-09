"use client";

import Link from "next/link";
import { Chip } from "@nextui-org/react";
import { FaFacebook, FaFileCsv, FaUserEdit } from "react-icons/fa";
import type { Lead } from "@/lib/types";

const SOURCE_ICON: Record<Lead["source"], React.ReactNode> = {
  facebook: <FaFacebook className="text-blue-600" size={12} />,
  csv: <FaFileCsv className="text-emerald-600" size={12} />,
  manual: <FaUserEdit className="text-neutral-500" size={12} />,
};

export function LeadCard({ lead, onDragStart }: { lead: Lead; onDragStart: (id: string) => void }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(lead.id)}
      className="cursor-grab active:cursor-grabbing rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 shadow-sm hover:shadow transition-shadow"
    >
      <Link href={`/leads/${lead.id}`} className="block">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate">{lead.name}</span>
          {SOURCE_ICON[lead.source]}
        </div>
        {lead.campaignName && (
          <Chip size="sm" variant="flat" className="mt-1">
            {lead.campaignName}
          </Chip>
        )}
        <div className="mt-2 text-xs text-neutral-500 space-y-0.5">
          {lead.email && <div className="truncate">{lead.email}</div>}
          {lead.phone && <div className="truncate">{lead.phone}</div>}
        </div>
      </Link>
    </div>
  );
}
