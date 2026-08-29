import { NODE_KINDS, PALETTE_ORDER } from "../lib/nodeKinds.ts";
import { PALETTE_MIME } from "./Canvas.tsx";
import { useBuilder } from "../lib/builder.ts";

/**
 * The node palette. Drag a card onto the canvas, or click it to drop one in the
 * middle of the current node cluster - clicking is faster when you are adding a
 * chain of nodes and do not want to aim each time.
 */
export default function Palette() {
  const addNode = useBuilder((state) => state.addNode);
  const workflow = useBuilder((state) => state.workflow);

  const dropSpot = () => {
    const nodes = workflow?.nodes ?? [];
    if (!nodes.length) return { x: 80, y: 160 };
    const rightmost = nodes.reduce((furthest, node) =>
      node.position.x > furthest.position.x ? node : furthest,
    );
    return { x: rightmost.position.x + 300, y: rightmost.position.y };
  };

  return (
    <div className="w-[186px] shrink-0 overflow-y-auto border-r border-line bg-surface">
      <div className="px-3 pb-1.5 pt-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Nodes
        </h2>
        <p className="mt-1 text-[10.5px] leading-snug text-ink-faint">Drag onto the canvas</p>
      </div>

      <div className="flex flex-col gap-1 px-2 pb-4">
        {PALETTE_ORDER.map((kind) => {
          const meta = NODE_KINDS[kind];
          const Icon = meta.icon;
          return (
            <button
              key={kind}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(PALETTE_MIME, kind);
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => addNode(kind, dropSpot())}
              title={meta.blurb}
              className="flex cursor-grab items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-line hover:bg-raised active:cursor-grabbing"
            >
              <span
                className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: "color-mix(in srgb, currentColor 15%, transparent)",
                  color: meta.color,
                }}
              >
                <Icon size={11} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-medium leading-tight text-ink">
                  {meta.label}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-ink-faint">
                  {meta.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
