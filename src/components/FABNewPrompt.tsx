import { useState } from "react";
import { MessageCircle, StickyNote, Plus, X } from "./icons";

interface FABNewMessageProps {
  onCreateMessage: (position?: { x: number; y: number }) => void;
  onCreateNote: (position?: { x: number; y: number }) => void;
}

export default function FABNewPrompt({ onCreateMessage, onCreateNote }: FABNewMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isExpanded && (
        <div className="mb-4 flex flex-col gap-2">
          <button
            onClick={() => {
              onCreateMessage();
              setIsExpanded(false);
            }}
            className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors opacity-70 hover:opacity-100"
            title="New Message"
          >
            <MessageCircle size={16} />
          </button>
          <button
            onClick={() => {
              // Create note node
              onCreateNote();
              setIsExpanded(false);
            }}
            className="bg-yellow-600 text-white p-3 rounded-full shadow-lg hover:bg-yellow-700 transition-colors opacity-70 hover:opacity-100"
            title="New Note"
          >
            <StickyNote size={16} />
          </button>
        </div>
      )}
      
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-indigo-600 text-white rounded-full shadow-md hover:shadow-lg transition-all transform hover:scale-105 opacity-70 hover:opacity-100 flex items-center justify-center"
        style={{ height: '44px', width: '44px' }}
        title="New"
      >
        {isExpanded ? <X size={20} /> : <Plus size={20} />}
      </button>
    </div>
  );
}
