import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface OverflowMenuProps {
  boardId: string;
}

export default function OverflowMenu({ boardId }: OverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const exportMarkdown = useQuery(
    api.exports.exportMarkdown,
    boardId ? ({ boardId: boardId as Id<"boards"> }) : "skip",
  );
  const exportJson = useQuery(
    api.exports.exportJson,
    boardId ? ({ boardId: boardId as Id<"boards"> }) : "skip",
  );
  const clearBoard = useMutation(api.exports.clearBoard);

  const handleExportMarkdown = () => {
    if (exportMarkdown) {
      const blob = new Blob([exportMarkdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'board-export.md';
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Markdown exported successfully");
    }
    setIsOpen(false);
  };

  const handleExportJson = async () => {
    if (exportJson) {
      try {
        // Create a blob with the JSON data
        const blob = new Blob([exportJson], { type: 'application/json' });
        
        // Use the File System Access API if available (modern browsers)
        if ('showSaveFilePicker' in window) {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: 'board-export.json',
            types: [{
              description: 'JSON files',
              accept: {
                'application/json': ['.json'],
              },
            }],
          });
          
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          
          toast.success("JSON exported successfully");
        } else {
          // Fallback for browsers that don't support File System Access API
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'board-export.json';
          a.click();
          URL.revokeObjectURL(url);
          toast.success("JSON exported successfully");
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error exporting JSON:', error);
          toast.error("Failed to export JSON");
        }
      }
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
      >
        ⋯
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={() => setShowApiKeys(true)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              API Keys
            </button>
            <button
              onClick={handleExportMarkdown}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Export Markdown
            </button>
            <button
              onClick={handleExportJson}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Export JSON
            </button>
            <div className="border-t border-gray-100 my-1"></div>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Clear Board
            </button>
          </div>
        </div>
      )}

      {showApiKeys && (
        <ApiKeysModal onClose={() => setShowApiKeys(false)} />
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Clear Board</h3>
            <p className="text-gray-600 mb-4">
              This will permanently delete all nodes and edges on this board. 
              Are you sure you want to continue?
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={async () => {
                  try {
                    const result = await clearBoard({ boardId: boardId as Id<"boards"> });
                    console.log("Clear board result:", result);
                    toast.success(`Board cleared successfully! Removed ${result.deleted.nodes} nodes, ${result.deleted.edges} edges, ${result.deleted.tags} tags, and ${result.deleted.nodeTags} node tags.`);
                    setShowClearConfirm(false);
                  } catch (error) {
                    console.error("Failed to clear board:", error);
                    toast.error(`Failed to clear board: ${error.message || error}`);
                  }
                }}
                className="flex-1 bg-red-600 text-white py-2 rounded-md hover:bg-red-700"
              >
                Yes, Clear Board
              </button>
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

function ApiKeysModal({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState<"openai" | "anthropic" | "google">("openai");
  const [nickname, setNickname] = useState("");
  const [secret, setSecret] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const apiKeys = useQuery(api.keys.listApiKeys);
  const addApiKey = useMutation(api.keys.addApiKey);
  const revokeApiKey = useMutation(api.keys.revokeApiKey);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !secret.trim()) return;

    try {
      setIsAdding(true);
      await addApiKey({
        provider,
        nickname: nickname.trim(),
        secret: secret.trim(),
      });
      setNickname("");
      setSecret("");
      toast.success("API key added successfully");
    } catch (error) {
      toast.error("Failed to add API key");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">API Keys</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-6">
          <h4 className="font-medium mb-3">Add New API Key</h4>
          <form onSubmit={handleAddKey} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="My OpenAI Key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={isAdding || !nickname.trim() || !secret.trim()}
              className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAdding ? "Adding..." : "Add API Key"}
            </button>
          </form>
        </div>

        <div>
          <h4 className="font-medium mb-3">Your API Keys</h4>
          {apiKeys?.length === 0 ? (
            <p className="text-gray-500 text-sm">No API keys added yet</p>
          ) : (
            <div className="space-y-2">
              {apiKeys?.map((key) => (
                <div
                  key={key._id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-md"
                >
                  <div>
                    <div className="font-medium">{key.nickname}</div>
                    <div className="text-sm text-gray-500">
                      {key.provider} • ****{key.last4}
                    </div>
                  </div>
                  <button
                    onClick={() => revokeApiKey({ keyId: key._id })}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
