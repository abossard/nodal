module.exports = (function() {
  'use strict';

  const fs = require('fs-extra');
  const path = require('path');
  const inquirer = require('inquirer');
  const inflect = require('i')();
  const colors = require('colors/safe');
  const async = require('async');

  return {
    new: function(args, flags, callback) {
      const rootPath = path.resolve(__dirname);
      const version = require('../../../package.json').version;

      console.log('');
      console.log(`Welcome to ${colors.bold.green('Nodal! v' + version)}`);
      console.log('');

      let data = {
        name: args[0] ? (args[0][0] || '').replace(/_/g, ' ') : '',
        author: (flags.author || '').replace(/_/g, ' ') || '',
        heroku: flags.hasOwnProperty('heroku'),
        ignoreOutput: flags.hasOwnProperty('ignore-output')
      };

      let questions = [];

      !data.name && questions.push({
        name: 'name',
        type: 'input',
        default: 'my-nodal-project',
        message: 'Name',
      });

      !data.author && questions.push({
        name: 'author',
        type: 'input',
        default: 'mysterious author',
        message: 'Author',
      });

      inquirer.prompt(questions, (promptResult) => {

        promptResult.name = promptResult.name || data.name;
        promptResult.author = promptResult.author || data.author;
        promptResult.heroku = promptResult.heroku || data.heroku;

        promptResult.simpleName = promptResult.name.replace(/\s/gi, '-');

        promptResult.databaseName = inflect.underscore(promptResult.simpleName);

        promptResult.version = require('../../../package.json').version;

        let dirname = promptResult.name.replace(/[^A-Za-z0-9-_]/gi, '-').toLowerCase();

        console.log('Creating directory "' + dirname + '"...');
        console.log('');

        if (fs.existsSync('./' + dirname)) {
          callback(new Error('Directory "' + dirname + '" already exists, try a different project name'));
        }

        fs.mkdirSync('./' + dirname);

        console.log('Copying Nodal directory structure and files...');
        console.log('');

        fs.copy(rootPath + '/../../../src', './' + dirname, function(err) {

          if (err) return callback(err);

          let dot = require('dot');

          dot.templateSettings.strip = false;
          dot.templateSettings.varname = 'data';

          fs.writeFileSync('./' + dirname + '/package.json', dot.template(
            fs.readFileSync(rootPath + '/templates/package.json.jst').toString()
          )(promptResult));

          if (promptResult.heroku) {
            fs.writeFileSync('./' + dirname + '/app.json', dot.template(
              fs.readFileSync(rootPath + '/templates/app.json.jst').toString()
            )(promptResult));
          }

          fs.writeFileSync('./' + dirname + '/app/controllers/index_controller.js', dot.template(
            fs.readFileSync(rootPath + '/templates/index_controller.jst').toString()
          )(promptResult));

          fs.writeFileSync('./' + dirname + '/README.md', dot.template(
            fs.readFileSync(rootPath + '/templates/README.md.jst').toString()
          )(promptResult));

          // read in the dbjson template, replace the development database name
          // generate new config/db.json in the generated app
          // NOTE: The db.json is intentionally not conditionally wrapped based
          // on DB support since if users want to enable it later, worse case it
          // defaults to an underscored version  <appname>_development
          let dbjson = JSON.parse(fs.readFileSync(rootPath + '/templates/db.json'));
          dbjson.development.main.database = promptResult.databaseName + '_development';
          dbjson.test.main.database = promptResult.databaseName + '_test';
          fs.writeFileSync('./' + dirname + '/config/db.json', JSON.stringify(dbjson, null, 2));

          let copyNodeModules = [
            'cli', 'core', 'test', 'node_modules',
            'package.json'
          ];

          async.series(
            copyNodeModules.map(m => {
              return (callback) => {

                console.log(`Copying ${m}...`);
                fs.copy(
                      path.join(rootPath, '..','..','..', m),
                      path.join(process.cwd(), dirname, 'node_modules', 'nodal', m),
                      callback);

              };
            }),
            (err) => {

              if (err) {
                callback(err);
              }

              if (!data.ignoreOutput) {
                console.log('');
                console.log(colors.bold.green('All done!'));
                console.log('');
                console.log('Your new Nodal project, ' + colors.bold(promptResult.name) + ', is ready to go! :)');
                console.log('');
                console.log('Have fun ' + promptResult.author + ', and check out https://github.com/keithwhor/nodal for the most up-to-date Nodal information')
                console.log('');
                console.log(colors.bold('Pro tip: ') + 'You can try running your server right away with:');
                console.log('');
                console.log('  cd ' + dirname + ' && nodal s');
                console.log('');
              }

              callback(null);

            }
          );

        });

      });
    }
  };

})();
