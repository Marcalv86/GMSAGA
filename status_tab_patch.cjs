const fs = require('fs');
let code = fs.readFileSync('src/components/MemoryManager.tsx', 'utf8');

const startMarker = '{/* Tab: Status (Estado Actual) */}';
const endMarker = '{/* Tab: Notes (Modo Narrador) */}';

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const newCode = code.substring(0, startIndex) +
    `{/* Tab: Status (Estado Actual) */}
      {activeTab === "status" && chats && onUpdateProject && (
        <div className="flex flex-col gap-3">
          <StatusView 
            project={project}
            files={files}
            chats={chats}
            onUpdate={onUpdateProject}
            onUpdateMemory={onUpdateMemory}
            onTriggerAIUpdate={onTriggerAIUpdate}
            isGenerating={isGenerating}
            hasChats={hasChats}
          />
        </div>
      )}

      ` + code.substring(endIndex);
  fs.writeFileSync('src/components/MemoryManager.tsx', newCode);
  console.log('Successfully patched status tab');
} else {
  console.log('Could not find markers');
}
