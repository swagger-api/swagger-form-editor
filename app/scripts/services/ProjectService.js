angular.module('swaggerEditorApp').factory('ProjectService', function (ModelService, ProjectUtilities, $timeout) {

  var service = {
    doc: null,
    files: [],
    remoteURL: "",


    importAndOpenDocFromURL: function(url, successFn, failFn) {
      var s = new SwaggerApi(url);
      s.specFromURL(url, function(doc) {
        if (doc.hasOwnProperty('apiDeclarations')) {
          doc = service.openDoc(url, doc);

          successFn(doc);
        } else {
          alert("[Open URL] Missing apiDeclarations.  This does not appear to be a valid project.");
          failFn(doc);
        }
      });
    },

    openDoc: function(url, originalDoc) {
      var doc = angular.copy(originalDoc);
      service.close();

      doc.apiDeclarations.forEach(function (file, i) {
        doc.apiDeclarations[i] = service.importFileObject(file);
      });

      $timeout(function() {
        service.doc = doc;
        service.files = service.doc.apiDeclarations;
        service.remoteURL = url;

      }, 0);

      return doc;
    },

    newDoc: function() {
      service.openDoc("Untitled", {
        apiVersion: "1.0.0",
        swaggerVersion: "1.2",
        apiDeclarations: []
      });
    },

    close: function() {
      ModelService.resetTypesAndModels();
      service.doc = null;
      service.files = [];
      service.remoteURL = "";
    },

    exportDoc: function(originalDoc) {
      var doc = angular.copy(originalDoc);

      console.log("inside exportDoc, we start with");
      console.log(doc.apiDeclarations[0].models);

      doc.apiDeclarations.forEach(function (file, i) {
        doc.apiDeclarations[i] = service.exportFileObject(file);
      });

      console.log("exported models");
      console.log(doc.apiDeclarations[0].models);

      return doc;
    },

    importFileObject: function(originalFileObj) {
      var fileObj = angular.copy(originalFileObj);
      ModelService.importTypesAndExtractModels(fileObj);

      //add a __path to each operation object, __id to model, and __name to each property object
      ProjectUtilities.forEachItemInFile(fileObj, {
        operation: function(op, opIndex, ops, api) {
          op.__path = api.path;
        }
      });

      return fileObj;
    },

    cleanUpFileObject: function(originalFileObj) {
      var fileObj = angular.copy(originalFileObj);

      var paramTypeChanged = function(parameter) {
        if (['query', 'header', 'path'].indexOf(parameter.paramType) > -1) {
          parameter.allowMultiple = parameter.allowMultiple || false;
        } else {
          delete (parameter.allowMultiple);
        }

        if (parameter.paramType == 'path') {
          parameter.required = true;
        }
      };

      //check if path changed or return type
      var checkIfOperationPropertiesChanged = function(op, opIndex, ops, api, apiIndex, apis) {
        if (op.__path !== api.path) {
          if (ops.length == 1) {
            //if the only operation in api, rename whole api
            //if api name conflict, will be merged later during cleanUpFileObject
            api.path = op.__path;
          } else {
            //otherwise, we have to create a new api below this api
            //and move this operation to there.  The new api
            // will later merge with existing api if necessary during cleanUpFileObject
            apis.splice(apiIndex + 1, 0, {
              path: op.__path,
              operations: [op]
            });
            ops.splice(opIndex, 1);
          }
        }
        if (op.__friendlyType == 'void') {
          delete(op.__array);
        }
      };

      //check if model properties changed
      var checkIfModelPropertiesChanged = function(model, modelName, models) {
        var renameKey = function(obj, newPropertyName, oldPropertyName) {
          obj[newPropertyName] = obj[oldPropertyName];
          delete obj[oldPropertyName];
        };

        /* used for model.id/__id or property.__storedName/__name to avoid duplicate keys in models/properties */
        var renameObjectKeyWithNewName = function(object, collection, newPropertyName, oldPropertyName) {
          var newName = object[newPropertyName];

          //does newName conflict?  Check based on type dropDown
          if (collection.hasOwnProperty(newName)) {
            //is known duplicate?
            if (object.__duplicate) {
              return object[oldPropertyName];
            } else {
              newName = ProjectUtilities.uniqueName(object[newPropertyName], collection);
              object.__duplicate = true;
            }
          } else {
            delete(object.__duplicate);
          }

          renameKey(collection, newName, object[oldPropertyName]);
          object[oldPropertyName] = newName;

          return newName;
        };

        //is the object name and user-typed object name different?
        if (model.id !== model.__id) {
          console.log("Model name changed");
          var originalName = model.id;
          var newName = renameObjectKeyWithNewName(model, models, '__id', 'id');

          if (originalName != newName) {
            service.renameModelAcrossProject(newName, originalName);
          }
        }

        /* check each property for new name */
        for (var propertyName in model.properties) {
          console.log(propertyName + " vs " + model.properties[propertyName].__name + " vs " + model.properties[propertyName].__storedName);
          if (propertyName !== model.properties[propertyName].__name) {
            var newName = renameObjectKeyWithNewName(model.properties[propertyName], model.properties, '__name', '__storedName');

            //update list of required properties
            if (model.hasOwnProperty('required')) {
              model.required.forEach(function(prop, i, requiredArray) {
                if (prop == propertyName) {
                  requiredArray[i] = newName;
                }
              });
            }
          }
        }
      };

      var mergeOperationsForDuplicateAPIsIntoOneAPI = function() {
        var mergeDuplicateItemsInArrayByKey = function(array, keyName, subArray) {
          var values = {};
          array.forEach(function (item, i) {
            values[item[keyName]] = values[item[keyName]] || [];
            values[item[keyName]].push(i);
          });

          if (array.length != Object.keys(values).length) {
            for (var name in values) {
              //if we have duplicates in array for given keyName
              if (values.hasOwnProperty(name) && values[name].length > 1) {
                //then for each duplicate,
                for (var i = 1; i < values[name].length; i++) {
                  //copy elements from duplicate's subarray to first one
                  array[values[name][0]][subArray] = array[values[name][0]][subArray].concat(array[values[name][i]][subArray]);
                  delete(array[values[name][i]]);
                }
              }
            }
            //clean up deleted elements
            for (var i = array.length; i >= 0; i--) {
              if (!array[i]) {
                array.splice(i, 1);
              }
            }
          }
        };
        mergeDuplicateItemsInArrayByKey(fileObj.apis, 'path', 'operations');
      };

      //trigger validations for each parameterType
      ProjectUtilities.forEachItemInFile(fileObj, {
        parameter: paramTypeChanged,
        operation: checkIfOperationPropertiesChanged
      });

      ModelService.forEach({
        model: checkIfModelPropertiesChanged
      });

      //merge methods with the same path into one
      mergeOperationsForDuplicateAPIsIntoOneAPI();

      return fileObj;
    },

    exportFileObject: function(originalFileObj, format) {
      console.log("inside export file object");
      var fileObj = angular.copy(originalFileObj);

      var revertBackToTypeAndFormat = function(obj) {
        var setTypeAndFormat = function(obj, friendlyType) {
          console.log(friendlyType);
          obj.type = ModelService.allTypes[friendlyType].type;
          if (ModelService.allTypes[friendlyType].hasOwnProperty('format')) {
            obj.format = ModelService.allTypes[friendlyType].format;
          }
        };

        if (obj.hasOwnProperty('__friendlyType')) {
          if (obj.hasOwnProperty('__array') && obj['__array']) {
            obj.type = 'array';
            //todo don't rely on capitalization to check if a model
            //check for existence in primitive types instead
            if (obj.__friendlyType[0] >= 'A' && obj.__friendlyType[0] <= 'Z') {
              obj.items = {'$ref': obj.__friendlyType};
            } else {
              obj.items = {};
              setTypeAndFormat(obj.items, obj.__friendlyType);
            }
          } else {
            setTypeAndFormat(obj, obj.__friendlyType);
          }
          delete(obj.__friendlyType);
        } else {
          console.log("Something went wrong. Expected to find and replace __friendlyType.")
        }
      };

      //insert models back into each file
      console.log("inserting models back into file object");
      //make sure models hash exists
      fileObj.models = {};

      ModelService.forEach({
        model: function(originalModel, modelName) {
          console.log("exporting model " + modelName);
          var model = angular.copy(originalModel);

          Object.keys(model.properties).forEach(function(propertyName) {
            if (model.properties[propertyName].__required) {
              model.required = model.required || [];
              model.required.push(propertyName);
            }
          });

          fileObj.models[modelName] = angular.copy(angular.copy(model));
        }
      });

      //replace friendlyType with correct type && format
      ProjectUtilities.forEachItemInFile(fileObj, {
        operation: revertBackToTypeAndFormat,
        parameter: revertBackToTypeAndFormat,
        property: revertBackToTypeAndFormat
      });

      //remove private properties
      ProjectUtilities.forEachItemInFile(fileObj, {
        operation: function(op) {
          delete(op.__path);
          delete(op.__open);
          delete(op.__array);
        },
        parameter: function(param) {
          delete(param.__changed);
        },
        model: function(model) {
          delete(model.__id);
          delete(model.__duplicate);
          delete(model.__open);
        },
        property: function(property) {
          delete(property.__array);
          delete(property.__order);
          delete(property.__name);
          delete(property.__storedName);
          delete(property.__duplicate);
          delete(property.__required);
        }
      });

      if (format == 'json') {
        return JSON.stringify(fileObj, null, 2);
      }
      return fileObj;
    },

    //update every mention of type in every file
    // (parameters, operations) and model (properties)? yes
    // dropdown (type list) ? yes
    // actually renames the modelname in ModelService.models?  no

    renameModelAcrossProject: function(newType, currentType) {
      for (var i = 0; i < service.files.length; i++) {
        ProjectUtilities.renameTypeInFile(service.files[i], newType, currentType);
      }
      ModelService.renameTypeInModels(newType, currentType);
    }
  };

  return service;
});