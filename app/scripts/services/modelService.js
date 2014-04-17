angular.module('swaggerEditorApp').factory('ModelService', function (ProjectUtilities) {

  var service = {
    allTypes: {},
    models: {},

    resetTypesAndModels: function() {
      service.allTypes = {};
      service.models = {};

      angular.extend(service.allTypes,
        { 'void': { type: 'void' } },
        ProjectUtilities.primitiveTypes,
        { 'File': { type: 'File' } }
      );

      ProjectUtilities.generateTypesAsArray(service.allTypes);

    },

    newProperty: function(requestedName, model) {
      var propName = ProjectUtilities.uniqueName(requestedName, model.properties);

      model.properties[propName] = {
        __name: requestedName,
        __storedName: propName,
        __friendlyType: 'integer',
        __order: Object.keys(model.properties).length + 1
      };
    },

    newModel: function(requestedName) {
      var modelName = ProjectUtilities.uniqueName(requestedName, service.models);

      service.models[modelName] = {
        id: modelName,
        __id: requestedName,
        properties: {}
      };

      service.allTypes[modelName] = {type: modelName};
      ProjectUtilities.generateTypesAsArray(service.allTypes);

      return modelName;
    },

    //used for creating or renaming a model type, updating dropdown, and calling updateTypesInFile
    createNewType: function (fileObj, newName, originalName, deleteOriginal) {
      service.allTypes[newName] = {type: newName};
      if (deleteOriginal) {
        delete(service.allTypes[originalName]);
      }
      ProjectUtilities.generateTypesAsArray(service.allTypes);
      ProjectUtilities.renameTypeInFile(fileObj, newName, originalName);
    },

    importTypesAndExtractModels: function(fileObj) {
      //used for operation.type and parameter.type
      var replaceTypeAndFormatWithFriendlyType = function(obj) {

        var getFriendlyTypeAndDeleteOriginal = function(obj) {
          var newName = null;

          for (var name in service.allTypes) {
            if (service.allTypes[name].type == obj.type &&
              service.allTypes[name].format == obj.format) {
              newName = name;
              break;
            }
          }
          if (!newName) {
            console.log("hmm no match for " + obj.type + ", " + obj.format);
          }
          delete(obj.type);
          delete(obj.format);

          return newName;
        };

        var originalType;

        if (obj.hasOwnProperty('items')) {
          if (obj.items.hasOwnProperty('type')) {
            originalType = obj.items.type;
            obj.__friendlyType = getFriendlyTypeAndDeleteOriginal(obj.items);
          } else {
            originalType = obj.items['$ref'];
            obj.__friendlyType = obj.items['$ref'];

            if (!service.allTypes.hasOwnProperty(obj.__friendlyType)) {
              obj.__friendlyType = null;
            }
          }
          obj.__array = true;
          delete(obj.type);
          delete(obj.items);
        } else if (obj.hasOwnProperty('$ref')) {
//          console.log("must be type: $ref");
          originalType = obj['$ref'];
//          console.log("originalType: " + originalType);
          obj.__friendlyType = obj['$ref'];
          if (!service.allTypes.hasOwnProperty(obj.__friendlyType)) {
            obj.__friendlyType = null;
          }
//          console.log("__friendlyType: " + obj.__friendlyType);
          delete(obj['$ref']);
        } else {
//          console.log("must be type: syntax");
//          console.log(obj);
          originalType = obj.type;
//          console.log("originalType: " + obj.type);
          obj.__friendlyType = getFriendlyTypeAndDeleteOriginal(obj);
//          console.log("__friendlyTYpe: " + obj.__friendlyType);
        }
//      console.log("originalType was " + originalType);
//      console.log("friendlyType is now " + obj.__friendlyType);
        if (obj.__friendlyType == null) {
//          console.log("friendlyType is null!");
          var newType = "Missing:" + originalType;
//          console.log("Referencing missing object: " + newType);
          obj.__friendlyType = newType;
          service.createNewType(fileObj, newType, originalType);
        }
      };

      //replace type and format with friendlyType
      ProjectUtilities.forEachItemInFile(fileObj, {
        operation: replaceTypeAndFormatWithFriendlyType,
        parameter: replaceTypeAndFormatWithFriendlyType,
        property: replaceTypeAndFormatWithFriendlyType
      });

      //define private properties and extract models from file
      ProjectUtilities.forEachItemInFile(fileObj, {
        model: function(model, modelName) {
          model.__id = model.id;
          var i = 1;
          Object.keys(model.properties).forEach(function(propertyName) {
            model.properties[propertyName].__name = propertyName;
            model.properties[propertyName].__storedName = propertyName;
            model.properties[propertyName].__order = i++;
          });

          if (model.hasOwnProperty('required')) {
            model.required.forEach(function (requiredName) {
              if (model.properties.hasOwnProperty(requiredName)) {
                model.properties[requiredName].__required = true;
              } else {
                console.log(modelName + " " + requiredName + " property is required but does not exist in model");
              }
            });
            delete (model.required);
          }

          //extract models from file
          service.allTypes[modelName] = {type: modelName};
          service.models[modelName] = angular.copy(fileObj.models[modelName]);
          delete fileObj.models[modelName];
        }
      });

      ProjectUtilities.generateTypesAsArray(service.allTypes);
    },

    forEach: function(callbacks) {
      Object.keys(service.models).forEach(function (modelName) {
        if (callbacks.hasOwnProperty('model')) {
          callbacks.model(service.models[modelName], modelName, service.models);
        }

        //if we haven't deleted the modelName key, check for properties
        //don't run forEachItemInFile with callback =  'model' and 'property'
        // if model may delete key prior to this
        if (service.models.hasOwnProperty(modelName)) {
          Object.keys(service.models[modelName].properties).forEach(function (propName) {
            if (callbacks.hasOwnProperty('property')) {
              callbacks.property(service.models[modelName].properties[propName], propName, service.models[modelName].properties);
            }
          });
        }
      });
    },

    //note: this doesn't rename the modelname inside ModelService.models itself
    renameTypeInModels: function(newName, originalName) {
      //rename type in every property in every model object
      service.forEach({
        property: function(property) {
          ProjectUtilities.renameType(property, newName, originalName);
        }
      });

      //rename type in types list (and dropdown)
      service.allTypes[newName] = {type: newName};
      delete(service.allTypes[originalName]);
      ProjectUtilities.generateTypesAsArray(service.allTypes);
    }
  };

  return service;
});