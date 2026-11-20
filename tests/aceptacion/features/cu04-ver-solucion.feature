# language: es
@CU-04
Característica: CU-04 Ver la solución de una librería
  Como desarrollador
  Quiero saber a qué versión actualizar cada librería vulnerable
  Para corregir el problema sin introducir otra vulnerabilidad

  Antecedentes:
    Dado que escaneé el proyecto "proyecto-demo"

  Esquema del escenario: DepScan recomienda una versión segura verificada
    Cuando abro la solución de "<libreria>"
    Entonces se recomienda actualizar a "<version>"

    Ejemplos:
      | libreria | version |
      | lodash   | 4.17.21 |
      | django   | 3.2.19  |
