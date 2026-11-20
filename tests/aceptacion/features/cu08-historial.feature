# language: es
@CU-08
Característica: CU-08 Consultar y eliminar revisiones del historial
  Como visitante sin cuenta
  Quiero que mis revisiones queden guardadas en mi sesión
  Para volver a consultarlas sin que otras personas las vean

  Escenario: La revisión queda en mi historial
    Dado que escaneé el proyecto "proyecto-demo"
    Cuando abro el "Historial"
    Entonces veo la revisión "proyecto-demo" en la lista

  Escenario: Otra persona no ve mi historial
    Dado que escaneé el proyecto "proyecto-demo"
    Cuando otra persona abre el "Historial" en su navegador
    Entonces su historial está vacío

  Escenario: Eliminar una revisión pide confirmación
    Dado que escaneé el proyecto "proyecto-seguro"
    Y abro el "Historial"
    Cuando elimino la revisión "proyecto-seguro" y confirmo
    Entonces ya no veo la revisión "proyecto-seguro" en la lista
