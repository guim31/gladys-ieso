# IESO Ontario Grid

Las cifras en directo de la red eléctrica de Ontario en Gladys, a partir de
los informes públicos del IESO (Independent Electricity System Operator): el
precio en tiempo real, la demanda, la generación por fuente, la proporción
baja en carbono y una intensidad de CO₂ estimada.

Los datos son públicos y no requieren cuenta: probada con los informes reales
del IESO. Sin relación con el IESO.

## Qué obtiene

- Un dispositivo **Red eléctrica de Ontario**: el precio zonal de Ontario
  ($/MWh), la demanda de Ontario, la intensidad de CO₂ estimada, las
  proporciones baja en carbono y renovable, la proporción nuclear,
  hidráulica, de gas natural, eólica, solar, de biocombustibles y de otras
  fuentes, y un resumen en una frase.
- Tres disparadores de escena: precio por encima de un umbral, precio por
  debajo de un umbral (0 para un precio negativo), proporción baja en carbono
  por encima de un umbral.
- Un widget de panel con el precio, la proporción baja en carbono, el CO₂, la
  demanda, una curva de precio de 24 h y el mix en barras.

**Los precios son precios mayoristas** del mercado en tiempo real del IESO,
no su tarifa: los hogares de Ontario pagan tarifas reguladas (por franja
horaria, por tramos o nocturna) más el transporte y el ajuste global. El
precio mayorista muestra igualmente cuándo la electricidad abunda o escasea.

## Requisitos

- Gladys 5.3.0 o posterior.
- Acceso a Internet desde Gladys (los informes se leen en
  `reports-public.ieso.ca`). Sin cuenta ni clave.

## Instalación

En Gladys, **Integraciones → Instalar desde GitHub**, y luego la dirección
del repositorio: `https://github.com/guim31/gladys-ieso`.

## Configuración

- **Umbral de precio alto** y **Umbral de precio bajo** ($/MWh): para los
  disparadores de precio. Vacío: disparador desactivado. Un umbral bajo de 0
  se dispara cuando el precio se vuelve negativo.
- **Umbral de proporción baja en carbono** (%): para el disparador bajo en
  carbono. Vacío: desactivado.
- **Idioma de los nombres**: nombres de las funciones (fijados al añadir el
  dispositivo), resumen y mensajes de las acciones. Francés por defecto.

Después, en la pestaña **Descubrir**, añada el dispositivo **Red eléctrica de
Ontario**.

## Dispositivos

### Red eléctrica de Ontario

| Función                       | Unidad | Actualización  |
| ----------------------------- | ------ | -------------- |
| Precio de Ontario             | $/MWh  | cada 5 minutos |
| Demanda de Ontario            | kW     | cada 5 minutos |
| Intensidad de CO₂, estimada   | g/kWh  | cada hora      |
| Proporción baja en carbono    | %      | cada hora      |
| Proporción renovable          | %      | cada hora      |
| Proporción de cada fuente (7) | %      | cada hora      |
| Resumen                       | texto  | cada 5 minutos |

Gladys no tiene unidad de megavatio: la demanda está en kW (17 GW se muestran
como 17 000 000 kW). El precio está en dólares canadienses, mostrado con la
unidad dólar de Gladys.

## Escenas

Los disparadores se activan **una vez por cruce**: el valor debe volver a
pasar el umbral con un margen (5 $/MWh, 2 puntos) antes de poder activarse de
nuevo. Un reinicio no los vuelve a activar.

### Precio IESO por encima del umbral

El precio supera el umbral alto. Variables: `price`, `threshold`.

### Precio IESO por debajo del umbral

El precio baja del umbral bajo (0: un precio negativo). Variables: `price`,
`threshold`.

### Red de Ontario: proporción baja en carbono alta

La proporción baja en carbono supera su umbral: buen momento para cargar un
coche o encender el calentador de agua. Variables: `low_carbon_share`,
`renewable_share`, `carbon_intensity`, `threshold`.

## Panel

### Widget Red de Ontario

El precio (en rojo por encima del umbral alto, en verde por debajo del bajo o
cuando es negativo), la proporción baja en carbono, el CO₂ y la demanda, una
curva de precio de 24 h una vez añadido el dispositivo, y el mix en barras. La
curva y el mix tienen cada uno un ajuste para ocultarlos.

## Acciones

### Probar la conexión con el IESO

Lee ahora el precio, la demanda y el mix, y responde con las cifras o con lo
que falló (en rojo).

## Datos y límites

- Fuentes: `RealtimeOntarioZonalPrice` (precio zonal de Ontario, cada cinco
  minutos; sustituyó al HOEP con la renovación del mercado de mayo de 2025),
  `RealtimeTotals` (demanda de Ontario, cada cinco minutos) y
  `GenOutputCapability` (generación horaria de cada central, publicada unos
  quince minutos después de la hora). Solo se leen los archivos actuales,
  nunca el índice del directorio.
- Ritmo: el precio y la demanda cada cinco minutos, las centrales una vez por
  hora nueva (nuevo intento cada diez minutos hasta que aparece). No se lee
  nada mientras el dispositivo no esté añadido, no haya ningún umbral y ningún
  panel muestre el widget.
- El mix cubre las centrales **conectadas a la red de transporte**: las
  importaciones y las pequeñas centrales conectadas a las redes locales (la
  mayor parte de la solar en tejados) no figuran.
- La intensidad de CO₂ es una **estimación** a partir del mix, con los
  factores medianos de ciclo de vida (IPCC 2014): nuclear 12, hidráulica 24,
  eólica 11, solar 45, biocombustibles 230, gas 490, otras 700 g/kWh.
- El mercado del IESO funciona en hora estándar del Este todo el año: la
  integración hace la conversión, también en horario de verano.
- Una cifra de más de 30 minutos (precio, demanda) o de 3 horas (mix) no se
  publica: mejor ningún valor que uno caducado. Un valor que no cambia se
  reenvía cada 6 horas.
- Los informes públicos no requieren clave y el IESO no indica ningún límite
  de consultas: aun así solo se leen al ritmo de su publicación, con un
  User-Agent honesto.

## Solución de problemas

- **Estado «no se puede leer»** en la configuración: los informes del IESO
  no responden o están en mantenimiento. La integración lo reintenta sola.
- **Ningún valor en el dispositivo**: añada el dispositivo en la pestaña
  Descubrir, espere un minuto o lance la acción de prueba.
- **Registros**: una línea cuando empieza un fallo y otra cuando termina.
  Para más detalle, configure `LOG_LEVEL=debug`.

## Créditos

Datos: [IESO](https://www.ieso.ca/power-data), informes públicos. Factores de
emisión: IPCC AR5 (2014), como Electricity Maps. Integración de guim31, sin
relación con el IESO.
