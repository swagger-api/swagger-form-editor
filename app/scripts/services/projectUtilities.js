angular.module('swaggerEditorApp').factory('ProjectUtilities', function () {

  var utilities = {
    primitiveTypes: {
      'integer': {type: 'integer'},
      'integer [int32]': {type: 'integer', format: 'int32'},
      'integer [int64]': {type: 'integer', format: 'int64'},
      'number': {type: 'number'},
      'number [float]': {type: 'number', format: 'float'},
      'number [double]': {type: 'number', format: 'double'},
      'string': {type: 'string'},
      'string [byte]': {type: 'string', format: 'byte'},
      'boolean': {type: 'boolean'},
      'string [date]': {type: 'string', format: 'date'},
      'string [date-time]': {type: 'string', format: 'date-time'}
    },
    typesAsArray: [],

    forEachItemInFile: function (fileObj, callbacks) {
      fileObj.apis.forEach(function (api, apiIndex, apis) {
        if (callbacks.hasOwnProperty('api')) {
          callbacks.api(api, apiIndex, apis);
        }
        api.operations.forEach(function (op, opIndex, ops) {
          if (callbacks.hasOwnProperty('operation')) {
            callbacks.operation(op, opIndex, ops, api, apiIndex, apis);
          }
          op.parameters.forEach(function (param, paramIndex, params) {
            if (callbacks.hasOwnProperty('parameter')) {
              callbacks.parameter(param, paramIndex, params);
            }
          });
        });
      });

      if (fileObj.models) {
        Object.keys(fileObj.models).forEach(function (modelName) {
          if (callbacks.hasOwnProperty('model')) {
            callbacks.model(fileObj.models[modelName], modelName, fileObj.models);
          }

          //if we haven't deleted the modelName key, check for properties
          //note to developers:
          // don't run forEachItemInFile with callback = 'property' if you're also
          // running callback = 'model' where you delete some models
          if (fileObj.models.hasOwnProperty(modelName)) {
            Object.keys(fileObj.models[modelName].properties).forEach(function (propName) {
              if (callbacks.hasOwnProperty('property')) {
                callbacks.property(fileObj.models[modelName].properties[propName], propName, fileObj.models[modelName].properties);
              }
            });
          }
        });
      }
    },

    uniqueName: function (name, obj) {
      if (obj.hasOwnProperty(name)) {
        console.log("duplicate detected");
        var randomName = name + (Math.random() * 1000 + "").substring(0, 5);
        return utilities.uniqueName(randomName, obj);
      } else {
        return name;
      }
    },

    generateTypesAsArray: function (allTypes) {
      var typesAsArray = [];
      for (var typeName in allTypes) {
        if (allTypes.hasOwnProperty(typeName)) {
          typesAsArray.push(typeName);
        }
      }

      utilities.typesAsArray = typesAsArray;
    },

    renameType: function (object, newName, originalName) {
      if (object.hasOwnProperty('__friendlyType') &&
        object.__friendlyType == originalName) {
//        console.log("renaming " + originalName + " to " + newName);
        object.__friendlyType = newName;
      }
    },

    //rename model across all parameters and operations
    renameTypeInFile: function (fileObj, newName, originalName) {
//      console.log("renameTypeInFile");
      utilities.forEachItemInFile(fileObj, {
        parameter: function(param) {
//          console.log("renaming " + originalName + " to " + newName + " for");
//          console.log(param);
          utilities.renameType(param, newName, originalName);
        },
        operation: function(op) {
//          console.log("renaming " + originalName + " to " + newName + " for");
//          console.log(op);
          utilities.renameType(op, newName, originalName);
        }
      });
    }
  };

  return utilities;
});