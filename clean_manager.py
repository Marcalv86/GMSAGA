import re

with open('src/components/MemoryManager.tsx', 'r') as f:
    content = f.read()

# Delete lines containing the matched strings
lines = content.split('\n')
new_lines = []
skip = False
for line in lines:
    if 'const handleClearStatus = () => {' in line:
        skip = True
        continue
    if skip and '};' in line:
        skip = False
        continue
    if skip:
        continue
    
    if 'setStatusDraft' in line or 'setIsEditingStatus' in line or 'handleClearStatus' in line:
        continue
    new_lines.append(line)

with open('src/components/MemoryManager.tsx', 'w') as f:
    f.write('\n'.join(new_lines))

print("Cleaned MemoryManager")
