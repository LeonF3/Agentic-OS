"use client";

import type { ReactNode } from "react";

/**
 * Every screen answers: What is this? What can I do here?
 * `script` is the handwritten Wonderland layer label.
 */
export default function PageHeader({
  script,
  title,
  description,
  actions,
}: {
  script?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {script && <div className="accent-script text-lg leading-none">{script}</div>}
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-mist-100">{title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-mist-400">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
