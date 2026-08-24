import re

with open('src/components/MemoryManager.tsx', 'r') as f:
    content = f.read()

start_marker = '{/* Tab: Status (Estado Actual) */}'
end_marker = '{/* Tab: Visual'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + '''{/* Tab: Status (Estado Actual) */}
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

      ''' + content[end_idx:]
    with open('src/components/MemoryManager.tsx', 'w') as f:
        f.write(new_content)
    print("Patched successfully")
else:
    print("Markers not found")
