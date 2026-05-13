#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";

const file = "components/OrganizationSelection.tsx";
let content = await readFile(file, "utf-8");

// Replace the second block of sequential awaits
content = content.replace(
  /await refetchOrganizations\(\);\n\t+await refetchSelectionData\(\);\n\t+await authClient\.organization\.setActive\({\n\t+organizationId: invitation\.organizationId,\n\t+}\);\n\t+await refreshAndEnter\(\);/,
  "await Promise.all([\n\t\t\t\t\trefetchOrganizations(),\n\t\t\t\t\trefetchSelectionData(),\n\t\t\t\t\tauthClient.organization.setActive({\n\t\t\t\t\t\torganizationId: invitation.organizationId,\n\t\t\t\t\t}),\n\t\t\t\t\trefreshAndEnter(),\n\t\t\t\t]);"
);

await writeFile(file, content, "utf-8");
console.log("Done");
