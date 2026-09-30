# AGENTS.md — Diario de Comidas

Web para que Luis, Jose, Cristina y Arianna valoren comidas y consulten puntuaciones, clasificación, historial y rachas. Proyecto didáctico: el código debe ser claro para alguien que empieza.

## Stack y publicación
- HTML, CSS y JavaScript puros, sin frameworks, librerías, npm, compilación ni pasos de build.
- `index.html` (estructura), `styles.css` (estilos) y `app.js` (interfaz, lógica y conexión REST).
- La aplicación se publica como sitio estático, por ejemplo en GitHub Pages. Las lecturas y escrituras necesitan Internet y el proyecto Supabase.
- No uses módulos ES, `fetch` a archivos locales ni dependencias externas. Para comprobar la conexión, usa el sitio publicado o un origen local compatible con peticiones web.
- Mantén la interfaz en español, responsive y sencilla; escapa el texto de comidas antes de insertarlo en HTML.

## Personas y votos
- Las únicas personas válidas son Luis, Jose, Cristina y Arianna.
- Cada voto tiene fecha local, votante, persona evaluada, comida (1 o 2), descripción y puntuación.
- No se permite el auto voto. Cada votante puede puntuar una vez cada comida de cada persona por fecha.
- Cada comida recibe tres votos, uno de cada persona distinta de la evaluada. Cada persona necesita sus seis votos para completar el día; su total máximo es 60.
- La puntuación puede tener decimales y debe estar entre 0 y 10, inclusive. Una persona incompleta no puede ganar el día.
- Si hay empate en la puntuación máxima, todas las personas empatadas ganan; no inventes desempates.

## Supabase y seguridad
- La tabla compartida es `public.votos`. Columnas SQL: `id`, `fecha`, `votante`, `persona`, `comida`, `nombre_comida`, `puntuacion`. En JavaScript, `nombre_comida` se representa como `nombreComida`.
- Las fotos compartidas por comida se guardan como referencias en `public.fotos_comidas`: `id`, `fecha`, `persona`, `comida`, `foto_url`, `foto_public_id`. El archivo de imagen vive en Cloudinary, no en Supabase.
- `app.js` usa la API REST de Supabase y la clave publicable. La URL y la clave publicable pueden estar en el frontend; nunca incluyas `service_role`, secret keys, tokens ni credenciales privadas.
- Las subidas usan el preset unsigned de Cloudinary configurado en `app.js`. `cloud_name` y el nombre del preset son públicos; configura el preset para aceptar solo imágenes, limitar tamaño y usar la carpeta apropiada. Nunca incluyas el API secret.
- La sustitución de una foto actualiza su referencia, pero una carga unsigned no puede borrar del frontend el archivo antiguo de Cloudinary; no implementes borrado de assets sin un flujo seguro del lado servidor.
- RLS debe permanecer activada. La política pública configurada actualmente permite a cualquier visitante leer, añadir, editar y borrar votos.
- El selector de votante no autentica la identidad. No presentes nombres elegidos como verificados ni amplíes permisos sin autorización.
- El botón de borrar todos los votos afecta a todos y siempre debe pedir confirmación.
- Los votos anteriores guardados en `localStorage` no se importan: no identifican al votante. No los borres ni inventes atribuciones.
- Si cambia el esquema, coordina la migración SQL con el mapeo REST del frontend y pide autorización antes de modificar datos o almacenamiento.

## Fechas, rachas y clasificación
- Usa siempre fechas locales. No uses `toISOString()` ni `new Date("AAAA-MM-DD")`.
- Un día está completo cuando las cuatro personas recibieron sus seis votos: 24 votos en total.
- La racha general cuenta días completos consecutivos hasta hoy; si hoy no está completo, la racha es cero.
- La racha individual cuenta días consecutivos hasta hoy en que esa persona recibió sus seis votos.
- La clasificación suma los totales de días completos por persona. Los empates comparten posición y los empates diarios cuentan como victoria para todas las personas empatadas.
- El historial muestra fechas anteriores, de más reciente a más antigua.

## Forma de trabajar
- Haz solo lo solicitado; conserva código sencillo y cambios pequeños. No añadas funcionalidades por iniciativa propia.
- Lee `MEMORY.md` al empezar y actualízalo al terminar cada tarea. No guardes claves, tokens ni datos sensibles.
- No hagas commit, push ni despliegue sin que el usuario lo pida explícitamente.
- SDD y MCP son planes futuros, no configuraciones actuales. No añadas especificaciones, servidores MCP ni dependencias hasta que se soliciten.
- Cuando se incorpore MCP, úsalo solo para desarrollo, con permisos mínimos y sin exponer claves secretas.

## Verificación
- Ejecuta `node --check app.js` y revisa los diagnósticos del editor.
- Prueba desde una página servida con conexión: carga de votos, alta, auto voto, duplicado, edición, eliminación individual y borrado total con confirmación.
- Prueba también fotos: subida, previsualización, recarga desde otro navegador y errores por configuración incompleta; comprueba que el preset unsigned restringe tipos y tamaño.
- Verifica los 24 votos, puntuación máxima de 60, incompletos, empates, fechas locales, rachas, historial y persistencia desde otro navegador.
- Ante errores, comprueba URL y clave publicable, tabla `public.votos`, permisos y políticas RLS. No soluciones fallos desactivando RLS ni usando una clave secreta.