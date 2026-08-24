import re

with open('src/components/CharacterSheetView.tsx', 'r') as f:
    content = f.read()

# Add Pencil, Trash2 to imports
content = content.replace('  Wrench,\n} from "lucide-react";', '  Wrench,\n  Pencil,\n  Trash2,\n} from "lucide-react";')

# Destructure onClearCharacter and onOpenEditModal
old_comp_def = '''export const CharacterSheetView: React.FC<CharacterSheetViewProps> = ({
  character: rawCharacter,
  onOpenPortraitPicker,
}) => {'''

new_comp_def = '''export const CharacterSheetView: React.FC<CharacterSheetViewProps> = ({
  character: rawCharacter,
  onOpenPortraitPicker,
  onClearCharacter,
  onOpenEditModal,
}) => {'''
content = content.replace(old_comp_def, new_comp_def)

# Add the absolute positioned buttons inside the hero card
old_hero_start = '''      {/* HERO / STAT CARD */}
      <div className="relative rounded-3xl overflow-hidden border-2 border-amber-500/40 bg-gradient-to-b from-amber-950/40 via-stone-900/90 to-black/95 text-amber-100 p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">'''

new_hero_start = '''      {/* HERO / STAT CARD */}
      <div className="relative rounded-3xl overflow-hidden border-2 border-amber-500/40 bg-gradient-to-b from-amber-950/40 via-stone-900/90 to-black/95 text-amber-100 p-6 md:p-8 shadow-xl group/hero">
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover/hero:opacity-100 transition-opacity z-10">
           {onOpenEditModal && (
             <button
               type="button"
               onClick={onOpenEditModal}
               className="p-1.5 rounded-md bg-black/60 border border-amber-500/50 text-amber-300/80 hover:text-amber-100 hover:border-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm"
               title="Editar Ficha Manualmente"
             >
               <Pencil className="w-4 h-4" />
             </button>
           )}
           {onClearCharacter && (
             <button
               type="button"
               onClick={onClearCharacter}
               className="p-1.5 rounded-md bg-black/60 border border-red-500/50 text-red-400 hover:text-red-200 hover:border-red-400 hover:bg-red-500/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm"
               title="Vaciar Ficha del Personaje"
             >
               <Trash2 className="w-4 h-4" />
             </button>
           )}
        </div>
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-0">'''

content = content.replace(old_hero_start, new_hero_start)

# The name in the UI could be very long without break-words, which breaks layout.
# Let's add break-words to the name.
old_name = '''              <h1 className="font-cinzel text-3xl sm:text-4xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 m-0">'''
new_name = '''              <h1 className="font-cinzel text-3xl sm:text-4xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 m-0 break-words line-clamp-3">'''
content = content.replace(old_name, new_name)


with open('src/components/CharacterSheetView.tsx', 'w') as f:
    f.write(content)
print("Patched CharacterSheetView.tsx")
