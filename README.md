# PEC UNED - Experimento Figura-Fondo

Aplicación web estática (HTML + CSS + JavaScript) para ejecutar un experimento perceptivo de organización figura-fondo en GitHub Pages.

## Objetivo

Evaluar cómo el reconocimiento de objetos influye en la asignación figura-fondo.

En cada ensayo, el participante responde qué color percibe como figura (delante):

- BLANCO
- NEGRO

## Características implementadas

- Flujo secuencial de pantallas tipo laboratorio:
	- Bienvenida
	- Instrucciones
	- Inicio bloque 1
	- Ensayos bloque 1
	- Descanso
	- Inicio bloque 2
	- Ensayos bloque 2
	- Resultados
- 2 bloques experimentales:
	- Natural
	- Invertido
- Orden de bloques:
	- Aleatorio por defecto
	- Configurable por URL con el parámetro block1
- Ensayos por bloque:
	- 12 imágenes x 2 repeticiones = 24 ensayos
- Temporización por ensayo:
	- Fijación: 500-1000 ms
	- Estímulo: 100 ms
	- Máscara: 500-1000 ms
	- Respuesta obligatoria
- Registro por ensayo:
	- bloque
	- ensayo
	- imagen
	- respuesta
	- clasificación AS/BS
- Clasificación automática AS/BS según tabla oficial.
- Resultados automáticos:
	- Tabla de frecuencias (AS/BS por bloque)
	- Tabla de porcentajes (AS/BS por bloque)
	- Gráfica de barras con Chart.js
- Exportación CSV:
	- Datos brutos
	- Resumen de resultados

## Estructura del proyecto

- index.html
- style.css
- script.js
- assets/stimuli
	- N1.png ... N12.png
	- I1.png ... I12.png

## Requisitos

- Navegador moderno (Chrome, Edge, Firefox, Safari)
- No requiere backend

## Ejecución local

Opción 1 (rápida): abrir index.html en el navegador.

Opción 2 (recomendada): usar servidor local para evitar cualquier restricción del navegador con archivos locales.

Ejemplo con Python:

python -m http.server 8000

Luego abrir:

http://localhost:8000

## Despliegue en GitHub Pages

1. Subir el repositorio a GitHub (ya realizado en este proyecto).
2. En Settings > Pages:
	 - Source: Deploy from a branch
	 - Branch: main
	 - Folder: / (root)
3. Guardar y esperar la publicación.

## Configuración del bloque inicial

Por defecto, el bloque inicial es aleatorio.

Puedes forzarlo por URL:

- ?block1=natural
- ?block1=invertido

Ejemplo:

https://usuario.github.io/repositorio/?block1=natural

## Tabla AS/BS oficial usada

La tabla está en script.js, objeto AS_KEY.

Resumen:

- N1 N2 N5 N6 N9 N10 => AS = NEGRO
- N3 N4 N7 N8 N11 N12 => AS = BLANCO
- I1 I2 I5 I6 I9 I10 => AS = BLANCO
- I3 I4 I7 I8 I11 I12 => AS = NEGRO

## CSV exportados

1. Datos brutos:
	 - bloque, ensayo, imagen, respuesta, clasificacion
2. Resultados:
	 - bloque, frecuencia_AS, frecuencia_BS, porcentaje_AS, porcentaje_BS

## Verificación funcional realizada

Se ha realizado una prueba simulada de participante para validar:

- 48 ensayos totales (24 por bloque)
- 2 apariciones por cada estímulo en su bloque
- clasificación AS/BS sin valores inválidos
- tablas y porcentajes consistentes
- suma de porcentajes por bloque = 100%

Resultado: validación correcta.

## Notas de uso experimental

- Realizar la tarea en pantalla completa.
- Reducir distracciones del entorno.
- Mantener distancia de visión constante.
- Registrar cada participante en una ejecución independiente.

## Licencia

Uso académico para PEC UNED.
