# MATCH-CAT — Catálogo y recomendaciones comerciales

Ruta reforzada. Rama codex/catalogo-match. Petición de Campers Nova, 9 de noviembre de 2026.

El formulario público y las fichas internas comparten opciones de equipamiento. Las preferencias se valoran con igual peso. Los límites expresos son inclusivos y obligatorios. Si falta un requisito, la comercial puede verificarlo en la ficha del comprador; solo los aptos generan sugerencias automáticas. Las asociaciones manuales siguen disponibles.

Se añaden columnas JSON a vehículos y compradores con un catálogo validado en el servidor. Los datos existentes de presupuesto, plazas y dimensiones se leen de sus campos originales. El guardado interno comprueba la versión del catálogo para evitar pisar otra edición. Las captaciones públicas repetidas conservan la política de identidad y el historial existentes.

Validar con dos vehículos, plazas ausentes/insuficientes, presupuesto exacto, alternativas y observaciones abiertas. Aplicar la migración antes de publicar; si la validación de datos o permisos falla, detener la publicación. La aplicación anterior puede funcionar con las columnas adicionales.
