// Generated from: tests\aceptacion\features\cu08-historial.feature
import { test } from "playwright-bdd";

test.describe('CU-08 Consultar y eliminar revisiones del historial', () => {

  test('La revisión queda en mi historial', { tag: ['@CU-08'] }, async ({ Given, When, Then, page }) => { 
    await Given('que escaneé el proyecto "proyecto-demo"', null, { page }); 
    await When('abro el "Historial"', null, { page }); 
    await Then('veo la revisión "proyecto-demo" en la lista', null, { page }); 
  });

  test('Otra persona no ve mi historial', { tag: ['@CU-08'] }, async ({ Given, When, Then, browser, page }) => { 
    await Given('que escaneé el proyecto "proyecto-demo"', null, { page }); 
    await When('otra persona abre el "Historial" en su navegador', null, { browser }); 
    await Then('su historial está vacío'); 
  });

  test('Eliminar una revisión pide confirmación', { tag: ['@CU-08'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('que escaneé el proyecto "proyecto-seguro"', null, { page }); 
    await And('abro el "Historial"', null, { page }); 
    await When('elimino la revisión "proyecto-seguro" y confirmo', null, { page }); 
    await Then('ya no veo la revisión "proyecto-seguro" en la lista', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('tests\\aceptacion\\features\\cu08-historial.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":8,"tags":["@CU-08"],"steps":[{"pwStepLine":7,"gherkinStepLine":9,"keywordType":"Context","textWithKeyword":"Dado que escaneé el proyecto \"proyecto-demo\"","stepMatchArguments":[{"group":{"start":24,"value":"\"proyecto-demo\"","children":[{"start":25,"value":"proyecto-demo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"Cuando abro el \"Historial\"","stepMatchArguments":[{"group":{"start":8,"value":"\"Historial\"","children":[{"start":9,"value":"Historial","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":9,"gherkinStepLine":11,"keywordType":"Outcome","textWithKeyword":"Entonces veo la revisión \"proyecto-demo\" en la lista","stepMatchArguments":[{"group":{"start":16,"value":"\"proyecto-demo\"","children":[{"start":17,"value":"proyecto-demo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":12,"pickleLine":13,"tags":["@CU-08"],"steps":[{"pwStepLine":13,"gherkinStepLine":14,"keywordType":"Context","textWithKeyword":"Dado que escaneé el proyecto \"proyecto-demo\"","stepMatchArguments":[{"group":{"start":24,"value":"\"proyecto-demo\"","children":[{"start":25,"value":"proyecto-demo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":14,"gherkinStepLine":15,"keywordType":"Action","textWithKeyword":"Cuando otra persona abre el \"Historial\" en su navegador","stepMatchArguments":[{"group":{"start":21,"value":"\"Historial\"","children":[{"start":22,"value":"Historial","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":15,"gherkinStepLine":16,"keywordType":"Outcome","textWithKeyword":"Entonces su historial está vacío","stepMatchArguments":[]}]},
  {"pwTestLine":18,"pickleLine":18,"tags":["@CU-08"],"steps":[{"pwStepLine":19,"gherkinStepLine":19,"keywordType":"Context","textWithKeyword":"Dado que escaneé el proyecto \"proyecto-seguro\"","stepMatchArguments":[{"group":{"start":24,"value":"\"proyecto-seguro\"","children":[{"start":25,"value":"proyecto-seguro","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":20,"gherkinStepLine":20,"keywordType":"Context","textWithKeyword":"Y abro el \"Historial\"","stepMatchArguments":[{"group":{"start":8,"value":"\"Historial\"","children":[{"start":9,"value":"Historial","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":21,"gherkinStepLine":21,"keywordType":"Action","textWithKeyword":"Cuando elimino la revisión \"proyecto-seguro\" y confirmo","stepMatchArguments":[{"group":{"start":20,"value":"\"proyecto-seguro\"","children":[{"start":21,"value":"proyecto-seguro","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":22,"gherkinStepLine":22,"keywordType":"Outcome","textWithKeyword":"Entonces ya no veo la revisión \"proyecto-seguro\" en la lista","stepMatchArguments":[{"group":{"start":22,"value":"\"proyecto-seguro\"","children":[{"start":23,"value":"proyecto-seguro","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end