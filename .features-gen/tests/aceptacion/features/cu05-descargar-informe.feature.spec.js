// Generated from: tests\aceptacion\features\cu05-descargar-informe.feature
import { test } from "playwright-bdd";

test.describe('CU-05 Descargar el informe', () => {

  test('Descargar el informe en HTML', { tag: ['@CU-05'] }, async ({ Given, When, Then, page }) => { 
    await Given('que escaneé el proyecto "proyecto-demo"', null, { page }); 
    await When('descargo el informe "HTML"', null, { page }); 
    await Then('obtengo un archivo ".html" que menciona "4.17.21"'); 
  });

  test('Descargar el informe en PDF', { tag: ['@CU-05'] }, async ({ Given, When, Then, page }) => { 
    await Given('que escaneé el proyecto "proyecto-demo"', null, { page }); 
    await When('descargo el informe "PDF"', null, { page }); 
    await Then('obtengo un archivo ".pdf" válido'); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('tests\\aceptacion\\features\\cu05-descargar-informe.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":8,"tags":["@CU-05"],"steps":[{"pwStepLine":7,"gherkinStepLine":9,"keywordType":"Context","textWithKeyword":"Dado que escaneé el proyecto \"proyecto-demo\"","stepMatchArguments":[{"group":{"start":24,"value":"\"proyecto-demo\"","children":[{"start":25,"value":"proyecto-demo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":8,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"Cuando descargo el informe \"HTML\"","stepMatchArguments":[{"group":{"start":20,"value":"\"HTML\"","children":[{"start":21,"value":"HTML","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":9,"gherkinStepLine":11,"keywordType":"Outcome","textWithKeyword":"Entonces obtengo un archivo \".html\" que menciona \"4.17.21\"","stepMatchArguments":[{"group":{"start":19,"value":"\".html\"","children":[{"start":20,"value":".html","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"},{"group":{"start":40,"value":"\"4.17.21\"","children":[{"start":41,"value":"4.17.21","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":12,"pickleLine":13,"tags":["@CU-05"],"steps":[{"pwStepLine":13,"gherkinStepLine":14,"keywordType":"Context","textWithKeyword":"Dado que escaneé el proyecto \"proyecto-demo\"","stepMatchArguments":[{"group":{"start":24,"value":"\"proyecto-demo\"","children":[{"start":25,"value":"proyecto-demo","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":14,"gherkinStepLine":15,"keywordType":"Action","textWithKeyword":"Cuando descargo el informe \"PDF\"","stepMatchArguments":[{"group":{"start":20,"value":"\"PDF\"","children":[{"start":21,"value":"PDF","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":15,"gherkinStepLine":16,"keywordType":"Outcome","textWithKeyword":"Entonces obtengo un archivo \".pdf\" válido","stepMatchArguments":[{"group":{"start":19,"value":"\".pdf\"","children":[{"start":20,"value":".pdf","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
]; // bdd-data-end