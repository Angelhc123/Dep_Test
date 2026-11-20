// Generated from: tests\aceptacion\features\cu04-ver-solucion.feature
import { test } from "playwright-bdd";

test.describe('CU-04 Ver la solución de una librería', () => {

  test.beforeEach('Antecedentes', async ({ Given, page }, testInfo) => { if (testInfo.error) return;
    await Given('que escaneé el proyecto "proyecto-demo"', null, { page }); 
  });
  
  test.describe('DepScan recomienda una versión segura verificada', () => {

    test('Ejemplos: #1', { tag: ['@CU-04'] }, async ({ When, Then, page }) => { 
      await When('abro la solución de "lodash"', null, { page }); 
      await Then('se recomienda actualizar a "4.17.21"', null, { page }); 
    });

    test('Ejemplos: #2', { tag: ['@CU-04'] }, async ({ When, Then, page }) => { 
      await When('abro la solución de "django"', null, { page }); 
      await Then('se recomienda actualizar a "3.2.19"', null, { page }); 
    });

  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('tests\\aceptacion\\features\\cu04-ver-solucion.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":12,"pickleLine":17,"tags":["@CU-04"],"steps":[{"pwStepLine":7,"gherkinStepLine":9,"keywordType":"Context","textWithKeyword":"Dado que escaneé el proyecto \"proyecto-demo\"","isBg":true,"stepMatchArguments":[{"group":{"start":24,"value":"\"proyecto-demo\"","children":[{"start":25,"value":"proyecto-demo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":13,"gherkinStepLine":12,"keywordType":"Action","textWithKeyword":"Cuando abro la solución de \"lodash\"","stepMatchArguments":[{"group":{"start":20,"value":"\"lodash\"","children":[{"start":21,"value":"lodash","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":14,"gherkinStepLine":13,"keywordType":"Outcome","textWithKeyword":"Entonces se recomienda actualizar a \"4.17.21\"","stepMatchArguments":[{"group":{"start":27,"value":"\"4.17.21\"","children":[{"start":28,"value":"4.17.21","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":17,"pickleLine":18,"tags":["@CU-04"],"steps":[{"pwStepLine":7,"gherkinStepLine":9,"keywordType":"Context","textWithKeyword":"Dado que escaneé el proyecto \"proyecto-demo\"","isBg":true,"stepMatchArguments":[{"group":{"start":24,"value":"\"proyecto-demo\"","children":[{"start":25,"value":"proyecto-demo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":18,"gherkinStepLine":12,"keywordType":"Action","textWithKeyword":"Cuando abro la solución de \"django\"","stepMatchArguments":[{"group":{"start":20,"value":"\"django\"","children":[{"start":21,"value":"django","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":19,"gherkinStepLine":13,"keywordType":"Outcome","textWithKeyword":"Entonces se recomienda actualizar a \"3.2.19\"","stepMatchArguments":[{"group":{"start":27,"value":"\"3.2.19\"","children":[{"start":28,"value":"3.2.19","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end