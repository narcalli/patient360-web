"use client";

import { useState } from "react";
import { ConnectorsPanel } from "@/components/connectors";
import { IconTabs, type IconTab } from "@/components/icon-tabs";
import { ClipboardIcon, PlugIcon, ReplaceIcon, UploadIcon } from "@/components/icons";
import { PageHeader } from "@/components/staff-ui";
import { ToolGrid, type Tool } from "@/components/tool-grid";
import { can } from "@/lib/session";
import { useSessionContext } from "@/lib/use-session";

// What is on the Data page. Import needs imports.manage; Connectors need admin.actions (the hospital admin's); Modelling needs catalog.manage.
const IMPORT_TOOLS: Tool[] = [
  {
    href: "/admin/data/imports",
    label: "Import",
    description: "Bring people in from an Excel sheet. Check every row first, replace or delete the sheet, then run it.",
    icon: <UploadIcon size={22} />,
  },
  {
    href: "/admin/data/import-rules",
    label: "Import rules",
    description: "Tell the portal what each column in your Excel sheet means, and which columns a sheet must have.",
    icon: <ReplaceIcon size={22} />,
  },
];

const MODELLING_TOOLS: Tool[] = [
  {
    href: "/admin/data/patient-fields",
    label: "Patient fields",
    description: "Choose what information the hospital keeps about each patient, and who can see it.",
    icon: <ClipboardIcon size={22} />,
  },
];

/** Data: one page, one icon tab each (like Analytics): Excel imports, other systems' connectors, and modelling (what is kept about a patient). */
export default function DataPage() {
  const session = useSessionContext();
  const tabs: IconTab[] = [
    ...(can(session, "imports.manage") ? [{ key: "import", label: "Import", icon: <UploadIcon size={22} /> }] : []),
    ...(can(session, "admin.actions") ? [{ key: "connectors", label: "Connectors", icon: <PlugIcon size={22} /> }] : []),
    ...(can(session, "catalog.manage") ? [{ key: "modelling", label: "Modelling", icon: <ClipboardIcon size={22} /> }] : []),
  ];
  const [picked, setPicked] = useState<string | null>(null);
  const current = tabs.find((t) => t.key === picked) ?? tabs[0];

  return (
    <>
      <PageHeader title="Data" description="Bring data into the portal, connect other systems, and decide what is kept about each patient." />
      {current && (
        <div className="mt-6">
          <IconTabs tabs={tabs} value={current.key} onChange={setPicked} idPrefix="data" label="Data" />
          <div id="data-panel" role="tabpanel" aria-labelledby={`data-tab-${current.key}`} className="mt-5">
            {current.key === "import" ? (
              <ToolGrid tools={IMPORT_TOOLS} />
            ) : current.key === "modelling" ? (
              <ToolGrid tools={MODELLING_TOOLS} />
            ) : (
              <ConnectorsPanel />
            )}
          </div>
        </div>
      )}
    </>
  );
}
