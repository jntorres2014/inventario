# Inventario local de activos

Sistema dividido en dos partes independientes:

1. **Escáner móvil web (PWA):** funciona offline en Android, guarda las lecturas en el teléfono y descarga un Excel.
2. **Comparador Ubuntu:** carga el inventario maestro y uno o varios Excel de escaneos para producir el resultado final.

El teléfono nunca recibe el inventario maestro y no necesita conectarse al servidor durante el recorrido.

## Flujo de trabajo

1. Instalar una vez la PWA desde el servidor Ubuntu mediante HTTPS local.
2. Abrir la PWA, indicar operador y sector, y escanear sin conexión.
3. Descargar `escaneo_<sector>_<fecha>.xlsx` en el teléfono.
4. Pasar el archivo a Ubuntu, preferentemente por USB.
5. En Ubuntu, cargar primero el Excel maestro y después los archivos generados por los celulares.
6. Descargar el Excel final con encontrados en verde y pendientes en rojo.

## Funciones del celular

- Cámara para códigos de barras mediante la API segura del navegador.
- Ingreso manual como alternativa.
- Registro automático en IndexedDB para no perder lecturas al cerrar la aplicación.
- Conteo de códigos únicos, lecturas totales y repetidos.
- Operador, sector, fecha y hora.
- Generación local de un archivo `.xlsx` válido, sin enviar información al servidor.
- Instalación en pantalla de inicio y funcionamiento offline mediante Service Worker.
- Sin APIs externas, CDN, Firebase ni servicios en la nube.

## Funciones de Ubuntu

- Importación del inventario maestro `.xlsx`.
- Importación acumulativa de uno o varios Excel generados por teléfonos.
- Estados: encontrado, pendiente, repetido y desconocido.
- Panel de avance y trazabilidad del primer operador.
- Exportación del Excel maestro coloreado.
- Hoja adicional con códigos desconocidos.
- Conservación de ceros iniciales cuando el Excel usa formatos como `000000`.

## Prueba rápida en Ubuntu

Requiere Python 3.11 o posterior.

```bash
sudo apt update
sudo apt install git python3 python3-venv openssl
git clone -b codex/mvp-inventario-local https://github.com/jntorres2014/inventario.git
cd inventario
chmod +x start.sh
./start.sh
```

Abrir en Ubuntu:

```text
http://localhost:8000
```

Pulsar **Usar inventario de demostración**. Los códigos válidos son:

```text
000101
000102
000103
```

Esta prueba HTTP permite validar el comparador. Para instalar la PWA y usar la cámara se necesita HTTPS.

## HTTPS local e instalación de la PWA

Obtener la IP del servidor:

```bash
hostname -I
```

Iniciar con HTTPS indicando la IP, por ejemplo:

```bash
chmod +x start-https.sh scripts/create-local-cert.sh
./start-https.sh 192.168.50.10
```

La primera vez se crean una autoridad certificadora privada y un certificado para esa IP dentro de `certs/`. Ese directorio está excluido de Git.

En el Android de prueba:

1. Copiar `certs/inventory-ca.crt` al teléfono mediante un medio autorizado.
2. Instalarlo como certificado de CA desde la configuración de seguridad de Android.
3. Conectar temporalmente el teléfono a la misma red local que Ubuntu.
4. Abrir `https://192.168.50.10:8443/mobile/` en Chrome.
5. Verificar que no aparezca una advertencia de certificado.
6. Seleccionar **Instalar aplicación** o usar el menú de Chrome.
7. Abrir la aplicación instalada y probar la cámara.
8. Desconectar el teléfono de la red: las lecturas y la exportación siguen funcionando offline.

> La instalación de una CA en teléfonos laborales debe ser autorizada por Seguridad. La clave `inventory-ca.key` debe permanecer protegida únicamente en Ubuntu.

## Archivos y seguridad

- No subir Excel reales al repositorio.
- `data/`, `certs/`, archivos Excel y la base SQLite están excluidos mediante `.gitignore`.
- El archivo móvil solo contiene códigos escaneados y datos de la jornada; no contiene el inventario maestro ni descripciones de activos.
- El comparador funciona en Ubuntu y no requiere hosting externo.

## Pruebas

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

El flujo automático cubre inventario demo, lectura encontrada, repetición, código desconocido, importación del Excel móvil, estadísticas y exportación final.

