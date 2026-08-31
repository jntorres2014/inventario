# Inventario local de activos

Prototipo para inventariar equipos mediante códigos de barras, compararlos con un Excel y exportar el resultado. Está diseñado para ejecutarse en un servidor local y no utiliza servicios en la nube.

## Funciones incluidas

- Importación de archivos `.xlsx`.
- Detección automática de columnas habituales de número de inventario.
- Comparación exacta y conservación de ceros iniciales cuando el Excel usa formatos como `000000`.
- Registro concurrente desde distintos dispositivos.
- Estados: encontrado, pendiente, repetido y no registrado.
- Identificación del operador y fecha de la primera lectura.
- Panel de avance actualizado cada cinco segundos.
- Exportación del Excel con encontrados en verde y pendientes en rojo.
- Hoja adicional para códigos que no estaban registrados.
- Datos de demostración incluidos desde la interfaz.

## Prueba rápida

Requiere Python 3.11 o posterior.

### Windows

Ejecutar:

```powershell
start.bat
```

### Ubuntu/Linux

Ejecutar:

```bash
chmod +x start.sh
./start.sh
```

Abrir en el equipo servidor:

```text
http://localhost:8000
```

Pulsar **Usar datos de demostración** y probar los códigos:

```text
000101
000102
000103
```

## Acceso desde teléfonos

El servidor se inicia escuchando en todas sus interfaces. En una red local autorizada, se accede usando su IP, por ejemplo:

```text
http://192.168.50.10:8000
```

El firewall debe permitir el puerto TCP 8000 únicamente desde la red de inventario.

> La cámara del navegador requiere un contexto HTTPS cuando la página se abre desde otro dispositivo. El ingreso manual funciona sobre HTTP y permite validar ahora la carga, comparación y exportación. La siguiente etapa incorporará HTTPS local y un lector compatible con Android/iPhone según el tipo real de código de barras.

## Seguridad y datos

- No subir archivos de inventario reales al repositorio.
- Los Excel, la base SQLite y las exportaciones se guardan dentro de `data/`, excluida por `.gitignore`.
- El repositorio no depende de Firebase, servicios de túnel ni APIs externas durante la ejecución.
- Para producción debe utilizarse HTTPS, autenticación y reglas de firewall definidas por el área de Seguridad.

## Formato esperado del Excel

La primera fila debe contener los encabezados. Se reconocen automáticamente nombres como:

- `Inventario`
- `Número Inventario`
- `Nro Inventario`
- `Código Inventario`

También se puede escribir el nombre exacto de la columna en la pantalla de carga.

## Estado del prototipo

Esta versión valida el circuito principal. Para cerrar la compatibilidad de cámara necesitamos una fotografía de la etiqueta y saber qué valor devuelve el código de barras real.

