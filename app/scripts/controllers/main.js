'use strict';

app.controller('MainCtrl', function ($scope, $http, $filter, $timeout, ProjectService, ModelService, ProjectUtilities, CodeEditorService) {

  $scope.projectService = ProjectService;
  $scope.modelService = ModelService;
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
      } else {
        $scope.fileContents = "(No resources. Click 'New Resource' to create.)";
      }
    }
  }, true);


  //init
  ProjectService.importDocFromURL("http://petstore.swagger.wordnik.com/api/api-docs");

  $scope.removeFromArrayByIndex = function(arr, index) {
    arr.splice(index, 1);
  };

  $scope.removeFromObjectByKey = function(obj, key, kind) {
    delete(obj[key]);
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
      operation: closeOrToggle
    });

    ModelService.forEach({
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
