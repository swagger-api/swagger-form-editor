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
          //don't run forEachItemInFile with callback =  'model' and 'property'
          // if model may delete key prior to this
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
      var randomName = name + (Math.random() * 1000 + "").substring(0, 5);
      if (obj.hasOwnProperty(randomName)) {
        console.log("duplicate detected");
        return this(name, obj);
      } else {
        return randomName;
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

    //used for updating model name in types of all kinds
    updateTypesInFile: function (fileObj, newName, originalName) {
      var updateType = function (object) {
        if (object.hasOwnProperty('__friendlyType') &&
          object.__friendlyType == originalName) {
          object.__friendlyType = newName;
        }
      };

      //update all saved types
      utilities.forEachItemInFile(fileObj, {
        parameter: function (parameter) { //parameter type
          updateType(parameter);
        },
        operation: function (op) { //return type
          updateType(op);
        },
        property: function (prop) { //model property type
          updateType(prop);
        }
      });
    }
  };

  return utilities;
});