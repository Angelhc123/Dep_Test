// Generated from: tests\aceptacion\features\cu01-revisar-proyecto.feature
import { test } from "playwright-bdd";

test.describe('CU-01 Revisar un proyecto subiendo sus archivos', () => {

  test.describe('El semáforo refleja el riesgo del proyecto', () => {

    test('Ejemplos: #1', { tag: ['@CU-01'] }, async ({ Given, When, Then, And, page }) => { 
      await Given('que estoy en la página "Nuevo escaneo"', null, { page }); 
      await When('subo los archivos del proyecto "proyecto-demo"', null, { page }); 
      await And('presiono "Escanear"', null, { page }); 
      await Then('veo el semáforo "Riesgo alto"', null, { page }); 
      await And('veo "2 / 3" dependencias vulnerables', null, { page }); 
    });

    test('Ejemplos: #2', { tag: ['@CU-01'] }, async ({ Given, When, Then, And, page }) => { 
      await Given('que estoy en la página "Nuevo escaneo"', null, { page }); 
      await When('subo los archivos del proyecto "proyecto-python"', null, { page }); 
      await And('presiono "Escanear"', null, { page }); 
      await Then('veo el semáforo "Riesgo alto"', null, { page }); 
      await And('veo "1 / 1" dependencias vulnerables', null, { page }); 
    });

    test('Ejemplos: #3', { tag: ['@CU-01'] }, async ({ Given, When, Then, And, page }) => { 
      await Given('que estoy en la página "Nuevo escaneo"', null, { page }); 
      await When('subo los archivos del proyecto "proyecto-seguro"', null, { page }); 
      await And('presiono "Escanear"', null, { page }); 
      await Then('veo el semáforo "Sin riesgo relevante"', null, { page }); 
      await And('veo "0 / 1" dependencias vulnerables', null, { page }); 
    });

  });

  test('No se puede escanear sin archivos', { tag: ['@CU-01'] }, async ({ Given, Then, page }) => { 
    await Given('que estoy en la página "Nuevo escaneo"', null, { page }); 
    await Then('el botón "Escanear" está deshabilitado', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('tests\\aceptacion\\features\\cu01-revisar-proyecto.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":8,"pickleLine":17,"tags":["@CU-01"],"steps":[{"pwStepLine":9,"gherkinStepLine":9,"keywordType":"Context","textWithKeyword":"Dado que estoy en la página \"Nuevo escaneo\"","stepMatchArguments":[{"group":{"start":23,"value":"\"Nuevo escaneo\"","children":[{"start":24,"value":"Nuevo escaneo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":10,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"Cuando subo los archivos del proyecto \"proyecto-demo\"","stepMatchArguments":[{"group":{"start":31,"value":"\"proyecto-demo\"","children":[{"start":32,"value":"proyecto-demo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":11,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"Y presiono \"Escanear\"","stepMatchArguments":[{"group":{"start":9,"value":"\"Escanear\"","children":[{"start":10,"value":"Escanear","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":12,"gherkinStepLine":12,"keywordType":"Outcome","textWithKeyword":"Entonces veo el semáforo \"Riesgo alto\"","stepMatchArguments":[{"group":{"start":16,"value":"\"Riesgo alto\"","children":[{"start":17,"value":"Riesgo alto","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":13,"gherkinStepLine":13,"keywordType":"Outcome","textWithKeyword":"Y veo \"2 / 3\" dependencias vulnerables","stepMatchArguments":[{"group":{"start":4,"value":"\"2 / 3\"","children":[{"start":5,"value":"2 / 3","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":16,"pickleLine":18,"tags":["@CU-01"],"steps":[{"pwStepLine":17,"gherkinStepLine":9,"keywordType":"Context","textWithKeyword":"Dado que estoy en la página \"Nuevo escaneo\"","stepMatchArguments":[{"group":{"start":23,"value":"\"Nuevo escaneo\"","children":[{"start":24,"value":"Nuevo escaneo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":18,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"Cuando subo los archivos del proyecto \"proyecto-python\"","stepMatchArguments":[{"group":{"start":31,"value":"\"proyecto-python\"","children":[{"start":32,"value":"proyecto-python","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":19,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"Y presiono \"Escanear\"","stepMatchArguments":[{"group":{"start":9,"value":"\"Escanear\"","children":[{"start":10,"value":"Escanear","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":20,"gherkinStepLine":12,"keywordType":"Outcome","textWithKeyword":"Entonces veo el semáforo \"Riesgo alto\"","stepMatchArguments":[{"group":{"start":16,"value":"\"Riesgo alto\"","children":[{"start":17,"value":"Riesgo alto","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":21,"gherkinStepLine":13,"keywordType":"Outcome","textWithKeyword":"Y veo \"1 / 1\" dependencias vulnerables","stepMatchArguments":[{"group":{"start":4,"value":"\"1 / 1\"","children":[{"start":5,"value":"1 / 1","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":24,"pickleLine":19,"tags":["@CU-01"],"steps":[{"pwStepLine":25,"gherkinStepLine":9,"keywordType":"Context","textWithKeyword":"Dado que estoy en la página \"Nuevo escaneo\"","stepMatchArguments":[{"group":{"start":23,"value":"\"Nuevo escaneo\"","children":[{"start":24,"value":"Nuevo escaneo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":26,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"Cuando subo los archivos del proyecto \"proyecto-seguro\"","stepMatchArguments":[{"group":{"start":31,"value":"\"proyecto-seguro\"","children":[{"start":32,"value":"proyecto-seguro","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":27,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"Y presiono \"Escanear\"","stepMatchArguments":[{"group":{"start":9,"value":"\"Escanear\"","children":[{"start":10,"value":"Escanear","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":28,"gherkinStepLine":12,"keywordType":"Outcome","textWithKeyword":"Entonces veo el semáforo \"Sin riesgo relevante\"","stepMatchArguments":[{"group":{"start":16,"value":"\"Sin riesgo relevante\"","children":[{"start":17,"value":"Sin riesgo relevante","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":29,"gherkinStepLine":13,"keywordType":"Outcome","textWithKeyword":"Y veo \"0 / 1\" dependencias vulnerables","stepMatchArguments":[{"group":{"start":4,"value":"\"0 / 1\"","children":[{"start":5,"value":"0 / 1","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":34,"pickleLine":21,"tags":["@CU-01"],"steps":[{"pwStepLine":35,"gherkinStepLine":22,"keywordType":"Context","textWithKeyword":"Dado que estoy en la página \"Nuevo escaneo\"","stepMatchArguments":[{"group":{"start":23,"value":"\"Nuevo escaneo\"","children":[{"start":24,"value":"Nuevo escaneo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":36,"gherkinStepLine":23,"keywordType":"Outcome","textWithKeyword":"Entonces el botón \"Escanear\" está deshabilitado","stepMatchArguments":[{"group":{"start":9,"value":"\"Escanear\"","children":[{"start":10,"value":"Escanear","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end