'use strict';

app.controller('MainCtrl', function ($scope, $http, $filter, $timeout, WorkspaceService, ProjectService, ModelService, ProjectUtilities, CodeEditorService) {
  $scope.workspaceService = WorkspaceService;
  $scope.projectService = ProjectService;
  $scope.modelService = ModelService;
  $scope.projectUtilities = ProjectUtilities;

  $scope.activeIndex = 0;
  $scope.fileContents = "";

  $scope.projectDropdownVisible = false;

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

        //rename missing models to regular if found
        Object.keys(ModelService.allTypes).forEach(function (key) {
          if (ModelService.allTypes.hasOwnProperty("Missing:" + key)) {
            //update every file, model, and types list for dropdown
            ProjectService.renameModelAcrossProject(key, "Missing:" + key);
          }
        });

        var file = ProjectService.cleanUpFileObject(ProjectService.files[$scope.activeIndex]);
        ProjectService.files[$scope.activeIndex] = file;
        $scope.fileContents = ProjectService.exportFileObject(ProjectService.files[$scope.activeIndex], 'json');
        CodeEditorService.highlightBlocksInFile(ProjectService.files[$scope.activeIndex], editor);

      } else {
        $scope.fileContents = "(No resources. Click 'New Resource' to create.)";
      }
    } else {
      $scope.fileContents = "(No project selected.\nClick 'New', 'Open URL', or select a project from the history dropdown.)";
    }
  }, true);

  //listen for changes to models
  $scope.$watch('modelService.models', function(newValue) {
    if (newValue != null) {
      if (ProjectService.files.length > 0) {

        var file = ProjectService.cleanUpFileObject(ProjectService.files[$scope.activeIndex]);
        ProjectService.files[$scope.activeIndex] = file;
        $scope.fileContents = ProjectService.exportFileObject(ProjectService.files[$scope.activeIndex], 'json');
        CodeEditorService.highlightBlocksInFile(ProjectService.files[$scope.activeIndex], editor);
      }
    }
  }, true);

  //init
  WorkspaceService.openMostRecentProject();
//  WorkspaceService.openFromURL();
//  WorkspaceService.new();
//
//  $http.get('/data/pet-data.json').success(function(data) {
//    console.log(data);
//    ProjectService.doc.apiDeclarations.push(data);
//    ProjectService.doc.apiDeclarations.push(data);
//    ProjectService.open(ProjectService.doc, 'PetStore', WorkspaceService.project);
//  });

  $scope.removeFromArrayByIndex = function(arr, index) {
    arr.splice(index, 1);
  };

  $scope.removeFromObjectByKey = function(obj, key, kind) {
    delete(obj[key]);
  };

  $scope.newParameter = function(parameters) {
    parameters.push(          {
      "name": "",
      "description": "",
      "defaultValue": "",
      "required": false,
      "__friendlyType": "integer",
      "paramType": "path",
      "allowMultiple": false,
      "__changed": true
    });
  };

  $scope.headingClicked = function(obj, event) {
    if (event.target.className == 'heading open' || !obj.__open) {
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

    if (fileObj) {
      ProjectUtilities.forEachItemInFile(fileObj, {
        operation: closeOrToggle
      });
    }

    ModelService.forEach({
      model: closeOrToggle
    });
  };

  $scope.newOperationAfterIndex = function(api, opIndex) {
    var newIndex = typeof(opIndex) == 'undefined' ? 0 : opIndex + 1;
    api.operations.splice(newIndex, 0, {
//      __class: "new",
      "method": "GET",
      "summary": "",
      "nickname": "",
      "notes": "",
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

  $scope.newModel = function() {
    ModelService.newModel('Model');
    closeAllHeadings(ProjectService.files[$scope.activeIndex]);
  };

  $scope.newProperty = function(model) {
    ModelService.newProperty('prop', model);
  };

  $scope.errorsForObject = function(object) {
    if (object.__duplicate) {
      var definition = object.__id || object.__name;
      return "[Error] Duplicate definition: '" + definition + "' already exists.";
    }
    return "";
  };

  $scope.clickTab = function(index) {
    $scope.activeIndex = index;
    $scope.fileContents = ProjectService.exportFileObject(ProjectService.files[$scope.activeIndex], 'json');

    CodeEditorService.highlightBlocksInFile(ProjectService.files[$scope.activeIndex], editor);
  };

  //rename resource
  $scope.doubleClickTab = function(index) {
    var currentName = ProjectService.files[index].resourcePath;
    var requestedName = prompt("[Rename resource] Please enter a new resource name, or click Cancel.", currentName);

    while (requestedName) {
      if (requestedName && requestedName != currentName) {
        if (requestedName[0] != "/") {
          requestedName = "/" + requestedName;
        }
        var newName = requestedName.match(/\/[a-zA-Z0-9]{1,}/);
        if (newName) {
          newName = newName[0].toLowerCase();
        }

        if (newName == requestedName) {
          var duplicate = false;
          ProjectService.files.forEach(function(file) {
            if (file.resourcePath == newName) {
              duplicate = true;
            }
          });

          if (duplicate) {
            requestedName = prompt("[Rename resource] Sorry, that name is already taken.  Please make changes, or click Cancel to keep " + currentName + ".", requestedName);
          } else {
            ProjectService.files[index].resourcePath = newName;
            ProjectUtilities.forEachItemInFile(ProjectService.files[index], {
              operation: function(op) {
                op.__path = op.__path.toLowerCase().replace(currentName, newName);
              }
            });
            requestedName = null;
          }
        } else {
          requestedName = prompt("[Rename resource] Sorry, that name is invalid.  Please make changes, or click Cancel to keep " + currentName + ".", requestedName);
        }
      } else {
        requestedName = null;
      }

    }
  };

  $scope.deleteResource = function(index) {
    //delete each model in resource
    ProjectUtilities.forEachItemInFile(ProjectService.files[$scope.activeIndex], {
      model: function(model, modelName, models) {
        $scope.deleteModel(models, model);
      }
    } );

    ProjectService.files.splice(index, 1);

    if (ProjectService.files.length > 0 && $scope.activeIndex > ProjectService.files.length - 1) {
      $scope.clickTab($scope.activeIndex > 0 ? $scope.activeIndex - 1 : 0);
    }
  };

  $scope.deleteModel = function(models, model) {
    delete(models[model.id]);
    ModelService.createNewType(ProjectService.files[$scope.activeIndex], "Missing:" + model.id, model.id, true);
  };

  $scope.openInSwaggerUI = function () {
    var doc = angular.copy(ProjectService.doc);
    //replace each resource with exported version (removes internal properties)
    doc.apiDeclarations.forEach(function(resource, i) {
      doc.apiDeclarations[i] = ProjectService.exportFileObject(resource);
    });
    window.data = doc;
    window.open('views/swagger.html', '_swagger');
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

  $scope.clickProjectInHistory = function(index) {
    $scope.projectDropdownVisible = false;
    WorkspaceService.openFromHistory(index);
  }
});
