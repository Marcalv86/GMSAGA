import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

old_header = '''        {/* Sidebar Header */}
        <div className="p-3 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--glass)]">
          <h1 className="font-cinzel text-lg md:text-xl text-[var(--accent)] font-bold tracking-wider m-0">
            GM STUDIO
          </h1>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button'''

new_header = '''        {/* Sidebar Header */}
        <div className="p-3 border-b border-[var(--glass-border)] flex flex-col gap-3 bg-[var(--glass)]">
          <div className="flex justify-between items-center">
            <h1 className="font-cinzel text-lg md:text-xl text-[var(--accent)] font-bold tracking-wider m-0">
              GM STUDIO
            </h1>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden text-base text-[var(--text-secondary)] hover:text-[var(--accent)] p-1 cursor-pointer"
              title="Cerrar menú"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 justify-between w-full">
            <button'''

content = content.replace(old_header, new_header)

old_close_btn = '''            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden text-base text-[var(--text-secondary)] hover:text-[var(--accent)] p-1 cursor-pointer"
              title="Cerrar menú"
              aria-label="Cerrar menú"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>'''

new_close_btn = '''          </div>
        </div>'''

content = content.replace(old_close_btn, new_close_btn)

# Make the buttons stretch if we want, or just let them fit. 
# They have flex-1 justify-center for better layout:
content = content.replace(
    'className={`text-xs font-cinzel transition-all cursor-pointer px-2 sm:px-2.5 py-1 flex items-center gap-1.5 rounded border',
    'className={`flex-1 justify-center text-xs font-cinzel transition-all cursor-pointer px-1.5 py-1.5 flex items-center gap-1.5 rounded border'
)

content = content.replace(
    'className="text-xs text-[var(--accent)] hover:underline font-cinzel transition-colors cursor-pointer px-2 sm:px-2.5 py-1 flex items-center gap-1.5 rounded border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)]"',
    'className="flex-1 justify-center text-xs text-[var(--accent)] hover:underline font-cinzel transition-colors cursor-pointer px-1.5 py-1.5 flex items-center gap-1.5 rounded border border-[var(--user-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)]"'
)

with open('src/App.tsx', 'w') as f:
    f.write(content)

print("Patched sidebar header")
