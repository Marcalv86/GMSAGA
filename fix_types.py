import re

with open('src/components/MemoryManager.tsx', 'r') as f:
    content = f.read()

# Fix MemoryManager typing
content = content.replace(
    'onUpdateProject?: (field: keyof Project, value: any) => Promise<void>;',
    'onUpdateProject?: (fields: Partial<Project> | ((prev: Project) => Partial<Project>)) => Promise<void> | void;'
)

# Remove unused states and functions related to editing status in MemoryManager
# We can just remove `isEditingStatus`, `handleSaveStatus`, `handleClearStatus` 
# Actually let's just let TS fail on them and use sed to remove them

with open('src/components/MemoryManager.tsx', 'w') as f:
    f.write(content)

with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace('import { StatusView } from "./components/StatusView";', '')
content = content.replace('ScrollText,\n', '')

with open('src/App.tsx', 'w') as f:
    f.write(content)

print("Fixed types")
