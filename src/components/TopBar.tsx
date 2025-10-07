import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "../SignOutButton";
import OverflowMenu from "./OverflowMenu";
import { Search, ExternalLink, Undo2, Redo2 } from "./icons";

interface TopBarProps {
  board: {
    _id: string;
    title: string;
    description?: string;
  };
}

export default function TopBar({ board }: TopBarProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="text-xl font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Nodea
        </button>
        <div className="text-gray-400">•</div>
        <h1 className="text-lg font-medium text-gray-900 truncate max-w-xs">
          {board.title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Search size={16} />
          </div>
        </div>

        <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md">
          <ExternalLink size={16} />
        </button>

        {/* Undo/Redo buttons */}
        <div className="flex items-center gap-1">
          <button 
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
            title="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button 
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
            title="Redo"
          >
            <Redo2 size={16} />
          </button>
        </div>

        <OverflowMenu boardId={board._id} />
        <SignOutButton />
      </div>
    </header>
  );
}
