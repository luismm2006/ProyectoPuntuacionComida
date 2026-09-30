# MEMORY.md — Diario de Comidas
Memoria breve del proyecto entre sesiones.

## Estado actual
- Aplicación de HTML, CSS y JavaScript; los archivos se pueden alojar como web estática.
- Lee y escribe votos compartidos en la tabla `public.votos` de Supabase mediante REST.
- El usuario confirmó que ejecutó el SQL de creación de tabla y política RLS en Supabase.
- El repositorio se subió a GitHub; no hay confirmación de que GitHub Pages ya esté publicando.
- Registra votante, persona evaluada, comida, descripción, puntuación y fecha.
- Cada persona vota las dos comidas de las otras tres; hacen falta seis votos recibidos para completar un día. Las puntuaciones aceptan decimales de 0 a 10 y el total máximo sigue siendo 60.
- La vista vuelve a consultar Supabase al cargar y al volver a la pestaña.
- Se añadió soporte para una foto compartida por fecha/persona/comida; metadatos en `public.fotos_comidas`, archivos en Cloudinary.
- `cloud_name` y el preset unsigned están configurados en `app.js`; no guardar sus valores aquí.
- Falta confirmar que se ejecutó la migración SQL de `public.fotos_comidas` y que el preset restringe tipo y tamaño de imagen.
- Falta migrar `public.votos.puntuacion` de `smallint` a `numeric` y permitir 0–10 para aceptar decimales.

## Decisiones (y por qué)
- No se permite el auto voto ni duplicar voto por fecha, votante, persona y comida.
- Los días incompletos no dan ganador. Los empates cuentan para todas las personas empatadas.
- La racha general cuenta días completos de las cuatro personas y termina en hoy; si hoy está incompleto, vale cero.
- No hay inicio de sesión: elegir un nombre no verifica identidad. La política pública actual permite leer, crear, editar y borrar votos a cualquiera.
- El frontend usa la URL del proyecto y una clave publicable; nunca incluir claves `service_role` ni secret keys.
- Las cargas unsigned no permiten borrado seguro desde el navegador; al reemplazar una foto, el archivo anterior puede quedar en Cloudinary.
- Los votos guardados anteriormente en localStorage no se borran, pero no se importan automáticamente a Supabase.
- Los votos antiguos de `diario-comidas-registros-v1` no se migran: no identifican al votante y no se deben inventar esas atribuciones.

## Aprendizajes y errores a evitar
- Calcular y mostrar fechas en hora local; no usar `toISOString()` ni `new Date("AAAA-MM-DD")`.
- Al calcular completitud, comprobar los tres votos de cada comida, no solo que exista un registro.
- No incluir nunca claves privadas de Supabase en el frontend.

## Próximos pasos
- Probar conexión, altas, edición, borrado, duplicados y acceso desde otro navegador.
- Confirmar/ejecutar SQL para `public.fotos_comidas`, revisar restricciones del preset unsigned y probar subida, visualización y reemplazo desde otro navegador.
- Confirmar/terminar la publicación de los tres archivos estáticos en GitHub Pages.
- Antes de uso público, revisar RLS; añadir Supabase Auth si se necesita verificar quién vota.
- SDD y MCP son ideas futuras, aún no implementadas ni configuradas.