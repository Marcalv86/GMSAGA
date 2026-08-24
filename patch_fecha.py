import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add fechaCompacta to imports
content = content.replace(
    'fechaCompleta,\n  fechaLegible,',
    'fechaCompleta,\n  fechaLegible,\n  fechaCompacta,'
)

# Update fechaBoton
old_logic = '''  const llevaElTiempo =
    Boolean(currentProject?.currentDate) &&
    calendarioValido(currentProject?.calendar);
  const fechaBoton = "Tiempo";
  const tituloFecha ='''

new_logic = '''  const llevaElTiempo =
    Boolean(currentProject?.currentDate) &&
    calendarioValido(currentProject?.calendar);
  const fechaBoton =
    llevaElTiempo && currentProject?.calendar && currentProject.currentDate
      ? fechaCompacta(currentProject.calendar, currentProject.currentDate)
      : "Tiempo";
  const tituloFecha ='''

content = content.replace(old_logic, new_logic)

with open('src/App.tsx', 'w') as f:
    f.write(content)
print("Patched fechaBoton")
