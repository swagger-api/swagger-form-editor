'use strict';

app.controller('MainCtrl', function ($scope, $http, $filter, $timeout) {
  $scope.items = ['/path1', '/path2'];
  $scope.file = null;
  $scope.fileContents = "";
  $http.get('/data/pet-data.json').success(function(obj) {
    importFileObject(obj);
  });

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

  $scope.paramTypeChanged = function(parameter) {
    if (['query', 'header', 'path'].indexOf(parameter.paramType) > -1) {
      parameter.allowMultiple = parameter.allowMultiple || false;
    } else {
      delete (parameter.allowMultiple);
    }

    if (parameter.paramType == 'path') {
      parameter.required = true;
    }
  };

  var forEachItemInFile = function (fileObj, callbacks) {
    fileObj.apis.forEach(function(api) {
      if (callbacks.hasOwnProperty('api')) {
        callbacks.api(api);
      }
      api.operations.forEach(function (op) {
        if (callbacks.hasOwnProperty('operation')) {
          callbacks.operation(op);
        }
        op.parameters.forEach(function (param) {
          if (callbacks.hasOwnProperty('parameter')) {
            callbacks.parameter(param);
          }
        });
      });
    });
  };

  var importFileObject = function(fileObj) {
    allTypes = {};

    angular.extend(allTypes,
      { 'void': { type: 'void' } },
      primitiveTypes,
      { 'File': { type: 'File' } }
    );

    //add model names to our allTypes list
    for (var model in fileObj.models) {
      allTypes[model] = {type: model};
    }

    //used for operation.type and parameter.type
    var replaceTypeAndFormatWithFriendlyType = function(obj) {
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
      } else {
        obj.__friendlyType = newName;
      }
      delete(obj.type);
      delete(obj.format);
    };

    //replace type and format with friendlyType
    forEachItemInFile(fileObj, {
      operation: replaceTypeAndFormatWithFriendlyType,
      parameter: replaceTypeAndFormatWithFriendlyType
    });

    //trigger validations for each parameterType
    forEachItemInFile(fileObj, {
      parameter: $scope.paramTypeChanged
    });
    
    //update human-readable types
    var friendlyTypes = [];
    for (var typeName in allTypes) {
      if (allTypes.hasOwnProperty(typeName)) {
        friendlyTypes.push(typeName);
      }
    }

    $scope.friendlyTypes = friendlyTypes;
    $scope.file = fileObj;
    $scope.fileContents = $filter('json')(fileObj);

  };

  var exportJSON = function(originalFileObj) {
    var fileObj = angular.copy(originalFileObj);

    var revertBackToTypeAndFormat = function(obj) {
      if (obj.hasOwnProperty('__friendlyType')) {
        obj.type = allTypes[obj.__friendlyType].type;
        if (allTypes[obj.__friendlyType].hasOwnProperty('format')) {
          obj.format = allTypes[obj.__friendlyType].format;
        }
        delete(obj.__friendlyType);
      } else {
        console.log("Something went wrong. Expected to find and replace __friendlyType.")
      }
    };

    //replace friendlyType with correct type && format
    forEachItemInFile(fileObj, {
      operation: revertBackToTypeAndFormat,
      parameter: revertBackToTypeAndFormat
    });

    $scope.fileContents = $filter('json')(fileObj);
  };

  //listen for changes from ng-model in the rows on the left panel of the view
  $scope.$watch('file', function(newValue) {
    if (newValue != null) {
      exportJSON(newValue);
    }
  }, true);


//  $timeout(function() {
//    window.swagger = new SwaggerApi({
//      url: "http://petstore.swagger.wordnik.com/api/api-docs",
//      success: function () {
//        if (swagger.ready === true) {
//          // upon connect, fetch a pet and set contents to element "mydata"
////          swagger.apis.pet.getPetById({petId: 1}, function (data) {
////            console.log(data.content.data);
////          });
//          console.log(swagger);
//        }
//      }
//    });
//  }, 1000);
});
