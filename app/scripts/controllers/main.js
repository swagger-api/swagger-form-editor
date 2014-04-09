'use strict';

app.controller('MainCtrl', function ($scope, $http, $filter, $timeout, ProjectService, ProjectUtilities, CodeEditorService) {

  $scope.projectService = ProjectService;
  $scope.projectUtilities = ProjectUtilities;
  $scope.activeIndex = 0;
  $scope.fileContents = "";

  $scope.methods = ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'];
  $scope.paramTypes = ['path', 'query', 'body', 'header', 'form'];

  var editor = null;

  $scope.editorLoaded = function(_editor) {
    editor = _editor;
  };

  $scope.editorChanged = function() {
    console.log("CHANGED");
  };

  //listen for changes from ng-model in the rows on the left panel of the view
  $scope.$watch('projectService.doc', function(newValue) {
    if (newValue != null) {
      if (ProjectService.files.length > 0) {
        var file = cleanUpFileObject(ProjectService.files[$scope.activeIndex]);

        //rename missing models to regular if found
        Object.keys(ProjectService.allTypes).forEach(function (key) {
          if (ProjectService.allTypes.hasOwnProperty("Missing:" + key)) {
            //rename missing to the real model name
            ProjectService.createNewType(file, key, "Missing:" + key, true);
            //update every file (technically already called for this file)
            for (var i = 0; i < ProjectService.files.length; i++) {
              ProjectUtilities.updateTypesInFile(ProjectService.files[i], key, "Missing:" + key);
            }
          }
        });

        ProjectService.files[$scope.activeIndex] = file;
        $scope.fileContents = exportFileObject(ProjectService.files[$scope.activeIndex], 'json');
        CodeEditorService.highlightBlocksInFile(ProjectService.files[$scope.activeIndex], editor);

      } else {
        $scope.fileContents = "(No resources. Click 'New Resource' to create.)";
      }
    }
  }, true);


  //init
  ProjectService.importDocFromURL("http://petstore.swagger.wordnik.com/api/api-docs");

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
        if (ProjectService.allTypes.hasOwnProperty(newName)) {
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
        var originalName = model.id;
        var newName = renameObjectKeyWithNewName(model, models, '__id', 'id');

        if (originalName != newName) {
          ProjectService.createNewType(fileObj, newName, originalName, true);

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
    ProjectUtilities.forEachItemInFile(fileObj, {
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
        obj.type = ProjectService.allTypes[friendlyType].type;
        if (ProjectService.allTypes[friendlyType].hasOwnProperty('format')) {
          obj.format = ProjectService.allTypes[friendlyType].format;
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
      ProjectService.createNewType(ProjectService.files[$scope.activeIndex], "Missing:" + key, key, true);
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
    if (event.target.className == 'heading' || !obj.__open) {
      closeAllHeadings(ProjectService.files[$scope.activeIndex], obj);
    }
  };

  var closeAllHeadings = function(fileObj, objToToggle) {
    var closeOrToggle = function(obj) {
      if (objToToggle && obj == objToToggle && !objToToggle.__open) {
        obj.__open = true;
      } else {
        delete(obj.__open);
      }
    };

    ProjectUtilities.forEachItemInFile(fileObj, {
      operation: closeOrToggle,
      model: closeOrToggle
    });
  };

  $scope.newOperationAfterIndex = function(api, opIndex) {
    var newIndex = typeof(opIndex) == 'undefined' ? 0 : opIndex + 1;
    api.operations.splice(newIndex, 0, {
//      __class: "new",
      "method": "GET",
      "summary": "(summary)",
      "nickname": "(nickname)",
      "parameters": [],
      "__friendlyType": "void",
      "__path": api.path
    });

    closeAllHeadings(ProjectService.files[$scope.activeIndex], api.operations[newIndex]);
  };


  $scope.newAPI = function(apis, index) {
    var paths = {};
    apis.forEach(function(api) {
      paths[api.path] = true;
    });

    var newPath = ProjectUtilities.uniqueName(ProjectService.files[$scope.activeIndex].resourcePath + '/', paths);

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
      properties: {}
    };

    closeAllHeadings(ProjectService.files[$scope.activeIndex], models[newModelName]);

    ProjectService.allTypes[newModelName] = {type: newModelName};
    ProjectUtilities.generateTypesAsArray(ProjectService.allTypes);
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
    $scope.fileContents = exportFileObject(ProjectService.files[$scope.activeIndex], 'json');

    CodeEditorService.highlightBlocksInFile(ProjectService.files[$scope.activeIndex], editor);
  };

  $scope.deleteResource = function(index) {
    //delete each model in resource
    ProjectUtilities.forEachItemInFile(ProjectService.files[$scope.activeIndex], {
      model: function(model, modelName, models) {
        $scope.deleteModel(models, model);
      }
    });

    ProjectService.files.splice(index, 1);

    if (ProjectService.files.length > 0 && $scope.activeIndex > ProjectService.files.length - 1) {
      $scope.clickTab($scope.activeIndex > 0 ? $scope.activeIndex - 1 : 0);
    }
  };

  $scope.deleteModel = function(models, model) {
    delete(models[model.id]);
    ProjectService.createNewType(ProjectService.files[$scope.activeIndex], "Missing:" + model.id, model.id, true);
  };

  $scope.openInSwaggerUI = function () {
    var doc = angular.copy(ProjectService.doc);
    //replace each resource with exported version (removes internal properties)
    doc.apiDeclarations.forEach(function(resource, i) {
      doc.apiDeclarations[i] = exportFileObject(resource);
    });
    window.data = doc;
    window.open('views/swagger.html', '_swagger');
  };

  $scope.replaceURL = function() {
    var url = prompt("Please enter new url", ProjectService.remoteURL);
    if (url) {
      ProjectService.importDocFromURL(url);
    }
  };

  $scope.newResource = function() {
    var resources = {};
    ProjectService.files.forEach(function(file) {
      resources[file.resourcePath] = true;
    });

    var newName = ProjectUtilities.uniqueName("/new", resources);
    ProjectService.files.push({
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
    $scope.activeIndex = ProjectService.files.length - 1;
  };
});
