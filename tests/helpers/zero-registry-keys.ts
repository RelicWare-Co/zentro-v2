type ZeroRegistryNode = Record<string, unknown>;

function isZeroRegistryLeaf(value: unknown): value is { fn: unknown } {
  return (
    typeof value === "function" &&
    ("fn" in value || "queryName" in value || "mutatorName" in value)
  );
}

export function flattenZeroRegistryPaths(
  registry: ZeroRegistryNode,
  prefix = ""
): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(registry)) {
    if (key === "~") {
      continue;
    }

    const path = prefix ? `${prefix}.${key}` : key;

    if (isZeroRegistryLeaf(value)) {
      paths.push(path);
      continue;
    }

    if (value && typeof value === "object") {
      paths.push(...flattenZeroRegistryPaths(value as ZeroRegistryNode, path));
    }
  }

  return paths.sort();
}

function getRegistryEntryAtPath(
  registry: ZeroRegistryNode,
  path: string
): { fn: unknown } | undefined {
  let current: unknown = registry;

  for (const segment of path.split(".")) {
    if (!(current && typeof current === "object" && segment in current)) {
      return;
    }

    current = (current as ZeroRegistryNode)[segment];
  }

  return isZeroRegistryLeaf(current) ? current : undefined;
}

export function getServerMutatorOverridePaths(
  sharedMutators: ZeroRegistryNode,
  serverMutators: ZeroRegistryNode
): string[] {
  return flattenZeroRegistryPaths(serverMutators).filter((path) => {
    const sharedEntry = getRegistryEntryAtPath(sharedMutators, path);
    const serverEntry = getRegistryEntryAtPath(serverMutators, path);

    return (
      sharedEntry !== undefined &&
      serverEntry !== undefined &&
      sharedEntry.fn !== serverEntry.fn
    );
  });
}

interface ZeroNamedLeaf {
  mutatorName?: string;
  queryName?: string;
}

export function getRegistryNameMismatches(
  registry: ZeroRegistryNode,
  nameKey: "queryName" | "mutatorName",
  prefix = ""
): string[] {
  const mismatches: string[] = [];

  for (const [key, value] of Object.entries(registry)) {
    if (key === "~") {
      continue;
    }

    const path = prefix ? `${prefix}.${key}` : key;

    if (isZeroRegistryLeaf(value)) {
      const declaredName = (value as ZeroNamedLeaf)[nameKey];
      if (declaredName !== undefined && declaredName !== path) {
        mismatches.push(`${path} (declared ${declaredName})`);
      }
      continue;
    }

    if (value && typeof value === "object") {
      mismatches.push(
        ...getRegistryNameMismatches(value as ZeroRegistryNode, nameKey, path)
      );
    }
  }

  return mismatches.sort();
}
