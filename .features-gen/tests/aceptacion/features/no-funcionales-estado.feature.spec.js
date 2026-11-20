// Generated from: tests\aceptacion\features\no-funcionales-estado.feature
import { test } from "playwright-bdd";

test.describe('Telemetría visible para el administrador', () => {

  test('Un escaneo nuevo aparece en la telemetría', { tag: ['@no-funcional'] }, async ({ Given, When, Then, And, page }) => { 
    await Given('que escaneé el proyecto "proyecto-demo"', null, { page }); 
    await When('abro la página "Estado"', null, { page }); 
    await Then('veo el panel "Estado del sistema"', null, { page }); 
    await And('la telemetría registra al menos 1 escaneo con riesgo alto', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('tests\\aceptacion\\features\\no-funcionales-estado.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":8,"tags":["@no-funcional"],"steps":[{"pwStepLine":7,"gherkinStepLine":9,"keywordType":"Context","textWithKeyword":"Dado que escaneé el proyecto \"proyecto-demo\"","stepMatchArguments":[{"group":{"start":24,"value":"\"proyecto-demo\"","children":[{"start":25,"value":"proyecto-demo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"Cuando abro la página \"Estado\"","stepMatchArguments":[{"group":{"start":15,"value":"\"Estado\"","children":[{"start":16,"value":"Estado","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":9,"gherkinStepLine":11,"keywordType":"Outcome","textWithKeyword":"Entonces veo el panel \"Estado del sistema\"","stepMatchArguments":[{"group":{"start":13,"value":"\"Estado del sistema\"","children":[{"start":14,"value":"Estado del sistema","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":10,"gherkinStepLine":12,"keywordType":"Outcome","textWithKeyword":"Y la telemetría registra al menos 1 escaneo con riesgo alto","stepMatchArguments":[{"group":{"start":32,"value":"1"},"parameterTypeName":"int"}]}]},
]; // bdd-data-end