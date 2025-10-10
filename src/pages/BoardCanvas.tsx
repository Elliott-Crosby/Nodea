import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import Canvas from "../components/Canvas";
import TopBar from "../components/TopBar";

export default function BoardCanvas() {
  const { boardId } = useParams<{ boardId: string }>();
  const board = useQuery(
    api.boards.getBoard,
    boardId ? { boardId: boardId as Id<"boards"> } : "skip",
  );

  if (!boardId) {
    return <div>Invalid board ID</div>;
  }

  if (board === undefined) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (board === null || (board && "status" in board)) {
    return <div>Board not found</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopBar board={board} />
      <div className="flex-1 relative">
        <Canvas boardId={boardId as Id<"boards">} />
      </div>
    </div>
  );
}
