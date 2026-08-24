import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Update activeTab state
content = content.replace('    | "status"\n    | "memory"', '    | "diary"')

# Update top bar icons
old_tabs = '''{[
              { id: "chat", label: "Crónica", icon: Swords },
              { id: "status", label: "Estado", icon: Compass },
              { id: "memory", label: "Fichas", icon: ScrollText },
              {
                id: "calendar",
                label: fechaBoton,
                icon: BookOpen,
                title: tituloFecha,
              },
            ]'''
new_tabs = '''{[
              { id: "chat", label: "Crónica", icon: Swords },
              { id: "diary", label: "Diario", icon: BookOpen },
              {
                id: "calendar",
                label: fechaBoton,
                icon: Compass,
                title: tituloFecha,
              },
            ]'''
content = content.replace(old_tabs, new_tabs)

# Remove StatusView from rendering
start_status_view = '{activeTab === "status" && currentProject && ('
end_status_view = '          {activeTab === "memory" && currentProject && ('

start_idx = content.find(start_status_view)
end_idx = content.find(end_status_view)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + content[end_idx:]

# Change "memory" to "diary"
content = content.replace('{activeTab === "memory" && currentProject && (', '{activeTab === "diary" && currentProject && (')

# Pass extra props to MemoryManager
# Find MemoryManager component in App.tsx
old_mm = '''<MemoryManager
              secciones={["character", "npcs", "locs", "visual", "quests"]}
              project={currentProject}
              files={currentFiles}
              onUpdateMemory={handleUpdateMemory}
              onTriggerAIUpdate={handleTriggerAISyncMemory}
              onAnalyzeImageFile={handleAnalyzeImageFile}
              onUpdateFileAnalysis={handleUpdateFileAnalysis}
              onDeleteFileAnalysis={handleDeleteFileAnalysis}
              onOpenMap={(file) => setSelectedMapFile(file)}
              onAutoClassifyAll={handleAutoClassifyAll}
              onUploadEntityImage={handleUploadEntityImage}
              isGenerating={isBackgroundSyncingMemory || isGenerating}
              hasChats={currentChats.some((c) =>
                (c.messages || []).some(
                  (m) =>
                    m.content &&
                    m.content.trim().length > 0 &&
                    m.content !== "Pensando..." &&
                    m.content !== "Tirando dados...",
                ),
              )}
            />'''

new_mm = '''<MemoryManager
              project={currentProject}
              files={currentFiles}
              chats={currentChats}
              onUpdateProject={handleUpdateProjectField}
              onUpdateMemory={handleUpdateMemory}
              onTriggerAIUpdate={handleTriggerAISyncMemory}
              onAnalyzeImageFile={handleAnalyzeImageFile}
              onUpdateFileAnalysis={handleUpdateFileAnalysis}
              onDeleteFileAnalysis={handleDeleteFileAnalysis}
              onOpenMap={(file) => setSelectedMapFile(file)}
              onAutoClassifyAll={handleAutoClassifyAll}
              onUploadEntityImage={handleUploadEntityImage}
              isGenerating={isBackgroundSyncingMemory || isGenerating}
              hasChats={currentChats.some((c) =>
                (c.messages || []).some(
                  (m) =>
                    m.content &&
                    m.content.trim().length > 0 &&
                    m.content !== "Pensando..." &&
                    m.content !== "Tirando dados...",
                ),
              )}
            />'''

content = content.replace(old_mm, new_mm)

# Write back
with open('src/App.tsx', 'w') as f:
    f.write(content)
print("App.tsx patched successfully")
