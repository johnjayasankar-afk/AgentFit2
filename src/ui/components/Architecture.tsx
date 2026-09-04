import type { ArchitectureNode } from "@/domain/types";

export function Architecture({ nodes }: { nodes: ArchitectureNode[] }) {
  return (
    <ol className="arch" aria-label="Recommended system pattern">
      {nodes.map((node, i) => (
        <li key={node.id}>
          <span className="sys">{String(i + 1).padStart(2, "0")}</span>
          <span>{node.label}</span>
        </li>
      ))}
    </ol>
  );
}
