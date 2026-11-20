# language: es
@no-funcional
Característica: Telemetría visible para el administrador
  Como administrador del servicio
  Quiero ver el estado del sistema en vivo
  Para saber si DepScan responde bien y cuánto se usa

  Escenario: Un escaneo nuevo aparece en la telemetría
    Dado que escaneé el proyecto "proyecto-demo"
    Cuando abro la página "Estado"
    Entonces veo el panel "Estado del sistema"
    Y la telemetría registra al menos 1 escaneo con riesgo alto
