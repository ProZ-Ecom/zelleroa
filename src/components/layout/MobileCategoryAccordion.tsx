"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { categoryHref, withGenderParam } from "@/features/customers/utils/catalog-listing-query";
import type { NavNode } from "./MegaMenu";

interface MobileCategoryAccordionProps {
  nodes: NavNode[];
  depth?: number;
  onNavigate?: () => void;
  /** Audience of the top-level nav item this subtree belongs to - carried down to every child link. */
  gender?: string | null;
}

/** Recursive expand/collapse accordion for the mobile drawer's category tree. */
export function MobileCategoryAccordion({
  nodes,
  depth = 0,
  onNavigate,
  gender,
}: MobileCategoryAccordionProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <div className={depth > 0 ? "pl-4 border-l border-white/10" : undefined}>
      {nodes.map((node) => {
        const href = withGenderParam(node.href ?? categoryHref(node), gender ?? node.gender);
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedId === node.id;

        return (
          <div key={node.id} className={depth === 0 ? "border-b border-white/10" : undefined}>
            <div className="flex items-center justify-between">
              <Link
                href={href}
                onClick={onNavigate}
                className={`flex-1 px-6 py-3 text-white hover:bg-white/10 transition-colors ${
                  depth === 0 ? "text-sm font-medium" : "text-xs text-white/85"
                }`}
                style={depth > 0 ? { paddingLeft: 16 + depth * 12 } : undefined}
              >
                {node.name}
              </Link>
              {hasChildren && (
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : node.id)}
                  className="px-4 py-3 text-white/70 hover:text-white"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>
              )}
            </div>

            {hasChildren && isExpanded && (
              <div className="bg-black/20 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                <MobileCategoryAccordion
                  nodes={node.children}
                  depth={depth + 1}
                  onNavigate={onNavigate}
                  gender={gender ?? node.gender}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MobileCategoryAccordion;
