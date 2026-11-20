# language: es
@CU-05
Característica: CU-05 Descargar el informe
  Como docente o jefe de proyecto
  Quiero descargar el resultado del escaneo
  Para archivarlo o adjuntarlo como evidencia

  Escenario: Descargar el informe en HTML
    Dado que escaneé el proyecto "proyecto-demo"
    Cuando descargo el informe "HTML"
    Entonces obtengo un archivo ".html" que menciona "4.17.21"

  Escenario: Descargar el informe en PDF
    Dado que escaneé el proyecto "proyecto-demo"
    Cuando descargo el informe "PDF"
    Entonces obtengo un archivo ".pdf" válido
