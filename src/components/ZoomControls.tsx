import { useReactFlow } from "reactflow";
import { Plus, Minus, Home } from "./icons";

export default function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
      <button
        onClick={() => zoomIn()}
        className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
        title="Zoom In"
      >
        <Plus size={16} />
      </button>
      <button
        onClick={() => zoomOut()}
        className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
        title="Zoom Out"
      >
        <Minus size={16} />
      </button>
      <button
        onClick={() => fitView()}
        className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
        title="Fit View"
      >
        <Home size={16} />
      </button>
    </div>
  );
}
