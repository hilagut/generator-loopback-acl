'use strict';
var yeoman = require('yeoman-generator');
var async = require('async');
var fs = require('fs-extra');

var wsModels = require('loopback-workspace').models;
var ModelAccessControl = wsModels.ModelAccessControl;

var actions = require('../lib/actions');
var helpers = require('../lib/helpers');


module.exports = yeoman.generators.Base.extend({
  // NOTE(bajtos)
  // This generator does not track file changes via yeoman,
  // as loopback-workspace is editing (modifying) files when
  // saving project changes.

  help: function() {
    return helpers.customHelp(this);
  },
  init: function(){
      this.mfpHelperMethod = function(method, path){
        var modelConfig = fs.readJsonSync(this.modelDefinition.configFile);
        var pluralModel = modelConfig.plural;
        pluralModel = pluralModel || this.modelName+"s";
		var config = fs.readJsonSync(path, {throws: false});
		//console.log("config is: "+JSON.stringify(config));
		//console.log("config loopback-mfp element: "+config['loopback-mfp']);
		if (!config['loopback-mfp']){
			config['loopback-mfp'] = {};
		}
		
		config['loopback-mfp'].publicKeyServerUrl = config['loopback-mfp'].publicKeyServerUrl || this.mfpServer;
		var route = "/api/"+pluralModel;
		if (this.property) {
			route+="/"+this.property;
		}
		
		var authRealm = {'authRealm': this.mfpScope};
		//console.log("authRealm: "+JSON.stringify(authRealm));
		//console.log("method: "+method);
		var methodJson = {};
		methodJson[method] = authRealm;
		//console.log("method: "+JSON.stringify(methodJson));
		var newRoute = {};
		newRoute[route] = methodJson;
		//console.log("newRoute: "+JSON.stringify(newRoute));
		if (config['loopback-mfp'].routes){
			if (config['loopback-mfp'].routes[route]) {
				if (config['loopback-mfp'].routes[route][method]) {
					if (config['loopback-mfp'].routes[route][method].authRealm) {
						config['loopback-mfp'].routes[route][method].authRealm += " "+this.mfpScope;
					}
					else {
						config['loopback-mfp'].routes[route][method].authRealm = this.mfpScope;
					}
				}
				else {
					config['loopback-mfp'].routes[route][method] = authRealm;
				}
			}
			else {
				config['loopback-mfp'].routes[route]=methodJson;
			}
		}
		else {
			config['loopback-mfp'].routes= newRoute;
		}
		
		//console.log("new config is: "+JSON.stringify(config));
		fs.writeJsonSync(path, config);
      };
 
  },

  loadProject: actions.loadProject,

  loadModels: actions.loadModels,

  loadAccessTypeValues: function() {
    var done = this.async();
    ModelAccessControl.getAccessTypes(function(err, list) {
      this.accessTypeValues = list;
      done(err);
    }.bind(this));
  },

  loadRoleValues: function() {
    var done = this.async();
    ModelAccessControl.getBuiltinRoles(function(err, list) {
      this.roleValues = list;
      done(err);
    }.bind(this));
  },

  loadPermissionValues: function() {
    var done = this.async();
    ModelAccessControl.getPermissionTypes(function(err, list) {
      this.permissionValues = list;
      done(err);
    }.bind(this));
  },

  askForModel: function() {
    var done = this.async();
    
    var modelChoices =
      [{ name: '(all existing models)', value: null }]
      .concat(this.modelNames);

    var prompts = [
      {
        name: 'model',
        message: 'Select the model to apply the ACL entry to:',
        type: 'list',
        default: 0,
        choices: modelChoices
      }
    ];

    this.prompt(prompts, function(answers) {
      this.modelName = answers.model;
      if (this.modelName) {
        this.modelDefinition = this.projectModels.filter(function(m) {
          return m.name === answers.model;
        })[0];
      }
      //console.log("config: "+this.modelDefinition.configFile);
      done();
    }.bind(this));

  },

  askForParameters: function() {
    var done = this.async();

    var prompts = [
      {
        name: 'scope',
        message: 'Select the ACL scope:',
        type: 'list',
        default: 'all',
        choices: [
          { name: 'All methods and properties', value: 'all' },
          { name: 'A single method', value: 'method' },
          // not supported by loopback yet
          { name: 'A single property (READ, WRITE)', value: 'property' }
        ]
      },
       {
        name: 'permission',
        message: 'Select the permission to apply',
        type: 'list',
        choices: this.permissionValues.concat(['MFP']),
      },
      {
          //this is for non mfp stuff... 
        name: 'method',
        message: 'Enter method name',
        when: function(answers) {
          return answers.scope === 'method' && answers.permission !== 'MFP';
        }
      },
      {
        name: 'method',
        message: 'Choose a built in method or choose other to enter custom method',
        type: 'list', 
        choices: [
            {name: 'Find', value: 'find'},
            {name: 'Find by ID', value: 'findbyid'}, 
            {name: 'Find if entry exists', value: 'exists'}, 
            {name: 'Find first entry that matches', value: 'findone'}, 
            {name: 'Count entries', value: 'count'}, 
            {name: 'Check whether model instance exists', value: 'headexists'},
            {name: 'Create entry', value: 'create'}, 
            {name: 'Update all entries', value: 'updateall'}, 
            {name: 'Create change-stream', value: 'createchangestream'},
            {name: 'Get change-stream', value: 'getchangestream'},
            {name: 'Insert entry', value: 'upsert'}, 
            {name: 'Update entry', value: 'updateattributes'}, 
            {name: 'Delete entry', value: 'deletebyid'}, 
            
        ].concat(['Other']),
        when: function(answers) {
          return answers.permission === 'MFP' && answers.scope === 'method' && answers.method !== 'Other';
        }
      },
       {
        name: 'method',
        message:
          'Enter the method name:',
        when: function(answers) {
          return answers.permission === 'MFP' && answers.method === 'Other';
        }
      },
      {
        name: 'property',
        message: 'Choose the property name', //other not implemented yet. only read and write. execute also not implemented yet. 
        type: 'list', 
        choices: [
            {name: 'READ', value: 'READ'}, 
            {name: 'WRITE', value: 'WRITE'}
        ],
        when: function(answers) {
          return answers.scope === 'property';
        }
      },
      {
        name: 'accessType',
        message: 'Select the access type:',
        type: 'list',
        default: '*',
        when: function(answers) {
          return answers.scope === 'all';
        },
        choices: this.accessTypeValues,
      },
      {
        name: 'role',
        message: 'Select the role',
        type: 'list',
        default: '$everyone',
        choices: this.roleValues.concat(['other']),
      },
      {
        name: 'customRole',
        message:
          'Enter the role name:',
        when: function(answers) {
          return answers.role === 'other';
        }
      },
    //   {
    //     name: 'permission',
    //     message: 'Select the permission to apply',
    //     type: 'list',
    //     choices: this.permissionValues.concat(['MFP']),
    //   },
        {
        name: 'mfpScope',
        message: 'Please enter the MFP security permission (scope):',
        type: 'string',
        default: "SampleAppRealm",
        store: true,
        when: function(answers) {
          return answers.permission === 'MFP';
        }
        },
        {
        name: 'mfpServer',
        message: 'Please enter the MFP server url:',
        type: 'string',
        default: "http://localhost:10080/FormBasedAuth-release71",
        store: true,
        when: function(answers) {
          return answers.permission === 'MFP';
        }
        }
    ];
    this.prompt(prompts, function(answers) {
      // this is when the type is an entire property (read, write, execute) and MFP -- at the moment
      //if(answers.permission === 'MFP' && answers.scope === 'property'){
          //something here? 
          var methods = []; 
          console.log("what is property: " + answers.property); 
          console.log("what is method: " + answers.method); //the problem is that it already decides what its going to write down here!
          if(answers.property === 'READ' && answers.method === undefined){
              console.log("in property read");
              //var read_methods 
              methods= ['find','findbyid', 'findone', 'count' ];
              //methods.concat(read_methods); 
          }else if(answers.property === 'WRITE' && answers.method === undefined){
              console.log("in property write");
              //var write_methods 
              methods = ['create', 'updateattributes', 'upsert', 'destroybyid', 'update'];
              //methods.concat(write_methods);
          }else if(answers.methods !== undefined && answers.property === undefined){
              console.log("in method not property");
              methods.push(answers.method); 
          }
          console.log("length: " + methods.length);
          for(var i=0; i<methods.length; i++){

              console.log('prop_method: ' + methods[i]);
        
            this.accessType='EXECUTE';
            this.scope = answers.scope;
            this.method = methods[i];
            this.mfpServer = answers.mfpServer;
            this.mfpScope = answers.mfpScope;
            this.property = '';
            this.aclDef = {
                property: '',//answers.property,
                accessType: this.accessType,
                principalType: 'ROLE', // TODO(bajtos) support all principal types
                principalId: answers.customRole || answers.role,
                permission: answers.permission
            }; 
            
            if (this.aclDef.permission == 'MFP') {
                this.mfpHelperMethod(this.method, "server/component-config.json");
                //this.mfpHelperMethod(this.method, "../auth-server/server/component-config.json");
	        }
            
            else if (this.aclDef.permission != 'MFP') {
                //console.log("in acl");
                var done = this.async();

                var aclDef = this.aclDef;
                var filter = this.modelName ?
                { where: { name: this.modelName }, limit: 1 } :
                {} /* all models, force refresh */;

                wsModels.ModelDefinition.find(filter, function(err, models) {
                    console.log("model: "+models);
                if (err) {
                    return done(err);
                }

                var firstError = true;
                async.eachSeries(models, function(model, cb) {
                    //console.log("model: "+model);
                    model.accessControls.create(aclDef, function(err) {
                    if (err && firstError) {
                        helpers.reportValidationError(err);
                        firstError = false;
                    }
                    cb(err);
                    });
                }, done);
                });
              }
          }
  
  }.bind(this));
  
  },
  
//   mfpGeneration: function() {
// 	var done = this.async();
// 	if (this.aclDef.permission == 'MFP') {
//         this.mfpHelperMethod(this.method, "server/component-config.json");
//         //this.mfpHelperMethod(this.method, "../auth-server/server/component-config.json");
        
// 	}
//     done();
//   },
  
//   acl: function() {
//     if (this.aclDef.permission != 'MFP') {
// 	//console.log("in acl");
//     var done = this.async();

//     var aclDef = this.aclDef;
//     var filter = this.modelName ?
//       { where: { name: this.modelName }, limit: 1 } :
//     {} /* all models, force refresh */;

//     wsModels.ModelDefinition.find(filter, function(err, models) {
//         console.log("model: "+models);
//       if (err) {
//         return done(err);
//       }

//       var firstError = true;
//       async.eachSeries(models, function(model, cb) {
//           //console.log("model: "+model);
//         model.accessControls.create(aclDef, function(err) {
//           if (err && firstError) {
//             helpers.reportValidationError(err);
//             firstError = false;
//           }
//           cb(err);
//         });
//       }, done);
//     });
// 	}
//   },

  saveProject: actions.saveProject
});