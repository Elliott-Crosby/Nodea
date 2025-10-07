import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser, SignOutButton } from "@clerk/clerk-react";
import { Footer } from "../components/Footer";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const boards = useQuery(api.boards.listBoards, user ? {} : "skip");
  const createBoard = useMutation(api.boards.createBoard);
  const [isCreating, setIsCreating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const navigate = useNavigate();

  // Centralized create click instrumentation
  const handleCreateClick = () => {
    const timestamp = new Date().toISOString();
    // Visible toast for quick confirmation
    toast("Create clicked");
    // Console marker for debugging
    // eslint-disable-next-line no-console
    console.log(`[CREATE] click ${timestamp}`);
  };

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardTitle.trim()) return;

    try {
      setCreating(true);
      setCreateError(null);
      const boardId = await createBoard({
        title: newBoardTitle.trim(),
        description: "",
        ownerUserId: user.id,
      });
      setIsCreating(false);
      setNewBoardTitle("");
      navigate(`/b/${boardId}`);
    } catch (error) {
      console.error("Failed to create board:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Not authenticated")) {
        setCreateError("You must be signed in to create a board.");
      } else if (message.toLowerCase().includes("title")) {
        setCreateError("Please enter a valid board title.");
      } else {
        setCreateError("Could not create board. Please try again.");
      }
    }
    finally {
      setCreating(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
          <h2 className="text-xl font-semibold text-indigo-600">Nodea</h2>
        </header>

        <main className="flex-1 p-8">
          <div className="flex items-center justify-center min-h-[80vh] py-12">
            <div className="w-full max-w-md mx-auto px-4">
              <div className="text-center mb-8">
                <h1 className="text-5xl font-bold text-indigo-600 mb-4">Nodea</h1>
                <p className="text-xl text-gray-600">
                  Infinite canvas for AI conversations
                </p>
                <p className="text-gray-500 mt-2">
                  Sign in to get started
                </p>
              </div>

              <div className="space-y-4">
                <Link
                  to="/sign-in"
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors text-center block"
                >
                  Sign In
                </Link>
                <Link
                  to="/sign-up"
                  className="w-full bg-white text-indigo-600 py-3 px-4 rounded-lg border border-indigo-600 hover:bg-indigo-50 transition-colors text-center block"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </main>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-indigo-600">Nodea</h2>
        <div className="flex items-center gap-4">
          <Link
            to="/profile"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Profile
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Your Boards</h1>
              <p className="text-gray-600 mt-2">
                Welcome back, {user.firstName || user.emailAddresses[0]?.emailAddress || "friend"}!
              </p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              New Board
            </button>
          </div>

          {isCreating && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Create New Board</h3>
                <form onSubmit={handleCreateBoard}>
                  {createError && (
                    <div className="mb-3 text-sm text-red-600">
                      {createError}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Board title..."
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-4">
                    <button
                      type="submit"
                      disabled={creating}
                      data-testid="create-button"
                      onClick={handleCreateClick}
                      className={`relative z-50 pointer-events-auto flex-1 text-white py-2 rounded-md ${creating ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                      {creating ? 'CREATING…' : 'CREATE'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setNewBoardTitle("");
                        setCreateError(null);
                      }}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-md hover:bg-gray-300"
                      >
                      CANCEL
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {boards?.map((board) => (
              <div
                key={board._id}
                onClick={() => navigate(`/b/${board._id}`)}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              >
                <h3 className="font-semibold text-lg text-gray-900 mb-2">
                  {board.title}
                </h3>
                {board.description && (
                  <p className="text-gray-600 text-sm mb-4">{board.description}</p>
                )}
                <div className="text-xs text-gray-500">
                  Updated {new Date(board.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>

          {boards?.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-4">No boards yet</div>
              <button
                onClick={() => setIsCreating(true)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create Your First Board
              </button>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
