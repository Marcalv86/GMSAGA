import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '  BookOpen,\n  Check,',
    '  BookOpen,\n  CalendarDays,\n  Check,'
)

content = content.replace(
    '''{
                id: "calendar",
                label: fechaBoton,
                icon: Compass,
                title: tituloFecha,
              }''',
    '''{
                id: "calendar",
                label: fechaBoton,
                icon: CalendarDays,
                title: tituloFecha,
              }'''
)

with open('src/App.tsx', 'w') as f:
    f.write(content)
print("Icons patched")
