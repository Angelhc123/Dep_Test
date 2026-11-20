# language: es
@CU-01
Característica: CU-01 Revisar un proyecto subiendo sus archivos
  Como desarrollador
  Quiero subir los manifiestos de mi proyecto
  Para saber qué librerías tienen vulnerabilidades conocidas

  Esquema del escenario: El semáforo refleja el riesgo del proyecto
    Dado que estoy en la página "Nuevo escaneo"
    Cuando subo los archivos del proyecto "<proyecto>"
    Y presiono "Escanear"
    Entonces veo el semáforo "<semaforo>"
    Y veo "<vulnerables>" dependencias vulnerables

    Ejemplos:
      | proyecto        | semaforo     | vulnerables |
      | proyecto-demo   | Riesgo alto  | 2 / 3       |
      | proyecto-python | Riesgo alto  | 1 / 1       |
      | proyecto-seguro | Sin riesgo relevante | 0 / 1 |

  Escenario: No se puede escanear sin archivos
    Dado que estoy en la página "Nuevo escaneo"
    Entonces el botón "Escanear" está deshabilitado
