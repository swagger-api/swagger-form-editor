'use strict';

app.controller('MainCtrl', function ($scope, $http, $filter, $timeout) {
  $scope.doc = null;
  $scope.files = [];
  $scope.activeIndex = 0;
  $scope.remoteURL = "";

  $scope.fileContents = "";

  $scope.methods = ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'];
  $scope.paramTypes = ['path', 'query', 'body', 'header', 'form'];

  var primitiveTypes = {
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
  };

  var allTypes = {};

  $scope.friendlyTypes = [];

  //listen for changes from ng-model in the rows on the left panel of the view
  $scope.$watch('doc', function(newValue) {
    if (newValue != null) {
      if ($scope.files.length > 0) {
        var file = cleanUpFileObject($scope.files[$scope.activeIndex]);

        //rename missing models to regular if found
        Object.keys(allTypes).forEach(function (key) {
          if (allTypes.hasOwnProperty("Missing:" + key)) {
            //rename missing to the real model name
            createNewType(file, key, "Missing:" + key, true);
            //update every file (technically already called for this file)
            for (var i = 0; i < $scope.files.length; i++) {
              updateTypesInFile($scope.files[i], key, "Missing:" + key);
            }
          }
        });

        $scope.files[$scope.activeIndex] = file;
        $scope.fileContents = exportFileObject($scope.files[$scope.activeIndex], 'json');
      } else {
        $scope.fileContents = "(No resources. Click 'New Resource' to create.)";
      }
    }
  }, true);


  var uniqueName = function(name, obj) {
    var randomName = name + (Math.random() * 1000 + "").substring(0, 5);
    if (obj.hasOwnProperty(randomName)) {
      console.log("duplicate detected");
      return uniqueName(name, obj);
    } else {
      return randomName;
    }
  };

  var forEachItemInFile = function (fileObj, callbacks) {
    fileObj.apis.forEach(function(api, apiIndex, apis) {
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

    if(fileObj.models) {
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
  };

  var updateHumanTypes = function() {
    var friendlyTypes = [];
    for (var typeName in allTypes) {
      if (allTypes.hasOwnProperty(typeName)) {
        friendlyTypes.push(typeName);
      }
    }

    $scope.friendlyTypes = friendlyTypes;
  };

  //used for creating or renaming a model type, updating dropdown, and calling updateTypesInFile
  var createNewType = function(fileObj, newName, originalName, deleteOriginal) {
    allTypes[newName] = {type: newName};
    if (deleteOriginal) {
      delete(allTypes[originalName]);
    }
    updateHumanTypes();
    updateTypesInFile(fileObj, newName, originalName);
  };

  //used for updating model name in types of all kinds
  var updateTypesInFile = function(fileObj, newName, originalName) {
    var updateType = function(object) {
      if (object.hasOwnProperty('__friendlyType') &&
        object.__friendlyType == originalName) {
        object.__friendlyType = newName;
      }
    };

    //update all saved types
    forEachItemInFile(fileObj, {
      parameter: function(parameter) { //parameter type
        updateType(parameter);
      },
      operation: function(op) { //return type
        updateType(op);
      },
      property: function(prop) { //model property type
        updateType(prop);
      }
    });
  };


  var importDocFromURL = function(url) {
    var s = new SwaggerApi(url);
    s.specFromURL(url, function(doc) {

      console.log("importing");
      console.log(doc);
      if (!doc.hasOwnProperty('apiDeclarations')) {
        alert("This does not appear to be a valid docs object");
        return;
      }

      allTypes = {};

      angular.extend(allTypes,
        { 'void': { type: 'void' } },
        primitiveTypes,
        { 'File': { type: 'File' } }
      );

      $scope.$apply(function() {
        doc.apiDeclarations.forEach(function (file, i) {
          doc.apiDeclarations[i] = importFileObject(file);

          //add model names to our allTypes list
          for (var modelName in file.models) {
            allTypes[modelName] = {type: modelName};
          }
        });
        $scope.doc = doc;
        $scope.files = $scope.doc.apiDeclarations;
        $scope.remoteURL = url;
      });
    });
  };

  //init
  importDocFromURL("http://petstore.swagger.wordnik.com/api/api-docs");

  var importFileObject = function(fileObj) {
    //used for operation.type and parameter.type
    var replaceTypeAndFormatWithFriendlyType = function(obj) {

      var getFriendlyTypeAndDeleteOriginal = function(obj) {
        var newName = null;

        for (var name in allTypes) {
          if (allTypes[name].type == obj.type &&
            allTypes[name].format == obj.format) {
            newName = name;
            break;
          }
        }
        if (!newName) {
          console.log("hmm no match for " + obj.type);
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

          if (!allTypes.hasOwnProperty(obj.__friendlyType)) {
            obj.__friendlyType = null;
          }
        }
        obj.__array = true;
        delete(obj.type);
        delete(obj.items);
      } else if (obj.hasOwnProperty('$ref')) {
        originalType = obj['$ref'];
        obj.__friendlyType = obj['$ref'];
        if (!allTypes.hasOwnProperty(obj.__friendlyType)) {
          obj.__friendlyType = null;
        }
        delete(obj['$ref']);
      } else {
        originalType = obj.type;
        obj.__friendlyType = getFriendlyTypeAndDeleteOriginal(obj);
      }
//      console.log("originalType was " + originalType);
//      console.log("friendlyType is now " + obj.__friendlyType);
      if (obj.__friendlyType == null) {
        var newType = "Missing:" + originalType;
        obj.__friendlyType = newType;
        createNewType(fileObj, newType, originalType);
      }

    };



    //replace type and format with friendlyType
    forEachItemInFile(fileObj, {
      operation: replaceTypeAndFormatWithFriendlyType,
      parameter: replaceTypeAndFormatWithFriendlyType
//      property: replaceTypeAndFormatWithFriendlyType
    });

    //replace type and format with friendlyType
    forEachItemInFile(fileObj, {
      property: replaceTypeAndFormatWithFriendlyType
    });

    //add a __path to each operation object, __id to model, and __name to each property object
    forEachItemInFile(fileObj, {
      operation: function(op, opIndex, ops, api) {
        op.__path = api.path;
      },
      model: function(model, modelName, models) {
        model.__id = model.id;
        var i = 1;
        for (var propertyName in model.properties) {
          model.properties[propertyName].__name = propertyName;
          model.properties[propertyName].__storedName = propertyName;
          model.properties[propertyName].__order = i++;
        }
      }
    });

    updateHumanTypes();

    return fileObj;
  };

  var cleanUpFileObject = function(originalFileObj) {
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

      /* great for model.id or property.name to avoid duplicates */
      var renameObjectKeyWithNewName = function(object, collection, newPropertyName, oldPropertyName) {
        var newName = object[newPropertyName];

        //does newName conflict?  Check based on type dropDown
        if (allTypes.hasOwnProperty(newName)) {
          //is known duplicate?
          if (object.__duplicate) {
            return object[oldPropertyName];
          } else {
            newName = uniqueName(object[newPropertyName], collection);
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
        var originalName = model.id;
        var newName = renameObjectKeyWithNewName(model, models, '__id', 'id');

        if (originalName != newName) {
          createNewType(fileObj, newName, originalName, true);

        }
      }

      /* check each property for new name */
      for (var propertyName in model.properties) {
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
    forEachItemInFile(fileObj, {
      parameter: paramTypeChanged,
      operation: checkIfOperationPropertiesChanged,
      model: checkIfModelPropertiesChanged
    });

    //merge methods with the same path into one
    mergeOperationsForDuplicateAPIsIntoOneAPI();
    return fileObj;
  };

  var exportFileObject = function(originalFileObj, format) {
    console.log("export");
    var fileObj = angular.copy(originalFileObj);

    var revertBackToTypeAndFormat = function(obj) {
      var setTypeAndFormat = function(obj, friendlyType) {
        console.log(friendlyType);
        obj.type = allTypes[friendlyType].type;
        if (allTypes[friendlyType].hasOwnProperty('format')) {
          obj.format = allTypes[friendlyType].format;
        }
      };

      if (obj.hasOwnProperty('__friendlyType')) {
        if (obj.hasOwnProperty('__array') && obj['__array']) {
          obj.type = 'array';

          if (obj.__friendlyType[0] >= 'A' && obj.__friendlyType[0] <= 'Z') {
            obj.items = {'$ref': obj.__friendlyType};
          } else {
            obj.items = {};
            setTypeAndFormat(obj.items, obj.__friendlyType);
          }
          delete(obj.__array);
        } else {
          setTypeAndFormat(obj, obj.__friendlyType);
        }
        delete(obj.__friendlyType);
      } else {
        console.log("Something went wrong. Expected to find and replace __friendlyType.")
      }
    };

    //replace friendlyType with correct type && format
    forEachItemInFile(fileObj, {
      operation: revertBackToTypeAndFormat,
      parameter: revertBackToTypeAndFormat,
      property: revertBackToTypeAndFormat
    });

    //remove private properties
    forEachItemInFile(fileObj, {
      operation: function(op) {
        delete(op.__path);
        delete(op.__open);
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
        delete(property.__order);
        delete(property.__name);
        delete(property.__storedName);
        delete(property.__duplicate);
      }
    });

    if (format == 'json') {
      return JSON.stringify(fileObj, null, 2);
    }
    return fileObj;
  };

  $scope.removeFromArrayByIndex = function(arr, index) {
    arr.splice(index, 1);
  };

  $scope.removeFromObjectByKey = function(obj, key, kind) {
    delete(obj[key]);

    if (kind == 'model') {
      createNewType($scope.files[$scope.activeIndex], "Missing:" + key, key, true);
    }
  };

  $scope.newParameter = function(parameters) {
    parameters.push(          {
      "name": "(name)",
      "description": "(description)",
      "defaultValue": "",
      "required": false,
      "__friendlyType": "integer",
      "paramType": "path",
      "allowMultiple": false,
      "__changed": true
    });
  };

  $scope.headingClicked = function(obj, event) {
    if (!obj.__open) {
      obj.__open = true;
    } else if (event.target.className == 'heading') {
      obj.__open = false;
    }
  };

  $scope.newOperationAfterIndex = function(api, opIndex) {
    api.operations.splice(opIndex + 1, 0, {
//      __class: "new",
      "method": "GET",
      "summary": "(summary)",
      "nickname": "(nickname)",
      "parameters": [],
      "__friendlyType": "void",
      "__path": api.path,
      "__open": true
    });
  };


  $scope.newAPI = function(apis, index) {
    var paths = {};
    apis.forEach(function(api) {
      paths[api.path] = true;
    });

    var newPath = uniqueName($scope.files[$scope.activeIndex].resourcePath + '/', paths);

    apis.splice(index, 0, {
      "path": newPath,
      "operations": []
    });
  };

  $scope.newModel = function(models) {
    var newModelName = 'Model' + (Math.random() * 1000 + "").substring(0, 5);

    models[newModelName] = {
      id: newModelName,
      __id: newModelName,
      properties: {},
      __open: true
    };

    allTypes[newModelName] = {type: newModelName};
    updateHumanTypes();
  };

  $scope.newProperty = function(properties) {
    var newPropertyName = 'prop' + (Math.random() * 1000 + "").substring(0, 5);

    properties[newPropertyName] = {
      __name: newPropertyName,
      __storedName: newPropertyName,
      __friendlyType: 'integer',
      __order: Object.keys(properties).length + 1
    };
  };

  $scope.errorsForObject = function(object) {
    if (object.__duplicate) {
      return "[Error] Duplicate definition: '" + object.__id + "' already exists.";
    }
    return "";
  };

  $scope.clickTab = function(index) {
    $scope.activeIndex = index;
    $scope.fileContents = exportFileObject($scope.files[$scope.activeIndex], 'json');
  };

  $scope.deleteResource = function(index) {
    //delete each model in resource
    forEachItemInFile($scope.files[$scope.activeIndex], {
      model: function(model, modelName, models) {
        $scope.deleteModel(models, model);
      }
    });

    $scope.files.splice(index, 1);

    if ($scope.files.length > 0 && $scope.activeIndex > $scope.files.length - 1) {
      $scope.clickTab($scope.activeIndex > 0 ? $scope.activeIndex - 1 : 0);
    }
  };

  $scope.deleteModel = function(models, model) {
    delete(models[model.id]);
    createNewType($scope.files[$scope.activeIndex], "Missing:" + model.id, model.id, true);
  };

  $scope.openInSwaggerUI = function () {
    var doc = angular.copy($scope.doc);
    //replace each resource with exported version (removes internal properties)
    doc.apiDeclarations.forEach(function(resource, i) {
      doc.apiDeclarations[i] = exportFileObject(resource);
    });
    window.data = doc;
    window.open('views/swagger.html', '_swagger');
  };

  $scope.replaceURL = function() {
    var url = prompt("Please enter new url", $scope.remoteURL);
    if (url) {
      importDocFromURL(url);
    }
  };

  $scope.newResource = function() {
    var resources = {};
    $scope.files.forEach(function(file) {
      resources[file.resourcePath] = true;
    });

    var newName = uniqueName("/new", resources);
    $scope.files.push({
      "apiVersion": "1.0.0",
      "swaggerVersion": "1.2",
      "basePath": "http://petstore.swagger.wordnik.com/api",
      "resourcePath": newName,
      "produces": [
        "application/json"
      ],
      "apis": [],
      "models": {}
    });
    $scope.activeIndex = $scope.files.length - 1;
  };
});
